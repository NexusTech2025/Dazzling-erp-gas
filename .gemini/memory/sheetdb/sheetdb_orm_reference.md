# SheetDB ORM Client Reference

This document serves as the comprehensive client API reference for the **SheetDB ORM Layer**. It outlines the public interfaces, signatures, use cases, and best practices for the database facade, dynamic table repositories, and active record instances.

---

## 1. High-Level Architecture Overview

SheetDB bridges the gap between raw Google Sheets worksheets and a structured, relational, self-validating ORM.

```
       [ SheetDB.init() ]
               │
               ▼
       [ DBContext (db) ] ──(Generates dynamically for each sheet)
               │
               ▼
      [ db.TableInstance ] ──(Instance of DynamicRepository)
               │
      ┌────────┴────────┐
      ▼                 ▼
[ Reads Raw Rows ]   [ Hydrates & Returns ]
      │                 │
      ▼                 ▼
[ Row Data Array ]   [ BaseModel / Active Record Instances ]
```

* **`db` (DBContext)**: The database facade returned by `SheetDB.init()`. It dynamically registers a property for each table defined in your schema.
* **`db.TableName` (DynamicRepository)**: Represented as `db.Table` throughout this reference. Provides high-level CRUD query interfaces.
* **`BaseModel`**: The active record instance returned by repository queries. It manages dirty checking, type casting, validation, and saving state directly.

---

## 2. Table Repository API (`db.Table` / `DynamicRepository`)

Every dynamically generated repository on the `db` object (e.g., `db.Student`, `db.Course`, `db.Enrollment`) is an instance of `DynamicRepository`.

### 2.1 `all()`
* **Signature**: `all(): Array<BaseModel>`
* **Description**: Fetches every record from the corresponding Google Sheet, hydrates them, and returns an array of model instances.
* **When to Use**: When you need to read all records in a table for iteration or processing (e.g., populating a cache or generating full reports).
* **Example**:
  ```javascript
  const courses = db.Course.all();
  courses.forEach(course => {
    console.log(course.name);
  });
  ```

---

### 2.2 `findById(id)`
* **Signature**: `findById(id: string|number): BaseModel|null`
* **Description**: Performs a fast primary key lookup. Fetches all records internally, filters by the primary key, hydrates the matching row, and returns it. Returns `null` if no match is found.
* **When to Use**: When you know the exact unique primary key of the record you want to fetch.
* **Example**:
  ```javascript
  const student = db.Student.findById("STU-1002");
  if (student) {
    console.log(`Found: ${student.first_name}`);
  }
  ```

---

### 2.3 `findOne(filters)`
* **Signature**: `findOne(filters: Object): BaseModel|null`
* **Description**: Searches the table and returns the **first** record that matches all strict key-value equality criteria. Returns `null` if no match is found.
* **When to Use**: When querying for a record on a unique, non-primary-key field (such as `email` or `slug`).
* **Example**:
  ```javascript
  const user = db.User.findOne({ email: "moni@nexustech.com" });
  if (user) {
    console.log(`Welcome back, ${user.username}!`);
  }
  ```

---

### 2.4 `where(filters)`
* **Signature**: `where(filters: Object): Array<BaseModel>`
* **Description**: Filters the table based on strict key-value equality criteria and returns all matching records as hydrated models.
* **When to Use**: When searching for multiple records matching a foreign key, status, or category.
* **Example**:
  ```javascript
  const activeEnrollments = db.Enrollment.where({ status: "active", branch_id: "BR-01" });
  console.log(`Active enrollments: ${activeEnrollments.length}`);
  ```

---

### 2.5 `exists(filters)`
* **Signature**: `exists(filters: Object): boolean`
* **Description**: Checks if there is at least one record in the table matching the filters. Gracefully returns `false` if the table does not physically exist.
* **When to Use**: For quick existence checks (e.g., verifying if a username is taken or a relationship exists) without hydrating full objects.
* **Example**:
  ```javascript
  const nameExists = db.Subject.exists({ name: "Advanced Mathematics" });
  if (nameExists) {
    throw new Error("Subject name already taken.");
  }
  ```

---

### 2.6 `count(filters)`
* **Signature**: `count(filters?: Object): number`
* **Description**: Returns the number of records matching the filters. If no filters are provided, returns the total row count. Gracefully returns `0` if the sheet is missing.
* **When to Use**: For metadata counts, dashboards, or checking constraints.
* **Example**:
  ```javascript
  const pendingCount = db.Payment.count({ status: "pending" });
  ```

---

### 2.7 `isTableExist()`
* **Signature**: `isTableExist(): boolean`
* **Description**: Checks if the sheet representing this model physically exists in the database.
* **When to Use**: Under defensive initialization scenarios or setup verification.
* **Example**:
  ```javascript
  if (!db.AuditLog.isTableExist()) {
    console.warn("Audit logs table is missing!");
  }
  ```

