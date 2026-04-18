/**
 * Enum for standardized File System Error Types
 */
const FSErrorType = {
  NOT_FOUND: 'NotFound',
  DUPLICATE: 'Duplicate',
  INVALID_INPUT: 'InvalidInput',
  PERMISSION: 'Permission',
  OPERATION_FAILED: 'OperationFailed'
};

/**
 * Custom Error Class for the SpreadsheetFileSystem
 * Ensures no silent failures and provides structured debugging context.
 */
class FileSystemError extends Error {
  constructor(type, message, meta = {}) {
    super(message);
    this.name = 'FileSystemError';
    this.type = type;
    this.meta = meta;
  }
}

/**
 * SpreadsheetFileSystem
 * A controlled abstraction layer over Google Drive for managing Google Sheets as database files.
 * Enforces strict root-folder isolation, ID-first lookups, and guaranteed valid metadata returns.
 */
class SpreadsheetFileSystem {
  /**
   * Initializes the filesystem controller scoped to a specific root folder.
   * @param {string} rootFolderId - The Drive folder ID to use as the filesystem root.
   */
  constructor(rootFolderId) {
    if (!rootFolderId || typeof rootFolderId !== 'string') {
      throw new FileSystemError(FSErrorType.INVALID_INPUT, 'Valid rootFolderId is required.');
    }
    this.rootFolderId = rootFolderId;
    this.mimeType = MimeType.GOOGLE_SHEETS;
    
    // Validate folder exists and user has access during instantiation
    this._getRootFolder();
  }

  // ==========================================
  // 📂 FOLDER LAYER
  // ==========================================

  /**
   * Lazy loads and caches the root folder reference for the current execution context.
   * @private
   * @returns {GoogleAppsScript.Drive.Folder}
   */
  _getRootFolder() {
    if (this._rootFolder) return this._rootFolder;
    try {
      this._rootFolder = DriveApp.getFolderById(this.rootFolderId);
      return this._rootFolder;
    } catch (e) {
      throw new FileSystemError(FSErrorType.PERMISSION, `Cannot access root folder ${this.rootFolderId}. Verify it exists and you have access.`, { error: e.message });
    }
  }

  // ==========================================
  // 📄 FILE DISCOVERY LAYER
  // ==========================================

  /**
   * Strongest lookup: Finds a spreadsheet by its exact ID.
   * Validates that it exists, is a spreadsheet, and lives in the root folder.
   * @param {string} id 
   * @returns {Object} Standard metadata
   */
  findById(id) {
    if (!id) throw new FileSystemError(FSErrorType.INVALID_INPUT, 'ID is required.');
    
    let file;
    try {
      file = DriveApp.getFileById(id);
    } catch (e) {
      throw new FileSystemError(FSErrorType.NOT_FOUND, `File with ID ${id} not found.`, { id });
    }

    this._validateIsSpreadsheet(file);
    this._validateInRoot(file);

    return this._buildMetadata(file);
  }

  /**
   * Finds a single spreadsheet by name. Throws if multiple exist to prevent ambiguity.
   * @param {string} name 
   * @returns {Object|null} Standard metadata or null if not found
   */
  findByName(name) {
    if (!name) throw new FileSystemError(FSErrorType.INVALID_INPUT, 'Name is required.');
    
    const query = `title = '${this._escapeQuery(name)}' and mimeType = '${this.mimeType}' and '${this.rootFolderId}' in parents and trashed = false`;
    const iterator = this._executeSearch(query);
    
    const files = this._iteratorToArray(iterator);
    if (files.length === 0) return null;
    if (files.length > 1) {
      throw new FileSystemError(FSErrorType.DUPLICATE, `Multiple spreadsheets found with the name '${name}'. Use findById to be specific.`, { count: files.length, name });
    }

    return this._buildMetadata(files[0]);
  }

  /**
   * Returns all matching spreadsheets by name.
   * @param {string} name 
   * @returns {Array<Object>} Array of standard metadata
   */
  findAllByName(name) {
    if (!name) throw new FileSystemError(FSErrorType.INVALID_INPUT, 'Name is required.');
    
    const query = `title = '${this._escapeQuery(name)}' and mimeType = '${this.mimeType}' and '${this.rootFolderId}' in parents and trashed = false`;
    const iterator = this._executeSearch(query);
    return this._iteratorToArray(iterator).map(f => this._buildMetadata(f));
  }

