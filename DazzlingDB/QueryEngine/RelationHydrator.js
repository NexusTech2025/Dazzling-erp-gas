/**
 * @file RelationHydrator.js
 * Component: Query Engine - Batch Relational Loading
 * 
 * Responsibility:
 * - Solves the N+1 problem by batching lookups for related entities.
 * - Recursively hydrates nested relations.
 * - Supports belongsTo, hasOne, and hasMany mappings with O(N+M) complexity.
 */

const RelationHydrator = (function() {

  /**
   * Hydrates a dataset with related entities.
   * @param {Array<Object>} rows - The primary records to hydrate.
   * @param {Object} includeDSL - The sanitized include configuration.
   * @param {Object} db - The database instance.
   * @returns {Array<Object>} The hydrated records.
   */
  function hydrate(rows, includeDSL, db) {
    if (!rows || rows.length === 0 || !includeDSL) return rows;

    const schema = DATABASE_SCHEMA;
    const parentTableName = rows[0].__tableName;

    if (!parentTableName) {
      console.warn("[RelationHydrator] Parent rows missing '__tableName' metadata. Hydration aborted.");
      return rows;
    }

    const parentTableSchema = _findTableSchema(parentTableName, schema);
    if (!parentTableSchema) return rows;

    for (const relKey in includeDSL) {
      const config = includeDSL[relKey];
      const relMeta = parentTableSchema.relations[relKey];

      if (!relMeta) {
        console.warn(`[RelationHydrator] Relation '${relKey}' not found for '${parentTableName}'.`);
        continue;
      }

      // 1. Batch Fetch Related Data
      const relatedData = _batchFetch(rows, relMeta, db, parentTableSchema.primaryKey);

      // 2. Map Data Back to Parents (Optimized O(N+M))
      _mapToParents(rows, relatedData, relKey, relMeta, parentTableSchema.primaryKey);

      // 3. Recursive Hydration
      if (config.include && relatedData.length > 0) {
        hydrate(relatedData, config.include, db);
      }
    }

    return rows;
  }

  /**
   * Internal: Performs a single batch fetch for all related rows.
   * @private
   */
  function _batchFetch(rows, relMeta, db, parentPK) {
    const targetTable = relMeta.target;
    const targetPK = _getPrimaryKey(targetTable);
    const fk = relMeta.foreignKey;
    
    // Determine which key we are collecting from parents
    const isBelongsTo = (relMeta.type === "belongsTo");
    const collectionKey = isBelongsTo ? fk : parentPK;

    // Collect Unique Keys
    const keys = new Set();
    rows.forEach(row => {
      if (row[collectionKey]) keys.add(row[collectionKey]);
    });

    if (keys.size === 0) return [];

    // Execute Batch Query: Fetch rows where [MatchingKey] IN [CollectedKeys]
    const matchingKeyInTarget = isBelongsTo ? targetPK : fk;
    
    const query = {
      target: targetTable,
      where: { [matchingKeyInTarget]: { operator: "in", value: Array.from(keys) } },
      pagination: { limit: 1000, offset: 0 }
    };

    return DataFetcher.executePrimary(query, db);
  }

  /**
   * Internal: Maps the fetched related data back to parent objects using HashMaps.
   * Complexity: O(N + M)
   * @private
   */
  function _mapToParents(parents, relatedData, relKey, relMeta, parentPK) {
    const type = relMeta.type;
    const fk = relMeta.foreignKey;
    const targetPK = _getPrimaryKey(relMeta.target);
    const isBelongsTo = (type === "belongsTo");

    // 1. Build a Map of related data for O(1) lookup
    // Key depends on relation type
    const relatedMap = new Map();
    
    relatedData.forEach(row => {
      const key = isBelongsTo ? row[targetPK] : row[fk];
      
      if (type === "hasMany") {
        if (!relatedMap.has(key)) relatedMap.set(key, []);
        relatedMap.get(key).push(row);
      } else {
        relatedMap.set(key, row);
      }
    });

    // 2. Efficiently attach to parents
    parents.forEach(parent => {
      const lookupValue = isBelongsTo ? parent[fk] : parent[parentPK];
      const match = relatedMap.get(lookupValue);
      
      parent[relKey] = match || (type === "hasMany" ? [] : null);
    });
  }

  /**
   * Helper: Find table schema in global DATABASE_SCHEMA.
   * @private
   */
  function _findTableSchema(tableName, schema) {
    for (const cat in schema.categories) {
      if (schema.categories[cat].tables[tableName]) return schema.categories[cat].tables[tableName];
    }
    return null;
  }

  /**
   * Helper: Get primary key for a table.
   * @private
   */
  function _getPrimaryKey(tableName) {
    const tableSchema = _findTableSchema(tableName, DATABASE_SCHEMA);
    return tableSchema ? tableSchema.primaryKey : "id";
  }

  return {
    hydrate: hydrate
  };

})();

