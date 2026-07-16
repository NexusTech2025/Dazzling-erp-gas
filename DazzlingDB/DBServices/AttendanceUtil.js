/**
 * AttendanceUtil - Specialized application context manager handling 
 * classroom attendance states, slot validation, and financial suspension controls.
 */
class AttendanceUtil {
  /**
   * Scans a student's ledger balances and applies sister-suspensions across split seat models.
   * Aligned with Decoupled Contract-to-Seat Model (Axiom 1).
   * @param {string} studentId - Unique record identifier resolved dynamically.
   * @param {DBContext} db - Active database context singleton.
   */
  static processStudentGatekeeping(studentId, db) {
    const enrollmentRepo = db.repository('Enrollment');
    const allocationRepo = db.repository('BatchAllocation');

    const activeEnrollments = enrollmentRepo.where({ student_id: studentId, status: 'active' });

    for (const enrollment of activeEnrollments) {
      const account = enrollment.studentFeeAccount(); // Hydrate relational model
      if (!account) continue;

      const installments = account.installments() || [];
      for (const installment of installments) {
        // Safe domain evaluation call inheriting from DazzlingDateTime
        if (this.isPastGracePeriod(installment.due_date, 7)) {
          // Breach verified: cascade state boundaries across parallel seat records
          allocationRepo.updateMany(
            { enrollment_id: enrollment.id, status: 'active' },
            { status: 'suspended' }
          );
        }
      }
    }
  }

  /**
   * Parses a JSON time object and combines it with a date to form a Date object with hours/minutes set as UTC.
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
    const isDateFn = (typeof SheetDB !== 'undefined' && SheetDB.isDate) || ((v) => Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()));
    
    if (isDateFn(dateVal)) {
      dt = new Date(dateVal.getTime());
    } else if (typeof dateVal === 'string') {
      const plainDate = dateVal.split('T')[0];
      dt = new Date(`${plainDate}T00:00:00Z`);
    } else {
      dt = new Date(dateVal);
    }

    dt.setUTCHours(hrs, minute, 0, 0);
    return dt;
  }

  /**
   * Converts a native Date object back to a JSON time object using local timezone accessors.
   * @param {Date|string} dateVal - Target date.
   * @returns {Object|null} { hour, minute, period } hash.
   */
  static convertDateToJson(dateVal) {
    if (!dateVal) return null;
    let dt = dateVal;
    if (typeof dateVal === 'string') {
      dt = new Date(dateVal);
    }
    const isDateFn = (typeof SheetDB !== 'undefined' && SheetDB.isDate) || ((v) => Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()));
    if (!isDateFn(dt)) return null;

    let hour = dt.getHours();
    const minute = dt.getMinutes();
    const period = hour >= 12 ? 'PM' : 'AM';

    hour = hour % 12;
    if (hour === 0) hour = 12;

    return { hour, minute, period };
  }
}

// Register securely into global container space without wiping properties
globalThis.AttendanceUtil = AttendanceUtil;
