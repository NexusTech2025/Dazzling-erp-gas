/**
 * DazzlingDB Teacher Salary Calculation Engine
 * Designed for optimized, single-pass in-memory payroll resolutions over SheetDB.
 * Path: DazzlingDB/DBServices/StaffService_TeacherSalaryCalculationEngine.js
 */

// =========================================================================
// STANDALONE MODULAR UTILITIES (Single Responsibility & Decoupled Scope)
// =========================================================================

/**
 * Resolves flat temporal strategies while handling mid-month proration exceptions.
 * @param {Object} config - The TeacherSalaryConfig record.
 * @param {string} billingMonth - Target YYYY-MM month.
 * @returns {Object} { amount, notes }
 */
function resolveProratedTemporalStrategy(config, billingMonth) {
  const baseValue = Number(config.base_value);
  const rateType = config.rate_type;

  if (isNaN(baseValue) || baseValue <= 0) {
    throw new SheetDB.ValidationError(`[PAYROLL ERROR] Invalid base_value '${config.base_value}' on TSC: ${config.salary_config_id}. Must be a positive number.`);
  }

  const parts = billingMonth.split("-");
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;

  const firstOfMonth = new Date(year, monthIdx, 1);
  const lastOfMonth = new Date(year, monthIdx + 1, 0);
  const totalDaysInMonth = lastOfMonth.getDate();

  const configFrom = new Date(config.effective_from);
  if (isNaN(configFrom.getTime())) {
    throw new SheetDB.ValidationError(`[PAYROLL ERROR] Invalid effective_from date '${config.effective_from}' on TSC: ${config.salary_config_id}.`);
  }

  const configTo = config.effective_to ? new Date(config.effective_to) : null;
  if (configTo && isNaN(configTo.getTime())) {
    throw new SheetDB.ValidationError(`[PAYROLL ERROR] Invalid effective_to date '${config.effective_to}' on TSC: ${config.salary_config_id}.`);
  }

  const calculationStart = configFrom > firstOfMonth ? configFrom : firstOfMonth;
  let calculationEnd = lastOfMonth;
  if (configTo && configTo < lastOfMonth) {
    calculationEnd = configTo;
  }

  const diffTime = calculationEnd.getTime() - calculationStart.getTime();
  const activeDaysCount = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

  let targetMonthlyBase = rateType === "yearly" ? (baseValue / 12) : baseValue;
  let finalCalculatedAmount = targetMonthlyBase;
  let noteSummary = "";

  if (activeDaysCount < totalDaysInMonth) {
    finalCalculatedAmount = targetMonthlyBase * (activeDaysCount / totalDaysInMonth);
    noteSummary = `Prorated compensation applied: ${activeDaysCount}/${totalDaysInMonth} active days. `;
  } else {
    noteSummary = `Full standard month salary applied. `;
  }

  return {
    amount: Number(finalCalculatedAmount.toFixed(2)),
    notes: `${noteSummary}Base: ₹${targetMonthlyBase.toFixed(2)}. Active Window: [${calculationStart.toISOString().split('T')[0]} to ${calculationEnd.toISOString().split('T')[0]}].`
  };
}

/**
 * Distributes computed base payroll across batch/global scopes.
 * @param {Object} config - The TeacherSalaryConfig record.
 * @param {number} baseAmount - Payout baseline.
 * @param {string} summaryNote - Log description.
 * @param {string} billingMonth - Target YYYY-MM month.
 * @returns {Array<Object>} List of distributed payouts.
 */
