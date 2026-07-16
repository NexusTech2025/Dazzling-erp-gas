# Engineering Audit Log: Teacher Salary Config Management System 2

## 1. Session Summary

This engineering session executed a secure structural overhaul of the compensation configuration management subsystem within `DazzlingDB`. The primary architectural objectives were:

1. Decommissions generic CRUD access for salary profiles to enforce strong data protection boundaries.


2. Refactored the core domain schema from strict single-entity mapping (`teacher_id`) into an extensible, polymorphic entity reference framework (`entity_type` + `entity_id`).


3. Re-architected the execution controller of the payroll processor using a declarative Finite State Machine (FSM) policy engine to handle multi-state billing and historical arrears evaluations without regression.


4. Established synchronized, isolated in-memory Node.js sandbox test suites and production-grade Google Apps Script (GAS) lifecycle integration workflows verifying a comprehensive 15-state transaction mutation matrix.



---

## 2. Files Modified

### Frontend / Presentation Documentation

* `docs/client/teacher_salary_config_api_guide.md`

* `views/test_api.html`

* `REST-api-doc.md`


### Backend / Core DBServices

* `DazzlingDB/Config.js`

* `DazzlingDB/ApiDispatcher.js`

* `DazzlingDB/DBServices/ConcreteActions.js`

* `DazzlingDB/DBServices/StaffService.js`

* `DazzlingDB/DBServices/StaffService_TeacherSalaryCalculationEngine.js`


### Database / Configurations

* `DazzlingDB/Config/Schema/Staff/TeacherSalaryConfig.json`

* `DazzlingDB/Config/Schema/Staff/Teacher.json`

* `DazzlingDB/Config/Schema/Staff/StaffMember.json`

* `DazzlingDB/Config/database_schema.js` *(Regenerated via compilation)*

* `DazzlingDB/Config/dependency_graph.js` *(Regenerated via compilation)*


### Config / Infrastructure

* `DazzlingDB/.claspignore`


### Test Frameworks & Mock Configurations

* `DazzlingDB/NodeTest/Staff_SalaryCalculationTests.js` *(Newly created local sandbox suite)*

* `DazzlingDB/Test/Staff_SalaryCalculationTests.js` *(GAS-aligned integration suite)*

* `DazzlingDB/Test/TestMockData.js`

* `DazzlingDB/Test/TestMockHelper.js`

* `DazzlingDB/Test/TeacherSalaryCalculationTests.js` *(Deleted/Ported)*


---

## 3. Chronological Implementation Tracking

### Task 1: Decommissioning Generic CRUD Whitelisting & Building Dedicated Secure Actions

* **The 'What'**: The security specifications dictated that salary configurations must never be exposed to automated runtime modification via generic table gateways (`data_create`, `data_update`, etc.) to minimize vector access exploits.


* **The 'How'**: Revoked `"TeacherSalaryConfig"` visibility from the `GLOBAL_CRUD_WHITELIST` array within `DazzlingDB/Config.js`. Engineered explicit controller blocks (`StaffGetSalaryConfigsAction`, `StaffGetSalaryConfigAction`, `StaffUpdateSalaryConfigAction`, `StaffDeleteSalaryConfigAction`) inside `DazzlingDB/DBServices/ConcreteActions.js`. Implemented cross-entity validation constraints requiring an exact match of the record's ownership reference parameter against the caller's query payload to prevent unauthorized horizontal parameter injection.



#### Code Evidence

```javascript
// DazzlingDB/DBServices/ConcreteActions.js
class StaffUpdateSalaryConfigAction extends BaseAction {
  execute(payload, context) {
    const { salary_config_id, entity_id, entity_type, data } = payload;
    // Structural invariant: Ownership confirmation pairing to block cross-entity leakage
    const record = StaffService.getSalaryConfigById(salary_config_id, context);
    if (!record || record.entity_id !== entity_id || record.entity_type !== entity_type) {
      throw new ValidationError("Cross-Entity Data Access Blocked: Identity pairing mismatch.");
    }
    return StaffService.updateSalaryConfig(salary_config_id, data, context);
  }
}

```

