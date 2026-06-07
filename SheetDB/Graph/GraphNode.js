/**
 * @file GraphNode.js
 * Represents a single database record node in the dynamic transaction graph.
 */

class GraphNode {
  /**
   * @param {string} entityName - Name of the table.
   * @param {any} id - Primary key value (or group ID).
   * @param {Object|Array} record - Hydrated database model instance (or array of instances).
   * @param {string} type - Node cardinality type ("single" or "grouped").
   */
  constructor(entityName, id, record, type = 'single') {
    this.entityName = entityName;
    this.type = type;
    this.id = id;
    this.outgoing = []; // Edges pointing to dependents (children)
    this.incoming = []; // Edges pointing to parents

    if (type === 'grouped') {
      this.records = Array.isArray(record) ? record : [record];
      this.ids = this.records.map(r => r._primaryKey ? r[r._primaryKey] : (r.id || null));
      this.record = this.records[0] || null; // Fallback for backwards compatibility
    } else {
      this.record = record;
      this.records = [record];
      this.ids = [id];
    }
  }

  /**
   * Registers a parent node dependency edge.
   * @param {GraphEdge} edge
   */
  addIncoming(edge) {
    this.incoming.push(edge);
  }

  /**
   * Registers a child dependent node edge.
   * @param {GraphEdge} edge
   */
  addOutgoing(edge) {
    this.outgoing.push(edge);
  }
}

globalThis.GraphNode = GraphNode;
