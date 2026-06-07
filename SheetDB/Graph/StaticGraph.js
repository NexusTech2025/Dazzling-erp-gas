/**
 * @file StaticGraph.js
 * Manages the static schema relationships graph compiled from database schemas.
 */

class StaticGraph {
  constructor() {
    this.nodes = {}; // Map of tableName -> StaticNode
  }

  /**
   * Registers a node if not already present.
   * @param {string} tableName
   * @returns {StaticNode}
   */
  addNode(tableName) {
    if (!this.nodes[tableName]) {
      this.nodes[tableName] = new StaticNode(tableName);
    }
    return this.nodes[tableName];
  }

  /**
   * Retrieves a node by table name.
   * @param {string} tableName
   * @returns {StaticNode|null}
   */
  getNode(tableName) {
    return this.nodes[tableName] || null;
  }

  /**
   * Registers a static relationship link.
   */
  addEdge(fromTable, toTable, fk, onDelete, type) {
    const fromNode = this.addNode(fromTable);
    const toNode = this.addNode(toTable);

    // Check if edge already exists to prevent duplicates
    const exists = fromNode.outgoing.some(e => e.toNode.entityName === toTable && e.foreignKey === fk);
    if (!exists) {
      const edge = new StaticEdge(fromNode, toNode, fk, onDelete, type);
      fromNode.outgoing.push(edge);
      toNode.incoming.push(edge);
    }
  }
}

class StaticGraphBuilder {
  /**
   * Resolves the parent table name for a given relation.
   * - If type is 'belongsTo', parent is the target table (rel.target).
   * - If type is 'hasMany' or 'hasOne', parent is the current table (currentTable).
   * @param {string} currentTable - The table declaring the relation.
   * @param {Object} relation - The relation configuration object.
   * @returns {string} The parent table name.
   */
  static _getParentTableName(currentTable, relation) {
    if (!relation || typeof relation !== 'object') {
      throw new globalThis.ValidationError("StaticGraphBuilder._getParentTableName: Relation config must be a valid object.");
    }
    const type = relation.type;
    const target = relation.target;
    if (!type || typeof type !== 'string') {
      throw new globalThis.ValidationError(`StaticGraphBuilder._getParentTableName: Relation type is missing or invalid in table '${currentTable}'.`);
    }
    if (!target || typeof target !== 'string') {
      throw new globalThis.ValidationError(`StaticGraphBuilder._getParentTableName: Relation target is missing or invalid in table '${currentTable}'.`);
    }

    if (type === 'belongsTo') {
      return target;
    } else if (type === 'hasMany' || type === 'hasOne') {
      return currentTable;
    } else {
      throw new globalThis.ValidationError(`StaticGraphBuilder._getParentTableName: Unsupported or invalid relation type '${type}' in table '${currentTable}'.`);
    }
  }

  /**
   * Resolves the child table name for a given relation.
   * - If type is 'belongsTo', child is the current table (currentTable).
   * - If type is 'hasMany' or 'hasOne', child is the target table (rel.target).
   * @param {string} currentTable - The table declaring the relation.
   * @param {Object} relation - The relation configuration object.
   * @returns {string} The child table name.
   */
  static _getChildTableName(currentTable, relation) {
    if (!relation || typeof relation !== 'object') {
      throw new globalThis.ValidationError("StaticGraphBuilder._getChildTableName: Relation config must be a valid object.");
    }
    const type = relation.type;
    const target = relation.target;
    if (!type || typeof type !== 'string') {
      throw new globalThis.ValidationError(`StaticGraphBuilder._getChildTableName: Relation type is missing or invalid in table '${currentTable}'.`);
    }
    if (!target || typeof target !== 'string') {
      throw new globalThis.ValidationError(`StaticGraphBuilder._getChildTableName: Relation target is missing or invalid in table '${currentTable}'.`);
    }

    if (type === 'belongsTo') {
      return currentTable;
    } else if (type === 'hasMany' || type === 'hasOne') {
      return target;
    } else {
      throw new globalThis.ValidationError(`StaticGraphBuilder._getChildTableName: Unsupported or invalid relation type '${type}' in table '${currentTable}'.`);
    }
  }

