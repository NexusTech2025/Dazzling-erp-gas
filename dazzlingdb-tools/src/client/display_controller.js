/**
 * @file display_controller.js
 * Decoupled rendering pipeline to handle post-fetch data filtering,
 * sorting, cell formatting, column selection, and relation displaying.
 */

/**
 * Main entrance to run the formatting and display pipeline.
 * @param {Array<Object>} rows - Raw database rows
 * @param {Object} config - The "display" block from the query arguments
 * @param {string} tableName - Target table name
 * @param {Array<string>} includeKeys - Hydrated relation keys
 * @param {Function} colorizeJsonFn - Reference to the JSON colorizer
 * @param {Function} getPkFn - Reference to the primary key resolver
 */
function render(rows, config = {}, tableName, includeKeys = [], colorizeJsonFn, getPkFn) {
  if (!rows || rows.length === 0) {
    console.log('📭 No records found matching the query.\n');
    return;
  }

  // 1. Local Filtering
  let processed = filterRows(rows, config.filter, includeKeys);
  
  if (processed.length === 0) {
    console.log('📭 No records remain after applying local display filters.\n');
    return;
  }

  // 2. Local Sorting
  processed = sortRows(processed, config.sort);

  // 3. Collect and print Query & Relation statistics at the top
  const relationStats = {};
  if (includeKeys.length > 0) {
    includeKeys.forEach(relKey => {
      let totalRelCount = 0;
      processed.forEach(row => {
        const val = row[relKey];
        if (Array.isArray(val)) {
          totalRelCount += val.length;
        } else if (val && typeof val === 'object') {
          totalRelCount += 1;
        }
      });
      relationStats[relKey] = totalRelCount;
    });
  }

  console.log(`\n==================================================`);
  console.log(`📊 QUERY STATS (${tableName})`);
  console.log(`==================================================`);
  console.log(`🔹 Total matching rows in database : ${rows.__totalCount || rows.length}`);
  console.log(`🔹 Rows rendered in table          : ${processed.length}`);
  if (includeKeys.length > 0) {
    console.log(`🔹 Hydrated Relations Statistics :`);
    Object.entries(relationStats).forEach(([rel, count]) => {
      console.log(`   - "${rel}": ${count} items total across all rendered rows`);
    });
  }
  console.log(`==================================================\n`);

  // 4. Render flat console.table with projected columns
  console.log(`📦 Retrieved ${processed.length} rows:`);
  const flatTableRows = projectAndFormatTable(processed, config.select, config.format, tableName, getPkFn);
  console.table(flatTableRows);

  // 5. Render Deep Hydrated Relations
  if (includeKeys.length > 0) {
    // If hasRelations filter was applied, only show relation details for rows that match it
    renderRelations(processed, includeKeys, tableName, colorizeJsonFn, getPkFn);
  }
}

/**
 * Filter Step: Filters records locally based on relation criteria.
 */
function filterRows(rows, filterConfig = {}, includeKeys) {
  if (!filterConfig || Object.keys(filterConfig).length === 0) return rows;

  return rows.filter(row => {
    // hasRelations filter: Show only rows with active relation items populated
    if (filterConfig.hasRelations === true) {
      return includeKeys.some(relKey => {
        const val = row[relKey];
        if (Array.isArray(val)) return val.length > 0;
        if (val && typeof val === 'object') return Object.keys(val).length > 0;
        return val !== undefined && val !== null;
      });
    }
    // emptyRelations filter: Show only rows without any populated relation items
    if (filterConfig.hasRelations === false) {
      return includeKeys.every(relKey => {
        const val = row[relKey];
        if (Array.isArray(val)) return val.length === 0;
        if (val && typeof val === 'object') return Object.keys(val).length === 0;
        return val === undefined || val === null;
      });
    }
    return true;
  });
}

/**
 * Sort Step: Sorts rows locally by specified column key and direction.
 */
function sortRows(rows, sortConfig) {
  if (!sortConfig || !sortConfig.by) return rows;

  const key = sortConfig.by;
  const isDesc = sortConfig.order && sortConfig.order.toLowerCase() === 'desc';

  return [...rows].sort((a, b) => {
    const valA = a[key];
    const valB = b[key];

    if (valA === valB) return 0;
    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    let comparison = 0;
    if (typeof valA === 'number' && typeof valB === 'number') {
      comparison = valA - valB;
    } else {
      comparison = String(valA).localeCompare(String(valB));
    }
    return isDesc ? -comparison : comparison;
  });
}

/**
 * Formats values based on column definitions.
 */
function formatValue(val, type) {
  if (val === undefined || val === null) return 'null';
  
  if (type === 'currency') {
    const num = Number(val);
    if (!isNaN(num)) {
      return '₹ ' + num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
  }

  if (type === 'date') {
    try {
      const date = new Date(val);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    } catch (e) {
      // Return raw string on parse error
    }
  }

  return val;
}

/**
 * Projection & Formatting Step: Returns flat row mappings for console.table.
 */
function projectAndFormatTable(rows, selectedColumns, formatMap = {}, tableName, getPkFn) {
  const firstRow = rows[0];
  const pkName = (getPkFn && tableName && firstRow) ? getPkFn(tableName, firstRow) : null;

  return rows.map(row => {
    const displayRow = {};
    let keysToCopy = selectedColumns && Array.isArray(selectedColumns) && selectedColumns.length > 0
      ? selectedColumns
      : Object.keys(row).filter(key => !key.startsWith('__') && key !== 'password_hash' && key !== 'password_salt');

    // Move primary key to the first position
    if (pkName && keysToCopy.includes(pkName)) {
      keysToCopy = [pkName, ...keysToCopy.filter(k => k !== pkName)];
    }

    keysToCopy.forEach(key => {
      let val = row[key];
      
      // If there is an active formatter defined for the key
      if (formatMap[key]) {
        val = formatValue(val, formatMap[key]);
      }

      // Flatten arrays and objects for clean cell display
      if (Array.isArray(val)) {
        displayRow[key] = `[Array: ${val.length} items]`;
      } else if (val && typeof val === 'object') {
        displayRow[key] = `[Object: ${Object.keys(val).join(', ')}]`;
      } else {
        displayRow[key] = val;
      }
    });

    return displayRow;
  });
}

/**
 * Relation Renderer: Outputs color-prettified nested JSON structures.
 */
function renderRelations(rows, includeKeys, tableName, colorizeJsonFn, getPkFn) {
  console.log('\n📋 Deep Hydrated Relation Details:');
  const pkName = getPkFn(tableName, rows[0]);
  
  rows.forEach((row, index) => {
    const title = `📄 ${tableName} [${pkName}: ${row[pkName] || 'N/A'}] (${row.name || row.student_name || ''})`;
    console.log(`\n${'='.repeat(80)}\n${title}\n${'='.repeat(80)}`);

    includeKeys.forEach(relKey => {
      const val = row[relKey];
      if (val === undefined || val === null) return;
      
      // Skip printing empty relation fields to save space
      if (Array.isArray(val) && val.length === 0) return;
      if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0) return;

      console.log(`  🔹 Relation "${relKey}":`);
      console.log(colorizeJsonFn(val, 2));
    });
  });
}

module.exports = {
  render
};
