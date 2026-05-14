/**
 * @file DataFetcher.js
 * Component: Query Engine - Data Retrieval
 * 
 * Responsibility:
 * - Interacts with TableGateway to fetch primary data.
 * - Applies filtering, sorting, and pagination.
 */

const DataFetcher = (function() {

  /**
   * Fetches the primary dataset based on the parsed query.
   * @param {Object} query - Validated query object.
   * @param {Object} db - The database instance.
   * @returns {Array<Object>} The filtered, sorted, and paginated result set.
   */
  function executePrimary(query, db) {
    const table = db[query.target];
    if (!table) throw new Error(`Table '${query.target}' not found.`);

    // 1. Fetch All (Normalized)
    // let rows = table.all();
    let rows = table.gateway.all();

    // 2. Inject Metadata (Required for Hydrator)
    rows.forEach(row => {
      row.__tableName = query.target;
    });

    // 3. Apply Predicate (Filter)
    const predicate = PredicateBuilder.build(query.where);
    rows = rows.filter(predicate);

    // 3. Apply Sorting
    if (query.sort && query.sort.length > 0) {
      rows = _sort(rows, query.sort);
    }

    // 4. Apply Pagination (Offset/Limit)
    const totalCount = rows.length;
    const start = query.pagination.offset;
    const end = start + query.pagination.limit;
    const paginated = rows.slice(start, end);

    // Add metadata for internal use if needed
    paginated.__totalCount = totalCount;

    return paginated;
  }

  /**
   * Internal: Multi-column sorting engine.
   * @private
   */
  function _sort(rows, sortConfig) {
    return rows.sort((a, b) => {
      for (const config of sortConfig) {
        const valA = a[config.field];
        const valB = b[config.field];

        if (valA === valB) continue;

        const comparison = valA > valB ? 1 : -1;
        return config.order === "DESC" ? comparison * -1 : comparison;
      }
      return 0;
    });
  }

  return {
    executePrimary: executePrimary
  };

})();
