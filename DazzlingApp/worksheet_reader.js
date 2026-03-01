/**
 * 🚀 UNIVERSAL READER
 * Reads "DummyRecord", finds ALL sheets, and dumps them as a JSON Database.
 */

function readAllTables() {
  const FILENAME = "DummyRecord";
  
  try {
    const ss =  SpreadsheetApp.getActiveSpreadsheet();
    
    Logger.log(`✅ Found File: ${FILENAME} (ID: ${ss.getId()})`);

    // 2. Initialize the Database Object
    let fullDatabase = {};
    const sheets = ss.getSheets();

    // 3. Loop through EVERY sheet found
    sheets.forEach(sheet => {
      const tableName = sheet.getName();
      const rawData = sheet.getDataRange().getValues();
      
      // Convert 2D Array to JSON
      const tableData = convertSheetToJson(rawData);
      
      // Add to main object
      fullDatabase[tableName] = tableData;
      
      Logger.log(`   📂 Loaded Table: ${tableName} (${tableData.length} records)`);
    });

    // 4. Output results
    // (If running in editor)
    console.log(JSON.stringify(fullDatabase, null, 2));
    
    return fullDatabase;

  } catch (e) {
    Logger.log("❌ ERROR: " + e.message);
    return { error: e.message };
  }
}

/**
 * 🛠️ HELPER: Converts Rows [[]] to Objects [{}]
 * Handles Header mapping and JSON string parsing automatically.
 */
function convertSheetToJson(data) {
  if (!data || data.length < 2) return []; // Handle empty sheets

  const headers = data.shift(); // First row is keys

  return data.map(row => {
    let record = {};
    headers.forEach((key, index) => {
      let cellValue = row[index];

      // ✨ AUTO-PARSE JSON STRINGS
      // If a cell looks like ["A", "B"] or {"a":1}, try to parse it.
      if (typeof cellValue === 'string' && 
         (cellValue.trim().startsWith('[') || cellValue.trim().startsWith('{'))) {
        try {
          cellValue = JSON.parse(cellValue);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }
      
      record[key] = cellValue;
    });
    return record;
  });
}

/**
 * 🌐 API ENDPOINT (Optional)
 * If you deploy this as a Web App, this returns the whole DB.
 */
function read(e) {
  const db = readAllTables();
  Logger.log(db)
}