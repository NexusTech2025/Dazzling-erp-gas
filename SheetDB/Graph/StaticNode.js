/**
 * @file StaticNode.js
 * Represents a single database table in the static schema relation graph.
 */

class StaticNode {
  /**
   * @param {string} entityName - Name of the table.
   */
  constructor(entityName) {
    this.entityName = entityName;
    this.outgoing = []; // Array of StaticEdge pointing to dependent (child) tables
    this.incoming = []; // Array of StaticEdge pointing to parent tables
  }
}

globalThis.StaticNode = StaticNode;
