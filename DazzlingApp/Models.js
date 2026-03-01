/**
 * ==============================================================
 * BaseModel.gs
 * ==============================================================
 *
 * Responsibility:
 * - Wrap raw data object
 * - Provide safe property access
 * - Serve as foundation for ORM wrapping
 *
 * MUST NOT:
 * - Access repositories directly
 * - Access SpreadsheetApp
 * - Resolve relations directly
 * - Version V1
 * ==============================================================
 */

class BaseModel {

  /**
   * @param {string} entityName
   * @param {Object} data
   * @param {ORM} orm (optional for lazy resolution)
   */
  constructor(entityName, data, orm = null) {
    if (!entityName || !data) {
      throw new Error("entityName and data are required.");
    }

    this._entity = entityName;
    this._data = Object.freeze({ ...data }); // Immutable copy
    this._orm = orm;
  }

  /**
   * Get raw field value
   */
  get(field) {
    return this._data[field];
  }

  /**
   * Get primary key value
   */
  get id() {
    return this._data.id;
  }

  /**
   * Convert to plain object
   */
  toJSON() {
    return { ...this._data };
  }

  /**
   * Debug helper
   */
  toString() {
    return `${this._entity}#${this.id}`;
  }
}