---

### 2.8 `insert(dataPayload)`
* **Signature**: `insert(dataPayload: Object|BaseModel): BaseModel`
* **Description**: Standard insertion method. Instantiates a new model with full context, applies validation, triggers primary key/timestamp auto-generation, persists the row, and returns the hydrated instance.
  * If a `BaseModel` instance is passed in directly, it immediately routes to `dataPayload.save()`.
* **When to Use**: To insert a single record.
* **Example**:
  ```javascript
  const newCourse = db.Course.insert({
    name: "Quantum Mechanics",
    code: "PHYS-401",
    price: 350
  });
  ```

---

### 2.9 `insertOne(payload)`
* **Signature**: `insertOne(payload: Object): BaseModel`
* **Description**: **MongoDB-style nested insertion.** Extracts core table columns from the payload and inserts the parent first (generating the parent's primary key). It then automatically traverses any nested relationship arrays/objects (e.g., inserting address blocks or enrollments), injects the parent's foreign key automatically, and recursively executes insertions.
* **When to Use**: When saving a complex tree of related models simultaneously (e.g. creating a Student along with their Address and initial Enrollment).
* **Example**:
  ```javascript
  const student = db.Student.insertOne({
    first_name: "Moni",
    last_name: "Roy",
    email: "moni@nexustech.com",
    address: { // 1:1 hasOne relation
      street: "123 Tech Ave",
      city: "Kolkata"
    },
    enrollments: [ // 1:N hasMany relation
      { course_id: "CRS-101", status: "active" },
      { course_id: "CRS-102", status: "pending" }
    ]
  });
  ```

---

### 2.10 `insertMany(payloadArray)`
* **Signature**: `insertMany(payloadArray: Array<Object>): Array<BaseModel>`
* **Description**: High-performance, priority-safe bulk insertion. Uses an internal `BatchBucket` to buffer all writes. It separates nested structures, maps out the relational dependencies, executes the primary parents in a single spreadsheet batch write, extracts the newly generated IDs, updates children, and writes children in consecutive batches.
* **When to Use**: When performing bulk migrations, imports, or high-throughput creations to minimize Google Spreadsheet I/O locks and latency.
* **Example**:
  ```javascript
  const results = db.Student.insertMany([
    { first_name: "Alice", email: "alice@gmail.com", address: { city: "Delhi" } },
    { first_name: "Bob", email: "bob@gmail.com", address: { city: "Mumbai" } }
  ]);
  ```

---

### 2.11 `update(id, updates)`
* **Signature**: `update(id: string|number, updates: Object|BaseModel): BaseModel`
* **Description**: Updates an existing record. It fetches the existing record by ID, extracts updates (if a model instance was passed, it calls `.toJSON()`), merges partial properties, runs validation against all schema criteria (including defaults and data types), saves changes, and returns the updated model.
* **When to Use**: To update one or more columns of a record by primary key.
* **Example**:
  ```javascript
  const updated = db.Course.update("CRS-101", { price: 299, status: "active" });
  ```

---

### 2.12 `remove(id)`
* **Signature**: `remove(id: string|number): boolean`
* **Description**: Deletes a record directly from the sheet using its primary key. Returns `true` if successful.
* **When to Use**: When removing a specific record and you do not need to load or hydrate it into memory.
* **Example**:
  ```javascript
  const succeeded = db.Subject.remove("SUB-404");
  ```

---

## 3. Active Record Instance API (`BaseModel`)

Any query matching records returns one or more `BaseModel` instances. These models are active, meaning they are bound to the sheet lifecycle and support direct manipulation.

### 3.1 `getEntityType()`
* **Signature**: `getEntityType(): string`
* **Description**: Returns the logical name of this model's table (e.g. `"Student"`).
* **Example**:
  ```javascript
  const type = student.getEntityType(); // "Student"
  ```

---

### 3.2 `merge(data)`
* **Signature**: `merge(data: Object): BaseModel`
* **Description**: Merges a partial data object into the model instance. Automatically type-casts the incoming data values based on the schema's field rules. Returns `this` to support method chaining.
* **When to Use**: When prepping an existing model for an update step before saving.
* **Example**:
  ```javascript
  student.merge({ email: "new_email@gmail.com" }).save();
  ```

---

### 3.3 `save()`
* **Signature**: `save(): BaseModel`
* **Description**: The core active record persistence mechanism. Under the hood, it performs the following lifecycle steps:
  1. Runs **Field Validations** (required, choices, lengths, custom validations).
  2. Runs **Relational Checks** (verifies foreign keys exist in their target tables using `PrimaryKeyCache`).
  3. Detects if the record is new (via the internal `_isNew` flag):
     * **If New**: Triggers ID and timestamp generators (e.g. `STU-0001`, `created_at`), serializes fields, executes a physical row append, and transitions `_isNew` to `false`.
     * **If Existing**: Locates the physical row index in the spreadsheet by primary key and updates it with serialized changes.
* **When to Use**: When inserting or updating a model manually.
* **Example**:
  ```javascript
  // Inserting a new record manually
  const course = new BaseModel({ name: "History", code: "HIS-101" }, context);
  course.save();

  // Updating an existing record
  const student = db.Student.findById("STU-100");
  student.first_name = "Alexander";
  student.save();
  ```

---

### 3.4 `delete()`
* **Signature**: `delete(): boolean`
* **Description**: Deletes this specific model instance physically from the spreadsheet using its primary key.
* **When to Use**: When you have an active model instance in memory and want to delete it.
* **Example**:
  ```javascript
  const student = db.Student.findById("STU-500");
  if (student.status === "archived") {
    student.delete();
  }
  ```

---

### 3.5 `validate()`
* **Signature**: `validate(): boolean`
* **Description**: Manually triggers all field schema validations (Tier 1: DataType, Tier 2: Length/Choices/Required, Tier 4: custom rules). Throws a combined `ValidationError` listing all failures if validation fails.
* **When to Use**: When validating an object's schema alignment early without intending to persist it yet.
* **Example**:
  ```javascript
  try {
    course.validate();
  } catch (e) {
    console.error("Course fields are invalid:", e.errors);
  }
  ```

---

### 3.6 `toJSON()`
* **Signature**: `toJSON(): Object`
* **Description**: Serializes the model's properties into a clean JSON-safe object. It standardizes Javascript Dates into ISO strings, includes any eager-loaded nested relations, and strips out hidden framework/ORM metadata properties (properties beginning with an underscore, e.g., `_gateway`).
* **When to Use**: Before sending model payloads over API responses or printing output.
* **Example**:
  ```javascript
  const apiPayload = student.toJSON();
  return ContentService.createTextOutput(JSON.stringify(apiPayload));
  ```

---

### 3.7 Dynamic Relationship Methods
When an entity's schema declares a relationship (e.g. `hasMany` or `belongsTo`), SheetDB injects dynamic getter methods directly on the instantiated model.
* **Pattern**: `model.RelationName(): BaseModel | Array<BaseModel> | null`
* **When to Use**: To fetch and traverse related sheets on demand.
* **Example**:
  ```javascript
  // 1. Traverse parent relationships (belongsTo)
  const student = db.Student.findById("STU-001");
  const parentAddress = student.address(); // returns Address model or null

  // 2. Traverse child relationships (hasMany)
  const enrollments = student.enrollments(); // returns Array<Enrollment>
  enrollments.forEach(enrollment => {
    console.log(enrollment.course_id);
  });
  ```

---

## 4. Key Architectural Patterns & Guarantees

### 4.1 When to Use `.where()` vs `.findOne()` vs `.findById()`
* **Use `.findById(id)`** when you want to retrieve a record by its unique Primary Key. It uses primary-key indexing conventions.
* **Use `.findOne(filters)`** when searching for exactly **one unique record** using a field other than the primary key (e.g. a unique email, registration token, or branch slug).
* **Use `.where(filters)`** when expecting multiple records (e.g. searching for enrollments under a specific batch, or finding all course sections taught by a teacher).

### 4.2 Database Transactions and Rollbacks
Since Google Spreadsheets do not natively support database transactions (ACID), transactional boundaries should be handled in the service layers using a defensive rollback pattern:

```javascript
function executeTransactionalAction(payload) {
  const rollbackList = []; // Track backups of rows that were modified
  try {
    // 1. Inserting records
    const inserted = db.Package.insert(payload);
    rollbackList.push({ action: "delete", repo: db.Package, id: inserted.id });

    // 2. Updating records
    const student = db.Student.findById(payload.student_id);
    const originalState = student.toJSON(); // Backup original state
    
    student.merge({ status: "active" }).save();
    rollbackList.push({ action: "update", repo: db.Student, id: student.id, backup: originalState });

    // Transaction Success
    return inserted;
  } catch (error) {
    // Execute rollbacks in reverse order
    console.error("Transaction failed, executing rollbacks...", error);
    for (let i = rollbackList.length - 1; i >= 0; i--) {
      const step = rollbackList[i];
      if (step.action === "delete") {
        step.repo.remove(step.id);
      } else if (step.action === "update") {
        step.repo.update(step.id, step.backup);
      }
    }
    throw error; // Re-throw error to trigger API client diagnostic logs
  }
}
```
