/**
 * @file DeletionValidationRegistry.js
 * Strategy pattern registry mapping onDelete validation policies to execution strategies.
 */

/**
 * @typedef {Object} DeletionViolation
 * @property {string} table - The name of the referencing child table (e.g. "Enrollment").
 * @property {string} foreignKey - The foreign key field name making the link (e.g. "student_id").
 * @property {Array<any>} ids - Array of primary keys of referencing records blocking the deletion.
 * @property {string} policy - The onDelete policy strategy causing the block (always "protect" for restrict-like blocks).
 * @property {string} message - Descriptive error message detailing the constraint breach.
 */

// ==========================================
// 🛠️ MODULE LEVEL STANDALONE UTILITIES
// ==========================================

/**
 * Traces and collects all cascade deletion targets starting from a root node using BFS.
 * Standalone Utility: Decoupled from DeletionValidationRegistry namespace.
 * @param {GraphNode} rootNode - The starting node of the dynamic graph traversal.
 * @param {string} rootKey - Unique entity name and identifier key for the root node (e.g. "Student:123").
 * @returns {Set<string>} Set of all node keys scheduled for deletion via cascade.
 */
function traceCascadeNodeKeys(rootNode, rootKey) {
  const deleteNodeKeys = new Set([rootKey]);
  const queue = [rootNode];
  const visited = new Set([rootKey]);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const edge of current.outgoing) {
      if (edge.onDelete === 'cascade') {
        const childKey = `${edge.toNode.entityName}:${edge.toNode.id}`;
        if (!visited.has(childKey)) {
          visited.add(childKey);
          deleteNodeKeys.add(childKey);
          queue.push(edge.toNode);
        }
      }
    }
  }
  return deleteNodeKeys;
}

/**
 * Evaluates the deletion edges of the graph against registered policy strategies.
 * Standalone Utility: Decoupled from DeletionValidationRegistry namespace.
 * @param {Array<GraphEdge>} edges - All relationship edges in the dynamic graph.
 * @param {Set<string>} deleteNodeKeys - Set of parent keys slated for deletion.
 * @param {Set<string>} activeDeleteKeys - Union of active keys (batch scope).
 * @param {Object} context - The validation context carrying the violations array.
 * @param {Object} strategies - Registry of onDelete strategies.
 */
function evaluateEdges(edges, deleteNodeKeys, activeDeleteKeys, context, strategies) {
  for (const edge of edges) {
    const parentKey = `${edge.fromNode.entityName}:${edge.fromNode.id}`;
    if (deleteNodeKeys.has(parentKey)) {
      const strategy = strategies[edge.onDelete];
      if (strategy) {
        strategy(edge, activeDeleteKeys, context);
      } else {
        // Fall back to protect if strategy is unrecognized
        strategies.protect(edge, activeDeleteKeys, context);
      }
    }
  }
}

const DeletionValidationRegistry = (function() {
  const _strategies = {
    protect: (edge, deleteNodeKeys, context) => {
      // If the child node is NOT slated for deletion, it blocks the parent deletion
      const childKey = `${edge.toNode.entityName}:${edge.toNode.id}`;
      if (!deleteNodeKeys.has(childKey)) {
        const violation = {
          table: edge.toNode.entityName,
          foreignKey: edge.foreignKey,
          ids: edge.toNode.ids,
          policy: "protect",
          message: `Delete Protected: Cannot delete from '${edge.fromNode.entityName}' because active records in '${edge.toNode.entityName}' refer to it (FK: '${edge.foreignKey}').`
        };
        if (context && context.violations) {
          context.violations.push(violation);
        } else {
          throw new IntegrityError(violation.message, violation);
        }
      }
    },
    cascade: (edge, deleteNodeKeys, context) => {
      // Cascading relations are expected to be in the delete node list
      const childKey = `${edge.toNode.entityName}:${edge.toNode.id}`;
      if (!deleteNodeKeys.has(childKey)) {
        throw new IntegrityError(`Delete Cascade Mismatch: Dependent record '${childKey}' is not scheduled for cascading deletion.`);
      }
    },
    set_null: (edge, deleteNodeKeys, context) => {
      // If we nullify the foreign key, verify the foreign key field is not marked as required
      const sampleRec = edge.toNode.record;
      const schema = (sampleRec && sampleRec.constructor && sampleRec.constructor.schema)
        ? sampleRec.constructor.schema
        : null;
      if (!schema) {
        throw new ValidationError(`Delete Nullify Violation: Cannot validate nullification constraint for '${edge.toNode.entityName}' because schema metadata is missing.`);
      }

      const fkField = schema[edge.foreignKey];
      if (fkField && fkField.required === true) {
        throw new ValidationError(`Delete Nullify Violation: Cannot set foreign key '${edge.foreignKey}' to null on '${edge.toNode.entityName}' because the field is marked as required.`);
      }

      // Check if polymorphic typeField discriminator is required
      if (fkField && fkField.typeField) {
        const typeFieldConfig = schema[fkField.typeField];
        if (typeFieldConfig && typeFieldConfig.required === true) {
          throw new ValidationError(`Delete Nullify Violation: Cannot set polymorphic discriminator '${fkField.typeField}' to null on '${edge.toNode.entityName}' because the field is marked as required.`);
        }
      }
    },
    do_nothing: (edge, deleteNodeKeys, context) => {
      // Skip validation (Django-style DO_NOTHING policy)
    }
  };

  /**
   * Validates a DynamicGraph using the registered strategies.
   * @param {DynamicGraph} graph - The dynamic graph instance.
   * @param {string} rootEntityName - Name of root entity table.
   * @param {any} rootId - ID of root entity record.
   * @param {Set<string>} [globalDeleteNodeKeys] - Optional union set of all deletion keys in the batch.
   */
  function validate(graph, rootEntityName, rootId, globalDeleteNodeKeys) {
    if (!graph || typeof graph.getNode !== 'function') {
      throw new ValidationError("Invalid graph parameter: Graph is null or invalid.");
    }

    const rootKey = `${rootEntityName}:${rootId}`;
    const rootNode = graph.getNode(rootEntityName, rootId);
    if (!rootNode) {
      throw new ValidationError(`Validation failed: Root record node '${rootKey}' is missing from the validation graph.`);
    }

    // 1. Identify which nodes are actually slated for deletion via cascade paths (Standalone Utility)
    const deleteNodeKeys = traceCascadeNodeKeys(rootNode, rootKey);

    const violations = [];
    const context = { rootEntityName, rootId, violations };
    const activeDeleteKeys = globalDeleteNodeKeys || deleteNodeKeys;

    // 2. Evaluate all edges where the parent node is scheduled to be deleted (Standalone Utility)
    evaluateEdges(graph.edges, deleteNodeKeys, activeDeleteKeys, context, _strategies);

    if (violations.length > 0) {
      throw new IntegrityError(violations[0].message, {
        parentTable: rootEntityName,
        parentId: rootId,
        violations: violations.map(v => ({
          table: v.table,
          foreignKey: v.foreignKey,
          ids: v.ids,
          policy: v.policy
        }))
      });
    }

    return true;
  }

  return {
    validate,
    _strategies
  };
})();

globalThis.DeletionValidationRegistry = DeletionValidationRegistry;
