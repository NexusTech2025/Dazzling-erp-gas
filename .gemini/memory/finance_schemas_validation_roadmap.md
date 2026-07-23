# Finance Schemas Validation Roadmap

---

## 1. Executive Summary

This roadmap defines **modular, decoupled validation rules** for each of the 4 core finance schemas in DazzlingDB:
1. [Payment.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/Payment.json) (`PAY-`)
2. [Installment.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/Installment.json) (`INS-`)
3. [StudentFeeAccount.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/StudentFeeAccount.json) (`SFA-`)
4. [MoneyTransaction.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/MoneyTransaction.json) (`MTX-`)

Each schema is assigned **3 standalone validation rules** matching the `ValidationEngine` and `ValidationContext` structure established in [ValidationEngine.js](E:/NAST/Dazzling/GAS/DazzlingDB/Validate/ValidationEngine.js). 

These rules can be executed individually during isolated single-entity mutations or combined into pipeline wrappers for multi-table transactions.

---

## 2. Validation Architecture Reference

All rules follow the `ValidationEngine` contract:

```javascript
{
  name: "rule_identifier",
  validator: (ctx) => {
    // Inspect ctx.payload and ctx.db
    // Return true if valid, false if invalid
  },
  onError: (ctx) => {
    ctx.addError(field_name, error_message);
  }
}
```

---

## 3. Schema-Specific Validation Rules Breakdown

### A. Payment Schema (`Payment.json`)

```
[Payment Entity]
├── Rule P1: payment_amount_positive
├── Rule P2: payment_method_enum_valid
└── Rule P3: payment_references_required
```

#### Rule P1: `payment_amount_positive`
* **Target Field**: `amount_paid`
* **Logic**: Validates that `amount_paid` is defined, numeric, non-NaN, and strictly greater than zero ($> 0$).
* **Code Spec**:
  ```javascript
  {
    name: "payment_amount_positive",
    validator: (ctx) => {
      const { amount_paid } = ctx.payload;
      if (amount_paid === undefined || amount_paid === null || isNaN(Number(amount_paid)) || Number(amount_paid) <= 0) {
        ctx.addError("amount_paid", "Payment amount_paid must be a valid numeric value strictly greater than 0.");
        return false;
      }
      return true;
    }
  }
  ```

#### Rule P2: `payment_method_enum_valid`
* **Target Field**: `payment_method`
* **Logic**: Validates that `payment_method` is present and matches one of the allowed schema choices: `["cash", "upi", "bank_transfer", "cheque"]`.
* **Code Spec**:
  ```javascript
  {
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
  }
  ```

#### Rule P3: `payment_references_required`
* **Target Fields**: `installment_id`, `student_fee_id`
* **Logic**: Verifies that both foreign keys are present and conform to primary key prefix formats (`INS-` and `SFA-`).
* **Code Spec**:
  ```javascript
  {
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
  ```

---

### B. Installment Schema (`Installment.json`)

```
[Installment Entity]
├── Rule I1: installment_due_amount_valid
├── Rule I2: installment_due_date_format
└── Rule I3: installment_status_transition_valid
```

#### Rule I1: `installment_due_amount_valid`
* **Target Field**: `due_amount`
* **Logic**: Validates that `due_amount` is defined, numeric, and positive ($> 0$).
* **Code Spec**:
  ```javascript
  {
    name: "installment_due_amount_valid",
    validator: (ctx) => {
      const { due_amount } = ctx.payload;
      if (due_amount === undefined || due_amount === null || isNaN(Number(due_amount)) || Number(due_amount) <= 0) {
        ctx.addError("due_amount", "Installment due_amount must be a valid positive number.");
        return false;
      }
      return true;
    }
  }
  ```

#### Rule I2: `installment_due_date_format`
* **Target Field**: `due_date`
* **Logic**: Validates that `due_date` is provided in `YYYY-MM-DD` standard notation format and parses safely using `DazzlingDateTime`.
* **Code Spec**:
  ```javascript
  {
    name: "installment_due_date_format",
    validator: (ctx) => {
      const { due_date } = ctx.payload;
      if (!due_date || !/^\d{4}-\d{2}-\d{2}$/.test(String(due_date))) {
        ctx.addError("due_date", "Installment due_date must be a valid ISO date in YYYY-MM-DD format.");
        return false;
      }
      return true;
    }
  }
  ```

#### Rule I3: `installment_status_transition_valid`
* **Target Fields**: `status`, `paid_amount`, `due_amount`
* **Logic**: Validates status enum (`pending`, `partially_paid`, `paid`, `overdue`) and ensures `paid_amount` does not exceed `due_amount` unexpectedly.
* **Code Spec**:
  ```javascript
  {
    name: "installment_status_transition_valid",
    validator: (ctx) => {
      const { status, paid_amount, due_amount } = ctx.payload;
      const allowedStatus = ["pending", "partially_paid", "paid", "overdue"];
      if (status && !allowedStatus.includes(status)) {
        ctx.addError("status", "Invalid installment status. Allowed: pending, partially_paid, paid, overdue.");
        return false;
      }
      if (paid_amount !== undefined && due_amount !== undefined) {
        if (Number(paid_amount) < 0) {
          ctx.addError("paid_amount", "paid_amount cannot be negative.");
          return false;
        }
      }
      return true;
    }
  }
  ```

