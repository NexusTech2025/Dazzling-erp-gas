/**
 * @file HealthSimulationTests.js
 * Test suite designed to deliberately corrupt the physical spreadsheets
 * to simulate BAD, WARNING, ERROR, and ISSUE states for the Health UI.
 * 
 * WARNING: This is destructive to the current physical structure. 
 * Run the UI's "Repair All" after running this to fix the damage.
 */

function runHealthCorruptionSimulation() {
  console.log("🚀 Starting Health Corruption Simulation...");
  const db = DBContext.getInstance();
  const fs = db.setup.fs; // Access SpreadsheetFileSystem
  
  // 1. Simulate BAD: Delete a physical sheet (e.g., 'TeacherPaymentTransaction' from 'Staff' domain)
  try {
    const staffMeta = fs.findByName("Staff");
    if (staffMeta) {
      const ss = SpreadsheetApp.openById(staffMeta.id);
      const sheet = ss.getSheetByName("TeacherPaymentTransaction");
      if (sheet) {
        ss.deleteSheet(sheet);
        console.log("✅ Simulated BAD: Deleted 'TeacherPaymentTransaction' sheet.");
      } else {
        console.log("⚠️ 'TeacherPaymentTransaction' already deleted.");
      }
    }
  } catch (e) {
    console.error("❌ Failed to simulate BAD state:", e.message);
  }

  // 2. Simulate WARNING: Modify a header in an existing sheet (e.g., 'Student' in 'Students' domain)
  try {
    const studentsMeta = fs.findByName("Students");
    if (studentsMeta) {
      const ss = SpreadsheetApp.openById(studentsMeta.id);
      const sheet = ss.getSheetByName("Student");
      if (sheet) {
        // Change 'updated_at' to 'updated_at_broken'
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const updateIdx = headers.indexOf("updated_at");
        if (updateIdx !== -1) {
          sheet.getRange(1, updateIdx + 1).setValue("updated_at_broken");
          console.log("✅ Simulated WARNING: Renamed 'updated_at' to 'updated_at_broken' in 'Student'.");
        } else {
           // If 'updated_at' isn't there, just append a weird column
           sheet.getRange(1, headers.length + 1).setValue("rogue_column");
           console.log("✅ Simulated WARNING: Added 'rogue_column' to 'Student' headers.");
        }
      }
    }
  } catch (e) {
    console.error("❌ Failed to simulate WARNING state:", e.message);
  }

  // 3. Simulate ERROR: Create row 1 data corruption. (e.g., 'Course' in 'Academic' domain)
  try {
    const academicMeta = fs.findByName("Academic");
    if (academicMeta) {
      const ss = SpreadsheetApp.openById(academicMeta.id);
      const sheet = ss.getSheetByName("Course");
      if (sheet) {
        // First ensure there is at least one data row
        if (sheet.getLastRow() < 2) {
           sheet.appendRow(["test_course", "Test Course", "active", "123", new Date(), new Date(), "admin", "admin"]);
        }
        // Then clear the header row (all columns)
        sheet.getRange(1, 1, 1, sheet.getMaxColumns()).clearContent();
        // Give it a dummy header that matches nothing in the schema to ensure it triggers the logic
        sheet.getRange(1, 1).setValue("completely_corrupt_header_row");
        
        console.log("✅ Simulated ERROR: Cleared valid headers in 'Course' while leaving data intact.");
      }
    }
  } catch (e) {
    console.error("❌ Failed to simulate ERROR state:", e.message);
  }

  // 4. Simulate ISSUE: Downgrade the metadata version (e.g., 'Finance' domain)
  try {
    const financeMeta = fs.findByName("Finance");
    if (financeMeta) {
      const ss = SpreadsheetApp.openById(financeMeta.id);
      const metaSheet = ss.getSheetByName("__META__");
      if (metaSheet) {
        const data = metaSheet.getDataRange().getValues();
        for (let r = 0; r < data.length; r++) {
          if (data[r][0] === "schemaVersion") {
            metaSheet.getRange(r + 1, 2).setValue("0.0.1-broken");
            console.log("✅ Simulated ISSUE: Downgraded schemaVersion in 'Finance' __META__.");
            break;
          }
        }
      }
    }
  } catch (e) {
    console.error("❌ Failed to simulate ISSUE state:", e.message);
  }
  
  console.log("🏁 Corruption Simulation Complete. Run 'Analyze System' in the UI to see the live report.");
}