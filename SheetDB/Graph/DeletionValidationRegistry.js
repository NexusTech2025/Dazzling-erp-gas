/**
 * @file DeletionValidationRegistry.js
 * Strategy pattern registry mapping onDelete validation policies to execution strategies.
 */

const DeletionValidationRegistry = (function() {
  const _strategies = {
    protect: (edge, deleteNodeKeys, context) => {
      // If the child node is NOT slated for deletion, it blocks the parent deletion
      const childKey = `${edge.toNode.entityName}:${edge.toNode.id}`;
      if (!deleteNodeKeys.has(childKey)) {
        throw new IntegrityError(`Delete Protected: Cannot delete from '${edge.fromNode.entityName}' because active records in '${edge.toNode.entityName}' refer to it (FK: '${edge.foreignKey}').`);
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

    // 1. Identify which nodes are actually slated for deletion via cascade paths
    const deleteNodeKeys = new Set();
    deleteNodeKeys.add(rootKey);

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

    const context = { rootEntityName, rootId };
    const activeDeleteKeys = globalDeleteNodeKeys || deleteNodeKeys;

    // 2. Evaluate all edges where the parent node is scheduled to be deleted
    for (const edge of graph.edges) {
      const parentKey = `${edge.fromNode.entityName}:${edge.fromNode.id}`;
      if (deleteNodeKeys.has(parentKey)) {
        const strategy = _strategies[edge.onDelete];
        if (strategy) {
          strategy(edge, activeDeleteKeys, context);
        } else {
          // Fall back to protect if strategy is unrecognized
          _strategies.protect(edge, activeDeleteKeys, context);
        }
      }
    }
    return true;
  }

  return {
    validate
  };
})();

globalThis.DeletionValidationRegistry = DeletionValidationRegistry;
