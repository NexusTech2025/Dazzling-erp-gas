/**
 * @file MultiStorageCoordinator.js
 * Component: Polymorphic Multi-Spreadsheet Extraction Orchestrator
 * 
 * Responsibility:
 * - Provides concrete strategy drivers to extract cell matrices across files.
 * - Sanitizes cell matrices against formula injection (System Axiom 3).
 * - Maps platform host exceptions to SheetDB error hierarchy.
 */

// ==========================================
// 🛠️ MODULE LEVEL STANDALONE UTILITIES
// ==========================================

// Global execution-level caching of resolved schemas
const _schemaCache = {};

/**
 * Retrieves the compiled field schema for a given table name from the ModelRegistry.
 * Standalone Utility: Decoupled from class context.
 * @param {string} tableName - The model/table name (e.g. "Student").
 * @returns {Object|null} A map of field names to BaseField instances, or null if not registered.
 */
function getModelSchema(tableName) {
  const cleanName = String(tableName).trim();
  if (_schemaCache[cleanName] !== undefined) {
    return _schemaCache[cleanName];
  }

  try {
    if (typeof ModelRegistry !== 'undefined') {
      const ModelClass = ModelRegistry.getModel(cleanName);
      const schema = ModelClass ? (ModelClass.schema || null) : null;
      _schemaCache[cleanName] = schema;
      return schema;
    }
  } catch (e) {
    console.log(`[MultiStorageCoordinator Utils] Schema resolution bypass for '${cleanName}': ${e.message}`);
    _schemaCache[cleanName] = null;
  }
  return null;
}

/**
 * Normalizes a raw record entry object using a custom strategy mapping callback.
 * Standalone Utility: Decoupled from class context.
 * @param {Object} record - The key-value record object representing a database row.
 * @param {Function} callback - A callback matching signature (key, value) => normalizedValue.
 * @returns {Object} The newly normalized record entry.
 */
function normalizeEntry(record, callback) {
  const normalized = {};
  for (const key in record) {
    normalized[key] = callback(key, record[key]);
  }
  return normalized;
}

/**
 * Transforms raw 2D sheet rows into an array of normalized objects,
 * dynamically applying schema-defined type-casting and formula injection protection.
 * Standalone Utility: Decoupled from class context.
 * @param {Array<Array<*>>} matrix - Raw 2D array of rows from the sheet (including header row).
 * @param {string} tableName - The model/table name corresponding to the sheet (e.g. "Student").
 * @returns {Array<Object>} Normalized array of record objects.
 */
function dataRangesToObject(matrix, tableName) {
  if (!matrix || matrix.length === 0) return [];
  const headers = matrix[0];
  const schema = getModelSchema(tableName);

  // Strategy Pattern: Decouple normalization logic into a callback
  const normalizationCallback = (headerKey, val) => {
    let sanitizedVal = val;
    // Formula Injection Shield: Escape arithmetic cell prefixes
    if (typeof sanitizedVal === 'string' && (sanitizedVal.startsWith('=') || sanitizedVal.startsWith('+') || sanitizedVal.startsWith('-') || sanitizedVal.startsWith('@'))) {
      sanitizedVal = `'${sanitizedVal}`;
    }
    // Apply dynamic field-level casting and normalization
    if (schema && schema[headerKey]) {
      return schema[headerKey].fromSheetValue(sanitizedVal);
    }
    return sanitizedVal;
  };

  return matrix.slice(1).map(row => {
    const rawRecord = {};
    headers.forEach((header, index) => {
      if (header) {
        const headerKey = String(header).trim();
        // Safe check for short rows (sparse matrix data)
        const rawValue = (index < row.length) ? row[index] : "";
        rawRecord[headerKey] = rawValue;
      }
    });
    return normalizeEntry(rawRecord, normalizationCallback);
  });
}

/**
 * Decoupled processing of range response objects mapping sheets to value matrices.
 * Standalone Utility: Decoupled from class context.
 * @param {Object} response - The batchGet API response payload.
 * @param {string[]} ranges - Ranges requested.
 * @param {Function} matrixProcessor - Injected processing strategy callback.
 * @returns {Object} Object mapping sheet titles to normalized matrices.
 */