  /**
   * Compiles the static schema relation graph from the configuration schema.
   * @param {Object} schema - Canonical database schema V1.
   * @returns {StaticGraph}
   */
  static compile(schema) {
    // 1. Strict Type Safety Checks
    if (!schema || typeof schema !== 'object') {
      throw new globalThis.ValidationError("StaticGraphBuilder.compile: Schema must be a valid non-null object.");
    }
    if (!schema.categories || typeof schema.categories !== 'object') {
      throw new globalThis.ValidationError("StaticGraphBuilder.compile: Schema categories block must be a valid object.");
    }

    console.log("[StaticGraphBuilder] Starting compilation of Static Schema Graph...");
    const graph = new StaticGraph();
    const allTableNames = new Set();
    const tablesMap = new Map();

    // 2. Phase 1: Register all table nodes & compile a master table registry
    try {
      for (const cat of Object.values(schema.categories)) {
        if (!cat || typeof cat !== 'object' || !cat.tables) continue;
        for (const [tableName, tableConfig] of Object.entries(cat.tables)) {
          graph.addNode(tableName);
          allTableNames.add(tableName);
          tablesMap.set(tableName, tableConfig);
        }
      }
    } catch (e) {
      throw new globalThis.ValidationError(`StaticGraphBuilder.compile: Fatal error registering table nodes: ${e.message}`);
    }

    // 3. Phase 2: Compile relationships with strict validation & custom errors
    let edgeCount = 0;
    for (const [catName, cat] of Object.entries(schema.categories)) {
      if (!cat || typeof cat !== 'object' || !cat.tables) continue;
      
      for (const [tableName, tableConfig] of Object.entries(cat.tables)) {
        if (!tableConfig || typeof tableConfig !== 'object') continue;

        const relations = tableConfig.relations || {};

        for (const [relName, rel] of Object.entries(relations)) {
          try {
            if (!rel || typeof rel !== 'object') continue;

            // Special Case: Polymorphic belongsTo relation
            if (rel.type === "belongsToPolymorphic") {
              const childTable = tableName;
              const fk = rel.idField;
              if (!fk) {
                console.warn(`[StaticGraphBuilder] Warning: Skipping malformed polymorphic relation '${relName}' in table '${tableName}': idField missing.`);
                continue;
              }

              const childTableConfig = tablesMap.get(childTable);
              if (!childTableConfig) {
                throw new globalThis.ValidationError(
                  `StaticGraphBuilder.compile: Child table '${childTable}' configuration not found in schema map.`
                );
              }

              const childColumns = childTableConfig.columns || {};
              const fkColumn = childColumns[fk];
              if (!fkColumn) {
                throw new globalThis.ValidationError(
                  `StaticGraphBuilder.compile: Schema Mismatch in table '${tableName}' -> relation '${relName}': Polymorphic foreign key column '${fk}' is not defined under the columns block of child table '${childTable}'.`
                );
              }

              const onDelete = rel.onDelete || fkColumn.onDelete || "protect";
              if (onDelete === "do_nothing") continue;

              const mapping = rel.mapping || {};
              const parentTables = [...new Set(Object.values(mapping))];

              for (const parentTable of parentTables) {
                if (!allTableNames.has(parentTable)) {
                  throw new globalThis.ValidationError(
                    `StaticGraphBuilder.compile: Referential Integrity Violation in table '${tableName}' -> relation '${relName}': Polymorphic parent table '${parentTable}' does not exist in the schema.`
                  );
                }

                const relType = fkColumn.unique === true ? "hasOne" : "hasMany";
                graph.addEdge(parentTable, childTable, fk, onDelete, relType);
                edgeCount++;
              }
              continue;
            }

            const parentTable = this._getParentTableName(tableName, rel);
            const childTable = this._getChildTableName(tableName, rel);
            const fk = rel.foreignKey;

            // Guard: Malformed relation properties check
            if (!parentTable || !fk) {
              console.warn(`[StaticGraphBuilder] Warning: Skipping malformed relation '${relName}' in table '${tableName}': target or foreignKey missing.`);
              continue;
            }

            // Guard: Referential Integrity Check (Does the parent table exist in the schema?)
            if (!allTableNames.has(parentTable)) {
              throw new globalThis.ValidationError(
                `StaticGraphBuilder.compile: Referential Integrity Violation in table '${tableName}' -> relation '${relName}': Parent table '${parentTable}' does not exist in the schema.`
              );
            }

            // Guard: Referential Integrity Check (Does the child table exist in the schema?)
            if (!allTableNames.has(childTable)) {
              throw new globalThis.ValidationError(
                `StaticGraphBuilder.compile: Referential Integrity Violation in table '${tableName}' -> relation '${relName}': Child table '${childTable}' does not exist in the schema.`
              );
            }

            // Guard: Column Validity Check (Does the FK field exist in the child's columns definition?)
            const childTableConfig = tablesMap.get(childTable);
            if (!childTableConfig) {
              throw new globalThis.ValidationError(
                `StaticGraphBuilder.compile: Child table '${childTable}' configuration not found in schema map.`
              );
            }

            const childColumns = childTableConfig.columns || {};
            const fkColumn = childColumns[fk];
            if (!fkColumn) {
              throw new globalThis.ValidationError(
                `StaticGraphBuilder.compile: Schema Mismatch in table '${tableName}' -> relation '${relName}': Foreign key column '${fk}' is not defined under the columns block of child table '${childTable}'.`
              );
            }

            // Resolve onDelete policy (relation override, column setting, or fallback)
            const onDelete = rel.onDelete || fkColumn.onDelete || "protect";

            // Add the parent -> child edge if onDelete policy is active
            if (onDelete !== "do_nothing") {
              const relType = rel.type === "hasOne" || fkColumn.unique === true ? "hasOne" : "hasMany";
              
              graph.addEdge(parentTable, childTable, fk, onDelete, relType);
              edgeCount++;
            }
          } catch (err) {
            console.error(`[StaticGraphBuilder] Critical validation error in table '${tableName}' relation '${relName}': ${err.message}`);
            throw err; // Stop compiler to protect runtime schema sanity
          }
        }
      }
    }

    console.log(`[StaticGraphBuilder] Success: Compiled Static Schema Graph with ${Object.keys(graph.nodes).length} nodes and ${edgeCount} edges.`);
    return graph;
  }

  /**
   * Compiles the static schema graph from a flat dependency graph mapping.
   * Useful for testing and mock dependency configurations.
   * @param {Object} depGraph - Adjacency list dependency mapping.
   * @returns {StaticGraph}
   */
  static compileFromDependencyGraph(depGraph) {
    const graph = new StaticGraph();
    for (const [fromTable, targets] of Object.entries(depGraph)) {
      graph.addNode(fromTable);
      for (const target of targets) {
        graph.addNode(target.table);
        if (target.onDelete !== 'do_nothing') {
          graph.addEdge(fromTable, target.table, target.fk, target.onDelete, 'hasMany');
        }
      }
    }
    return graph;
  }
}

globalThis.StaticGraph = StaticGraph;
globalThis.StaticGraphBuilder = StaticGraphBuilder;
