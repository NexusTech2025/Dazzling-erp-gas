/**
 * @file GraphEdge.js
 * Represents a foreign key dependency edge linking parent and child nodes.
 */

class GraphEdge {
  /**
   * @param {GraphNode} fromNode - Parent node.
   * @param {GraphNode} toNode - Child dependent node.
   * @param {string} foreignKey - The foreign key column name.
   * @param {string} onDelete - The delete constraint policy ("protect", "cascade", "set_null", "do_nothing").
   */
  constructor(fromNode, toNode, foreignKey, onDelete) {
    this.fromNode = fromNode;
    this.toNode = toNode;
    this.foreignKey = foreignKey;
    this.onDelete = onDelete || "protect";
  }
}

globalThis.GraphEdge = GraphEdge;
