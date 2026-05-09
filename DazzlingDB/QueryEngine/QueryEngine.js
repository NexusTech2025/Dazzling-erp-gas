/**
 * @file QueryEngine.js
 * Component: Advanced Query Engine - Primary Facade
 * 
 * Responsibility:
 * - Orchestrates the Query lifecycle: Parse -> Fetch -> Hydrate -> Project.
 * - Provides the public entry point for the Application Layer.
 */

const QueryEngine = (function() {

  /**
   * Executes a complex query based on the JSON DSL.
   * @param {Object} dsl - The raw query payload.
   * @param {Object} db - The SheetDB database instance.
   * @returns {Object} The query results with metadata.
   */
  function execute(dsl, db) {
    try {
      console.log(`[QueryEngine] Starting execution for target: ${dsl.target}`);

      // 1. Parse & Validate DSL
      const query = DSLParser.parse(dsl);

      // 2. Fetch Primary Data (Filtered, Sorted, Paginated)
      const results = DataFetcher.executePrimary(query, db);
      const totalCount = results.__totalCount;

      // 3. Relational Hydration (Task 3 & 4)
      let hydratedResults = results;
      if (query.include && results.length > 0) {
        hydratedResults = RelationHydrator.hydrate(results, query.include, db);
      }

      // 4. Projection & Formatting (Task 4)
      const finalResults = ProjectionEngine.project(hydratedResults, query.select);


      return {
        success: true,
        target: query.target,
        count: finalResults.length,
        total_count: totalCount,
        data: finalResults
      };

    } catch (error) {
      console.error("[QueryEngine] Execution Failed:", error);
      throw error;
    }
  }


  return {
    execute: execute
  };

})();
