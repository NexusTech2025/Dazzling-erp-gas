/**
 * Specific validation rules for TeacherPaymentTransaction creation requests.
 * Path: DazzlingDB/Validate/TeacherPaymentTransactionPipeline.js
 */
const TeacherPaymentTransactionRules = [
  {
    name: "transaction_date",
    validator: (ctx) => {
      const { transaction_date } = ctx.payload;
      if (!transaction_date) {
        ctx.addError("transaction_date", "Transaction date is strictly required.");
        return false;
      }

      // Enforce YYYY-MM-DD format structure
      const dateStr = String(transaction_date);
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(dateStr)) {
        ctx.addError("transaction_date", "Date structural invalidity. Enforce explicit YYYY-MM-DD standard notation format.");
        return false;
      }

      // Parse with DazzlingDateTime to ensure cross-realm Date safety
      const parsedDate = DazzlingDateTime.safeParseStringToDate(dateStr);
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        ctx.addError("transaction_date", "Date structural invalidity. Enforce explicit YYYY-MM-DD standard notation format.");
        return false;
      }

      // Block future scheduling
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (parsedDate > today) {
        ctx.addError("transaction_date", "Future scheduling warning. Manual retroactive settlement entries cannot exist ahead of active calendar clock.");
        return false;
      }
      return true;
    }
  },
  {
    name: "salary_month",
    validator: (ctx) => {
      const { salary_month } = ctx.payload;
      if (!salary_month || String(salary_month).length !== 7) {
        ctx.addError("salary_month", "Format layout sizing error. Must match exactly 7 characters (YYYY-MM).");
        return false;
      }

      // Pattern: YYYY-MM
      const regex = /^[0-9]{4}-[0-9]{2}$/;
      if (!regex.test(salary_month)) {
        ctx.addError("salary_month", "Structural design mismatch. Enforce numeric calendar pattern format constraint.");
        return false;
      }

      const parts = salary_month.split("-");
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);

      // Coordinate limits
      if (month < 1 || month > 12) {
        ctx.addError("salary_month", "Calendar anomaly caught. Month coordinate must fall inside the range limit of 01 through 12.");
        return false;
      }

      // Target operational bounds (2020 to 2026)
      if (year < 2020 || year > 2026) {
        ctx.addError("salary_month", "Out of logical context calendar bounding. Target operational limit boundaries fall between 2020 and 2026.");
        return false;
      }

      return true;
    }
  }
];

// Global export for Google Apps Script execution context
globalThis.TeacherPaymentTransactionRules = TeacherPaymentTransactionRules;