#### Task-Level Insights & Future Actionability

* **Learning Key Points**: Relying on decoupled runtime configurations like global whitelists introduces vulnerability points if microservices automatically register endpoints without checking for domain sensitivity permissions.


* **Best Practices vs. Anti-Patterns**:
* *Best Practice*: Enforced tight data-access parameters by requiring dual composite keys (`salary_config_id` combined with an explicit identity match) inside the service layer.


* *Anti-Pattern Avoided*: Bypassed the *Generic Gateway Delegation Anti-Pattern*, which grants universal read/write access to entity tables based solely on string table identifiers.




* **Future Session Action Items**: Extend the identity check layer to intercept transactions automatically at the `ApiDispatcher` phase by querying dynamic Access Control Lists (ACLs).

---

### Task 2: Polymorphic Association Schema Refactoring & Graph Compilation

* **The 'What'**: The single-domain architecture was limited to processing `Teacher` identifiers exclusively, preventing the payroll system from managing other personnel categories using the updated table structure.


* **The 'How'**: Refactored `DazzlingDB/Config/Schema/Staff/TeacherSalaryConfig.json` to deprecate `teacher_id` and substitute polymorphic keys: `entity_type` and `entity_id`. Registered target model bindings inside `PolymorphicRegistry` to enable dynamic model routing between `Teacher` and `StaffMember` source schemas. Executed the tool compilation framework (`npm run compile-graph:prod`) inside the `dazzlingdb-tools/` module to rebuild the runtime dependency graph configurations (`database_schema.js`, `dependency_graph.js`).



#### Code Evidence

```json
// DazzlingDB/Config/Schema/Staff/TeacherSalaryConfig.json
{
  "type": "object",
  "properties": {
    "salary_config_id": { "type": "string", "pattern": "^TSC-[0-9A-F]+$" },
    "entity_type": { "type": "string", "enum": ["Teacher", "StaffMember"] },
    "entity_id": { "type": "string" },
    "contract_status": { "type": "string", "enum": ["drafted", "active", "expired", "terminated", "voided"] },
    "settlement_state": { "type": "string", "enum": ["unsettled", "settled", "arrears_due"] }
  }
}

```

#### Task-Level Insights & Future Actionability

* **Learning Key Points**: Static pattern validation fields (such as checking string prefixes like `"TCH-"`) fail when managing complex, mixed-entity table collections. Using a formal discriminator field isolates domain resolution safely.


* **Best Practices vs. Anti-Patterns**:
* *Best Practice*: Applied *Polymorphic Referencing* models to maintain single-table normalization while supporting diverse target objects.


* *Anti-Pattern Avoided*: Avoided *Table-Per-Concrete-Class replication*, which duplicates table structures for highly similar data attributes.




* **Future Session Action Items**: Build an engine validator component into the build pipeline to catch unlinked or orphaned schema pointers across the graph before output compilation.

---

### Task 3: Declarative FSM Calculation Engine Strategy Refactoring

* **The 'What'**: The historical execution model relied on nested `if-else` blocks to calculate monthly distributions, which failed to cleanly separate calculation flags from lifecycle changes. This risked double-payment errors if an active contract was re-processed after settlement.


* **The 'How'**: Re-engineered `DazzlingDB/DBServices/StaffService_TeacherSalaryCalculationEngine.js` using a declarative policy directory pattern. Introduced the `FSMCalculationPolicies` ledger to encapsulate state routing rules for all 5 lifecycle modes (`drafted`, `active`, `expired`, `terminated`, `voided`). The engine applies an isolated calculation check: for `active` contexts, it blocks standard payouts if `settlement_state === "settled"`. For historical contexts (`expired`/`terminated`) marked as `arrears_due`, it switches execution paths to use an `ArrearsEvaluationPolicy` that computes outstanding deltas against historical transaction histories:



