/**
 * @file Fields.js
 * Layer: ORM - Field Specification Layer
 * 
 * Responsibility:
 * - Define declarative field types for Models.
 * - Handle type-specific validation and casting.
 * - Implement spreadsheet safety (formula escaping).
 * - Automate ID and Timestamp generation.
 */

/**
 * @abstract
 * Base class for all Model Fields.
 */
class BaseField {
  /**
   * @param {Object} options - Configuration for the field.
   * @param {string} [options.name] - The property name in JS.
   * @param {boolean} [options.primaryKey=false] - Whether this is the table's primary key.
   * @param {boolean} [options.required=true] - If true, value cannot be null or empty.
   * @param {*} [options.default=null] - Default value or callable.
   * @param {Array} [options.choices=null] - Restricted list of valid values.
   * @param {Array<Function>} [options.validators=[]] - Custom validation functions.
   */
  constructor(options = {}) {
    this.name = options.name || null;
    this.primaryKey = options.primaryKey || false;
    this.required = options.required !== undefined ? options.required : true;
    this.default = options.default !== undefined ? options.default : null;
    this.choices = options.choices || null;
    this.validators = options.validators || [];
  }

  /**
   * Transforms a raw value from a Spreadsheet cell into a clean JS type.
   * @param {*} value - Raw value from Google Sheets.
   * @returns {*} Casted value.
   */
  fromSheetValue(value) {
    if (value === "" || value === null || value === undefined) {
      return this._getDefaultValue();
    }
    return value;
  }

  /**
   * Transforms a native JS value into a format safe for setValues().
   * @param {*} value - JS value.
   * @returns {*} Sheet-safe value.
   */
  toSheetValue(value) {
    if (value === null || value === undefined) {
      return ""; // Sheets prefers empty strings to clear cells
    }
    return value;
  }

  /**
   * Validates a value against schema constraints.
   * @param {*} value - The value to check.
   * @throws {FieldError} If validation fails.
   */
  validate(value) {
    // 1. Check Required
    if (this.required && (value === null || value === undefined || value === "")) {
      throw new FieldError(this.name, "This field is required.", value);
    }

    // 2. Check Choices
    if (this.choices && value !== null && value !== "" && !this.choices.includes(value)) {
      throw new FieldError(this.name, `Value '${value}' is not a valid choice. Allowed: [${this.choices.join(", ")}]`, value);
    }

    // 3. Run Custom Validators
    this.validators.forEach(validator => {
      const result = validator(value);
      if (result !== true) {
        throw new FieldError(this.name, typeof result === 'string' ? result : "Custom validation failed.", value);
      }
    });
  }

  /**
   * Resolves the default value, supporting callables.
   * @protected
   */
  _getDefaultValue() {
    return typeof this.default === 'function' ? this.default() : this.default;
  }
}

/**
 * Handles text storage with formula injection protection.
 */
class CharField extends BaseField {
  constructor(options = {}) {
    super(options);
    this.maxLength = options.maxLength || null;
    this.minLength = options.minLength || null;
  }

  /** @override */
  validate(value) {
    super.validate(value);
    if (value === null || value === "") return;

    const strVal = String(value);
    if (this.maxLength && strVal.length > this.maxLength) {
      throw new FieldError(this.name, `Length ${strVal.length} exceeds maximum of ${this.maxLength}.`, value);
    }
    if (this.minLength && strVal.length < this.minLength) {
      throw new FieldError(this.name, `Length ${strVal.length} is below minimum of ${this.minLength}.`, value);
    }
  }

  /** @override */
  toSheetValue(value) {
    const val = super.toSheetValue(value);
    if (typeof val === 'string' && /^[=+\-@]/.test(val)) {
      return "'" + val; // Escape potential formulas
    }
    return val;
  }

  /** @override */
  fromSheetValue(value) {
    const val = super.fromSheetValue(value);
    return val !== null ? String(val) : null;
  }
}

