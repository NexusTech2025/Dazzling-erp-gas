/**
 * @file FinanceValidationPipeline.js
 * Path: DazzlingDB/Validate/FinanceValidationPipeline.js
 * 
 * Standalone validation rule object mappings for Payment, Installment, and StudentFeeAccount entities.
 * Rules are indexed by unique rule keys so individual validations can be selected and run manually.
 */

/**
 * Validation rules for Payment entity records.
 */
const PaymentValidationRules = {
  /**
   * Rule: payment_amount_positive
   * Validates that amount_paid is a defined numeric value strictly greater than 0.
   */
  payment_amount_positive: {
    name: "payment_amount_positive",
    validator: (ctx) => {
      const { amount_paid } = ctx.payload;
      if (amount_paid === undefined || amount_paid === null || isNaN(Number(amount_paid)) || Number(amount_paid) <= 0) {
        ctx.addError("amount_paid", "Payment amount_paid must be a valid numeric value strictly greater than 0.");
        return false;
      }
      return true;
    }
  },

  /**
   * Rule: payment_method_enum_valid
   * Validates that payment_method matches one of the allowed choices (cash, upi, bank_transfer, cheque).
   */
  payment_method_enum_valid: {
    name: "payment_method_enum_valid",
    validator: (ctx) => {
      const { payment_method } = ctx.payload;
      const allowed = ["cash", "upi", "bank_transfer", "cheque"];
      if (!payment_method || !allowed.includes(String(payment_method).toLowerCase())) {
        ctx.addError("payment_method", "Invalid payment_method. Allowed choices: cash, upi, bank_transfer, cheque.");
        return false;
      }
      return true;
    }
  },

  /**
   * Rule: payment_date_format_valid
   * Validates that payment_date is a valid date string or Date object using cross-realm safe checks.
   */
  payment_date_format_valid: {
    name: "payment_date_format_valid",
    validator: (ctx) => {
      const { payment_date } = ctx.payload;
      if (!payment_date) return true; // Optional on payload input; defaults to current clock if omitted

      const isCrossRealmDate = typeof SheetDB !== 'undefined' && SheetDB.isDate ? SheetDB.isDate(payment_date) : (payment_date instanceof Date);
      if (isCrossRealmDate) return true;

      const parsedDate = typeof DazzlingDateTime !== 'undefined' && DazzlingDateTime.safeParseStringToDate
        ? DazzlingDateTime.safeParseStringToDate(String(payment_date))
        : new Date(payment_date);

      if (!parsedDate || isNaN(parsedDate.getTime())) {
        ctx.addError("payment_date", "Payment date structural invalidity. Enforce valid date notation format.");
        return false;
      }
      return true;
    }
  },

  /**
   * Rule: payment_references_required
   * Enforces the presence and prefix structure of target foreign keys (INS- for installment, SFA- for fee account).
   */
  payment_references_required: {
    name: "payment_references_required",
    validator: (ctx) => {
      const { installment_id, student_fee_id } = ctx.payload;
      if (!installment_id || !String(installment_id).startsWith("INS-")) {
        ctx.addError("installment_id", "Valid 'installment_id' (INS-xxx) is required.");
        return false;
      }
      if (!student_fee_id || !String(student_fee_id).startsWith("SFA-")) {
        ctx.addError("student_fee_id", "Valid 'student_fee_id' (SFA-xxx) is required.");
        return false;
      }
      return true;
    }
  }
};

/**
 * Validation rules for Installment entity records.
 */
