/**
 * @file BackupService.js
 * Layer: Application Service Layer / Infrastructure Orchestration
 * 
 * Responsibility:
 * - Production-grade database backup orchestrator for DazzlingDB.
 * - Creates point-in-time snapshots of all database category spreadsheets.
 * - Generates structured JSON manifests for auditability.
 * - Enforces retention policies (retaining up to 30 snapshots with oldest-first eviction).
 * - Dispatches transactional execution summary emails via MailApp.
 */

/**
 * Maximum number of backup snapshots retained before oldest-first purge.
 * @constant {number}
 */
const MAX_BACKUP_RETENTION = 30;

const BackupService = {
  /**
   * Primary Backup Orchestrator.
   * Copies all category spreadsheets from source database root into a timestamped snapshot directory.
   * 
   * @param {Object} [options={}] - Backup configuration options.
   * @param {string} [options.targetFolderId] - Google Drive folder ID for backup root. Defaults to sibling 'DazzlingDB_Backups'.
   * @param {string} [options.sourceFolderId] - Source database root folder ID override. Defaults to active environment folder.
   * @param {string} [options.label] - Optional alphanumeric label appended to the snapshot folder name.
   * @param {Array<string>} [options.excludeCategories] - Category names to exclude from backup (e.g. ['Attendance']).
   * @param {string} [options.notifyEmail] - Target email for backup summary. Defaults to active session user email.
   * @returns {Object} Structured BackupReport.
   * @throws {BackupError} Non-recoverable infrastructure failure (e.g., target folder inaccessible).
   */
  createSnapshot: function (options = {}) {
    const startTime = Date.now();
    console.log("[BackupService] ==========================================");
    console.log("[BackupService] Initializing Database Snapshot Sequence...");
    console.log(`[BackupService] Execution Options: ${JSON.stringify(options)}`);

    // 1. Resolve Source Database Directory
    const sourceFolderId = BackupService._resolveSourceFolder(options.sourceFolderId);
    console.log(`[BackupService] Source Database Root: '${sourceFolderId}'`);

    // 2. Resolve Target Backup Parent Directory
    const targetParentFolder = BackupService._resolveTargetFolder(options.targetFolderId, sourceFolderId);
    console.log(`[BackupService] Target Backup Parent: '${targetParentFolder.getName()}' (${targetParentFolder.getId()})`);

    // 3. Create Timestamped Snapshot Subfolder
    const timestampStr = BackupService._generateTimestamp();
    const cleanLabel = options.label ? `_${String(options.label).trim().replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
    const snapshotFolderName = `BKP_${timestampStr}${cleanLabel}`;
    
    let snapshotFolder;
    try {
      snapshotFolder = targetParentFolder.createFolder(snapshotFolderName);
      console.log(`[BackupService] Created Snapshot Folder: '${snapshotFolderName}' (${snapshotFolder.getId()})`);
    } catch (createFolderErr) {
      throw new BackupError(`Failed to create snapshot directory '${snapshotFolderName}' in parent folder: ${createFolderErr.message}`, {
        parentFolderId: targetParentFolder.getId(),
        error: createFolderErr.message
      });
    }

    // 4. Discover Source Database Spreadsheets
    const excludeSet = new Set(Array.isArray(options.excludeCategories) ? options.excludeCategories.map(c => String(c).trim().toLowerCase()) : []);
    let sourceFiles = [];
    try {
      sourceFiles = BackupService._discoverSourceFiles(sourceFolderId);
      console.log(`[BackupService] Discovered ${sourceFiles.length} database file(s) in source root.`);
    } catch (fsErr) {
      throw new BackupError(`Failed to inspect source database directory [${sourceFolderId}]: ${fsErr.message}`, {
        sourceFolderId,
        error: fsErr.message
      });
    }

    if (sourceFiles.length === 0) {
      console.warn(`[BackupService] Warning: Zero spreadsheet files discovered in source directory [${sourceFolderId}].`);
    }

    // 5. Execute Sequential Copy Loop (Per-file fault tolerance)
    const fileResults = [];
    let succeededCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    sourceFiles.forEach((fileMeta, index) => {
      const fileName = fileMeta.name;
      const fileLower = fileName.toLowerCase();

      if (excludeSet.has(fileLower)) {
        console.log(`[BackupService] [${index + 1}/${sourceFiles.length}] Skipping excluded category: '${fileName}'`);
        skippedCount++;
        fileResults.push({
          name: fileName,
          status: "SKIPPED",
          source_id: fileMeta.id,
          copy_id: null,
          duration_ms: 0,
          error: null
        });
        return;
      }

      console.log(`[BackupService] [${index + 1}/${sourceFiles.length}] Copying '${fileName}' (ID: ${fileMeta.id})...`);
      const copyResult = BackupService._copySpreadsheet(fileMeta, snapshotFolder);
      fileResults.push(copyResult);

      if (copyResult.status === "SUCCESS") {
        succeededCount++;
      } else {
        failedCount++;
      }
    });

    const activeEnv = (typeof PropertiesService !== 'undefined')
      ? resolveEnvironmentType(PropertiesService.getScriptProperties().getProperty('ENV'))
      : (typeof SYSTEM_ENV !== 'undefined' ? SYSTEM_ENV : 'DEVELOPMENT');

    const schemaVer = (typeof DATABASE_SCHEMA !== 'undefined' && DATABASE_SCHEMA.version) ? DATABASE_SCHEMA.version : '2.2.0';

    // 6. Build Initial Report Object
    const report = {
      backup_id: snapshotFolderName,
      timestamp: new Date().toISOString(),
      schema_version: schemaVer,
      source: {
        environment: activeEnv,
        root_folder_id: sourceFolderId
      },
      target: {
        parent_folder_id: targetParentFolder.getId(),
        snapshot_folder_id: snapshotFolder.getId(),
        snapshot_folder_name: snapshotFolderName,
        snapshot_folder_url: snapshotFolder.getUrl()
      },
      results: {
        total: sourceFiles.length,
        succeeded: succeededCount,
        failed: failedCount,
        skipped: skippedCount,
        details: fileResults
      },
      retention: null,
      notification: null,
      execution_time_ms: 0,
      label: options.label || null
    };

    // 7. Write Manifest File
    try {
      BackupService._writeManifest(snapshotFolder, report);
      console.log("[BackupService] Manifest file 'manifest.json' written successfully.");
    } catch (manifestErr) {
      console.error(`[BackupService] Non-fatal: Failed to write manifest file: ${manifestErr.message}`);
    }

    // 8. Enforce Retention Policy (Keep 30 newest, purge oldest)
    try {
      const retentionTelemetry = BackupService._enforceRetention(targetParentFolder);
      report.retention = retentionTelemetry;
      console.log(`[BackupService] Retention enforced: ${retentionTelemetry.purged_count} oldest snapshot(s) purged.`);
    } catch (retentionErr) {
      console.error(`[BackupService] Non-fatal: Retention enforcement encountered error: ${retentionErr.message}`);
      report.retention = {
        max_allowed: MAX_BACKUP_RETENTION,
        purged_count: 0,
        purged_folders: [],
        error: retentionErr.message
      };
    }

    report.execution_time_ms = Date.now() - startTime;

    // 9. Dispatch Email Notification
    try {
      const recipient = BackupService._resolveNotificationRecipient(options.notifyEmail);
      if (recipient) {
        const attachmentName = `manifest_${report.backup_id}.json`;
        BackupService._sendNotification(report, snapshotFolder.getUrl(), recipient);
        report.notification = {
          email_sent: true,
          recipient: recipient,
          manifest_attached: true,
          attachment_name: attachmentName,
          error: null
        };
        console.log(`[BackupService] Backup summary email with attachment [${attachmentName}] dispatched to: '${recipient}'`);
      } else {
        report.notification = {
          email_sent: false,
          recipient: null,
          manifest_attached: false,
          attachment_name: null,
          error: "No active user email detected in execution session."
        };
      }
    } catch (notifyErr) {
      console.warn(`[BackupService] Non-fatal: Email notification failed: ${notifyErr.message}`);
      report.notification = {
        email_sent: false,
        recipient: options.notifyEmail || 'academydazzlingdream@gmail.com',
        manifest_attached: false,
        attachment_name: null,
        error: notifyErr.message
      };
    }

    console.log(`[BackupService] Snapshot sequence complete in ${report.execution_time_ms}ms. Total: ${sourceFiles.length}, Success: ${succeededCount}, Fail: ${failedCount}, Skipped: ${skippedCount}`);
    console.log("[BackupService] ==========================================");

    return report;
  },

  /**
   * Generates a standardized timestamp string formatted as 'YYYY-MM-DD_HH-mm-ss'.
   * @returns {string}
   * @private
   */
  _generateTimestamp: function () {
    const timeZone = (typeof Session !== 'undefined' && Session.getScriptTimeZone)
      ? (Session.getScriptTimeZone() || 'Asia/Kolkata')
      : 'Asia/Kolkata';
    return Utilities.formatDate(new Date(), timeZone, 'yyyy-MM-dd_HH-mm-ss');
  },

  /**
   * Resolves the source database root folder ID.
   * @param {string} [overrideSourceId] 
   * @returns {string}
   * @private
   */
  _resolveSourceFolder: function (overrideSourceId) {
    if (overrideSourceId && typeof overrideSourceId === 'string' && overrideSourceId.trim() !== '') {
      try {
        const folder = DriveApp.getFolderById(overrideSourceId.trim());
        return folder.getId();
      } catch (err) {
        throw new BackupError(`Specified source database folder ID '${overrideSourceId}' is invalid or inaccessible: ${err.message}`, {
          sourceFolderId: overrideSourceId,
          error: err.message
        });
      }
    }

    if (typeof resolveDatabaseEnvironment === 'function') {
      const activeConfig = resolveDatabaseEnvironment();
      if (activeConfig && activeConfig.rootFolderId) {
        return activeConfig.rootFolderId;
      }
    }

    if (typeof DATABASE_ROOT_FOLDER_ID !== 'undefined' && DATABASE_ROOT_FOLDER_ID) {
      return DATABASE_ROOT_FOLDER_ID;
    }

    throw new BackupError("Unable to resolve source database root folder. Configure DEV_DATABASE_ROOT_FOLDER_ID or provide sourceFolderId option.");
  },

  /**
   * Discovers all spreadsheet files within the source folder.
   * Utilizes SheetDB.SpreadsheetFileSystem if available, DBContext filesystem cache,
   * or falls back to native DriveApp search queries.
   * 
   * @param {string} sourceFolderId 
   * @returns {Array<Object>} List of file metadata { id, name, url, createdTime, modifiedTime }
   * @private
   */
  _discoverSourceFiles: function (sourceFolderId) {
    // 1. Try SheetDB Library's SpreadsheetFileSystem
    if (typeof SheetDB !== 'undefined' && typeof SheetDB.SpreadsheetFileSystem === 'function') {
      try {
        const fs = new SheetDB.SpreadsheetFileSystem(sourceFolderId);
        return fs.listAll();
      } catch (err) {
        console.warn(`[BackupService] SheetDB.SpreadsheetFileSystem failed: ${err.message}. Falling back to native Drive search.`);
      }
    }

    // 2. Try DBContext cached filesystem instance if folder matches
    if (typeof DBContext !== 'undefined' && typeof DBContext.getInstance === 'function') {
      try {
        const db = DBContext.getInstance();
        if (db && db._fs && db._fs.rootFolderId === sourceFolderId && typeof db._fs.listAll === 'function') {
          return db._fs.listAll();
        }
      } catch (dbErr) {
        // Fall through to native search
      }
    }

    // 3. Resilient Native DriveApp Search
    const mimeType = MimeType.GOOGLE_SHEETS;
    const query = `mimeType = '${mimeType}' and '${sourceFolderId}' in parents and trashed = false`;
    const iterator = DriveApp.searchFiles(query);
    const files = [];

    while (iterator.hasNext()) {
      const file = iterator.next();
      files.push({
        id: file.getId(),
        name: file.getName(),
        url: file.getUrl(),
        createdTime: file.getDateCreated().toISOString(),
        modifiedTime: file.getLastUpdated().toISOString()
      });
    }

    return files;
  },


  /**
   * Resolves the target backup parent folder.
   * If targetFolderId is provided, validates accessibility.
   * Otherwise, auto-provisions a sibling folder 'DazzlingDB_Backups' next to source database root.
   * 
   * @param {string|null} targetFolderId 
   * @param {string} sourceFolderId 
   * @returns {GoogleAppsScript.Drive.Folder}
   * @private
   */
  _resolveTargetFolder: function (targetFolderId, sourceFolderId) {
    if (targetFolderId && typeof targetFolderId === 'string' && targetFolderId.trim() !== '') {
      try {
        return DriveApp.getFolderById(targetFolderId.trim());
      } catch (err) {
        throw new BackupError(`Specified target backup folder ID '${targetFolderId}' is inaccessible: ${err.message}`, {
          targetFolderId,
          error: err.message
        });
      }
    }

    // Auto-provision sibling folder 'DazzlingDB_Backups'
    try {
      const sourceFolder = DriveApp.getFolderById(sourceFolderId);
      const parentIterator = sourceFolder.getParents();
      
      let parentContainer;
      if (parentIterator.hasNext()) {
        parentContainer = parentIterator.next();
      } else {
        // Fallback to Drive root if source folder has no visible parent
        parentContainer = DriveApp.getRootFolder();
      }

      const existingBackups = parentContainer.getFoldersByName('DazzlingDB_Backups');
      if (existingBackups.hasNext()) {
        const foundFolder = existingBackups.next();
        console.log(`[BackupService] Located existing backup root folder: '${foundFolder.getName()}' (${foundFolder.getId()})`);
        return foundFolder;
      }

      const createdFolder = parentContainer.createFolder('DazzlingDB_Backups');
      console.log(`[BackupService] Auto-provisioned sibling backup root folder: '${createdFolder.getName()}' (${createdFolder.getId()})`);
      return createdFolder;
    } catch (siblingErr) {
      throw new BackupError(`Failed to resolve or auto-provision sibling backup directory: ${siblingErr.message}`, {
        sourceFolderId,
        error: siblingErr.message
      });
    }
  },

  /**
   * Copies an individual spreadsheet file into the snapshot folder with isolated error capture.
   * 
   * @param {Object} fileMeta - { id, name, url }
   * @param {GoogleAppsScript.Drive.Folder} snapshotFolder 
   * @returns {Object} Execution result for this file
   * @private
   */
  _copySpreadsheet: function (fileMeta, snapshotFolder) {
    const fileStart = Date.now();
    try {
      const sourceFile = DriveApp.getFileById(fileMeta.id);
      const copiedFile = sourceFile.makeCopy(fileMeta.name, snapshotFolder);
      const durationMs = Date.now() - fileStart;

      console.log(`[BackupService]  -> Success: '${fileMeta.name}' copied to ID [${copiedFile.getId()}] in ${durationMs}ms.`);
      return {
        name: fileMeta.name,
        status: "SUCCESS",
        source_id: fileMeta.id,
        copy_id: copiedFile.getId(),
        copy_url: copiedFile.getUrl(),
        duration_ms: durationMs,
        error: null
      };
    } catch (copyErr) {
      const durationMs = Date.now() - fileStart;
      console.error(`[BackupService]  -> FAILED: Copying '${fileMeta.name}' encountered error: ${copyErr.message}`);
      return {
        name: fileMeta.name,
        status: "FAILED",
        source_id: fileMeta.id,
        copy_id: null,
        copy_url: null,
        duration_ms: durationMs,
        error: copyErr.message
      };
    }
  },

  /**
   * Writes the backup manifest as 'manifest.json' inside the snapshot folder.
   * Prioritizes Drive Advanced Service with seamless fallback to DriveApp.
   * 
   * @param {GoogleAppsScript.Drive.Folder} snapshotFolder 
   * @param {Object} report 
   * @private
   */
  _writeManifest: function (snapshotFolder, report) {
    const manifestContent = JSON.stringify(report, null, 2);
    const manifestFileName = 'manifest.json';

    // 1. Try Drive Advanced Service (v2) if available
    if (typeof Drive !== 'undefined' && Drive.Files && typeof Drive.Files.insert === 'function') {
      try {
        const fileResource = {
          title: manifestFileName,
          mimeType: 'application/json',
          parents: [{ id: snapshotFolder.getId() }]
        };
        const mediaBlob = Utilities.newBlob(manifestContent, 'application/json', manifestFileName);
        Drive.Files.insert(fileResource, mediaBlob);
        return;
      } catch (advancedErr) {
        console.warn(`[BackupService] Drive.Files.insert failed, falling back to DriveApp: ${advancedErr.message}`);
      }
    }

    // 2. Standard DriveApp fallback
    snapshotFolder.createFile(manifestFileName, manifestContent, MimeType.PLAIN_TEXT);
  },

  /**
   * Enforces retention policy by purging oldest snapshot subfolders when count > MAX_BACKUP_RETENTION.
   * Uses Drive.Files.remove for permanent deletion, falling back to folder.setTrashed(true).
   * 
   * @param {GoogleAppsScript.Drive.Folder} backupParentFolder - Parent directory containing backup snapshots.
   * @returns {{ max_allowed: number, total_before: number, purged_count: number, purged_folders: Array<string>, errors: Array<Object> }} Retention telemetry summary.
   * @private
   */
  _enforceRetention: function (backupParentFolder) {
    const telemetry = {
      max_allowed: MAX_BACKUP_RETENTION,
      total_before: 0,
      purged_count: 0,
      purged_folders: [],
      errors: []
    };

    const folderIterator = backupParentFolder.getFolders();
    const snapshots = [];

    while (folderIterator.hasNext()) {
      const folder = folderIterator.next();
      const folderName = folder.getName();
      if (folderName.startsWith('BKP_')) {
        snapshots.push({
          id: folder.getId(),
          name: folderName,
          createdDate: folder.getDateCreated(),
          folderRef: folder
        });
      }
    }

    telemetry.total_before = snapshots.length;

    // Cross-realm safe sorting ascending by creation date (oldest first)
    snapshots.sort((a, b) => {
      const timeA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
      const timeB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
      return timeA - timeB;
    });

    if (snapshots.length <= MAX_BACKUP_RETENTION) {
      console.log(`[BackupService] Retention Check: ${snapshots.length}/${MAX_BACKUP_RETENTION} snapshots present. No eviction needed.`);
      return telemetry;
    }

    const excessCount = snapshots.length - MAX_BACKUP_RETENTION;
    console.log(`[BackupService] Retention Triggered: Found ${snapshots.length} snapshots (Limit: ${MAX_BACKUP_RETENTION}). Purging ${excessCount} oldest folder(s)...`);

    for (let i = 0; i < excessCount; i++) {
      const targetSnapshot = snapshots[i];
      try {
        console.log(`[BackupService]  -> Purging oldest snapshot: '${targetSnapshot.name}' (${targetSnapshot.id})...`);
        
        // Permanent delete via Drive Advanced Service if available
        if (typeof Drive !== 'undefined' && Drive.Files && typeof Drive.Files.remove === 'function') {
          Drive.Files.remove(targetSnapshot.id);
        } else {
          targetSnapshot.folderRef.setTrashed(true);
        }

        telemetry.purged_count++;
        telemetry.purged_folders.push(targetSnapshot.name);
      } catch (purgeErr) {
        console.error(`[BackupService]  -> Failed to purge snapshot '${targetSnapshot.name}': ${purgeErr.message}`);
        telemetry.errors.push({
          folder_name: targetSnapshot.name,
          folder_id: targetSnapshot.id,
          error: purgeErr.message
        });
      }
    }

    return telemetry;
  },

  /**
   * Safely resolves the target notification email recipient without throwing permission errors.
   * 
   * @param {string} [explicitEmail] - Optional explicitly configured email address.
   * @returns {string} Resolved email or default 'academydazzlingdream@gmail.com'.
   * @private
   */
  _resolveNotificationRecipient: function (explicitEmail) {
    if (explicitEmail && typeof explicitEmail === 'string' && explicitEmail.trim() !== '') {
      return explicitEmail.trim();
    }

    if (typeof Session !== 'undefined') {
      try {
        const activeUser = Session.getActiveUser ? Session.getActiveUser().getEmail() : '';
        if (activeUser) return activeUser;
      } catch (activeErr) {
        // Fall through to getEffectiveUser
      }

      try {
        const effectiveUser = Session.getEffectiveUser ? Session.getEffectiveUser().getEmail() : '';
        if (effectiveUser) return effectiveUser;
      } catch (effectiveErr) {
        // Suppress session scope restriction errors gracefully
      }
    }

    return 'academydazzlingdream@gmail.com';
  },

  /**
   * Dispatches a structured HTML execution summary email via MailApp with attached manifest.json.
   * 
   * @param {Object} report 
   * @param {string} snapshotFolderUrl 
   * @param {string} recipientEmail 
   * @private
   */
  _sendNotification: function (report, snapshotFolderUrl, recipientEmail) {
    if (!recipientEmail || typeof MailApp === 'undefined') return;

    const overallStatus = report.results.failed === 0 ? "SUCCESS" : (report.results.succeeded > 0 ? "PARTIAL SUCCESS" : "FAILED");
    const statusColor = overallStatus === "SUCCESS" ? "#2e7d32" : (overallStatus === "PARTIAL SUCCESS" ? "#f57c00" : "#d32f2f");

    const subject = `[DazzlingDB] Database Backup ${overallStatus} — ${report.backup_id}`;

    let detailsRows = '';
    (report.results.details || []).forEach(d => {
      const badgeColor = d.status === 'SUCCESS' ? '#2e7d32' : (d.status === 'SKIPPED' ? '#757575' : '#d32f2f');
      detailsRows += `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 8px 12px; font-weight: 500;">${d.name}</td>
          <td style="padding: 8px 12px;"><span style="background-color: ${badgeColor}; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">${d.status}</span></td>
          <td style="padding: 8px 12px; text-align: right;">${d.duration_ms} ms</td>
          <td style="padding: 8px 12px; color: #d32f2f; font-size: 12px;">${d.error ? d.error : '—'}</td>
        </tr>
      `;
    });

    const retentionSummary = report.retention && report.retention.purged_count > 0
      ? `<p style="margin: 8px 0; color: #555555;"><strong>Retention Purge:</strong> Removed ${report.retention.purged_count} oldest snapshot(s) (${report.retention.purged_folders.join(', ')}).</p>`
      : '';

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: ${statusColor}; color: #ffffff; padding: 18px 24px;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 600;">DazzlingDB Database Backup Report</h2>
          <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">Snapshot ID: <strong>${report.backup_id}</strong></p>
        </div>
        <div style="padding: 20px 24px;">
          <table style="width: 100%; margin-bottom: 16px; font-size: 14px; color: #333333;">
            <tr>
              <td style="padding: 4px 0;"><strong>Environment:</strong> ${report.source.environment}</td>
              <td style="padding: 4px 0;"><strong>Schema Version:</strong> v${report.schema_version}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0;"><strong>Execution Duration:</strong> ${report.execution_time_ms} ms</td>
              <td style="padding: 4px 0;"><strong>Timestamp:</strong> ${report.timestamp}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding: 6px 0;">
                <strong>Snapshot Drive Folder:</strong> 
                <a href="${snapshotFolderUrl}" style="color: #1a73e8; text-decoration: none; font-weight: 500;" target="_blank">Open in Google Drive ↗</a>
              </td>
            </tr>
          </table>

          <div style="display: flex; gap: 12px; margin-bottom: 20px;">
            <div style="flex: 1; background-color: #f1f8e9; border: 1px solid #c5e1a5; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 22px; font-weight: bold; color: #2e7d32;">${report.results.succeeded}</div>
              <div style="font-size: 12px; color: #558b2f;">Succeeded</div>
            </div>
            <div style="flex: 1; background-color: #ffebee; border: 1px solid #ffcdd2; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 22px; font-weight: bold; color: #c62828;">${report.results.failed}</div>
              <div style="font-size: 12px; color: #b71c1c;">Failed</div>
            </div>
            <div style="flex: 1; background-color: #f5f5f5; border: 1px solid #e0e0e0; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 22px; font-weight: bold; color: #616161;">${report.results.skipped}</div>
              <div style="font-size: 12px; color: #757575;">Skipped</div>
            </div>
          </div>

          <h3 style="font-size: 15px; margin: 16px 0 8px 0; color: #333333;">Category Spreadsheet Breakdown</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left;">
            <thead>
              <tr style="background-color: #f5f5f5; border-bottom: 2px solid #e0e0e0; color: #555555;">
                <th style="padding: 8px 12px;">Spreadsheet</th>
                <th style="padding: 8px 12px;">Status</th>
                <th style="padding: 8px 12px; text-align: right;">Time</th>
                <th style="padding: 8px 12px;">Diagnostics</th>
              </tr>
            </thead>
            <tbody>
              ${detailsRows}
            </tbody>
          </table>

          ${retentionSummary}

          <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #888888; text-align: center;">
            DazzlingDB Automated Database Operations • Built with SheetDB Engine • Attached: manifest_${report.backup_id}.json
          </div>
        </div>
      </div>
    `;

    // Create manifest file attachment blob
    const manifestBlob = Utilities.newBlob(
      JSON.stringify(report, null, 2),
      'application/json',
      `manifest_${report.backup_id}.json`
    );

    MailApp.sendEmail({
      to: recipientEmail,
      subject: subject,
      htmlBody: htmlBody,
      attachments: [manifestBlob]
    });
  }
};

// Bind to global scope for cross-file and GAS console access
globalThis.BackupService = BackupService;