  /**
   * Lists all spreadsheets in the root folder.
   * @returns {Array<Object>} Array of standard metadata
   */
  listAll() {
    const query = `mimeType = '${this.mimeType}' and '${this.rootFolderId}' in parents and trashed = false`;
    const iterator = this._executeSearch(query);
    return this._iteratorToArray(iterator).map(f => this._buildMetadata(f));
  }

  // ==========================================
  // 🔎 QUERY LAYER
  // ==========================================

  /**
   * Searches spreadsheets using Drive Query parameters for optimal performance.
   * @param {Object} queryOptions - Search filters
   * @param {string} [queryOptions.nameContains] - Substring to find in name
   * @param {Date} [queryOptions.createdAfter] - Creation boundary
   * @param {Date} [queryOptions.updatedBefore] - Modification boundary
   * @returns {Array<Object>} Array of standard metadata
   */
  search(queryOptions = {}) {
    let queryParts = [`mimeType = '${this.mimeType}'`, `trashed = false`, `'${this.rootFolderId}' in parents`];

    if (queryOptions.nameContains) {
      queryParts.push(`title contains '${this._escapeQuery(queryOptions.nameContains)}'`);
    }
    if (queryOptions.createdAfter instanceof Date) {
      queryParts.push(`createdDate >= '${queryOptions.createdAfter.toISOString()}'`);
    }
    if (queryOptions.updatedBefore instanceof Date) {
      queryParts.push(`modifiedDate <= '${queryOptions.updatedBefore.toISOString()}'`);
    }

    const query = queryParts.join(' and ');
    const iterator = this._executeSearch(query);
    return this._iteratorToArray(iterator).map(f => this._buildMetadata(f));
  }

  // ==========================================
  // 🏗️ FILE CREATION
  // ==========================================

  /**
   * Safely creates a new spreadsheet inside the root folder.
   * @param {string} name 
   * @param {Object} options 
   * @param {boolean} [options.avoidDuplicate=true] - Throw or return existing if name exists
   * @returns {Object} Standard metadata
   */
  create(name, options = { avoidDuplicate: true }) {
    if (!name) throw new FileSystemError(FSErrorType.INVALID_INPUT, 'Name is required for creation.');

    if (options.avoidDuplicate) {
      const existing = this.findByName(name);
      if (existing) {
        throw new FileSystemError(FSErrorType.DUPLICATE, `Cannot create file. '${name}' already exists in root folder.`);
      }
    }

    try {
      // Create inherently places it in the user's root Drive
      const ss = SpreadsheetApp.create(name);
      const file = DriveApp.getFileById(ss.getId());
      
      // Move to target root folder securely
      this._moveToRoot(file);
      
      return this._buildMetadata(file);
    } catch (e) {
      throw new FileSystemError(FSErrorType.OPERATION_FAILED, `Failed to create spreadsheet '${name}'.`, { error: e.message });
    }
  }

  // ==========================================
  // ✏️ FILE UPDATE
  // ==========================================

  /**
   * Renames a spreadsheet, ensuring duplicates aren't accidentally created.
   * @param {string} id 
   * @param {string} newName 
   * @returns {Object} Standard metadata
   */
  rename(id, newName) {
    if (!newName) throw new FileSystemError(FSErrorType.INVALID_INPUT, 'New name is required.');
    
    // Validation: Does target file exist?
    const fileMeta = this.findById(id);
    
    // Validation: Does another file already have this name?
    const existing = this.findByName(newName);
    if (existing && existing.id !== id) {
      throw new FileSystemError(FSErrorType.DUPLICATE, `Cannot rename to '${newName}'. Another spreadsheet already holds this name.`);
    }

    try {
      const file = DriveApp.getFileById(id);
      file.setName(newName);
      return this._buildMetadata(file);
    } catch (e) {
      throw new FileSystemError(FSErrorType.OPERATION_FAILED, `Failed to rename file ${id}.`, { error: e.message });
    }
  }

  // ==========================================
  // ❌ DELETION STRATEGY
  // ==========================================