---

### C. StudentFeeAccount Schema (`StudentFeeAccount.json`)

```
[StudentFeeAccount Entity]
├── Rule S1: fee_account_totals_positive
├── Rule S2: fee_account_adjustment_type_valid
└── Rule S3: fee_account_balance_due_integrity
```

#### Rule S1: `fee_account_totals_positive`
* **Target Fields**: `total_fee`, `discount`, `final_fee`
* **Logic**: Validates that `total_fee` and `discount` are non-negative numbers, and `final_fee` equals `(total_fee - discount)`.
* **Code Spec**:
  ```javascript
  {
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
  }
  ```

#### Rule S2: `fee_account_adjustment_type_valid`
* **Target Fields**: `adjustment_type`, `coupon_code`
* **Logic**: Validates `adjustment_type` enum (`scholarship`, `coupon`, `referral`, `manual_override`, `none`). If type is `coupon`, requires non-empty `coupon_code`.
* **Code Spec**:
  ```javascript
  {
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
  }
  ```

#### Rule S3: `fee_account_balance_due_integrity`
* **Target Fields**: `amount_paid`, `balance_due`, `status`
* **Logic**: Verifies `balance_due = Math.max(0, final_fee - amount_paid)` and validates status choice (`active`, `completed`, `defaulted`, `refunded`).
* **Code Spec**:
  ```javascript
  {
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
  ```

---

### D. MoneyTransaction Schema (`MoneyTransaction.json`)

```
[MoneyTransaction Entity]
├── Rule M1: money_transaction_amount_type_valid
├── Rule M2: money_transaction_counterparty_and_by
└── Rule M3: money_transaction_party_polymorphic_valid
```

#### Rule M1: `money_transaction_amount_type_valid`
* **Target Fields**: `amount`, `type`
* **Logic**: Validates that `amount` is a number $\ge 0.01$ and `type` is strictly `'in'` (revenue) or `'out'` (expense).
* **Code Spec**:
  ```javascript
  {
    name: "money_transaction_amount_type_valid",
    validator: (ctx) => {
      const { amount, type } = ctx.payload;
      if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) < 0.01) {
        ctx.addError("amount", "Transaction amount must be a number >= 0.01.");
        return false;
      }
      if (!type || !["in", "out"].includes(String(type).toLowerCase())) {
        ctx.addError("type", "Transaction type must be either 'in' or 'out'.");
        return false;
      }
      return true;
    }
  }
  ```

#### Rule M2: `money_transaction_counterparty_and_by`
* **Target Fields**: `by`, `from_to`, `category_id`
* **Logic**: Enforces non-empty string validation for system handler (`by`), counterparty label (`from_to`), and expense category (`category_id` FK).
* **Code Spec**:
  ```javascript
  {
    name: "money_transaction_counterparty_and_by",
    validator: (ctx) => {
      const { by, from_to, category_id } = ctx.payload;
      if (!by || String(by).trim() === "") {
        ctx.addError("by", "'by' (handler signature) is required.");
        return false;
      }
      if (!from_to || String(from_to).trim() === "") {
        ctx.addError("from_to", "'from_to' (counterparty label) is required.");
        return false;
      }
      if (!category_id || String(category_id).trim() === "") {
        ctx.addError("category_id", "'category_id' (ExpenseCategory FK) is required.");
        return false;
      }
      return true;
    }
  }
  ```

#### Rule M3: `money_transaction_party_polymorphic_valid`
* **Target Fields**: `party_type`, `payment_method`
* **Logic**: Validates `party_type` choice (`student`, `teacher`, `staff`, `external`) and `payment_method` choice (`cash`, `paytm`, `phonepe`, `bank`, `other`).
* **Code Spec**:
  ```javascript
  {
    name: "money_transaction_party_polymorphic_valid",
    validator: (ctx) => {
      const { party_type, payment_method } = ctx.payload;
      const allowedParties = ["student", "teacher", "staff", "external"];
      const allowedMethods = ["cash", "paytm", "phonepe", "bank", "other"];

      if (!party_type || !allowedParties.includes(String(party_type).toLowerCase())) {
        ctx.addError("party_type", "Invalid party_type. Allowed: student, teacher, staff, external.");
        return false;
      }
      if (!payment_method || !allowedMethods.includes(String(payment_method).toLowerCase())) {
        ctx.addError("payment_method", "Invalid payment_method. Allowed: cash, paytm, phonepe, bank, other.");
        return false;
      }
      return true;
    }
  }
  ```

---

## 4. Recombination Strategy

When executing multi-table transactions (e.g., Student Payment Transaction), individual rules are composed dynamically:

```javascript
// Example: Composed Student Payment Validation Pipeline
const StudentPaymentPipelineRules = [
  PaymentRules.payment_amount_positive,
  PaymentRules.payment_method_enum_valid,
  PaymentRules.payment_references_required,
  InstallmentRules.installment_due_amount_valid
];

// Execute via ValidationEngine
const ctx = new ValidationContext(db, entityId, payload);
ValidationEngine.run(ctx, StudentPaymentPipelineRules);
```
