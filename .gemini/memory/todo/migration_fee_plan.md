# TODO: Migrate `FeePlan` to `ProgramFeePlan`

This document serves as the tracking and execution blueprint for migrating `FeePlan` under the `Finance` category to `ProgramFeePlan` under the `Academic` category.

## **Architectural Goal**
Move `FeePlan` from the purely transactional `Finance` domain to `Academic`, renaming it to `ProgramFeePlan` since it functions as a pricing and program setup configuration template.

---

## **Refactoring Checklist**

### **1. Schema Relocation & Renaming**
- [ ] Rename and move [FeePlan.json](e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/FeePlan.json) to `DazzlingDB/Config/Schema/Academic/ProgramFeePlan.json`.
- [ ] Update table identifier within the schema file from `"FeePlan"` to `"ProgramFeePlan"`.
- [ ] Rename the primary key field from `"fee_plan_id"` to `"program_fee_plan_id"`.
- [ ] Change the auto ID prefix from `"FPL"` to `"PFP"`.
- [ ] Update relations in [StudentFeeAccount.json](e:/NAST/Dazzling/GAS/DazzlingDB/Config/Schema/Finance/StudentFeeAccount.json):
  - Change `"target": "FeePlan"` to `"target": "ProgramFeePlan"`.
  - Change foreignKey name to `"program_fee_plan_id"`.

### **2. Database Registry and Config Updates**
- [ ] Update `DazzlingDB/Config.js`:
  - Rename `"FeePlan"` registry references to `"ProgramFeePlan"`.
  - Update ID prefix mapping `FeePlan: "FPL"` to `ProgramFeePlan: "PFP"`.

### **3. Business Logic Updates**
- [ ] Update [StudentService.js](e:/NAST/Dazzling/GAS/DazzlingDB/DBServices/StudentService.js):
  - Rename all queries and inserts on `db.FeePlan` to `db.ProgramFeePlan`.
  - Update the mutation tracking declarations: `this._trackMutation(context, "FeePlan")` to `"ProgramFeePlan"`.

### **4. Test Fixtures and Assertion Updates**
- [ ] Update mock fixtures in `TestMockData.js`.
- [ ] Update the expected mutations assertions in:
  - [StudentDeleteTests.js](e:/NAST/Dazzling/GAS/DazzlingDB/Test/StudentDeleteTests.js)
  - [StudentServiceTests.js](e:/NAST/Dazzling/GAS/DazzlingDB/Test/StudentServiceTests.js)
  - [StudentRegistrationPhase1Tests.js](e:/NAST/Dazzling/GAS/DazzlingDB/Test/StudentRegistrationPhase1Tests.js)
- [ ] Adjust sheet loaders referencing `"Finance.FeePlan"` in tests to `"Academic.ProgramFeePlan"`.

### **5. Build & Compilation**
- [ ] Run `npm run compile-graph:prod` inside the `dazzlingdb-tools/` directory to regenerate `database_schema.js` and `dependency_graph.js`.