$$O_{\text{outstanding}} = \sum B_{\text{expected}} - \sum P_{\text{paid}}$$

#### Code Evidence

```javascript
// DazzlingDB/DBServices/StaffService_TeacherSalaryCalculationEngine.js
const FSMCalculationPolicies = {
  active: {
    shouldCalculate: (config) => config.settlement_state !== "settled",
    calculate: (db, config, billingMonth) => {
      return RateCalculationStrategies[config.rate_type].calculate(config, billingMonth);
    }
  },
  expired: {
    shouldCalculate: (config) => config.settlement_state === "arrears_due",
    calculate: (db, config, billingMonth) => {
      return ArrearsEvaluationPolicy.evaluate(db, config);
    }
  }
};

```

---

### Task 4: Localized In-Memory Matrix Sandbox Test Expansion

* **The 'What'**: The testing layer required validation checks for the edge cases inside the state machine matrix without hitting external network connections or modifying the live spreadsheet database.


* **The 'How'**: Formed an offline sandboxed environment (`DazzlingDB/NodeTest/Staff_SalaryCalculationTests.js`) using Node's native `assert` layer. Constructed a fully mock memory representation (`mockDb`) initializing **5 Teachers** and **10 Batches**. Expanded execution pathways to cover **15 distinct permutations** (`TC-M01` through `TC-M15`), asserting that unapproved drafts or voided configurations produce 0 obligations while expired/terminated configurations with lingering liabilities calculate exact arrears deltas.



#### Code Evidence

```javascript
// DazzlingDB/NodeTest/Staff_SalaryCalculationTests.js
const testPermutation = (testId, status, settlement, expectedTxCount, expectedAmount) => {
  mockDb.configs = [{
    salary_config_id: `TSC-${testId}`,
    entity_type: "Teacher",
    entity_id: "TCH-M02",
    contract_status: status,
    settlement_state: settlement,
    rate_type: "monthly",
    base_value: 20000
  }];
  const results = TeacherSalaryCalculationEngine.calculate("TCH-M02", "2026-06", mockDb);
  assert.strictEqual(results.length, expectedTxCount, `${testId} Transaction count mismatch`);
};

```

#### Task-Level Insights & Future Actionability

* **Learning Key Points**: Initial evaluation runs uncovered an execution collision (`TC-M03`) where active settled profiles duplicated standard monthly payloads due to missing state guards inside the strategy checker. This was resolved by shifting calculation constraints into declarative policies.


* **Best Practices vs. Anti-Patterns**:
* *Best Practice*: Implemented *State Matrix Permutation Testing*, running exhaustive coverage across every valid and invalid status interaction.


* *Anti-Pattern Avoided*: Remediated the *Happy Path Validation Fault*, which checks only standard active scenarios while ignoring edge cases like expired or administrative void states.




* **Future Session Action Items**: Implement an automated randomize-fuzzer script to populate the state machine matrix with randomly generated numeric inputs to detect unexpected rounding deltas.

---

### Task 5: Production-Grade Google Apps Script Lifecyle Integration Testing & Schema Provisioning

* **The 'What'**: Moving tests from the mock memory engine into the live Google Apps Script container caused query crashes. The execution logs showed empty configuration queries because the testing sheet columns still used the legacy layout, missing the updated fields.


* **The 'How'**: Built a live integrated suite at `DazzlingDB/Test/Staff_SalaryCalculationTests.js`. Configured initialization blocks to execute explicit repository calls (`db.setup.provision()`) during sandbox setup to force alter-table refactoring onto the physical Google Sheet headers. To prevent foreign-key reference rejections (`onDelete: "protect"`) when flushing states across scenarios, the lifecycle architecture was updated to use a **non-destructive testing isolation model**: it dynamically provisions a unique, independent `Teacher` identity tracking token for each of the 15 matrix items, avoiding row deletion steps entirely.



#### Code Evidence

