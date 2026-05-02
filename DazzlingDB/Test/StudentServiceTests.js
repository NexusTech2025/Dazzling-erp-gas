/**
 * @file StudentServiceTests.js
 * Integration Tests for the Student Domain.
 */

/**
 * Integration Test: Student Registration Lifecycle.
 * Verifies multi-table insertion and relational linking via SheetDB's insertOne.
 */
function test_registration() {
  const payload = {
    profile: {
      student_name: "Moni Developer",
      email: "moni@example.com",
      phone: "9876543210",
      gender: "Male",
      dob: new Date("1990-01-01")
    },
    address: {
      line1: "Tech Hub, Sector 5",
      city: "Bangalore",
      state: "Karnataka",
      pin_code: "560001"
    },
    contact: {
      emergency_name: "Aira Architect",
      emergency_phone: "1112223333",
      emergency_relationship: "Peer"
    }
  };

  console.log("[Test] Starting Student Registration Test...");
  
  try {
    const newStudent = StudentService.registerStudent(payload);
    
    console.log("[Test] Registration Successful!");
    console.log("[Test] Generated ID:", newStudent.student_id);
    
    // Validate relations via Lazy-Loading Methods
    // Note: Calling .address() triggers a physical fetch from the spreadsheet.
    const address = newStudent.address(); 
    if (address && address.student_id === newStudent.student_id) {
      console.log("✅ Relation Check: Address linked and fetched successfully.");
    } else {
      console.error("❌ Relation Check: Address link failed.");
    }

    const contact = newStudent.contact();
    if (contact && contact.student_id === newStudent.student_id) {
      console.log("✅ Relation Check: Contact linked and fetched successfully.");
    } else {
      console.error("❌ Relation Check: Contact link failed.");
    }

    // Explicit Serialization: 
    // 1. Convert to plain JSON object (strips circular framework refs)
    // 2. Stringify for logging
    const studentData = newStudent.toJSON();
    console.log("[Test] Record Snapshot:", JSON.stringify(studentData, null, 2));
    
  } catch (e) {
    console.error("[Test] Registration Failed:", e.message);
  }
}
