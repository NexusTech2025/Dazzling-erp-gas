/**
 * @file DriveStorageService.js
 * Infrastructure Service for Google Drive Folder Hierarchy and File Management.
 * Manages dedicated Course Notes folders and provides compensation transaction hooks.
 */

const DriveStorageService = (function () {
  const MEDIA_ROOT_FOLDER_NAME = "media";
  const NOTES_ROOT_FOLDER_NAME = "DazzlingDB_Course_Notes";

  /**
   * Sanitizes a string for use as a filesystem directory name.
   * @param {string} rawName - Raw course or folder name.
   * @returns {string} Sanitized directory name.
   * @private
   */
  function _sanitizeFolderName(rawName) {
    if (!rawName || typeof rawName !== "string") {
      return "Untitled_Course";
    }
    return rawName.trim().replace(/[\\/:*?"<>|]/g, "_");
  }

  /**
   * Derives a high-level file_type category from MIME type and file extension.
   * @param {string} mimeType - IANA MIME type.
   * @param {string} [fileName=""] - Target filename with extension.
   * @returns {string} One of ["pdf", "image", "presentation", "document", "spreadsheet", "text", "archive", "other"].
   * @private
   */
  function _deriveFileType(mimeType, fileName = "") {
    const mime = (mimeType || "").toLowerCase().trim();
    const ext = fileName && fileName.includes(".") ? fileName.split(".").pop().toLowerCase().trim() : "";

    if (mime === "application/pdf" || ext === "pdf") {
      return "pdf";
    }
    if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"].includes(ext)) {
      return "image";
    }
    if (
      mime.includes("presentation") ||
      mime.includes("powerpoint") ||
      ["ppt", "pptx", "key"].includes(ext)
    ) {
      return "presentation";
    }
    if (
      mime.includes("wordprocessingml") ||
      mime.includes("msword") ||
      ["doc", "docx", "pages", "odt"].includes(ext)
    ) {
      return "document";
    }
    if (
      mime.includes("spreadsheet") ||
      mime.includes("excel") ||
      mime === "text/csv" ||
      ["xls", "xlsx", "csv", "numbers", "ods"].includes(ext)
    ) {
      return "spreadsheet";
    }
    if (
      mime.startsWith("text/") ||
      ["txt", "md", "markdown", "log"].includes(ext)
    ) {
      return "text";
    }
    if (
      mime.includes("zip") ||
      mime.includes("tar") ||
      mime.includes("compressed") ||
      ["zip", "rar", "7z", "tar", "gz"].includes(ext)
    ) {
      return "archive";
    }
    return "other";
  }

  return {
    /**
     * Resolves or provisions the environment-isolated 'media' directory idempotently
     * inside the active environment's container folder.
     * @param {string} [overrideRootFolderId] - Optional explicit root folder ID.
     * @returns {GoogleAppsScript.Drive.Folder} The target media folder instance.
     * @throws {CourseNoteError} If folder resolution or creation fails.
     */
    createOrGetMediaDirectory(overrideRootFolderId) {
      const rootFolderId = overrideRootFolderId || (typeof DBContext !== 'undefined' && typeof DBContext.getTargetFolderId === 'function' ? DBContext.getTargetFolderId() : null);

      if (!rootFolderId) {
        throw new CourseNoteError(
          "DriveStorageService Error: Database root folder ID could not be resolved from DBContext.",
          "DRIVE_ROOT_RESOLUTION_FAILED"
        );
      }

      try {
        const parentContainer = DriveApp.getFolderById(rootFolderId);
        const search = parentContainer.getFoldersByName(MEDIA_ROOT_FOLDER_NAME);

        if (search.hasNext()) {
          return search.next();
        }

        console.log(`[DriveStorageService.createOrGetMediaDirectory] Idempotent Provisioning: Creating isolated '${MEDIA_ROOT_FOLDER_NAME}' directory.`);
        return parentContainer.createFolder(MEDIA_ROOT_FOLDER_NAME);
      } catch (err) {
        console.error(`[DriveStorageService.createOrGetMediaDirectory] Failed to resolve or create media folder: ${err.message}`);
        throw new CourseNoteError(
          `Failed to access or initialize Google Drive media folder: ${err.message}`,
          "DRIVE_FOLDER_CREATION_FAILED",
          { rootFolderId, originalError: err.message }
        );
      }
    },

    /**
     * Resolves or provisions the 'DazzlingDB_Course_Notes' folder idempotently
     * inside the environment's isolated 'media' directory.
     * @param {string} [overrideRootFolderId] - Optional explicit root folder ID.
     * @returns {GoogleAppsScript.Drive.Folder} The target root notes folder instance.
     * @throws {CourseNoteError} If folder resolution or creation fails.
     */
    resolveNotesRootFolder(overrideRootFolderId) {
      try {
        const mediaFolder = this.createOrGetMediaDirectory(overrideRootFolderId);
        const search = mediaFolder.getFoldersByName(NOTES_ROOT_FOLDER_NAME);

        if (search.hasNext()) {
          return search.next();
        }

        console.log(`[DriveStorageService.resolveNotesRootFolder] Idempotent Provisioning: Creating root notes folder '${NOTES_ROOT_FOLDER_NAME}' inside media folder.`);
        return mediaFolder.createFolder(NOTES_ROOT_FOLDER_NAME);
      } catch (err) {
        console.error(`[DriveStorageService.resolveNotesRootFolder] Failed to resolve or create notes root folder: ${err.message}`);
        throw new CourseNoteError(
          `Failed to access or initialize Google Drive notes folder: ${err.message}`,
          "DRIVE_FOLDER_CREATION_FAILED",
          { overrideRootFolderId, originalError: err.message }
        );
      }
    },

    /**
     * Resolves or provisions a course-specific subdirectory inside the root notes folder.
     * @param {string} courseName - Name of the course for partition naming.
     * @param {string} [overrideRootFolderId] - Optional explicit root folder ID.
     * @returns {GoogleAppsScript.Drive.Folder} Course-partitioned subfolder.
     * @throws {CourseNoteError} If subfolder resolution fails.
     */
    resolveCourseFolder(courseName, overrideRootFolderId) {
      const rootFolder = this.resolveNotesRootFolder(overrideRootFolderId);
      const sanitizedName = _sanitizeFolderName(courseName);

      try {
        const search = rootFolder.getFoldersByName(sanitizedName);
        if (search.hasNext()) {
          return search.next();
        }

        console.log(`[DriveStorageService.resolveCourseFolder] Creating course subfolder '${sanitizedName}'.`);
        return rootFolder.createFolder(sanitizedName);
      } catch (err) {
        console.error(`[DriveStorageService.resolveCourseFolder] Failed to resolve course subfolder '${sanitizedName}': ${err.message}`);
        throw new CourseNoteError(
          `Failed to access or create course subfolder '${sanitizedName}': ${err.message}`,
          "DRIVE_FOLDER_CREATION_FAILED",
          { courseName, sanitizedName, originalError: err.message }
        );
      }
    },

    /**
     * Ingests a Base64-encoded document into the designated course subfolder in Google Drive.
     * @param {Object} params - File upload parameters.
     * @param {string} params.courseName - Name of the course for directory organization.
     * @param {string} params.fileName - Target document filename.
     * @param {string} params.mimeType - Document MIME type.
     * @param {string} params.base64Content - Encoded binary payload.
     * @param {string} [params.description] - Metadata note description for Drive file properties.
     * @param {string} [params.overrideRootFolderId] - Optional explicit root folder ID.
     * @returns {Object} File descriptor containing { file_id, file_url, file_name, mime_type, file_size_bytes }.
     * @throws {CourseNoteError} If decoding fails or file cannot be written.
     */
    uploadDocument(params) {
      if (!params || !params.base64Content || !params.fileName || !params.mimeType) {
        throw new CourseNoteError(
          "Invalid upload payload: 'fileName', 'mimeType', and 'base64Content' are required.",
          "INVALID_UPLOAD_PAYLOAD"
        );
      }

      console.log(`[DriveStorageService.uploadDocument] Ingesting file '${params.fileName}' for course '${params.courseName}'...`);
      const startTime = Date.now();

      try {
        // 1. Decode Base64 string to byte array
        const bytes = Utilities.base64Decode(params.base64Content);
        const fileSize = bytes.length;

        // 2. Create Blob
        const blob = Utilities.newBlob(bytes, params.mimeType, params.fileName);

        // 3. Resolve target course subfolder
        const targetFolder = this.resolveCourseFolder(params.courseName, params.overrideRootFolderId);

        // 4. Ingest File to Google Drive
        const file = targetFolder.createFile(blob);

        if (params.description) {
          try {
            file.setDescription(String(params.description).substring(0, 1000));
          } catch (descErr) {
            console.warn(`[DriveStorageService.uploadDocument] Could not attach file description: ${descErr.message}`);
          }
        }

        const fileType = params.fileType || _deriveFileType(params.mimeType, params.fileName);
        const elapsed = Date.now() - startTime;
        console.log(`[DriveStorageService.uploadDocument] File '${params.fileName}' (${fileSize} bytes, type: ${fileType}) created in Drive in ${elapsed} ms. File ID: ${file.getId()}`);

        return {
          file_id: file.getId(),
          file_url: file.getUrl(),
          file_name: params.fileName,
          mime_type: params.mimeType,
          file_type: fileType,
          file_size_bytes: fileSize
        };

      } catch (err) {
        console.error(`[DriveStorageService.uploadDocument] Drive ingestion failure for '${params.fileName}': ${err.message}`);
        throw new CourseNoteError(
          `Google Drive file upload failed: ${err.message}`,
          "DRIVE_UPLOAD_FAILED",
          { fileName: params.fileName, mimeType: params.mimeType, originalError: err.message }
        );
      }
    },

    /**
     * Public utility to derive high-level file_type from MIME type and filename.
     * @param {string} mimeType - IANA MIME type.
     * @param {string} [fileName=""] - Filename with extension.
     * @returns {string} One of ["pdf", "image", "presentation", "document", "spreadsheet", "text", "archive", "other"].
     */
    deriveFileType(mimeType, fileName) {
      return _deriveFileType(mimeType, fileName);
    },

    /**
     * Trashes a Drive file during transaction rollback or explicit note deletion.
     * Resilient against already-deleted or non-existent files.
     * @param {string} fileId - Google Drive File ID.
     * @returns {boolean} True if successfully trashed or already absent.
     */
    trashFile(fileId) {
      if (!fileId || typeof fileId !== "string") {
        console.warn("[DriveStorageService.trashFile] Called with empty file ID, skipping.");
        return false;
      }

      try {
        console.log(`[DriveStorageService.trashFile] Moving Drive file '${fileId}' to trash...`);
        const file = DriveApp.getFileById(fileId);
        file.setTrashed(true);
        console.log(`[DriveStorageService.trashFile] File '${fileId}' successfully trashed.`);
        return true;
      } catch (err) {
        console.warn(`[DriveStorageService.trashFile] Could not trash file '${fileId}' (may already be removed): ${err.message}`);
        return false;
      }
    }
  };
})();

// Bind to global namespace
globalThis.DriveStorageService = DriveStorageService;