function processRanges(response, ranges, matrixProcessor) {
  const sheetData = {};
  ranges.forEach((rangeStr, index) => {
    const sheetTitle = rangeStr.split('!')[0];
    const valueRange = response.valueRanges[index];
    const rawMatrix = valueRange.values || [];
    sheetData[sheetTitle] = matrixProcessor(rawMatrix, sheetTitle);
  });
  return sheetData;
}

// ==========================================
// 🚀 ORCHESTRATOR & DRIVERS
// ==========================================

/**
 * SheetDB Polymorphic Multi-Spreadsheet Extraction Orchestrator
 * Bypasses network overhead via concrete strategy injection.
 */
class MultiStorageCoordinator {
  /**
   * @param {Object} [config]
   * @param {string} [config.defaultDriver="ADVANCED"] - "ADVANCED" | "STANDARD"
   */
  constructor(config = {}) {
    this.defaultDriver = config.defaultDriver || "ADVANCED";
  }

  /**
   * Main execution gateway to harvest cell ranges across files
   * @param {Object[]} manifest - Retrieval specs
   * @param {string} manifest[].spreadsheetId - Target workbook ID string
   * @param {string[]} [manifest[].sheets] - Array whitelist selector
   * @param {Object} [options] - Runtime overrides
   * @return {Object} Unified Success Envelope
   */
  fetchDataRanges(manifest, options = {}) {
    const startTime = Date.now();
    const driverType = options.driverType || this.defaultDriver;

    console.log(`[MultiStorageCoordinator] Initializing operation via strategy driver: ${driverType}`);

    try {
      this._validateManifest(manifest);
      const normalizedManifest = this._normalizeManifest(manifest);

      // Dynamic polymorphic instantiation via Strategy Factory
      const driver = StorageDriverFactory.getDriver(driverType);
      
      // Inject processing callback to strategy driver
      const combinedPayload = driver.fetchSheetData(normalizedManifest, (matrix, tableName) => {
        return dataRangesToObject(matrix, tableName);
      });

      return {
        success: true,
        meta: {
          strategyExecuted: driverType,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        },
        data: combinedPayload
      };

    } catch (error) {
      // Intercept and map platform container errors to pre-existing SheetDB Errors hierarchy
      StorageExceptionInterceptor.handle(error, { driverType, manifest });
    }
  }

  _validateManifest(manifest) {
    if (!manifest || !Array.isArray(manifest) || manifest.length === 0) {
      throw new ValidationError("Manifest array specification contract mismatch: Input cannot be empty.");
    }
  }

  _normalizeManifest(manifest) {
    return manifest.map((item, index) => {
      if (!item.spreadsheetId || typeof item.spreadsheetId !== 'string') {
        throw new ValidationError(`Structural structural gap at manifest index [${index}]: spreadsheetId string missing.`);
      }
      return {
        spreadsheetId: item.spreadsheetId,
        sheets: Array.isArray(item.sheets) ? item.sheets : []
      };
    });
  }
}

/**
 * Strategy Driver Abstract Contract
 */
class BaseStorageDriver {
  /**
   * Abstract interface to harvest raw cell matrices.
   * @param {Object[]} normalizedManifest - Retrieval specifications.
   * @param {Function} matrixProcessor - Injected processing strategy callback.
   */
  fetchSheetData(normalizedManifest, matrixProcessor) {
    throw new Error("Strategy abstract interface loop breached: fetchSheetData must be explicitly implemented.");
  }
}

/**
 * Concrete Strategy Implementation: Standard SpreadsheetApp Engine
 */
