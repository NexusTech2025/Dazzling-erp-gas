# Student Payment Transaction Lifecycle Roadmap

---

## 1. Executive Summary

This document defines the structural roadmap and operational workflow for processing student fee payment transactions in the Dazzling ERP Admin system.

When a student makes a payment against an installment—whether a **partial amount** or a **full settlement**—the payment executes an **atomic 3-step core pipeline** across three core fee tables ([Payment.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/Payment.json), [Installment.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/Installment.json), and [StudentFeeAccount.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/StudentFeeAccount.json)) to maintain student financial balance integrity.

The general ledger recording ([MoneyTransaction.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/MoneyTransaction.json)) is **fully decoupled** from the core payment pipeline and can be triggered independently via a separate API request.

---

## 2. Initial State Model

Suppose a student has a fee account with a total fee of **₹15,000** split into **3 installments of ₹5,000 each**:

```
[StudentFeeAccount: SFA-1001]
├── total_fee: ₹15,000
├── final_fee: ₹15,000
├── amount_paid: ₹0
├── balance_due: ₹15,000
└── status: "active"

[Installments]
├── INS-01: due_amount = ₹5,000 | paid_amount = ₹0 | status = "pending"
├── INS-02: due_amount = ₹5,000 | paid_amount = ₹0 | status = "pending"
└── INS-03: due_amount = ₹5,000 | paid_amount = ₹0 | status = "pending"
```

---

## 3. Core Atomic 3-Step Transaction Pipeline

When a payment call is executed (submitting `student_fee_id`, `installment_id`, `amount_paid`, `payment_method`, `transaction_reference`), the system processes the following 3 steps in a single atomic transaction:

```
                      ┌─────────────────────────────────┐
                      │    Incoming Payment Payload     │
                      │ (installment_id, amount_paid,   │
                      │   payment_method, reference)    │
                      └────────────────┬────────────────┘
                                       │
                                       ▼
                      ┌─────────────────────────────────┐
                      │ Step 1: Insert Payment Receipt  │
                      │      Table: Payment (PAY-xxx)   │
                      └────────────────┬────────────────┘
                                       │
                                       ▼
                      ┌─────────────────────────────────┐
                      │ Step 2: Update Target           │
                      │         Installment             │
                      │    Table: Installment (INS-xxx) │
                      │  - Increment paid_amount        │
                      │  - Recalculate status           │
                      └────────────────┬────────────────┘
                                       │
                                       ▼
                      ┌─────────────────────────────────┐
                      │ Step 3: Update Master Account   │
                      │ Table: StudentFeeAccount(SFA)   │
                      │  - Increment amount_paid        │
                      │  - Decrement balance_due        │
                      │  - Recalculate overall status   │
                      └─────────────────────────────────┘
```

---

## 4. Concrete Numerical Scenarios

### Scenario A: Partial Payment (Student pays ₹2,000 out of ₹5,000)

1. **Insert [Payment.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/Payment.json) Record**:
   ```json
   {
     "payment_id": "PAY-8F92A1",
     "student_fee_id": "SFA-1001",
     "installment_id": "INS-01",
     "amount_paid": 2000,
     "payment_date": "2026-07-22T16:15:00.000Z",
     "payment_method": "upi",
     "transaction_reference": "UPI-9988776655",
     "status": "success"
   }
   ```

2. **Update [Installment.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/Installment.json) (`INS-01`)**:
   * `paid_amount` = $0 + 2,000 = \mathbf{₹2,000}$
   * Remaining Installment Due = $5,000 - 2,000 = \mathbf{₹3,000}$
   * Since $0 < paid\_amount < due\_amount$, `status` evaluates to **`"partially_paid"`**.

3. **Update [StudentFeeAccount.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/StudentFeeAccount.json) (`SFA-1001`)**:
   * `amount_paid` = $0 + 2,000 = \mathbf{₹2,000}$
   * `balance_due` = $15,000 - 2,000 = \mathbf{₹13,000}$
   * `status` remains **`"active"`**.

---

### Scenario B: Subsequent Full Settlement of Remaining Installment (Student pays ₹3,000 on `INS-01`)

1. **Insert `Payment` Record**:
   * `payment_id`: `"PAY-8F92A2"`, `amount_paid`: `3000`, `installment_id`: `"INS-01"`.

2. **Update `Installment` (`INS-01`)**:
   * `paid_amount` = $2,000 + 3,000 = \mathbf{₹5,000}$
   * Remaining Installment Due = $5,000 - 5,000 = \mathbf{₹0}$
   * Since $paid\_amount \ge due\_amount$, `status` evaluates to **`"paid"`**.

3. **Update `StudentFeeAccount` (`SFA-1001`)**:
   * `amount_paid` = $2,000 + 3,000 = \mathbf{₹5,000}$
   * `balance_due` = $13,000 - 3,000 = \mathbf{₹10,000}$
   * `next_due_date` automatically updates to point to `INS-02`'s due date.

