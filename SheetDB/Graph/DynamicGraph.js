/**
 * @file DynamicGraph.js
 * Manages collections of nodes and edges, and provides safe topological sorting for leaf-first deletion.
 */

class DynamicGraph {
  constructor() {
    this.nodes = {}; // Map of "entityName:id" -> GraphNode
    this.edges = [];
  }

  /**
   * Registers a node if not already present.
   * @param {GraphNode} node
   */
  addNode(node) {
    const key = `${node.entityName}:${node.id}`;
    if (!this.nodes[key]) {
      this.nodes[key] = node;
    }
    return this.nodes[key];
  }

  /**
   * Retrieves a node by entity and ID.
   * @param {string} entityName
   * @param {any} id
   * @returns {GraphNode|null}
   */
  getNode(entityName, id) {
    return this.nodes[`${entityName}:${id}`] || null;
  }

  /**
   * Finds an existing node (single or grouped) in the graph that contains
   * the specified entity and record primary key ID.
   * @param {string} entityName
   * @param {any} recordId
   * @returns {GraphNode|null}
   */
  findNodeContaining(entityName, recordId) {
    for (const node of Object.values(this.nodes)) {
      if (node.entityName === entityName) {
        if (node.type === 'single' && node.id === recordId) {
          return node;
        }
        if (node.type === 'grouped' && node.ids.includes(recordId)) {
          return node;
        }
      }
    }
    return null;
  }

  /**
   * Registers a directed dependency edge.
   * @param {GraphEdge} edge
   */
  addEdge(edge) {
    this.edges.push(edge);
    edge.fromNode.addOutgoing(edge);
    edge.toNode.addIncoming(edge);
  }

  /**
   * Returns all registered nodes.
   * @returns {Array<GraphNode>}
   */
  getNodes() {
    return Object.values(this.nodes);
  }

  /**
   * Performs topological sorting using post-order DFS to yield leaf-first order.
   * @returns {Array<GraphNode>}
   */
  topologicalSort() {
    const visited = new Set();
    const result = [];

    const visit = (node) => {
      const key = `${node.entityName}:${node.id}`;
      if (visited.has(key)) return;
      visited.add(key);

      // DFS traversal through outgoing child edges
      for (const edge of node.outgoing) {
        visit(edge.toNode);
      }

      result.push(node);
    };

    // Traverse from all nodes to ensure disconnected subgraphs are covered
    for (const node of Object.values(this.nodes)) {
      visit(node);
    }

    return result;
  }
}

globalThis.DynamicGraph = DynamicGraph;