function distributeBaseValueOverScope(config, baseAmount, summaryNote, billingMonth) {
  const scopeType = config.scope_type;
  const scopeIdString = config.scope_id;
  let distributions = [];

  if (scopeType === "batch_group" && !scopeIdString) {
    throw new SheetDB.ValidationError(`[PAYROLL ERROR] scope_id is required when scope_type is batch_group on TSC: ${config.salary_config_id}.`);
  }
  if (scopeType === "single_batch" && !scopeIdString) {
    throw new SheetDB.ValidationError(`[PAYROLL ERROR] scope_id is required when scope_type is single_batch on TSC: ${config.salary_config_id}.`);
  }

  if (scopeType === "batch_group" && scopeIdString) {
    let weightMap;
    try {
      weightMap = JSON.parse(scopeIdString);
    } catch (e) {
      throw new SheetDB.ValidationError(`[MALFORMED JSON] scope_id inside TSC '${config.salary_config_id}' must be valid JSON when scope is batch_group.`);
    }

    let totalWeight = 0;
    Object.keys(weightMap).forEach(k => {
      totalWeight += Number(weightMap[k]);
    });

    if (Math.abs(100.0 - totalWeight) > 0.01) {
      throw new SheetDB.ValidationError(`[INVALID WEIGHTS] TSC '${config.salary_config_id}' weightage total must equal 100%. Got: ${totalWeight}%`);
    }

    for (let batchId in weightMap) {
      const weight = Number(weightMap[batchId]);
      const calculatedShare = baseAmount * (weight / 100);

      distributions.push({
        entity_id: config.entity_id,
        entity_type: config.entity_type,
        salary_config_id: config.salary_config_id,
        payment_type: "salary",
        amount: Number(calculatedShare.toFixed(2)),
        payment_mode: "bank_transfer",
        transaction_date: new Date(),
        salary_month: billingMonth,
        notes: `${summaryNote} Batch Scope Target: ${batchId}. Split Weightage: ${weight}%. Net: ₹${calculatedShare.toFixed(2)}.`
      });
    }
  } else {
    distributions.push({
      entity_id: config.entity_id,
      entity_type: config.entity_type,
      salary_config_id: config.salary_config_id,
      payment_type: "salary",
      amount: Number(baseAmount.toFixed(2)),
      payment_mode: "bank_transfer",
      transaction_date: new Date(),
      salary_month: billingMonth,
      notes: `${summaryNote} Target Scope Boundary: ${scopeIdString || "Global Systems Block"}.`
    });
  }

  return distributions;
}

/**
 * Calculates variable dynamic revenue percentage payouts based on fee collections.
 * @param {Object} db - Database singleton context.
 * @param {Object} config - The TeacherSalaryConfig record.
 * @param {string} billingMonth - Target YYYY-MM month.
 * @returns {Array<Object>} List of dynamic payouts.
 */
function calculateDynamicRevenuePercentage(db, config, billingMonth) {
  const basePercentage = Number(config.base_value);
  const scopeType = config.scope_type;
  const scopeIdString = config.scope_id;

  if (isNaN(basePercentage) || basePercentage < 0 || basePercentage > 100) {
    throw new SheetDB.ValidationError(`[PAYROLL ERROR] Invalid base_value percentage '${config.base_value}' on TSC: ${config.salary_config_id}. Must be between 0 and 100.`);
  }

  let targetBatches = [];
  let weights = {};

  if (scopeType === "single_batch") {
    targetBatches.push(scopeIdString);
    weights[scopeIdString] = 100.0;
  } else if (scopeType === "batch_group") {
    try {
      const parsedMap = JSON.parse(scopeIdString);
      targetBatches = Object.keys(parsedMap);
      weights = parsedMap;
    } catch (e) {
      throw new SheetDB.ValidationError(`[PARSING FAULT] Unable to parse batch weights on config '${config.salary_config_id}'.`);
    }
  } else {
    throw new SheetDB.ValidationError(`[SCOPE EXCEPTION] Percentage strategies require explicit batch scopes. Global scope is forbidden.`);
  }

  let calculatedPayoutLines = [];

  targetBatches.forEach(batchId => {
    const allPaymentsForBatch = db.MoneyTransaction.where({ batch_id: batchId, status: "cleared" });
    const paymentsInMonth = allPaymentsForBatch.filter((row) => {
      const transDate = new Date(row.transaction_date);
      const transYear = transDate.getFullYear();
      const transMonth = String(transDate.getMonth() + 1).padStart(2, '0');
      const formattedTransMonth = `${transYear}-${transMonth}`;
      return formattedTransMonth === billingMonth;
    });

    const totalRevenueCollected = paymentsInMonth.reduce((accumulator, currentRow) => {
      return accumulator + Number(currentRow.amount);
    }, 0);

    const weightMultiplier = weights[batchId] / 100;
    const calculatedShare = totalRevenueCollected * (basePercentage / 100) * weightMultiplier;

    calculatedPayoutLines.push({
      entity_id: config.entity_id,
      entity_type: config.entity_type,
      salary_config_id: config.salary_config_id,
      payment_type: "salary",
      amount: Number(calculatedShare.toFixed(2)),
      payment_mode: "bank_transfer",
      transaction_date: new Date(),
      salary_month: billingMonth,
      notes: `Variable Revenue share at ${basePercentage}% rate. Scope Target: ${batchId} (Weight: ${weights[batchId]}%). Total collected fees: ₹${totalRevenueCollected.toFixed(2)}. Net: ₹${calculatedShare.toFixed(2)}.`
    });
  });

  return calculatedPayoutLines;
}

