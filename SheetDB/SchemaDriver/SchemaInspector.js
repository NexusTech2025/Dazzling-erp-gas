/**
 * SchemaInspector
 * Dedicated Read Adapter (Internal). 
 * Encapsulates all Google API discovery logic to build a Physical State Snapshot.
 */
class SchemaInspector {
  /**
   * @param {Object} fileSystem - Instance of SpreadsheetFileSystem
   */
  constructor(fileSystem) {
    this.fs = fileSystem;
  }

  /**
   * Builds a full physical state snapshot of the filesystem based on schema categories.
   * @param {Object} categories - The 'categories' block from the JSON schema
   * @returns {Object} Normalized physical state snapshot
   */
  getPhysicalSnapshot(categories) {
    const snapshot = {};
    const categoryNames = Object.keys(categories);

    for (const name of categoryNames) {
      const state = this._inspectCategory(name);
      if (state) {
        snapshot[name] = state;
      }
    }
    return snapshot;
  }

  /**
   * Inspects a single spreadsheet to determine its current structure.
   * @private
   */
  _inspectCategory(categoryName) {
    const fileMeta = this.fs.findByName(categoryName);
    if (!fileMeta) return null;

    try {
      const ss = this.fs.open(fileMeta.id);
      const categoryState = {
        id: fileMeta.id,
        tables: {},
        meta: null
      };

      const sheets = ss.getSheets();
      for (const sheet of sheets) {
        const sheetName = sheet.getName();

        if (sheetName === '__meta__') {
          categoryState.meta = this._extractMeta(sheet);
        } else {
          categoryState.tables[sheetName] = {
            headers: this._getHeaders(sheet),
            lastRow: sheet.getLastRow()
          };
        }
      }

      return categoryState;
    } catch (e) {
      // Log failure but don't crash the planner
      console.error(`[Inspector] Failed to open/read category ${categoryName}: ${e.message}`);
      return { id: fileMeta.id, error: e.message, tables: {} };
    }
  }

  /**
   * Safely extracts versioning info from the __meta__ sheet.
   * @private
   */
  _extractMeta(sheet) {
    try {
      const marker = sheet.getRange('A1').getValue();
      if (marker !== '__SCHEMA_META__') return null;

      const jsonStr = sheet.getRange('B1').getValue();
      return jsonStr ? JSON.parse(jsonStr) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Standardizes header extraction and normalization.
   * @private
   */
  _getHeaders(sheet) {
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return [];

    try {
      const values = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      return values.map(h => String(h).trim());
    } catch (e) {
      return [];
    }
  }
}
