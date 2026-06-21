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
   * Main execution gateway to harvest cell matrices across files
   * @param {Object[]} manifest - Retrieval specs
   * @param {string} manifest[].spreadsheetId - Target workbook ID string
   * @param {string[]} [manifest[].sheets] - Array whitelist selector
   * @param {Object} [options] - Runtime overrides
   * @return {Object} Unified Success Envelope
   */
  fetchDataMatrix(manifest, options = {}) {
    const startTime = Date.now();
    const driverType = options.driverType || this.defaultDriver;

    console.log(`[MultiStorageCoordinator] Initializing operation via strategy driver: ${driverType}`);

    try {
      this._validateManifest(manifest);
      const normalizedManifest = this._normalizeManifest(manifest);

      // Dynamic polymorphic instantiation via Strategy Factory
      const driver = StorageDriverFactory.getDriver(driverType);
      const combinedPayload = driver.executeHarvest(normalizedManifest);

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
  executeHarvest(normalizedManifest) {
    throw new Error("Strategy abstract interface loop breached: executeHarvest must be explicitly implemented.");
  }

  /**
   * Single-Pass Memory Row Structuring & Cell Formula Protection (Axiom 3 Compliant)
   */
  _matrixToObjects(matrix) {
    if (!matrix || matrix.length === 0) return [];
    const headers = matrix[0];
    return matrix.slice(1).map(row => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) {
          let value = row[index];
          // Formula Injection Shield: Escape arithmetic cell prefixes
          if (typeof value === 'string' && (value.startsWith('=') || value.startsWith('+') || value.startsWith('-') || value.startsWith('@'))) {
            value = `'${value}`;
          }
          record[header] = value;
        }
      });
      return record;
    });
  }
}

/**
 * Concrete Strategy Implementation: Standard SpreadsheetApp Engine
 */
class StandardAppDriver extends BaseStorageDriver {
  executeHarvest(normalizedManifest) {
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
        fileContextMap[ssId][title] = this._matrixToObjects(rawValues);
      });
    });

    return fileContextMap;
  }
}

/**
 * Concrete Strategy Implementation: Advanced Sheets REST Service Tier
 */
class AdvancedRestDriver extends BaseStorageDriver {
  executeHarvest(normalizedManifest) {
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

      ranges.forEach((rangeStr, index) => {
        const sheetTitle = rangeStr.split('!')[0];
        const valueRange = response.valueRanges[index];
        const rawMatrix = valueRange.values || [];
        fileContextMap[ssId][sheetTitle] = this._matrixToObjects(rawMatrix);
      });
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