  /**
   * Deletes a spreadsheet. Soft-delete (trash) by default.
   * @param {string} id 
   * @param {Object} options 
   * @param {boolean} [options.permanent=false] - Attempt permanent deletion via Advanced Services
   */
  delete(id, options = { permanent: false }) {
    // Validate existence & domain before acting
    this.findById(id); 

    try {
      if (options.permanent) {
        // Permanent deletion requires the Advanced Drive API to be enabled in Apps Script.
        if (typeof Drive === 'undefined') {
          throw new Error('Advanced Drive Service must be enabled to permanently delete files. Use soft delete instead.');
        }
        Drive.Files.remove(id);
      } else {
        // Standard Soft Delete
        const file = DriveApp.getFileById(id);
        file.setTrashed(true);
      }
      return { success: true, id, permanent: options.permanent };
    } catch (e) {
      throw new FileSystemError(FSErrorType.OPERATION_FAILED, `Failed to delete file ${id}.`, { error: e.message });
    }
  }

  // ==========================================
  // 📊 SPREADSHEET-LEVEL HELPERS
  // ==========================================

  /**
   * Opens the Google Spreadsheet instance for deeper manipulation.
   * @param {string} id 
   * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  open(id) {
    this.findById(id); // Validate first
    return SpreadsheetApp.openById(id);
  }

  listSheets(id) {
    const ss = this.open(id);
    return ss.getSheets().map(s => s.getName());
  }

  createSheet(id, sheetName, columns = []) {
    if (!sheetName) throw new FileSystemError(FSErrorType.INVALID_INPUT, 'Sheet name required.');
    const ss = this.open(id);
    
    if (ss.getSheetByName(sheetName)) {
      throw new FileSystemError(FSErrorType.DUPLICATE, `Sheet '${sheetName}' already exists in spreadsheet ${id}.`);
    }

    const sheet = ss.insertSheet(sheetName);
    if (columns.length > 0) {
      sheet.appendRow(columns);
    }
    return true;
  }

  deleteSheet(id, sheetName) {
    const ss = this.open(id);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      throw new FileSystemError(FSErrorType.NOT_FOUND, `Sheet '${sheetName}' not found in spreadsheet ${id}.`);
    }
    ss.deleteSheet(sheet);
    return true;
  }

  // ==========================================
  // 🧪 VALIDATION & INTERNAL UTILS
  // ==========================================

  /**
   * Enforces that the file is actually a Google Sheet.
   * @private
   */
  _validateIsSpreadsheet(file) {
    if (file.getMimeType() !== this.mimeType) {
      throw new FileSystemError(FSErrorType.INVALID_INPUT, `File ${file.getId()} is not a Google Spreadsheet.`);
    }
  }

  /**
   * Enforces strict boundary isolation. Ensures the file resides in our designated root folder.
   * @private
   */
  _validateInRoot(file) {
    const parents = file.getParents();
    let inRoot = false;
    while (parents.hasNext()) {
      if (parents.next().getId() === this.rootFolderId) {
        inRoot = true;
        break;
      }
    }
    if (!inRoot) {
      throw new FileSystemError(FSErrorType.PERMISSION, `File ${file.getId()} exists but belongs to a different folder. Access denied.`);
    }
  }

  /**
   * Safely moves a file to the defined root folder (used during creation).
   * Note: .moveTo() is the modern Apps Script way, deprecating .addFile/.removeFile
   * @private
   */
  _moveToRoot(file) {
    const rootFolder = this._getRootFolder();
    file.moveTo(rootFolder);
  }

  /**
   * Standardizes the returned file object representation.
   * @private
   * @returns {Object}
   */
  _buildMetadata(file) {
    return {
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl(),
      createdTime: file.getDateCreated().toISOString(),
      modifiedTime: file.getLastUpdated().toISOString()
    };
  }

  /**
   * Helper to safely execute a Drive search and map native errors.
   * @private
   */
  _executeSearch(query) {
    try {
      return DriveApp.searchFiles(query);
    } catch (e) {
      throw new FileSystemError(FSErrorType.OPERATION_FAILED, 'Drive API search failed.', { query, error: e.message });
    }
  }

  /**
   * Converts a Drive API FileIterator to a standard JavaScript Array.
   * @private
   */
  _iteratorToArray(iterator) {
    const arr = [];
    while (iterator.hasNext()) {
      arr.push(iterator.next());
    }
    return arr;
  }

  /**
   * Escapes single quotes for Drive Query language
   * @private
   */
  _escapeQuery(string) {
    return string.replace(/'/g, "\\'");
  }
}