class StandardAppDriver extends BaseStorageDriver {
  /**
   * Harvests matrix arrays using low-level SpreadsheetApp services.
   * @param {Object[]} normalizedManifest - Normalized retrieval array.
   * @param {Function} matrixProcessor - Injected processing strategy callback.
   * @returns {Object} Harvested matrices.
   */
  fetchSheetData(normalizedManifest, matrixProcessor) {
    const fileContextMap = {};

    normalizedManifest.forEach(targetFile => {
      const ssId = targetFile.spreadsheetId;
      fileContextMap[ssId] = {};

      // Incurs cross-boundary initialization overhead
      const ss = SpreadsheetApp.openById(ssId);

      // Dynamic Path: Surgical Selection vs Complete Snapshot Loop
      const concreteSheets = targetFile.sheets.length > 0
        ? targetFile.sheets.map(name => ss.getSheetByName(name)).filter(Boolean)
        : ss.getSheets();

      concreteSheets.forEach(sheet => {
        const title = sheet.getName();
        if (sheet.getLastRow() === 0) {
          fileContextMap[ssId][title] = [];
          return;
        }
        const rawValues = sheet.getDataRange().getValues();
        fileContextMap[ssId][title] = matrixProcessor(rawValues, title);
      });
    });

    return fileContextMap;
  }
}

/**
 * Concrete Strategy Implementation: Advanced Sheets REST Service Tier
 */
class AdvancedRestDriver extends BaseStorageDriver {
  /**
   * Harvests matrix arrays using Google Sheets REST API.
   * @param {Object[]} normalizedManifest - Normalized retrieval array.
   * @param {Function} matrixProcessor - Injected processing strategy callback.
   * @returns {Object} Harvested matrices.
   */
  fetchSheetData(normalizedManifest, matrixProcessor) {
    const fileContextMap = {};

    normalizedManifest.forEach(targetFile => {
      const ssId = targetFile.spreadsheetId;
      fileContextMap[ssId] = {};
      let ranges = [];

      if (targetFile.sheets.length > 0) {
        // Surgical Selection Mode
        ranges = targetFile.sheets.map(name => `${name}!A:Z`);
      } else {
        // Complete Workbook Snapshot: Execute metadata query to fetch full tab grid indices
        const metadata = Sheets.Spreadsheets.get(ssId);
        ranges = metadata.sheets.map(s => `${s.properties.title}!A:Z`);
      }

      // EXECUTION BOUNDARY WIN: Exactly 1 consolidated REST request block per File ID
      const response = Sheets.Spreadsheets.Values.batchGet(ssId, { ranges: ranges });

      // Invoke decoupled range mapper standalone utility
      fileContextMap[ssId] = processRanges(response, ranges, matrixProcessor);
    });

    return fileContextMap;
  }
}

/**
 * Polymorphic Registry Strategy Factory
 */
class StorageDriverFactory {
  static getDriver(driverType) {
    const cleanType = String(driverType).toUpperCase();
    if (cleanType === "ADVANCED") return new AdvancedRestDriver();
    if (cleanType === "STANDARD") return new StandardAppDriver();

    throw new ValidationError(`Polymorphic Storage registry anomaly: Driver type "${driverType}" unrecognized.`);
  }
}

/**
 * Exception Boundary Bridge Interceptor
 */
class StorageExceptionInterceptor {
  static handle(error, context = {}) {
    const msg = error.message || String(error);

    // Scenario A: Check sheet metadata file resolution crashes
    if (msg.includes("Spreadsheet not found") || msg.includes("not found") || msg.includes("invalid spreadsheetId") || msg.includes("is not defined")) {
      throw new ResourceNotFoundError(`[SheetDB Infrastructure Fault] Target workspace file could not be mapped inside Google Drive paths. Msg: ${msg}`);
    }

    // Scenario B: Rate limits / Platform exhaustion
    if (msg.includes("Quota exceeded") || msg.includes("429") || msg.includes("API call failed")) {
      throw new PlatformQuotasExhaustedException(`[SheetDB Quota Breach] Google host runtime throttled active request context. Shift workflows to cache layers. Msg: ${msg}`);
    }

    // Scenario C: Internal pre-mapped exception bypass pass-through
    if (error instanceof ResourceNotFoundError || error instanceof ValidationError || error instanceof PlatformQuotasExhaustedException) {
      throw error;
    }

    // Scenario D: Standard fallback catch-all loop shielding
    throw new SheetDBEngineError(`[SheetDB Critical Unhandled Fault] Core driver execution terminated unexpectedly. Exception message: ${msg}`);
  }
}

// Export all components globally
Object.assign(globalThis, {
  MultiStorageCoordinator,
  BaseStorageDriver,
  StandardAppDriver,
  AdvancedRestDriver,
  StorageDriverFactory,
  StorageExceptionInterceptor
});

