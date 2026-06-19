/**
 * @file DazzlingDateTime.js
 * Domain service tier managing core calculations and constraints.
 */

const BaseClass = (typeof SheetDB !== 'undefined' && SheetDB.SheetDBDateTime) 
  ? SheetDB.SheetDBDateTime 
  : globalThis.SheetDBDateTime;

class DazzlingDateTime extends BaseClass {
  /**
   * Combines standalone date and time components into a local timezone-anchored ISO string.
   * @param {string} dateStr - Target date string representation.
   * @param {string} timeStr - Target time string representation (e.g. "08:15 AM").
   * @param {Object} [formattingOptions] - Custom delimiters or sequences.
   * @returns {string} Fully qualified ISO-8601 timestamp with offset.
   * @throws {SheetDB.ValidationError} Validation error on format mismatches.
   */
  static fromParts(dateStr, timeStr, formattingOptions = {}) {
    if (typeof dateStr !== 'string' || typeof timeStr !== 'string') {
      const errClass = (typeof SheetDB !== 'undefined' && SheetDB.ValidationError) || Error;
      throw new errClass("Temporal parameters must be strings.");
    }

    const dateOptions = formattingOptions.date || { delimiter: '-', format: 'YYYY-MM-DD' };
    const timeOptions = formattingOptions.time || { delimiter: ':', requireMeridian: false };

    const parsedDate = this.parseConfigurableDate(dateStr, dateOptions);
    const parsedTime = this.parseConfigurableTime(timeStr, timeOptions);

    if (!parsedDate || !parsedTime) {
      const errClass = (typeof SheetDB !== 'undefined' && SheetDB.ValidationError) || Error;
      throw new errClass("Failed to parse raw parts into coherent date-time fields.");
    }

    const yyyy = String(parsedDate.year);
    const mm = String(parsedDate.month).padStart(2, '0');
    const dd = String(parsedDate.day).padStart(2, '0');
    
    const hh = String(parsedTime.hour24).padStart(2, '0');
    const min = String(parsedTime.minute).padStart(2, '0');
    const ss = String(parsedTime.second).padStart(2, '0');

    // Attach system offset at the application boundary during memory reconstitution
    const offset = this.getSystemIsoOffset();

    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}${offset}`;
  }

  /**
   * Calculates absolute day deltas fully isolated inside the UTC plane.
   * @param {Date|string} dateVal1 - First date.
   * @param {Date|string} dateVal2 - Second date.
   * @returns {number} Absolute difference in days.
   * @throws {SheetDB.ValidationError} If inputs fail basic date parser checks.
   */
  static diffInDays(dateVal1, dateVal2) {
    const safe1 = this.toSheetSafeValue(dateVal1).split(' ')[0]; // Extract YYYY-MM-DD segment
    const safe2 = this.toSheetSafeValue(dateVal2).split(' ')[0];

    const d1 = new Date(`${safe1}T00:00:00Z`);
    const d2 = new Date(`${safe2}T00:00:00Z`);

    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      const errClass = (typeof SheetDB !== 'undefined' && SheetDB.ValidationError) || Error;
      throw new errClass("Invalid date parameters encountered during delta computation step.");
    }

    const msDiff = Math.abs(d2.getTime() - d1.getTime());
    return Math.floor(msDiff / (1000 * 60 * 60 * 24));
  }

  /**
   * Validates if target date has breached its allowed payment window.
   * @param {string} dueDateStr - Target due date.
   * @param {number} [gracePeriodDays=7] - Allowed days.
   * @returns {boolean} True if past due past grace period.
   */
  static isPastGracePeriod(dueDateStr, gracePeriodDays = 7) {
    const safeDueDate = this.toSheetSafeValue(dueDateStr).split(' ')[0];
    const safeToday = this.toSheetSafeValue(new Date()).split(' ')[0];
    
    const dueDate = new Date(`${safeDueDate}T00:00:00Z`);
    const today = new Date(`${safeToday}T00:00:00Z`);
    
    if (today <= dueDate) return false;
    
    const elapsedDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return elapsedDays > gracePeriodDays;
  }

  /**
   * Parses a JSON time object and combines it with a date to form a native Date object.
   * @param {Object} timeObj - e.g. { hour: 8, minute: 15, period: "AM" }
   * @param {string|Date} dateVal - Target base date.
   * @returns {Date|null} Combined Date object.
   */
  static convertJsonToDate(timeObj, dateVal) {
    if (!timeObj || typeof timeObj !== 'object') return null;
    const { hour, minute, period } = timeObj;

    const errClass = (typeof SheetDB !== 'undefined' && SheetDB.ValidationError) || Error;
    if (typeof hour !== 'number' || hour < 1 || hour > 12) {
      throw new errClass(`Invalid hour value: '${hour}'. Must be a number between 1 and 12.`);
    }
    if (typeof minute !== 'number' || minute < 0 || minute > 59) {
      throw new errClass(`Invalid minute value: '${minute}'. Must be a number between 0 and 59.`);
    }
    if (period !== 'AM' && period !== 'PM') {
      throw new errClass(`Invalid period: '${period}'. Must be 'AM' or 'PM'.`);
    }

    let hrs = hour;
    if (period === 'PM' && hrs < 12) hrs += 12;
    if (period === 'AM' && hrs === 12) hrs = 0;

    let dt;
    if (this._isDate(dateVal)) {
      dt = new Date(dateVal.getTime());
    } else if (typeof dateVal === 'string') {
      const plainDate = dateVal.split('T')[0];
      const timeStr = `${hour}:${String(minute).padStart(2, '0')} ${period}`;
      const safeIso = this.fromParts(plainDate, timeStr);
      return new Date(safeIso);
    } else {
      dt = new Date(dateVal);
    }

    // ENFORCE EXCLUSIVE UTC MUTATION TO PRESERVE CONTAINER ISOLATION
    dt.setUTCHours(hrs, minute, 0, 0);
    return dt;
  }

  /**
   * Converts a native Date object back to a JSON time object.
   * @param {Date|string} dateVal - Target date.
   * @returns {Object|null} { hour, minute, period } hash.
   */
  static convertDateToJson(dateVal) {
    if (!dateVal) return null;
    let dt = dateVal;
    if (typeof dateVal === 'string') {
      dt = this.safeParseStringToDate(dateVal) || new Date(dateVal);
    }
    if (!this._isDate(dt)) return null;

    let hour = dt.getUTCHours();
    const minute = dt.getUTCMinutes();
    const period = hour >= 12 ? 'PM' : 'AM';

    hour = hour % 12;
    if (hour === 0) hour = 12;

    return { hour, minute, period };
  }

  /**
   * Calculates the difference in hours between two datetimes or time strings.
   * @param {Date|string} entryVal - Entry datetime.
   * @param {Date|string} exitVal - Exit datetime.
   * @returns {number|null} Duration in hours.
   */
  static calculateDuration(entryVal, exitVal) {
    if (!entryVal || !exitVal) return null;

    const self = this;
    const parseTimeToMinutes = (val) => {
      if (self._isDate(val)) {
        return val.getUTCHours() * 60 + val.getUTCMinutes();
      }
      if (typeof val === 'string') {
        const cleanStr = val.trim();
        if (cleanStr.includes(' ') && !cleanStr.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i)) {
          const dt = self.safeParseStringToDate(cleanStr) || new Date(cleanStr);
          if (self._isDate(dt)) {
            return dt.getUTCHours() * 60 + dt.getUTCMinutes();
          }
        }

        const match = cleanStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
        if (match) {
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const ampm = match[3];

          if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

          if (ampm) {
            const meridian = ampm.toUpperCase();
            if (hours < 1 || hours > 12) return null;
            if (meridian === 'PM' && hours < 12) hours += 12;
            if (meridian === 'AM' && hours === 12) hours = 0;
          }
          return hours * 60 + minutes;
        }

        const dt = self.safeParseStringToDate(cleanStr) || new Date(cleanStr);
        if (self._isDate(dt)) {
          return dt.getUTCHours() * 60 + dt.getUTCMinutes();
        }
      }
      return null;
    };

    let entryDate = entryVal;
    let exitDate = exitVal;

    if (typeof entryDate === 'string' && !entryDate.match(/^\d{1,2}:\d{2}(?:\s*(AM|PM))?$/i)) {
      entryDate = this.safeParseStringToDate(entryDate) || new Date(entryDate);
    }
    if (typeof exitDate === 'string' && !exitDate.match(/^\d{1,2}:\d{2}(?:\s*(AM|PM))?$/i)) {
      exitDate = this.safeParseStringToDate(exitDate) || new Date(exitDate);
    }

    if (this._isDate(entryDate) && this._isDate(exitDate)) {
      const diffMs = exitDate.getTime() - entryDate.getTime();
      return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    }

    const entryMin = parseTimeToMinutes(entryVal);
    const exitMin = parseTimeToMinutes(exitVal);

    if (entryMin === null || exitMin === null) return null;

    let diffMin = exitMin - entryMin;
    if (diffMin < 0) {
      diffMin += 24 * 60;
    }
    return parseFloat((diffMin / 60).toFixed(2));
  }
}

globalThis.DazzlingDateTime = DazzlingDateTime;

// Resolve Apps Script compilation order: bind prototype dynamically since AttendanceUtil loads first
if (typeof AttendanceUtil !== 'undefined') {
  Object.setPrototypeOf(AttendanceUtil, DazzlingDateTime);
}
