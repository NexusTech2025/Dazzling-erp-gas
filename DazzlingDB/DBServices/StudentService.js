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
   * Leverages SheetDB's native insertOne() for relational linkage and maps related entities.
   * 
   * @param {Object} payload - The Comprehensive Relational Payload
   * @returns {Object} The complete hydrated student object.
   */
  registerStudent(payload) {
    const db = DBContext.getInstance();

    console.log(`[StudentService] Registering new student: ${payload.profile.student_name}`);

    // 1. Generate Root Identifiers
    const studentId = this._generateId("STU");
    const addressId = this._generateId("ADDR");
    const contactId = this._generateId("CONT");

    // 2. Perform Strict Pre-flight Package Verification (Plan 2)
    (payload.enrollments || []).forEach(item => {
      if (item.item_id.indexOf("PKG") === 0) {
        const packageItems = db.PackageItem.where({ package_id: item.item_id, entity_type: "course" });
        const requiredCourseIds = packageItems.map(pi => pi.entity_id);
        
        const providedCourseIds = (item.package_batches || []).map(pb => pb.course_id);
        
        const missingCourses = requiredCourseIds.filter(cid => !providedCourseIds.includes(cid));
        if (missingCourses.length > 0) {
          const courseNames = missingCourses.map(cid => {
            const crs = db.Course.findById(cid);
            return crs ? crs.name : cid;
          });
          throw new Error(`Package registration incomplete. Missing batch selections for: ${courseNames.join(", ")}`);
        }
      }
    });

    // 3. Build the nested payload for insertOne() to write profile, address, contact, and education
    const studentGraph = {
      ...payload.profile,
      student_id: studentId,
      created_at: new Date(),
      status: payload.profile.status || "active",

      // Nested Relation Keys
      address: {
        ...payload.address,
        address_id: addressId
      },
      contact: {
        ...payload.contact,
        contact_id: contactId
      },
      education: (payload.education || []).map(edu => ({
        ...edu,
        education_id: this._generateId("EDU")
      })),
      enrollments: [] // Managed manually below due to dynamic metadata and package linkages
    };

    try {
      // 4. Insert Student Graph (inserts Student, Address, ContactInfo, and Education)
      const student = db.Student.insertOne(studentGraph);

      // 5. Process Enrollments, Fee Accounts, and Payments
      (payload.enrollments || []).forEach(item => {
        const enrollmentId = this._generateId("ENR");

        // Resolve item metadata if it is a Package
        let metadata = null;
        const isPackage = item.item_id.indexOf("PKG") === 0;
        
        if (isPackage) {
          const packageItems = db.PackageItem.where({ package_id: item.item_id, entity_type: "course" });
          const courseFeesMap = {};
          packageItems.forEach(pi => {
            const course = db.Course.findById(pi.entity_id);
            courseFeesMap[pi.entity_id] = course ? course.base_fee : 0;
          });
          metadata = { course_fees: courseFeesMap };
        }

        // Insert Parent Enrollment row
        db.Enrollment.insert({
          enrollment_id: enrollmentId,
          student_id: studentId,
          item_id: item.item_id,
          batch_id: isPackage ? null : item.batch_id,
          enrollment_date: new Date(),
          status: "active",
          academic_status: "active",
          package_enrollment_id: null,
          metadata: metadata
        });

        // If Package, insert child subject enrollments pointing to this parent
        if (isPackage && item.package_batches) {
          item.package_batches.forEach(batch => {
            const childEnrollmentId = this._generateId("ENR");
            db.Enrollment.insert({
              enrollment_id: childEnrollmentId,
              student_id: studentId,
              item_id: batch.course_id,
              batch_id: batch.batch_id,
              enrollment_date: new Date(),
              status: "active",
              academic_status: "active",
              package_enrollment_id: enrollmentId,
              metadata: null
            });
          });
        }

        // 6. Setup Finance Ledger for this enrollment (Proportional Splitting)
        if (payload.feeAccount) {
          const proportion = item.fee / payload.feeAccount.total_fee;
          const calculatedDiscount = Math.round((payload.feeAccount.discount || 0) * proportion);
          const calculatedFinalFee = item.fee - calculatedDiscount;
          const calculatedAmountPaid = Math.round((payload.feeAccount.amount_paid || 0) * proportion);
          const balanceDue = calculatedFinalFee - calculatedAmountPaid;
          
          const feeAccountId = this._generateId("SFA");

          db.StudentFeeAccount.insert({
            student_fee_id: feeAccountId,
            enrollment_id: enrollmentId,
            fee_plan_id: payload.feeAccount.fee_plan_id || "FPL-DEFAULT",
            total_fee: item.fee,
            discount: calculatedDiscount,
            final_fee: calculatedFinalFee,
            amount_paid: calculatedAmountPaid,
            balance_due: balanceDue,
            status: "active",
            remarks: "Provisioned during student registration"
          });

          // Process Installments
          let firstInstallmentId = null;

          if (payload.feeAccount.installments && payload.feeAccount.installments.length > 0) {
            payload.feeAccount.installments.forEach((ins, idx) => {
              const installmentId = this._generateId("INS");
              if (idx === 0) firstInstallmentId = installmentId;

              const installmentDue = Math.round(ins.due_amount * proportion);
              const installmentPaid = Math.round((ins.paid_amount || 0) * proportion);

              db.Installment.insert({
                installment_id: installmentId,
                student_fee_id: feeAccountId,
                installment_number: ins.installment_number || (idx + 1),
                due_amount: installmentDue,
                paid_amount: installmentPaid,
                late_fee_amount: Math.round((ins.late_fee_amount || 0) * proportion),
                due_date: new Date(ins.due_date),
                status: ins.status || (installmentPaid >= installmentDue ? "paid" : (installmentPaid > 0 ? "partially_paid" : "pending"))
              });
            });
          } else {
            // Generate default single installment
            const installmentId = this._generateId("INS");
            firstInstallmentId = installmentId;

            db.Installment.insert({
              installment_id: installmentId,
              student_fee_id: feeAccountId,
              installment_number: 1,
              due_amount: calculatedFinalFee,
              paid_amount: calculatedAmountPaid,
              late_fee_amount: 0,
              due_date: new Date(),
              status: calculatedAmountPaid >= calculatedFinalFee ? "paid" : (calculatedAmountPaid > 0 ? "partially_paid" : "pending")
            });
          }

          // Record Proportional Payment
          if (calculatedAmountPaid > 0 && payload.payment) {
            db.Payment.insert({
              payment_id: this._generateId("PAY"),
              student_fee_id: feeAccountId,
              installment_id: firstInstallmentId,
              amount_paid: calculatedAmountPaid,
              payment_date: payload.payment.payment_date ? new Date(payload.payment.payment_date) : new Date(),
              payment_method: payload.payment.payment_method,
              transaction_reference: payload.payment.transaction_reference || "CONSOLIDATED",
              status: "success"
            });
          }
        }
      });

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
  },

  /**
   * Processes a subject withdrawal from a package enrollment.
   * Adjusts the parent package StudentFeeAccount and outstanding installments.
   */
  processSubjectWithdrawal(studentId, courseId) {
    const db = DBContext.getInstance();
    
    // 1. Locate the child enrollment
    const childEnrollment = db.Enrollment.findOne({
      student_id: studentId,
      item_id: courseId,
      status: "active"
    });
    if (!childEnrollment) {
      throw new Error(`Active course enrollment not found for Student ${studentId} and Course ${courseId}`);
    }
    
    // Check if this enrollment belongs to a package
    const parentEnrollmentId = childEnrollment.package_enrollment_id;
    if (!parentEnrollmentId) {
      throw new Error(`Enrollment ${childEnrollment.enrollment_id} is a standalone course, not part of a package.`);
    }

    const parentEnrollment = db.Enrollment.findById(parentEnrollmentId);
    if (!parentEnrollment) {
      throw new Error(`Parent enrollment ${parentEnrollmentId} not found.`);
    }

    return Database.transaction(function(db) {
      // 2. Mark child enrollment as withdrawn and suspended
      db.Enrollment.update(childEnrollment.enrollment_id, {
        status: "withdrawn",
        academic_status: "withdrawn"
      });

      // 3. Retrieve base fee from metadata snapshot stored in parent package enrollment
      const metadata = parentEnrollment.metadata;
      if (!metadata || !metadata.course_fees || typeof metadata.course_fees[courseId] === "undefined") {
        throw new Error(`Metadata snapshot for course ${courseId} is missing in parent enrollment.`);
      }
      const childBaseFee = metadata.course_fees[courseId];

      // 4. Calculate total base fees sum from the parent's metadata to determine relative weight
      let totalBaseFeesSum = 0;
      for (const cid in metadata.course_fees) {
        totalBaseFeesSum += metadata.course_fees[cid];
      }

      if (totalBaseFeesSum === 0) {
        throw new Error("Invalid metadata: sum of course fees is zero.");
      }

      const ratio = childBaseFee / totalBaseFeesSum;

      // 5. Load Parent StudentFeeAccount
      const parentSfa = db.StudentFeeAccount.findOne({ enrollment_id: parentEnrollmentId });
      if (!parentSfa) {
        throw new Error(`Parent StudentFeeAccount not found for enrollment ${parentEnrollmentId}`);
      }

      // Calculate discount and refund values
      const refundAmount = Math.round(parentSfa.total_fee * ratio);
      const calculatedDiscountToDeduct = Math.round(parentSfa.discount * ratio);
      const netRefundAmount = refundAmount - calculatedDiscountToDeduct;

      const newTotalFee = parentSfa.total_fee - refundAmount;
      const newDiscount = parentSfa.discount - calculatedDiscountToDeduct;
      const newFinalFee = parentSfa.final_fee - netRefundAmount;
      const newAmountPaid = parentSfa.amount_paid;
      const newBalanceDue = Math.max(0, newFinalFee - newAmountPaid);

      // Update parent fee account
      db.StudentFeeAccount.update(parentSfa.student_fee_id, {
        total_fee: newTotalFee,
        discount: newDiscount,
        final_fee: newFinalFee,
        balance_due: newBalanceDue
      });

      // 6. Re-amortize installments
      const installments = db.Installment.where({ student_fee_id: parentSfa.student_fee_id });
      installments.sort((a, b) => b.installment_number - a.installment_number);

      let remainingReduction = netRefundAmount;
      installments.forEach(ins => {
        if (remainingReduction <= 0) return;

        const currentDue = ins.due_amount;
        const currentPaid = ins.paid_amount || 0;
        const outstanding = currentDue - currentPaid;

        if (outstanding > 0) {
          const reduction = Math.min(remainingReduction, outstanding);
          const newDue = currentDue - reduction;
          db.Installment.update(ins.installment_id, {
            due_amount: newDue,
            status: newDue <= currentPaid ? "paid" : (currentPaid > 0 ? "partially_paid" : "pending")
          });
          remainingReduction -= reduction;
        }
      });

      // Issue refund payout if student paid more than the new package cost
      let creditOwed = 0;
      if (remainingReduction > 0) {
        creditOwed = remainingReduction;
        const refundPaymentId = StudentService._generateId("PAY");
        db.Payment.insert({
          payment_id: refundPaymentId,
          student_fee_id: parentSfa.student_fee_id,
          installment_id: installments[installments.length - 1] ? installments[installments.length - 1].installment_id : null,
          amount_paid: -creditOwed,
          payment_date: new Date(),
          payment_method: "cash",
          transaction_reference: "WITHDRAWAL-REFUND",
          status: "success",
          remarks: `Refund issued due to subject withdrawal of course: ${courseId}`
        });

        db.StudentFeeAccount.update(parentSfa.student_fee_id, {
          amount_paid: parentSfa.amount_paid - creditOwed,
          balance_due: 0
        });
      }

      console.log(`[StudentService] Successfully processed withdrawal for course: ${courseId} and student: ${studentId}`);
      return {
        status: "success",
        studentId: studentId,
        withdrawnCourseId: courseId,
        refundAmount: netRefundAmount,
        creditRefunded: creditOwed
      };
    });
  },

  /**
   * Upgrades standalone course enrollments to a package.
   * Merges past payments and establishes the remaining installment balance.
   */
  upgradeToPackage(studentId, currentEnrollmentIds, targetPackageId, packageBatches) {
    const db = DBContext.getInstance();
    
    return Database.transaction(function(db) {
      // 1. Gather all historical payments from standalone fee accounts and calculate rollover amount
      let totalPaymentsToRollover = 0;
      currentEnrollmentIds.forEach(eid => {
        const sfa = db.StudentFeeAccount.findOne({ enrollment_id: eid });
        if (sfa) {
          totalPaymentsToRollover += sfa.amount_paid;
          db.StudentFeeAccount.update(sfa.student_fee_id, {
            status: "upgraded",
            final_fee: 0,
            amount_paid: 0,
            balance_due: 0
          });
        }
      });

      // 2. Insert parent package enrollment
      const pkgEnrollmentId = StudentService._generateId("ENR");
      
      const pkgDetails = db.Package.findById(targetPackageId);
      if (!pkgDetails) {
        throw new Error(`Package ${targetPackageId} not found.`);
      }

      // Fetch base fees for package courses to build metadata snapshot
      const packageItems = db.PackageItem.where({ package_id: targetPackageId, entity_type: "course" });
      const courseFeesMap = {};
      packageItems.forEach(pi => {
        const course = db.Course.findById(pi.entity_id);
        courseFeesMap[pi.entity_id] = course ? course.base_fee : 0;
      });
      const metadata = { course_fees: courseFeesMap };

      db.Enrollment.insert({
        enrollment_id: pkgEnrollmentId,
        student_id: studentId,
        item_id: targetPackageId,
        batch_id: null,
        enrollment_date: new Date(),
        status: "active",
        academic_status: "active",
        package_enrollment_id: null,
        metadata: metadata
      });

      // 3. Create parent StudentFeeAccount
      const parentFeeId = StudentService._generateId("SFA");
      const packageFee = pkgDetails.package_fee;
      const balanceDue = Math.max(0, packageFee - totalPaymentsToRollover);

      db.StudentFeeAccount.insert({
        student_fee_id: parentFeeId,
        enrollment_id: pkgEnrollmentId,
        fee_plan_id: "FPL-DEFAULT",
        total_fee: packageFee,
        discount: 0,
        final_fee: packageFee,
        amount_paid: totalPaymentsToRollover,
        balance_due: balanceDue,
        status: "active",
        remarks: "Created during package upgrade transaction"
      });

      // 4. Update existing child enrollments & create new child enrollments
      packageBatches.forEach(batch => {
        const existingEnrollment = db.Enrollment.findOne({ student_id: studentId, item_id: batch.course_id });
        if (existingEnrollment) {
          db.Enrollment.update(existingEnrollment.enrollment_id, {
            package_enrollment_id: pkgEnrollmentId,
            batch_id: batch.batch_id
          });
        } else {
          db.Enrollment.insert({
            enrollment_id: StudentService._generateId("ENR"),
            student_id: studentId,
            item_id: batch.course_id,
            batch_id: batch.batch_id,
            enrollment_date: new Date(),
            status: "active",
            academic_status: "active",
            package_enrollment_id: pkgEnrollmentId,
            metadata: null
          });
        }
      });

      // 5. Record the rollover credit payment
      if (totalPaymentsToRollover > 0) {
        db.Payment.insert({
          payment_id: StudentService._generateId("PAY"),
          student_fee_id: parentFeeId,
          installment_id: null,
          amount_paid: totalPaymentsToRollover,
          payment_date: new Date(),
          payment_method: "upi",
          transaction_reference: "UPGRADE-ROLLOVER",
          status: "success",
          remarks: "Transferred credit from upgraded standalone courses"
        });
      }

      // 6. Generate new installment for remaining balance
      if (balanceDue > 0) {
        db.Installment.insert({
          installment_id: StudentService._generateId("INS"),
          student_fee_id: parentFeeId,
          installment_number: 1,
          due_amount: balanceDue,
          paid_amount: 0,
          late_fee_amount: 0,
          due_date: new Date(),
          status: "pending"
        });
      }

      console.log(`[StudentService] Successfully upgraded student: ${studentId} to package: ${targetPackageId}`);
      return {
        status: "success",
        packageEnrollmentId: pkgEnrollmentId,
        studentFeeId: parentFeeId
      };
    });
  },

  /**
   * Decoupled access check. Checks academic status and evaluates payment limits.
   */
  verifyAccess(studentId, courseId) {
    const db = DBContext.getInstance();
    const enrollment = db.Enrollment.findOne({ student_id: studentId, item_id: courseId });
    if (!enrollment) return { allowed: false, reason: "No active enrollment found." };
    
    if (enrollment.academic_status === "suspended") {
      return { allowed: false, reason: "Access suspended due to outstanding dues." };
    }
    
    let feeAccount = db.StudentFeeAccount.findOne({ enrollment_id: enrollment.enrollment_id });
    
    if (!feeAccount && enrollment.package_enrollment_id) {
      feeAccount = db.StudentFeeAccount.findOne({ enrollment_id: enrollment.package_enrollment_id });
    }
    
    if (!feeAccount) return { allowed: true };
    
    const gracePeriodDays = 7;
    const overdueLimitDate = new Date();
    overdueLimitDate.setDate(overdueLimitDate.getDate() - gracePeriodDays);
    
    const overdueInstallments = db.Installment.where({
      student_fee_id: feeAccount.student_fee_id,
      status: ["pending", "partially_paid"]
    });

    const isOverdue = overdueInstallments.some(ins => {
      const dueDate = new Date(ins.due_date);
      return dueDate < overdueLimitDate;
    });
    
    if (isOverdue) {
      Database.transaction(function(db) {
        db.Enrollment.update(enrollment.enrollment_id, { academic_status: "suspended" });
        if (enrollment.package_enrollment_id) {
          const children = db.Enrollment.where({ package_enrollment_id: enrollment.package_enrollment_id });
          children.forEach(c => db.Enrollment.update(c.enrollment_id, { academic_status: "suspended" }));
        }
      });
      return { allowed: false, reason: "Suspended: Overdue installment payment." };
    }
    
    return { allowed: true };
  }
};

