/**
 * @file AttendanceUtil.js
 * Utility services for time-arithmetic and dynamic duration calculation.
 */

const AttendanceUtil = {
  /**
   * Parses a JSON time object and combines it with a date to form a native Date object.
   * 
   * @param {Object} timeObj - e.g., { hour: 8, minute: 15, period: "AM" }
   * @param {string|Date} dateVal - e.g., "2026-06-11" or a Date object
   * @returns {Date|null} Native Date object or null.
   */
  convertJsonToDate(timeObj, dateVal) {
    if (!timeObj || typeof timeObj !== 'object') return null;
    const { hour, minute, period } = timeObj;

    // Component validation
    if (typeof hour !== 'number' || hour < 1 || hour > 12) {
      throw new Error(`Invalid hour value: '${hour}'. Must be a number between 1 and 12.`);
    }
    if (typeof minute !== 'number' || minute < 0 || minute > 59) {
      throw new Error(`Invalid minute value: '${minute}'. Must be a number between 0 and 59.`);
    }
    if (period !== 'AM' && period !== 'PM') {
      throw new Error(`Invalid period: '${period}'. Must be 'AM' or 'PM'.`);
    }

    let hrs = hour;
    if (period === 'PM' && hrs < 12) hrs += 12;
    if (period === 'AM' && hrs === 12) hrs = 0;

    // Parse base date safely without timezone offset shifting
    let dt;
    const isDateObj = globalThis.isDate ? globalThis.isDate : (d => d instanceof Date && !isNaN(d.getTime()));
    
    if (isDateObj(dateVal)) {
      dt = new Date(dateVal.getTime());
    } else if (typeof dateVal === 'string') {
      const cleanDateStr = dateVal.split('T')[0];
      dt = new Date(cleanDateStr.replace(/-/g, '/'));
    } else {
      dt = new Date(dateVal);
    }

    dt.setHours(hrs, minute, 0, 0);
    return dt;
  },

  /**
   * Converts a native Date object back to a JSON time object.
   * 
   * @param {Date|string} dateVal - Native Date object or formatted string.
   * @returns {Object|null} { hour, minute, period } or null.
   */
  convertDateToJson(dateVal) {
    if (!dateVal) return null;

    let dt = dateVal;
    if (typeof dateVal === 'string') {
      dt = new Date(dateVal);
    }

    const isDateObj = globalThis.isDate ? globalThis.isDate : (d => d instanceof Date && !isNaN(d.getTime()));
    if (!isDateObj(dt)) return null;

    let hour = dt.getHours();
    const minute = dt.getMinutes();
    const period = hour >= 12 ? 'PM' : 'AM';

    hour = hour % 12;
    if (hour === 0) hour = 12;

    return { hour, minute, period };
  },

  /**
   * Calculates the difference in hours between two datetimes or time-only strings.
   * 
   * @param {Date|string} entryVal - Entry datetime or time-only string (e.g. "08:00 AM").
   * @param {Date|string} exitVal - Exit datetime or time-only string (e.g. "01:00 PM").
   * @returns {number|null} Elapsed hours rounded to 2 decimal places, or null.
   */
  calculateDuration(entryVal, exitVal) {
    if (!entryVal || !exitVal) return null;

    const isDateObj = globalThis.isDate ? globalThis.isDate : (d => d instanceof Date && !isNaN(d.getTime()));

    // Helper to extract minutes since midnight for time-only strings or Dates
    const parseTimeToMinutes = (val) => {
      if (isDateObj(val)) {
        return val.getHours() * 60 + val.getMinutes();
      }
      if (typeof val === 'string') {
        const cleanStr = val.trim();

        // If it looks like a full Date/DateTime string, avoid simple regex matching
        if (cleanStr.includes(' ') && !cleanStr.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i)) {
          const dt = new Date(cleanStr);
          if (isDateObj(dt)) {
            return dt.getHours() * 60 + dt.getMinutes();
          }
        }

        // Match standard 12-hour or 24-hour time strings
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

        // Fallback generic date parser
        const dt = new Date(cleanStr);
        if (isDateObj(dt)) {
          return dt.getHours() * 60 + dt.getMinutes();
        }
      }
      return null;
    };

    let entryDate = entryVal;
    let exitDate = exitVal;

    // Convert strings to Dates ONLY if they do NOT match simple time formats
    if (typeof entryDate === 'string' && !entryDate.match(/^\d{1,2}:\d{2}(?:\s*(AM|PM))?$/i)) {
      entryDate = new Date(entryDate);
    }
    if (typeof exitDate === 'string' && !exitDate.match(/^\d{1,2}:\d{2}(?:\s*(AM|PM))?$/i)) {
      exitDate = new Date(exitDate);
    }

    // Direct millisecond subtraction for native Date objects
    if (isDateObj(entryDate) && isDateObj(exitDate)) {
      const diffMs = exitDate.getTime() - entryDate.getTime();
      return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    }

    // Minutes-based modulo math fallback for time-only strings
    const entryMin = parseTimeToMinutes(entryVal);
    const exitMin = parseTimeToMinutes(exitVal);

    if (entryMin === null || exitMin === null) return null;

    let diffMin = exitMin - entryMin;
    if (diffMin < 0) {
      diffMin += 24 * 60; // Overnight rollover
    }

    return parseFloat((diffMin / 60).toFixed(2));
  }
};

// Bind to global scope for testing and accessibility
globalThis.AttendanceUtil = AttendanceUtil;