```javascript
// DazzlingDB/Test/Staff_SalaryCalculationTests.js
function runStaffSalaryCalculationTests() {
  const db = DBContext.getInstance();
  try {
    // Force column infrastructure alignment to map polymorphic properties
    db.setup.provision(); 
    
    // Non-destructive permutation isolation mapping loop
    for (let i = 1; i <= 15; i++) {
      const uniqueSuffix = Utilities.getUuid().substring(0, 8);
      const teacher = db.Teacher.insert({ name: "FSM Faculty " + uniqueSuffix });
      // Map isolated config and execute calculation matrix scenario securely...
    }
  } finally {
    // Safe environmental variable restoration block
  }
}

```

---

### Task 6: Modernizing Client API Guide Requirements & Payload Specifications

* **The 'What'**: The client integration specifications needed updates to reflect the polymorphic endpoints and document changes to the session authorization token flow.


* **The 'How'**: Extensively rewrote `docs/client/teacher_salary_config_api_guide.md`. Documented that authorization tokens must be passed directly within the root properties of the JSON request body (on the same level as `action` and `payload`) instead of relying on traditional HTTP request headers. Added full structural parameter requirement schema charts for all five secure endpoints.



#### Code Evidence

```json
// Example of Revised Client Payload Structure Requirements
{
  "action": "staff_set_salary_config",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "payload": {
    "entity_type": "Teacher",
    "entity_id": "TCH-2026-001",
    "salary_config_type": "recurring_monthly",
    "rate_type": "monthly",
    "base_value": 45000,
    "contract_status": "active",
    "settlement_state": "unsettled"
  }
}

```

---

## 4. Architectural Learnings & Patterns

### Declarative Stratified Registries

The engine replaced historical nested conditional branching blocks with separate, focused strategy registers. Runtime mapping logic decouples code execution profiles from core schema configurations, ensuring compliance with Open/Closed architectural standards.

### Symmetric Sandbox Alignment

By maintaining matching test routines across both local Node.js sandboxes and live GAS integration tests, the system catches environmental configuration variations early—ensuring differences in table layouts or processing engines are flagged before staging deployment.

---

## 5. Future Roadmap

* [ ] **Automated Index Generation Optimization**: Build an index generation layer over polymorphic references (`entity_type` + `entity_id`) to accelerate query speeds during bulk payroll processing runs.
* [ ] **Temporal History Audit Ledger Hook**: Add a database interceptor event hook that records historical snapshots to an internal audit tracker whenever updates alter structural contract records.

---

## 6. Knowledge Graph & Data Flow

### Entity Association Graph

```
[Teacher Schema]       ──┐
                         ├─► Maps Dynamically ─► [PolymorphicRegistry] ◄─┐
[StaffMember Schema]   ──┘                                               │
                                                                 Enforces Association
                                                                         │
[TeacherSalaryConfig]  ◄─ Evaluates State Machine Policy Matrix ─────────┴─ [FSMCalculationPolicies]
         │
         ▼
Consumes Historical Transactions
         │
         ▼
[TeacherPaymentTransaction]

```

### Strategic Payroll Processing Pipeline Data Flow

```
    [Execution Call] ──► Query Target Profile Entity Configurations
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │ Filter Rows via Polymorphic Mapping Keys     │
        │ { entity_id: targetId, entity_type: "Type" } │
        └──────────────────────┬───────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │ Dynamic Lifecycle Route Strategy Extraction   │
        │ FSMCalculationPolicies[contract_status]      │
        └──────────────────────┬───────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
     [shouldCalculate == false]    [shouldCalculate == true]
                │                             │
                ▼                             ▼
        Bypass Evaluation            Extract Processing Logic
       (0 Tx Generated)               ┌───────┴───────┐
                                      ▼               ▼
                             ["active" Path]   ["arrears_due" Path]
                                      │               │
                                      ▼               ▼
                               Apply Standard    Query Ledger
                               Rate Strategy    Compute Deficits
                                      │               │
                                      └───────┬───────┘
                                              │
                                              ▼
                                   Compile Transaction Block
                                   Update RAM Trace Output Grid

```