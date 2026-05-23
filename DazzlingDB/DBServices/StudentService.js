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
   * Helper to generate unique identifiers, falling back to inline logic if SheetDB.Utils is unavailable.
   * @param {string} prefix - The prefix for the ID (e.g. "STU", "ADDR")
   * @returns {string} The generated unique ID.
   * @private
   */
  _generateId(prefix) {
    if (typeof SheetDB.Utils !== 'undefined' && typeof SheetDB.Utils.generateId === 'function') {
      return SheetDB.Utils.generateId(prefix);
    }
    return prefix + "-" + Math.random().toString(36).substring(2, 9).toUpperCase();
  },

  /**
   * Orchestrates the registration of a new student.
   * Leverages SheetDB's native insertOne() for relational linkage.
   * 
   * @param {Object} payload - { profile, address, contact }
   * @returns {Object} The complete hydrated student object.
   */
  registerStudent(payload) {
    const db = DBContext.getInstance();

    console.log(`[StudentService] Registering new student: ${payload.profile.student_name}`);

    // 1. Generate Primary Identifiers (Required because library doesn't auto-generate IDs yet)
    const studentId = this._generateId("STU");
    const addressId = this._generateId("ADDR");
    const contactId = this._generateId("CONT");

    // 2. Build the nested payload for insertOne()
    // The library will automatically inject student_id into address and contact
    // and addre`ss_id into contact if the schema relations are defined.
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
  },

  /**
   * Creates a new StudentLead record.
   * 
   * @param {Object} leadData
   * @returns {Object} The created StudentLead record.
   */
  addStudentLead(leadData) {
    const db = DBContext.getInstance();

    console.log(`[StudentService] Adding new student lead: ${leadData.student_name}`);

    // 1. Generate Primary Identifier
    const leadId = this._generateId("SLD");

    // 2. Build record payload
    const recordPayload = {
      ...leadData,
      lead_id: leadId,
      created_at: leadData.created_at ? new Date(leadData.created_at) : new Date(),
      updated_at: leadData.updated_at ? new Date(leadData.updated_at) : new Date(),
      status: leadData.status || "prospect",
      is_registered: leadData.is_registered === true || leadData.is_registered === "true"
    };

    try {
      // 3. Insert record using SheetDB
      const record = db.StudentLead.insertOne(recordPayload);
      console.log(`[StudentService] Lead successfully created with ID: ${leadId}`);
      return record;
    } catch (error) {
      console.error("[StudentService] Failed to add student lead:", error);
      throw new Error(`Failed to add student lead: ${error.message}`);
    }
  }
};