---

### Scenario C: Excess / Overflow Payment (Student pays ₹7,000 when `INS-01` due is ₹5,000)

If a student pays more than the single target installment due amount, the system handles it in one of two ways:

* **Cascade Allocation (Recommended Standard)**:
  * System allocates **₹5,000** to `INS-01` $\rightarrow$ marks `INS-01` as **`"paid"`**.
  * System automatically overflows remaining **₹2,000** into `INS-02` $\rightarrow$ marks `INS-02` as **`"partially_paid"`**.
* **Account-Level Single Credit**:
  * Credit full ₹7,000 to `INS-01` (`paid_amount: ₹7,000`, status: `"paid"`).
  * `StudentFeeAccount.balance_due` correctly reflects ₹8,000 remaining ($15,000 - 7,000$).

---

## 5. Decoupled General Ledger Sync ([MoneyTransaction.json](E:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/MoneyTransaction.json))

Recording payments in the institution's cashbook general ledger is **decoupled** from the core student fee payment transaction. It can be invoked via a separate API endpoint (e.g., `finance_record_money_transaction`) either synchronously upon payment confirmation or asynchronously during daily cashier reconciliation.

```json
{
  "transaction_id": "MTX-3A9F10",
  "amount": 2000,
  "type": "in",
  "by": "Admin User / Cashier",
  "from_to": "Student: Rahul Sharma",
  "category_id": "EXC-STUDENT-FEE",
  "payment_method": "upi",
  "payment_reference": "UPI-9988776655",
  "reconciliation_status": "unreconciled",
  "party_type": "student",
  "party_id": "STU-1001",
  "party_name": "Rahul Sharma",
  "transaction_date": "2026-07-22",
  "notes": "Partial payment for Installment #1 (INS-01)"
}
```

### Architectural Benefits of Decoupled Ledger Sync
* **Fail-Safe Processing**: Accounting rules or expense category validation failures cannot lock or roll back student payment receipts.
* **Batch Reconciliation**: Allows accounting staff to record or audit ledger entries independently of frontline fee collection.

---

## 6. Implementation Blueprint / Pseudocode

### A. Core Student Payment Action (`finance_record_payment`)

```javascript
function processStudentPayment(payload, db) {
  const { student_fee_id, installment_id, amount_paid, payment_method, reference, user } = payload;

  // 1. Fetch & Validate Entities
  const feeAccount = db.StudentFeeAccount.findById(student_fee_id);
  const installment = db.Installment.findById(installment_id);

  if (!feeAccount || !installment) throw new Error("Fee account or installment not found");
  if (amount_paid <= 0) throw new Error("Payment amount must be greater than zero");

  // 2. Step 1: Create Payment Receipt
  const paymentRecord = db.Payment.insert({
    student_fee_id,
    installment_id,
    amount_paid,
    payment_date: new Date().toISOString(),
    payment_method,
    transaction_reference: reference,
    status: "success",
    created_by: user.name
  });

  // 3. Step 2: Update Installment
  const newInstPaid = (installment.paid_amount || 0) + amount_paid;
  let instStatus = "partially_paid";
  if (newInstPaid >= installment.due_amount) {
    instStatus = "paid";
  }
  db.Installment.update(installment_id, {
    paid_amount: newInstPaid,
    status: instStatus
  });

  // 4. Step 3: Update Student Fee Account
  const newAccPaid = (feeAccount.amount_paid || 0) + amount_paid;
  const newBalance = Math.max(0, (feeAccount.final_fee || 0) - newAccPaid);
  const accStatus = newBalance === 0 ? "completed" : "active";

  db.StudentFeeAccount.update(student_fee_id, {
    amount_paid: newAccPaid,
    balance_due: newBalance,
    status: accStatus
  });

  return { success: true, payment_id: paymentRecord.payment_id, balance_due: newBalance };
}
```

### B. Decoupled General Ledger Action (`finance_record_money_transaction`)

```javascript
function recordMoneyTransaction(payload, db) {
  const { amount, party_id, party_name, category_id, payment_method, reference, notes, user } = payload;

  if (amount <= 0) throw new Error("Transaction amount must be greater than zero");

  const transactionRecord = db.MoneyTransaction.insert({
    amount,
    type: "in",
    party_type: "student",
    party_id,
    party_name,
    category_id: category_id || "EXC-STUDENT-FEE",
    payment_method,
    payment_reference: reference,
    reconciliation_status: "unreconciled",
    transaction_date: new Date().toISOString().split("T")[0],
    by: user.name,
    notes: notes || "Student fee payment cash inflow"
  });

  return { success: true, transaction_id: transactionRecord.transaction_id };
}
```