/**
 * Strictly casts values to Integers.
 */
class IntegerField extends BaseField {
  constructor(options = {}) {
    super(options);
    this.min = options.min !== undefined ? options.min : null;
    this.max = options.max !== undefined ? options.max : null;
  }

  /** @override */
  fromSheetValue(value) {
    const val = super.fromSheetValue(value);
    if (val === null || val === "") return null;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? null : parsed;
  }

  /** @override */
  validate(value) {
    super.validate(value);
    if (value === null || value === "") return;

    if (this.min !== null && value < this.min) {
      throw new FieldError(this.name, `Value ${value} is below minimum of ${this.min}.`, value);
    }
    if (this.max !== null && value > this.max) {
      throw new FieldError(this.name, `Value ${value} exceeds maximum of ${this.max}.`, value);
    }
  }
}

/**
 * Strictly casts values to Floats/Numbers.
 */
class FloatField extends BaseField {
  /** @override */
  fromSheetValue(value) {
    const val = super.fromSheetValue(value);
    if (val === null || val === "") return null;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  }
}

/**
 * Normalizes truthy/falsy inputs from Sheets.
 */
class BooleanField extends BaseField {
  constructor(options = {}) {
    options.required = false; // Booleans are rarely "missing", usually just false
    super(options);
  }

  /** @override */
  fromSheetValue(value) {
    if (value === "" || value === null || value === undefined) return this._getDefaultValue() || false;
    if (typeof value === 'boolean') return value;
    
    const str = String(value).toLowerCase();
    return ["true", "1", "yes", "y"].includes(str);
  }

  /** @override */
  toSheetValue(value) {
    return value === true; // Sheets API handles native booleans well
  }
}

/**
 * Handles complex objects stored as strings.
 */
class JSONField extends BaseField {
  /** @override */
  fromSheetValue(value) {
    const val = super.fromSheetValue(value);
    if (!val) return {};
    if (typeof val === 'object') return val;
    try {
      return JSON.parse(val);
    } catch (e) {
      console.error(`[JSONField] Failed to parse '${this.name}':`, e.message);
      return {};
    }
  }

  /** @override */
  toSheetValue(value) {
    if (value === null || value === undefined) return "";
    return JSON.stringify(value);
  }
}

/**
 * Forces deterministic ISO strings for time-series data.
 */
class DateTimeField extends BaseField {
  constructor(options = {}) {
    super(options);
    this.autoNow = options.autoNow || false;
    this.autoNowAdd = options.autoNowAdd || false;
  }

  /** @override */
  fromSheetValue(value) {
    const val = super.fromSheetValue(value);
    if (!val) return null;
    if (val instanceof Date) return val;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }

  /** @override */
  toSheetValue(value) {
    let date = value;
    
    // Auto-generation logic
    if (this.autoNow || (this.autoNowAdd && !value)) {
      date = new Date();
    }

    if (!date) return "";
    return date instanceof Date ? date.toISOString() : new Date(date).toISOString();
  }
}

/**
 * Automatic Unique ID Generator with prefix.
 */
class AutoField extends BaseField {
  constructor(options = {}) {
    options.primaryKey = true;
    options.required = false; // Allowed to be empty during input, filled on save
    super(options);
    this.prefix = options.prefix || "ID";
  }

  /** @override */
  toSheetValue(value) {
    if (!value || value === "") {
      return `${this.prefix}-${Utilities.getUuid().split('-')[0].toUpperCase()}`;
    }
    return value;
  }
}

// Export to Global Namespace
globalThis.BaseField = BaseField;
globalThis.CharField = CharField;
globalThis.IntegerField = IntegerField;
globalThis.FloatField = FloatField;
globalThis.BooleanField = BooleanField;
globalThis.JSONField = JSONField;
globalThis.DateTimeField = DateTimeField;
globalThis.AutoField = AutoField;