// =========================================================================
// DECOUPLED DECLARATIVE STRATEGY REGISTRY & POLICY INTERFACES
// =========================================================================

/**
 * Mapping Registry for rate calculations.
 */
const RateCalculationStrategies = {
  "monthly": {
    calculate(db, config, billingMonth) {
      const prorated = resolveProratedTemporalStrategy(config, billingMonth);
      return distributeBaseValueOverScope(config, prorated.amount, prorated.notes, billingMonth);
    }
  },
  "yearly": {
    calculate(db, config, billingMonth) {
      const prorated = resolveProratedTemporalStrategy(config, billingMonth);
      return distributeBaseValueOverScope(config, prorated.amount, prorated.notes, billingMonth);
    }
  },
  "revenue_percentage": {
    calculate(db, config, billingMonth) {
      return calculateDynamicRevenuePercentage(db, config, billingMonth);
    }
  }
};

/**
 * Policy handler resolving outstanding arrears balances.
 */
/**
 * Policy handler resolving outstanding arrears balances.
 */
const ArrearsEvaluationPolicy = {
  evaluate(db, config, billingMonth) {
    const fromDate = new Date(config.effective_from);
    const toDate = config.effective_to ? new Date(config.effective_to) : new Date();

    const activeMonths = [];
    let current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    const end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);

    while (current <= end) {
      const yr = current.getFullYear();
      const mo = String(current.getMonth() + 1).padStart(2, '0');
      activeMonths.push(`${yr}-${mo}`);
      current.setMonth(current.getMonth() + 1);
    }

    let totalExpected = 0;
    activeMonths.forEach(m => {
      if (config.rate_type === "monthly" || config.rate_type === "yearly") {
        const prorated = resolveProratedTemporalStrategy(config, m);
        totalExpected += prorated.amount;
      } else if (config.rate_type === "revenue_percentage") {
        const lines = calculateDynamicRevenuePercentage(db, config, m);
        lines.forEach(l => { totalExpected += l.amount; });
      }
    });

    const paidTransactions = db.TeacherPaymentTransaction.where({ salary_config_id: config.salary_config_id });
    const totalPaid = paidTransactions.reduce((acc, t) => acc + Number(t.amount), 0);

    const outstanding = totalExpected - totalPaid;
    if (outstanding > 0) {
      return [{
        entity_id: config.entity_id,
        entity_type: config.entity_type,
        salary_config_id: config.salary_config_id,
        payment_type: "salary",
        amount: Number(outstanding.toFixed(2)),
        payment_mode: "bank_transfer",
        transaction_date: new Date(),
        salary_month: billingMonth,
        notes: `Arrears settlement payout. Total expected: ₹${totalExpected.toFixed(2)}, total paid: ₹${totalPaid.toFixed(2)}. Outstanding: ₹${outstanding.toFixed(2)}.`
      }];
    }
    return [];
  }
};

/**
 * Declarative FSM Calculation Policies mapping contract lifecycles to validation guards.
 */
