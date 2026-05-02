/**
 * @file StudentService.js
 * Domain Service for Student Management.
 * 
 * Responsibility:
 * - Orchestrates multi-table Student operations.
 * - Manages relational integrity during creation.
 * - Provides hydrated profile views.
 */

const StudentService = {
  /**
   * Orchestrates the registration of a new student.
   * Leverages SheetDB's native insertOne() for relational linkage.
   * 
   * @param {Object} payload - { profile, address, contact }
   * @returns {Object} The complete hydrated student object.
   */
  registerStudent(payload) {
    const db = DBContext.getInstance();
    const utils = typeof SheetDB.Utils !== 'undefined' ? SheetDB.Utils : { generateId: (prefix) => prefix + "-" + Math.random().toString(36).substring(2, 9).toUpperCase() };

    console.log(`[StudentService] Registering new student: ${payload.profile.student_name}`);

    // 1. Generate Primary Identifiers (Required because library doesn't auto-generate IDs yet)
    const studentId = utils.generateId("STU");
    const addressId = utils.generateId("ADDR");
    const contactId = utils.generateId("CONT");

    // 2. Build the nested payload for insertOne()
    // The library will automatically inject student_id into address and contact
    // and address_id into contact if the schema relations are defined.
    const nestedPayload = {
      ...payload.profile,
      student_id: studentId,
      created_at: new Date(),
      status: payload.profile.status || "active",
      
      // Nested Relation Keys (Must match the 'relations' keys in Student schema)
      address: {
        ...payload.address,
        address_id: addressId
      },
      contact: {
        ...payload.contact,
        contact_id: contactId
      }
    };

    try {
      // 3. Execute Nested Relational Insert
      const student = db.Student.insertOne(nestedPayload);
      
      console.log(`[StudentService] Registration successful for ID: ${studentId}`);
      return student;
      
    } catch (error) {
      console.error("[StudentService] Registration failed:", error);
      throw new Error(`Failed to register student: ${error.message}`);
    }
  },

  /**
   * Retrieves a full student profile with all relations.
   * @param {string} studentId
   */
  getProfile(studentId) {
    const db = DBContext.getInstance();
    return db.Student.findById(studentId, ['Address', 'ContactInfo', 'Enrollment']);
  }
};