const InstallmentValidationRules = {
  /**
   * Rule: installment_due_amount_valid
   * Validates that due_amount is a positive non-zero number.
   */
  installment_due_amount_valid: {
    name: "installment_due_amount_valid",
    validator: (ctx) => {
      const { due_amount } = ctx.payload;
      if (due_amount === undefined || due_amount === null || isNaN(Number(due_amount)) || Number(due_amount) <= 0) {
        ctx.addError("due_amount", "Installment due_amount must be a valid positive number.");
        return false;
      }
      return true;
    }
  },

  /**
   * Rule: installment_due_date_format
   * Validates that due_date is provided and parses into a valid calendar date.
   */
  installment_due_date_format: {
    name: "installment_due_date_format",
    validator: (ctx) => {
      const { due_date } = ctx.payload;
      if (!due_date) {
        ctx.addError("due_date", "Installment due_date is strictly required.");
        return false;
      }
      const isCrossRealmDate = typeof SheetDB !== 'undefined' && SheetDB.isDate ? SheetDB.isDate(due_date) : (due_date instanceof Date);
      if (isCrossRealmDate) return true;

      const parsedDate = typeof DazzlingDateTime !== 'undefined' && DazzlingDateTime.safeParseStringToDate
        ? DazzlingDateTime.safeParseStringToDate(String(due_date))
        : new Date(due_date);

      if (!parsedDate || isNaN(parsedDate.getTime())) {
        ctx.addError("due_date", "Installment due_date must be a valid ISO date in YYYY-MM-DD format.");
        return false;
      }
      return true;
    }
  },

  /**
   * Rule: installment_status_transition_valid
   * Validates status choices and ensures paid_amount is non-negative.
   */
  installment_status_transition_valid: {
    name: "installment_status_transition_valid",
    validator: (ctx) => {
      const { status, paid_amount } = ctx.payload;
      const allowedStatus = ["pending", "partially_paid", "paid", "overdue"];
      if (status && !allowedStatus.includes(status)) {
        ctx.addError("status", "Invalid installment status. Allowed: pending, partially_paid, paid, overdue.");
        return false;
      }
      if (paid_amount !== undefined && Number(paid_amount) < 0) {
        ctx.addError("paid_amount", "paid_amount cannot be negative.");
        return false;
      }
      return true;
    }
  }
};

/**
 * Validation rules for StudentFeeAccount master records.
 */
const StudentFeeAccountValidationRules = {
  /**
   * Rule: fee_account_totals_positive
   * Validates that total_fee, discount, and final_fee are non-negative and mathematically consistent.
   */
  fee_account_totals_positive: {
    name: "fee_account_totals_positive",
    validator: (ctx) => {
      const { total_fee, discount, final_fee } = ctx.payload;
      const total = Number(total_fee || 0);
      const disc = Number(discount || 0);
      const finalVal = Number(final_fee || 0);

      if (total < 0 || disc < 0 || finalVal < 0) {
        ctx.addError("totals", "Fee amounts (total_fee, discount, final_fee) must be non-negative numbers.");
        return false;
      }
      if (final_fee !== undefined && Math.abs(finalVal - (total - disc)) > 0.01) {
        ctx.addError("final_fee", "final_fee must equal (total_fee - discount).");
        return false;
      }
      return true;
    }
  },

  /**
   * Rule: fee_account_adjustment_type_valid
   * Validates adjustment_type choices and requires coupon_code when set to 'coupon'.
   */
  fee_account_adjustment_type_valid: {
    name: "fee_account_adjustment_type_valid",
    validator: (ctx) => {
      const { adjustment_type, coupon_code } = ctx.payload;
      const allowed = ["scholarship", "coupon", "referral", "manual_override", "none"];
      if (adjustment_type && !allowed.includes(adjustment_type)) {
        ctx.addError("adjustment_type", "Invalid adjustment_type choice.");
        return false;
      }
      if (adjustment_type === "coupon" && (!coupon_code || String(coupon_code).trim() === "")) {
        ctx.addError("coupon_code", "coupon_code is required when adjustment_type is set to 'coupon'.");
        return false;
      }
      return true;
    }
  },

  /**
   * Rule: fee_account_balance_due_integrity
   * Verifies that balance_due accurately reflects (final_fee - amount_paid) and checks status validity.
   */
  fee_account_balance_due_integrity: {
    name: "fee_account_balance_due_integrity",
    validator: (ctx) => {
      const { final_fee, amount_paid, balance_due, status } = ctx.payload;
      const allowedStatus = ["active", "completed", "defaulted", "refunded"];
      if (status && !allowedStatus.includes(status)) {
        ctx.addError("status", "Invalid account status choice.");
        return false;
      }
      if (final_fee !== undefined && amount_paid !== undefined && balance_due !== undefined) {
        const expectedBalance = Math.max(0, Number(final_fee) - Number(amount_paid));
        if (Math.abs(Number(balance_due) - expectedBalance) > 0.01) {
          ctx.addError("balance_due", "balance_due must accurately reflect (final_fee - amount_paid).");
          return false;
        }
      }
      return true;
    }
  }
};

// Global registration for Google Apps Script execution environment
globalThis.PaymentValidationRules = PaymentValidationRules;
globalThis.InstallmentValidationRules = InstallmentValidationRules;
globalThis.StudentFeeAccountValidationRules = StudentFeeAccountValidationRules;