const FSMCalculationPolicies = {
  "drafted": {
    shouldCalculate(config, billingMonth) {
      return false;
    },
    calculate(db, config, billingMonth) {
      return [];
    }
  },

  "active": {
    shouldCalculate(config, billingMonth) {
      // Rule: Active settled contracts generate no new monthly payouts
      if (config.settlement_state === "settled") {
        return false;
      }

      const fromDate = new Date(config.effective_from);
      const toDate = config.effective_to ? new Date(config.effective_to) : null;

      const parts = billingMonth.split("-");
      const targetYear = parseInt(parts[0], 10);
      const targetMonthIdx = parseInt(parts[1], 10) - 1;

      const startOfBillingMonth = new Date(targetYear, targetMonthIdx, 1);
      const endOfBillingMonth = new Date(targetYear, targetMonthIdx + 1, 0, 23, 59, 59);

      const isStarted = fromDate <= endOfBillingMonth;
      const isNotExpired = !toDate || toDate >= startOfBillingMonth;

      return isStarted && isNotExpired;
    },
    calculate(db, config, billingMonth) {
      const strategy = RateCalculationStrategies[config.rate_type];
      if (!strategy) {
        throw new SheetDB.ValidationError(`[INVALID RATE TYPE] Unsupported strategy classification: '${config.rate_type}'`);
      }
      return strategy.calculate(db, config, billingMonth);
    }
  },

  "expired": {
    shouldCalculate(config, billingMonth) {
      // Rule: Expired configs are only evaluated if they have outstanding arrears due
      return config.settlement_state === "arrears_due";
    },
    calculate(db, config, billingMonth) {
      return ArrearsEvaluationPolicy.evaluate(db, config, billingMonth);
    }
  },

  "terminated": {
    shouldCalculate(config, billingMonth) {
      // Rule: Terminated configs are only evaluated if they have outstanding arrears due
      return config.settlement_state === "arrears_due";
    },
    calculate(db, config, billingMonth) {
      return ArrearsEvaluationPolicy.evaluate(db, config, billingMonth);
    }
  },

  "voided": {
    shouldCalculate(config, billingMonth) {
      return false;
    },
    calculate(db, config, billingMonth) {
      return [];
    }
  }
};

// =========================================================================
// MAIN CONTROLLER CLASS
// =========================================================================

class TeacherSalaryCalculationEngine {
  
  /**
   * Initializes the calculation engine with the active database context.
   * @param {Object} db - The active DazzlingDB instance containing Table Gateways.
   */
  constructor(db) {
    this.db = db;
    this.appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  }

  /**
   * Runs the payroll calculation engine for a specific teacher over a target billing month.
   * Enforces Polymorphic Associations and FSM Status State validations.
   * @param {string} teacherId - The primary key of the target teacher (e.g. "TCH-001").
   * @param {string} billingMonth - Target month to generate ledger splits (e.g. "2026-06").
   * @returns {Array<Object>} Ready-to-write transactional objects.
   */
  calculateTeacherPayroll(teacherId, billingMonth) {
    if (!teacherId || typeof teacherId !== 'string') {
      throw new SheetDB.ValidationError("[PAYROLL ERROR] teacherId must be a non-empty string.");
    }
    if (!billingMonth || !/^\d{4}-\d{2}$/.test(billingMonth)) {
      throw new SheetDB.ValidationError(`[PAYROLL ERROR] billingMonth '${billingMonth}' is invalid. Format must be YYYY-MM.`);
    }
    if (!this.db || !this.db.Teacher || !this.db.TeacherSalaryConfig) {
      throw new SheetDB.ValidationError("[PAYROLL ERROR] Database context is incomplete or not bootstrapped.");
    }

    console.log(`[PAYROLL ENGINE] Starting calculation for Teacher: ${teacherId} for Month: ${billingMonth}`);
    
    const teacher = this.db.Teacher.findById(teacherId);
    if (!teacher) {
      throw new SheetDB.EntityNotFoundError("Teacher", teacherId, "Staff");
    }

    // Query configurations matching the polymorphic identifier entity_id and entity_type
    const allConfigs = this.db.TeacherSalaryConfig.where({ entity_id: teacherId, entity_type: "Teacher" });
    
    let compiledTransactions = [];

    allConfigs.forEach(config => {
      try {
        const contractStatus = config.contract_status;
        const policy = FSMCalculationPolicies[contractStatus];

        if (!policy) {
          throw new SheetDB.ValidationError(`[FSM ERROR] No policy registered for contract status: '${contractStatus}'`);
        }

        if (policy.shouldCalculate(config, billingMonth)) {
          const resolvedLines = policy.calculate(this.db, config, billingMonth);
          compiledTransactions.push(...resolvedLines);
        } else {
          console.log(`[PAYROLL ENGINE] Ignoring config ${config.salary_config_id} (Status: ${contractStatus}, Settlement: ${config.settlement_state})`);
        }
      } catch (err) {
        console.error(`[PAYROLL CRITICAL ERROR] Failed resolving configuration target for TSC: ${config.salary_config_id}. Context: ${err.message}`);
        throw err;
      }
    });

    return compiledTransactions;
  }
}

// Bind to global namespace
globalThis.TeacherSalaryCalculationEngine = TeacherSalaryCalculationEngine;
