/**
 * @file DynamicGraphBuilder.js
 * Hydrates a StaticGraph schema template with active database records to form a DynamicGraph.
 */

class DynamicGraphBuilder {
  /**
   * @param {StaticGraph} staticGraph - The compiled static table relations graph template.
   * @param {Function} queryDelegate - Callback function: (table, fk, parentId) => Array<Model>
   */
  constructor(staticGraph, queryDelegate) {
    if (!staticGraph || typeof queryDelegate !== 'function') {
      throw new Error("DynamicGraphBuilder failed: Missing static schema graph or query delegate.");
    }
    this.staticGraph = staticGraph;
    this.queryDelegate = queryDelegate;
  }

  /**
   * Builds the dynamic record graph starting from a root record.
   * @param {string} rootEntityName - Root table name.
   * @param {any} rootId - Root record primary key.
   * @param {Object} rootRecord - In-memory model instance.
   * @returns {DynamicGraph}
   */
  build(rootEntityName, rootId, rootRecord) {
    const graph = new DynamicGraph();
    const rootNode = new GraphNode(rootEntityName, rootId, rootRecord, 'single');
    graph.addNode(rootNode);

    const queue = [rootNode];
    const visitedRecords = new Set([`${rootEntityName}:${rootId}`]);

    while (queue.length > 0) {
      const currentNode = queue.shift();
      const staticNode = this.staticGraph.getNode(currentNode.entityName);
      if (!staticNode) continue;

      for (const edge of staticNode.outgoing) {
        // Query child table matching outgoing static edge for each parent record in group
        for (const parentRecord of currentNode.records) {
          const parentKey = parentRecord._primaryKey || "id";
          const parentId = parentRecord[parentKey];
          if (!parentId) continue;

          const childRecords = this.queryDelegate(edge.toNode.entityName, edge.foreignKey, parentId) || [];
          if (childRecords.length === 0) continue;

          if (edge.relationType === 'hasMany') {
            // Group matching records together (Option 1 ID structure)
            const groupId = `${edge.toNode.entityName}_group_for_${currentNode.entityName}:${parentId}`;

            // Check if any of these child records are already mapped in the graph
            const unmappedRecords = [];
            const existingNodesToLink = new Set();

            childRecords.forEach(rec => {
              const childPk = rec._primaryKey || "id";
              const childPkVal = rec[childPk];
              if (!childPkVal) return;

              const existingNode = graph.findNodeContaining(edge.toNode.entityName, childPkVal);
              if (existingNode) {
                existingNodesToLink.add(existingNode);
              } else {
                unmappedRecords.push(rec);
              }
            });

            // Link to any existing nodes containing these records
            existingNodesToLink.forEach(existingNode => {
              const graphEdge = new GraphEdge(currentNode, existingNode, edge.foreignKey, edge.onDelete);
              graph.addEdge(graphEdge);
            });

            // For unmapped records, create or append to the grouped node
            if (unmappedRecords.length > 0) {
              let childNode = graph.getNode(edge.toNode.entityName, groupId);
              if (!childNode) {
                childNode = new GraphNode(edge.toNode.entityName, groupId, unmappedRecords, 'grouped');
                graph.addNode(childNode);
              } else {
                unmappedRecords.forEach(rec => {
                  const childPk = rec._primaryKey || "id";
                  const childPkVal = rec[childPk];
                  if (childPkVal && !childNode.ids.includes(childPkVal)) {
                    childNode.ids.push(childPkVal);
                    childNode.records.push(rec);
                  }
                });
              }

              const graphEdge = new GraphEdge(currentNode, childNode, edge.foreignKey, edge.onDelete);
              graph.addEdge(graphEdge);

              const visitKey = `${edge.toNode.entityName}:${groupId}`;
              if (!visitedRecords.has(visitKey)) {
                visitedRecords.add(visitKey);
                queue.push(childNode);
              }
            }
          } else {
            // Process individual 'single' nodes (hasOne, belongsTo)
            for (const row of childRecords) {
              const pkCol = row._primaryKey || "id";
              const childId = row[pkCol];
              if (!childId) continue;

              const recordKey = `${edge.toNode.entityName}:${childId}`;

              let childNode = graph.findNodeContaining(edge.toNode.entityName, childId);
              if (!childNode) {
                childNode = new GraphNode(edge.toNode.entityName, childId, row, 'single');
                graph.addNode(childNode);
              }

              const graphEdge = new GraphEdge(currentNode, childNode, edge.foreignKey, edge.onDelete);
              graph.addEdge(graphEdge);

              if (!visitedRecords.has(recordKey)) {
                visitedRecords.add(recordKey);
                queue.push(childNode);
              }
            }
          }
        }
      }
    }
    return graph;
  }
}

globalThis.DynamicGraphBuilder = DynamicGraphBuilder;
