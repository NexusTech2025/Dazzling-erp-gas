/**
 * @file StaticEdge.js
 * Represents a schema-defined relationship link between two tables.
 */

class StaticEdge {
  /**
   * @param {StaticNode} fromNode - Parent table node.
   * @param {StaticNode} toNode - Child table node.
   * @param {string} foreignKey - Foreign key column name.
   * @param {string} onDelete - Delete constraint policy ("protect", "cascade", "set_null", "do_nothing").
   * @param {string} relationType - Type of relationship ("hasMany", "hasOne", "belongsTo").
   */
  constructor(fromNode, toNode, foreignKey, onDelete, relationType) {
    this.fromNode = fromNode;
    this.toNode = toNode;
    this.foreignKey = foreignKey;
    this.onDelete = onDelete || "protect";
    this.relationType = relationType || "hasMany";
  }
}

globalThis.StaticEdge = StaticEdge;
