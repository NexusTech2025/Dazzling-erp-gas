/**
 * DazzlingDB High-Performance Testing Automation Helper
 */
const TestHelper = {
  
  /**
   * Truncates all data rows inside a targeted spreadsheet sheet, preserving Row 1 headers.
   * @param {string} dotNotationSelector - Target spec identifier following the layout 'SpreadsheetFile.SheetName' (e.g., 'Finance.FeePlan')
   */
  truncateSheet: function(dotNotationSelector) {
    if (!dotNotationSelector || !dotNotationSelector.includes('.')) {
      throw new Error(`Invalid Truncation Parameter: Must conform to 'Spreadsheet.Sheet' convention. Got: [${dotNotationSelector}]`);
    }
    
    // Safety Boundary Interceptor: Prevent data destruction on active development files
    const env = (typeof PropertiesService !== 'undefined')
      ? PropertiesService.getScriptProperties().getProperty('ENV')
      : 'DEVELOPMENT';
      
    if (env !== 'TESTING') {
      throw new Error(`CRITICAL SECURITY BLOCK: Truncation commands are exclusively locked to TESTING mode. Current ENV: [${env}]`);
    }

    const segments = dotNotationSelector.split('.');
    const spreadsheetFileName = segments[0]; // e.g., "Finance"
    const targetSheetName = segments[1];     // e.g., "FeePlan"
    
    // Resolve spreadsheet file via DBContext file gateways using our cached sandbox id
    const dbContext = DBContext.getInstance();
    const spreadsheetFile = dbContext.getSpreadsheetFileByName(spreadsheetFileName);
    
    if (!spreadsheetFile) {
      throw new Error(`Storage Target Missing: Spreadsheet file [${spreadsheetFileName}] could not be resolved inside the sandbox folder.`);
    }
    
    const sheet = spreadsheetFile.getSheetByName(targetSheetName);
    if (!sheet) {
      throw new Error(`Schema Sheet Missing: Sheet [${targetSheetName}] does not exist inside file [${spreadsheetFileName}].`);
    }
    
    const lastRow = sheet.getLastRow();
    
    // Idempotent Check: If lastRow <= 1, only the header row exists; skip deletion to preserve columns configuration
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
      console.log(`[TestHelper] Wiped ${lastRow - 1} records from sheet [${targetSheetName}] under file [${spreadsheetFileName}].`);
    }
    
    // Evict stale Range values from SheetDB's in-memory primary key lookup cache
    if (dbContext && dbContext._pkCache && typeof dbContext._pkCache.invalidate === 'function') {
      dbContext._pkCache.invalidate(targetSheetName);
    }
  }
};

// Bind to Global Scope for un-imported container exploration
globalThis.TestHelper = TestHelper;
