/**
 * AttendanceUtil - Specialized application context manager handling 
 * classroom attendance states, slot validation, and financial suspension controls.
 */
class AttendanceUtil {
  /**
   * Scans a student's ledger balances and applies sister-suspensions across split seat models.
   * Aligned with Decoupled Contract-to-Seat Model (Axiom 1).
   * @param {string} studentId - Unique record identifier resolved dynamically.
   * @param {DBContext} db - Active database context singleton.
   */
  static processStudentGatekeeping(studentId, db) {
    const enrollmentRepo = db.repository('Enrollment');
    const allocationRepo = db.repository('BatchAllocation');
    
    const activeEnrollments = enrollmentRepo.where({ student_id: studentId, status: 'active' });
    
    for (const enrollment of activeEnrollments) {
      const account = enrollment.studentFeeAccount(); // Hydrate relational model
      if (!account) continue;
      
      const installments = account.installments() || [];
      for (const installment of installments) {
        // Safe domain evaluation call inheriting from DazzlingDateTime
        if (this.isPastGracePeriod(installment.due_date, 7)) {
          // Breach verified: cascade state boundaries across parallel seat records
          allocationRepo.updateMany(
            { enrollment_id: enrollment.id, status: 'active' },
            { status: 'suspended' }
          );
        }
      }
    }
  }
}

// Register securely into global container space without wiping properties
globalThis.AttendanceUtil = AttendanceUtil;
