/**
 * @file GenericActions.js
 * Layer: Application Service Layer
 * 
 * Responsibility:
 * - Provide universal, schema-driven handlers for all CRUD operations.
 * - Replace entity-specific classes (AddStudent, UpdateTeacher, etc.).
 * - Ensure consistent response envelopes across the entire API.
 */

/**
 * Base class for all Actions. 
 * Provides the lifecycle: validate -> authorize -> execute -> format
 */
class BaseAction {
  constructor({ db, params = {}, user = null }) {
    this.db = db; // SheetDB Instance
    this.params = params;
    this.user = user;
    this.actionName = this.constructor.name.replace("Action", "").toLowerCase();
  }

  run() {
    try {
      this._validate();
      this._authorize();
      const result = this._execute();
      return { success: true, action: this.actionName, data: result };
    } catch (e) {
      return { success: false, action: this.actionName, error: e.message };
    }
  }

  _validate() {}
  _authorize() {}
  _execute() { throw new Error("_execute() not implemented."); }

  requireParam(name) {
    const val = this.params[name];
    if (val === undefined || val === null || val === "") throw new Error(`Parameter '${name}' is required.`);
    return val;
  }
}

/**
 * Generic Query: Handles collection fetching and filtering.
 * Params: entity (req), filter (opt)
 */
class GenericQueryAction extends BaseAction {
  _execute() {
    const entity = this.requireParam("entity");
    const repo = this.db[entity];
    if (!repo) throw new Error(`Entity '${entity}' not found in database.`);

    const filter = this.params.filter ? JSON.parse(this.params.filter) : {};
    const results = Object.keys(filter).length > 0 ? repo.where(filter) : repo.all();
    
    // Convert BaseModels back to data for the API response
    return results.map(model => model._getCleanData());
  }
}

/**
 * Generic Retrieve: Handles single record lookup by ID.
 * Params: entity (req), id (req)
 */
class GenericRetrieveAction extends BaseAction {
  _execute() {
    const entity = this.requireParam("entity");
    const id = this.requireParam("id");
    const repo = this.db[entity];
    
    const model = repo.findById(id);
    if (!model) throw new Error(`Record '${id}' not found in '${entity}'.`);
    
    return model._getCleanData();
  }
}

/**
 * Generic Create: Handles new record insertion.
 * Params: entity (req), data (req)
 */
class GenericCreateAction extends BaseAction {
  _execute() {
    const entity = this.requireParam("entity");
    const payload = typeof this.params.data === 'string' ? JSON.parse(this.params.data) : this.params.data;
    const repo = this.db[entity];

    const model = repo.insert(payload);
    return model._getCleanData();
  }
}

/**
 * Generic Update: Handles modifications to existing records.
 * Params: entity (req), id (req), data (req)
 */
class GenericUpdateAction extends BaseAction {
  _execute() {
    const entity = this.requireParam("entity");
    const id = this.requireParam("id");
    const payload = typeof this.params.data === 'string' ? JSON.parse(this.params.data) : this.params.data;
    const repo = this.db[entity];

    const model = repo.findById(id);
    if (!model) throw new Error(`Record '${id}' not found.`);

    // Apply updates directly to the model and save
    Object.assign(model, payload);
    model.save();
    
    return model._getCleanData();
  }
}

/**
 * Generic Delete: Handles record removal.
 * Params: entity (req), id (req)
 */
class GenericDeleteAction extends BaseAction {
  _execute() {
    const entity = this.requireParam("entity");
    const id = this.requireParam("id");
    const repo = this.db[entity];

    return repo.remove(id);
  }
}
