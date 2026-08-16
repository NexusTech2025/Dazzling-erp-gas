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
  /**
   * Thread-safe background mutation tracking wrapper
   * @private
   */
  _trackMutation(context, tableName) {
    if (context && context.mutationManifest && Array.isArray(context.mutationManifest)) {
      if (!context.mutationManifest.includes(tableName)) {
        context.mutationManifest.push(tableName);
      }
    }
  },

  /**
   * Orchestrates the registration of a new student using highly decoupled private primitives.
   * @param {Object} payload - The Comprehensive Relational Payload
   * @param {Object} context - Request execution lifecycle context
   * @returns {Object} The complete Student profile record.
   */
  registerStudent(payload, context) {
    if (!payload) {
      throw new ActionValidationError("payload is required.");
    }
    if (!payload.profile) {
      throw new ActionValidationError("payload must contain 'profile'.");
    }
    if (!payload.profile.student_name) {
      throw new ActionValidationError("profile must contain 'student_name'.", {
        errorCode: "ACTION_VALIDATION_FAILURE",
        details: [{ field: "profile.student_name", issue: "student_name is required" }]
      });
    }

    console.log(`[StudentService] Registering new student: ${payload.profile.student_name}`);

    // 1. Pre-flight verification routines
    this._verifyCurriculumCompleteness(payload);
    this._verifyLedgerAlignment(payload);

    const tx = new TransactionTracker();

    try {
      // 2. Cascading isolated database persistence steps
      const student = this._persistStudentProfile(payload, context, tx);

      this._persistAddressGraph(student.student_id, payload.address, context, tx);
      this._persistContactGraph(student.student_id, payload.contact, context, tx);
      this._persistEducationGraph(student.student_id, payload.education, context, tx);

      // 3. Process enrollment contracts & fee setups (isolated contracts vs seating model)
      this._processEnrollmentLedgers(student.student_id, payload, context, tx);

      // 4. Return serialized/clean profile object
      return student.toJSON();
    } catch (error) {
      console.error("[StudentService] Student registration failed. Rolling back...", error);
      tx.rollback();
      throw error;
    }
  },

  /** @private */
  _verifyCurriculumCompleteness(payload) {
    const db = DBContext.getInstance();
    (payload.enrollments || []).forEach(item => {
      if (item.enrollment_type === "package") {
        const targetPackageItems = db.PackageItem.where({ package_id: item.item_id });
        const batchAllocations = item.package_batches || [];

        targetPackageItems.forEach(pkgItem => {
          // Look for a corresponding allocation pointing to this required course
          const allocationMatch = batchAllocations.find(b => b.course_id === pkgItem.entity_id);

          if (!allocationMatch || !allocationMatch.batch_id) {
            throw new PackageOrchestrationError(
              `Curriculum Integrity Breach: Selected package requires an active batch seat allocation for Course ID [${pkgItem.entity_id}].`,
              {
                errorCode: "PACKAGE_ORCHESTRATION_BREACH",
                details: [{ field: "package_batches", issue: `Missing explicit seat pointer for course element: ${pkgItem.entity_id}` }]
              }
            );
          }
        });
      }
    });
  },

  /** @private */
  _verifyLedgerAlignment(payload) {
    if (payload.financials) {
      const feeVal = Number(payload.financials.total_fee);
      if (isNaN(feeVal) || feeVal <= 0) {
        throw new ActionValidationError(
          "Consolidated ledger baseline valuations cannot be zero or negative.",
          {
            errorCode: "INVALID_LEDGER_VALUATION",
            details: [{ field: "financials.total_fee", issue: "Value must balance above zero scale." }]
          }
        );
      }
    }
    if (payload.feeAccount) {
      const feeVal = Number(payload.feeAccount.total_fee);
      if (isNaN(feeVal) || feeVal <= 0) {
        throw new ActionValidationError(
          "Consolidated ledger baseline valuations cannot be zero or negative.",
          {
            errorCode: "INVALID_LEDGER_VALUATION",
            details: [{ field: "feeAccount.total_fee", issue: "Value must balance above zero scale." }]
          }
        );
      }
    }
  },

  /** @private */
  _persistStudentProfile(payload, context, tx) {
    const db = DBContext.getInstance();

    const profile = {
      ...payload.profile,
      created_at: new Date(),
      status: payload.profile.status || "active"
    };

    const studentRecord = db.Student.insert(profile);
    tx.trackInsert(db.Student, studentRecord.student_id);
    this._trackMutation(context, "Student");
    return studentRecord;
  },

  /** @private */
  _persistAddressGraph(studentId, addressData, context, tx) {
    if (!addressData) return;
    const db = DBContext.getInstance();

    const addr = {
      ...addressData,
      student_id: studentId
    };

    const record = db.Address.insert(addr);
    tx.trackInsert(db.Address, record.address_id);
    this._trackMutation(context, "Address");
  },

  /** @private */
  _persistContactGraph(studentId, contactData, context, tx) {
    if (!contactData) return;
    const db = DBContext.getInstance();

    const contact = {
      ...contactData,
      student_id: studentId
    };

    const record = db.ContactInfo.insert(contact);
    tx.trackInsert(db.ContactInfo, record.contact_id);
    this._trackMutation(context, "ContactInfo");
  },

  /** @private */
  _persistEducationGraph(studentId, educationData, context, tx) {
    if (!educationData || !Array.isArray(educationData)) return;
    const db = DBContext.getInstance();

    educationData.forEach(edu => {
      const record = db.Education.insert({
        ...edu,
        student_id: studentId
      });
      tx.trackInsert(db.Education, record.education_id);
      this._trackMutation(context, "Education");
    });
  },

  /** @private */
  _processEnrollmentLedgers(studentId, payload, context, tx) {
    if (!payload.enrollments) return;
    const db = DBContext.getInstance();

    payload.enrollments.forEach(item => {
      const enrollmentType = item.enrollment_type;
      const isPackage = enrollmentType === "package";

      // 1. Resolve item metadata if Package
      let metadata = null;
      if (isPackage) {
        const packageItems = db.PackageItem.where({ package_id: item.item_id });
        const courseFeesMap = {};
        packageItems.forEach(pi => {
          let course = null;
          if (pi.entity_type === "course" || pi.entity_type === "subject") {
            course = db.Course.findById(pi.entity_id);
          }
          courseFeesMap[pi.entity_id] = course ? course.base_fee : 0;
        });
        metadata = { course_fees: courseFeesMap };
      }

      // 2. Insert standard Enrollment record
      const enrollmentRecord = db.Enrollment.insert({
        student_id: studentId,
        enrollment_type: enrollmentType,
        item_id: item.item_id,
        enrollment_date: new Date(),
        status: "active",
        academic_status: "active",
        metadata: metadata
      });
      const enrollmentId = enrollmentRecord.enrollment_id;
      tx.trackInsert(db.Enrollment, enrollmentId);
      this._trackMutation(context, "Enrollment");

      // 3. Resolve default fee plan via natural query lookup
      let plan = db.FeePlan.findOne({
        entity_id: item.item_id,
        entity_type: enrollmentType,
        plan_name: "Default Standard Plan"
      });

      if (!plan) {
        let baseFee = 0;
        if (isPackage) {
          const pkg = db.Package.findById(item.item_id);
          baseFee = pkg ? pkg.package_fee : item.fee;
        } else {
          const course = db.Course.findById(item.item_id);
          baseFee = course ? course.base_fee : item.fee;
        }

        plan = db.FeePlan.insert({
          entity_id: item.item_id,
          entity_type: enrollmentType,
          plan_name: "Default Standard Plan",
          total_fee: baseFee,
          discount_allowed: true,
          installment_allowed: true
        });
        tx.trackInsert(db.FeePlan, plan.fee_plan_id);
        this._trackMutation(context, "FeePlan");
      }

      const feePlanId = (payload.feeAccount && payload.feeAccount.fee_plan_id) || plan.fee_plan_id;

      if (isPackage) {
        if (item.package_batches) {
          item.package_batches.forEach(batch => {
            if (batch.batch_id && !db.Batch.findById(batch.batch_id)) {
              throw new SheetDB.EntityNotFoundError("Batch", batch.batch_id, "Academic");
            }
            const allocRecord = db.BatchAllocation.insert({
              student_id: studentId,
              enrollment_id: enrollmentId,
              course_id: batch.course_id,
              batch_id: batch.batch_id,
              status: "active",
              remarks: "Assigned during package registration"
            });
            tx.trackInsert(db.BatchAllocation, allocRecord.allocation_id);
            this._trackMutation(context, "BatchAllocation");
          });
        }
      } else {
        if (item.batch_id && !db.Batch.findById(item.batch_id)) {
          throw new SheetDB.EntityNotFoundError("Batch", item.batch_id, "Academic");
        }
        const allocRecord = db.BatchAllocation.insert({
          student_id: studentId,
          enrollment_id: enrollmentId,
          course_id: item.item_id,
          batch_id: item.batch_id,
          status: "active",
          remarks: `Assigned during ${enrollmentType} registration`
        });
        tx.trackInsert(db.BatchAllocation, allocRecord.allocation_id);
        this._trackMutation(context, "BatchAllocation");
      }

      // 5. Setup StudentFeeAccount
      if (payload.feeAccount) {
        const totalFee = Number(payload.feeAccount.total_fee);
        if (!totalFee || totalFee <= 0) {
          throw new ActionValidationError("Cannot compute fee proportion: total_fee is zero or invalid.");
        }
        const proportion = item.fee / totalFee;
        const calculatedDiscount = Math.round((payload.feeAccount.discount || 0) * proportion);
        const calculatedFinalFee = item.fee - calculatedDiscount;
        const calculatedAmountPaid = Math.round((payload.feeAccount.amount_paid || 0) * proportion);
        const balanceDue = calculatedFinalFee - calculatedAmountPaid;

        const feeAccountRecord = db.StudentFeeAccount.insert({
          enrollment_id: enrollmentId,
          fee_plan_id: feePlanId,
          total_fee: item.fee,
          discount: calculatedDiscount,
          final_fee: calculatedFinalFee,
          amount_paid: calculatedAmountPaid,
          balance_due: balanceDue,
          status: "active",
          remarks: "Provisioned during student registration"
        });
        const feeAccountId = feeAccountRecord.student_fee_id;
        tx.trackInsert(db.StudentFeeAccount, feeAccountId);
        this._trackMutation(context, "StudentFeeAccount");

        // 6. Setup Installments
        let firstInstallmentId = null;

        if (payload.feeAccount.installments && payload.feeAccount.installments.length > 0) {
          payload.feeAccount.installments.forEach((ins, idx) => {
            const installmentDue = Math.round(ins.due_amount * proportion);
            const installmentPaid = Math.round((ins.paid_amount || 0) * proportion);

            const insRecord = db.Installment.insert({
              student_fee_id: feeAccountId,
              installment_number: ins.installment_number || (idx + 1),
              due_amount: installmentDue,
              paid_amount: installmentPaid,
              late_fee_amount: Math.round((ins.late_fee_amount || 0) * proportion),
              due_date: new Date(ins.due_date),
              status: ins.status || (installmentPaid >= installmentDue ? "paid" : (installmentPaid > 0 ? "partially_paid" : "pending"))
            });
            if (idx === 0) firstInstallmentId = insRecord.installment_id;
            tx.trackInsert(db.Installment, insRecord.installment_id);
            this._trackMutation(context, "Installment");
          });
        } else {
          const insRecord = db.Installment.insert({
            student_fee_id: feeAccountId,
            installment_number: 1,
            due_amount: calculatedFinalFee,
            paid_amount: calculatedAmountPaid,
            late_fee_amount: 0,
            due_date: new Date(),
            status: calculatedAmountPaid >= calculatedFinalFee ? "paid" : (calculatedAmountPaid > 0 ? "partially_paid" : "pending")
          });
          firstInstallmentId = insRecord.installment_id;
          tx.trackInsert(db.Installment, insRecord.installment_id);
          this._trackMutation(context, "Installment");
        }

        // 7. Setup Payment
        if (calculatedAmountPaid > 0 && payload.payment) {
          const paymentRecord = db.Payment.insert({
            student_fee_id: feeAccountId,
            installment_id: firstInstallmentId,
            amount_paid: calculatedAmountPaid,
            payment_date: payload.payment.payment_date ? new Date(payload.payment.payment_date) : new Date(),
            payment_method: payload.payment.payment_method,
            transaction_reference: payload.payment.transaction_reference || "CONSOLIDATED",
            status: "success"
          });
          tx.trackInsert(db.Payment, paymentRecord.payment_id);
          this._trackMutation(context, "Payment");
        }
      }
    });
  },

  /**
   * Atomically updates a student's profile across Student, Address, ContactInfo,
   * and Education tables using upsert semantics.
   *
   * @param {Object} payload - The update payload.
   * @param {string} payload.student_id - Required. The target student primary key.
   * @param {Object} [payload.profile] - Partial Student table field updates.
   * @param {Object} [payload.address] - Address upsert data (creates if missing).
   * @param {Object} [payload.contact] - ContactInfo upsert data (creates if missing).
   * @param {Array<Object>} [payload.education] - Education records array.
   * @param {Object} context - Request execution lifecycle context.
   * @returns {Object} Full hydrated student profile (Student + Address + ContactInfo + Education[]).
   */
  updateStudentProfile(payload, context) {
    if (!payload || !payload.student_id) {
      throw new ActionValidationError("payload must contain 'student_id'.");
    }

    const studentId = String(payload.student_id).trim();
    const db = DBContext.getInstance();

    // 1. Pre-flight verification routines
    const student = db.Student.findById(studentId);
    if (!student) {
      throw new StudentProfileError(`Student with ID '${studentId}' not found.`, {
        errorCode: "STUDENT_NOT_FOUND",
        details: { student_id: studentId }
      });
    }

    if (student.status === "inactive") {
      throw new StudentProfileError(`Cannot update inactive student profile for '${studentId}'.`, {
        errorCode: "INACTIVE_STUDENT_PROFILE",
        details: { student_id: studentId, status: student.status }
      });
    }

    // Uniqueness pre-flight check for email
    if (payload.profile && payload.profile.email) {
      const targetEmail = String(payload.profile.email).trim();
      const existingMatch = db.Student.where({ email: targetEmail });
      const conflict = existingMatch.find(s => String(s.student_id) !== studentId);
      if (conflict) {
        throw new StudentProfileError(`Email '${targetEmail}' is already registered to another student ('${conflict.student_id}').`, {
          errorCode: "DUPLICATE_EMAIL",
          details: { email: targetEmail, conflicting_student_id: conflict.student_id }
        });
      }
    }

    // Pre-flight validation for Address upsert (if creating new)
    const existingAddress = db.Address.findOne({ student_id: studentId });
    if (payload.address && !existingAddress) {
      const reqFields = ["line1", "city", "state", "pin_code"];
      const missing = reqFields.filter(f => !payload.address[f] || !String(payload.address[f]).trim());
      if (missing.length > 0) {
        throw new StudentProfileError(`Creating new Address requires fields: ${missing.join(", ")}.`, {
          errorCode: "ADDRESS_REQUIRED_FIELDS_MISSING",
          details: { missing_fields: missing }
        });
      }
    }

    // Pre-flight validation for Education array
    if (payload.education && Array.isArray(payload.education)) {
      payload.education.forEach(edu => {
        if (edu.education_id) {
          const eduId = String(edu.education_id).trim();
          const existingEdu = db.Education.findById(eduId);
          if (!existingEdu) {
            throw new StudentProfileError(`Education record with ID '${eduId}' not found.`, {
              errorCode: "EDUCATION_RECORD_NOT_FOUND",
              details: { education_id: eduId }
            });
          }
          if (String(existingEdu.student_id) !== studentId) {
            throw new StudentProfileError(`Education record '${eduId}' belongs to student '${existingEdu.student_id}', not '${studentId}'.`, {
              errorCode: "EDUCATION_OWNERSHIP_MISMATCH",
              details: { education_id: eduId, owner_student_id: existingEdu.student_id, target_student_id: studentId }
            });
          }
        }
        if (edu.meta) {
          const errStr = (typeof SheetDB !== 'undefined' && SheetDB.ValidationRegistry)
            ? SheetDB.ValidationRegistry.execute('validateEducationMeta', edu.meta)
            : null;
          if (errStr) {
            throw new ActionValidationError(errStr);
          }
        }
      });
    }

    // 2. Wrap context in PipelineContext interface facade
    const pipeCtx = (context && typeof context.trackMutation === 'function')
      ? context
      : (typeof PipelineContext !== 'undefined' 
          ? new PipelineContext(context) 
          : new SheetDB.PipelineContext(context));

    const pipeline = (typeof AtomicPipeline !== 'undefined' ? AtomicPipeline : SheetDB.AtomicPipeline)
      .begin(db, pipeCtx);

    // Step 1: Update Student profile table
    if (payload.profile && Object.keys(payload.profile).length > 0) {
      pipeline.addStep("Student", (repo) => {
        const profileUpdates = { ...payload.profile, updated_at: new Date() };
        delete profileUpdates.student_id;
        repo.update(studentId, profileUpdates);
        this._trackMutation(context, "Student");
      });
    }

    // Step 2: Address Upsert
    if (payload.address && Object.keys(payload.address).length > 0) {
      pipeline.addStep("Address", (repo) => {
        if (existingAddress) {
          const addrUpdates = { ...payload.address };
          delete addrUpdates.address_id;
          delete addrUpdates.student_id;
          repo.update(existingAddress.address_id, addrUpdates);
        } else {
          repo.insert({
            ...payload.address,
            student_id: studentId
          });
        }
        this._trackMutation(context, "Address");
      });
    }

    // Step 3: ContactInfo Upsert
    if (payload.contact && Object.keys(payload.contact).length > 0) {
      pipeline.addStep("ContactInfo", (repo) => {
        const existingContact = db.ContactInfo.findOne({ student_id: studentId });
        if (existingContact) {
          const contactUpdates = { ...payload.contact };
          delete contactUpdates.contact_id;
          delete contactUpdates.student_id;
          repo.update(existingContact.contact_id, contactUpdates);
        } else {
          repo.insert({
            ...payload.contact,
            student_id: studentId
          });
        }
        this._trackMutation(context, "ContactInfo");
      });
    }

    // Step 4: Education Upsert
    if (payload.education && Array.isArray(payload.education) && payload.education.length > 0) {
      pipeline.addStep("Education", (repo) => {
        payload.education.forEach(edu => {
          if (edu.education_id) {
            const eduId = String(edu.education_id).trim();
            const eduUpdates = { ...edu };
            delete eduUpdates.education_id;
            delete eduUpdates.student_id;
            repo.update(eduId, eduUpdates);
          } else {
            repo.insert({
              ...edu,
              student_id: studentId
            });
          }
        });
        this._trackMutation(context, "Education");
      });
    }

    // Execute atomic transaction
    pipeline.execute();

    // 3. Hydrate and return full profile
    return this.getProfile(studentId);
  },

  /**
   * Retrieves a full student profile with all relations.
   */
  getProfile(studentId) {
    const db = DBContext.getInstance();
    const student = db.Student.findById(studentId);
    if (!student) return null;

    const addrRecord = (typeof student.address === 'function') ? student.address() : null;
    const contactRecord = (typeof student.contact === 'function') ? student.contact() : null;
    const eduRecords = db.Education ? db.Education.where({ student_id: studentId }) : [];

    return {
      ...student.toJSON(),
      address: addrRecord ? addrRecord.toJSON() : null,
      contact: contactRecord ? contactRecord.toJSON() : null,
      education: eduRecords.map(e => (typeof e.toJSON === 'function' ? e.toJSON() : e)),
      enrollments: student.enrollments ? student.enrollments().map(e => e.toJSON()) : []
    };
  },

  /**
   * Creates a new StudentLead record.
   */
  addStudentLead(leadData, context) {
    const db = DBContext.getInstance();

    console.log(`[StudentService] Adding new student lead: ${leadData.student_name}`);

    const recordPayload = {
      ...leadData,
      created_at: leadData.created_at ? new Date(leadData.created_at) : new Date(),
      updated_at: leadData.updated_at ? new Date(leadData.updated_at) : new Date(),
      status: leadData.status || "prospect",
      is_registered: leadData.is_registered === true || leadData.is_registered === "true"
    };

    const record = db.StudentLead.insert(recordPayload);
    this._trackMutation(context, "StudentLead");
    return record.toJSON();
  },

  /**
   * Processes a subject withdrawal from a package enrollment.
   */
  processSubjectWithdrawal(studentId, courseId, context) {
    if (!studentId || !courseId) {
      throw new ActionValidationError("studentId and courseId are required.");
    }
    const db = DBContext.getInstance();

    const allocation = db.BatchAllocation.findOne({
      student_id: studentId,
      course_id: courseId,
      status: "active"
    });
    if (!allocation) {
      throw new EntityNotFoundError("BatchAllocation", `${studentId}-${courseId}`, "Academic");
    }

    const enrollment = db.Enrollment.findById(allocation.enrollment_id);
    if (!enrollment) {
      throw new EntityNotFoundError("Enrollment", allocation.enrollment_id, "Academic");
    }
    if (enrollment.enrollment_type !== "package") {
      throw new ActionValidationError(`Enrollment ${enrollment.enrollment_id} is a standalone course, not part of a package.`);
    }

    const parentEnrollmentId = enrollment.enrollment_id;
    const tx = new TransactionTracker();

    try {
      const backupAllocation = { ...allocation };
      db.BatchAllocation.update(allocation.allocation_id, {
        status: "dropped",
        dropped_at: new Date(),
        remarks: "Dropped via subject withdrawal"
      });
      tx.trackUpdate(db.BatchAllocation, allocation.allocation_id, backupAllocation);
      this._trackMutation(context, "BatchAllocation");

      const metadata = enrollment.metadata;
      if (!metadata || !metadata.course_fees || typeof metadata.course_fees[courseId] === "undefined") {
        throw new ActionValidationError(`Metadata snapshot for course ${courseId} is missing in parent enrollment.`);
      }
      const childBaseFee = metadata.course_fees[courseId];

      let totalBaseFeesSum = 0;
      for (const cid in metadata.course_fees) {
        totalBaseFeesSum += metadata.course_fees[cid];
      }

      if (!totalBaseFeesSum || totalBaseFeesSum <= 0) {
        throw new ActionValidationError("Invalid metadata: sum of course fees is zero or invalid.");
      }

      const ratio = childBaseFee / totalBaseFeesSum;

      const parentSfa = db.StudentFeeAccount.findOne({ enrollment_id: parentEnrollmentId });
      if (!parentSfa) {
        throw new EntityNotFoundError("StudentFeeAccount", parentEnrollmentId, "Finance");
      }

      const refundAmount = Math.round(parentSfa.total_fee * ratio);
      const calculatedDiscountToDeduct = Math.round(parentSfa.discount * ratio);
      const netRefundAmount = refundAmount - calculatedDiscountToDeduct;

      const newTotalFee = parentSfa.total_fee - refundAmount;
      const newDiscount = parentSfa.discount - calculatedDiscountToDeduct;
      const newFinalFee = parentSfa.final_fee - netRefundAmount;

      const cashRefundOwed = Math.max(0, parentSfa.amount_paid - newFinalFee);
      const newAmountPaid = parentSfa.amount_paid - cashRefundOwed;
      const newBalanceDue = Math.max(0, newFinalFee - newAmountPaid);

      const backupSfa = { ...parentSfa };
      db.StudentFeeAccount.update(parentSfa.student_fee_id, {
        total_fee: newTotalFee,
        discount: newDiscount,
        final_fee: newFinalFee,
        amount_paid: newAmountPaid,
        balance_due: newBalanceDue
      });
      tx.trackUpdate(db.StudentFeeAccount, parentSfa.student_fee_id, backupSfa);
      this._trackMutation(context, "StudentFeeAccount");

      const installments = db.Installment.where({ student_fee_id: parentSfa.student_fee_id });
      installments.sort((a, b) => b.installment_number - a.installment_number);

      if (cashRefundOwed > 0) {
        installments.forEach(ins => {
          const backupIns = { ...ins };
          db.Installment.update(ins.installment_id, {
            due_amount: ins.paid_amount || 0,
            status: "paid"
          });
          tx.trackUpdate(db.Installment, ins.installment_id, backupIns);
          this._trackMutation(context, "Installment");
        });

        const refundPaymentRecord = db.Payment.insert({
          student_fee_id: parentSfa.student_fee_id,
          installment_id: installments[installments.length - 1] ? installments[installments.length - 1].installment_id : null,
          amount_paid: -cashRefundOwed,
          payment_date: new Date(),
          payment_method: "cash",
          transaction_reference: "WITHDRAWAL-REFUND",
          status: "success",
          remarks: `Refund issued due to subject withdrawal of course: ${courseId}`
        });
        tx.trackInsert(db.Payment, refundPaymentRecord.payment_id);
        this._trackMutation(context, "Payment");
      } else {
        let remainingReduction = netRefundAmount;
        installments.forEach(ins => {
          if (remainingReduction <= 0) return;

          const currentDue = ins.due_amount;
          const currentPaid = ins.paid_amount || 0;
          const outstanding = currentDue - currentPaid;

          if (outstanding > 0) {
            const reduction = Math.min(remainingReduction, outstanding);
            const newDue = currentDue - reduction;
            const backupIns = { ...ins };
            db.Installment.update(ins.installment_id, {
              due_amount: newDue,
              status: newDue <= currentPaid ? "paid" : (currentPaid > 0 ? "partially_paid" : "pending")
            });
            tx.trackUpdate(db.Installment, ins.installment_id, backupIns);
            this._trackMutation(context, "Installment");
            remainingReduction -= reduction;
          }
        });
      }

      console.log(`[StudentService] Successfully processed withdrawal for course: ${courseId} and student: ${studentId}`);
      return {
        status: "success",
        studentId: studentId,
        withdrawnCourseId: courseId,
        refundAmount: netRefundAmount,
        creditRefunded: cashRefundOwed
      };
    } catch (error) {
      console.error("[StudentService] Subject withdrawal failed, rolling back...", error);
      tx.rollback();
      throw error;
    }
  },

  /**
   * Upgrades standalone course enrollments to a package.
   */
  upgradeToPackage(payload, context) {
    if (!payload.studentId || !payload.targetPackageId) {
      throw new ActionValidationError("Upgrade sequence halted: missing critical constraint identities.", {
        errorCode: "UPGRADE_PARAM_MISSING"
      });
    }

    const db = DBContext.getInstance();
    const tx = new TransactionTracker();

    try {
      const currentEnrollmentIdsVal = payload.currentEnrollmentIds || [];
      let totalPaymentsToRollover = 0;

      currentEnrollmentIdsVal.forEach(eid => {
        const sfa = db.StudentFeeAccount.findOne({ enrollment_id: eid });
        if (sfa) {
          totalPaymentsToRollover += (sfa.amount_paid || 0);
          const backupSfa = { ...sfa };

          db.StudentFeeAccount.update(sfa.student_fee_id, {
            status: "completed",
            total_fee: 0,
            final_fee: 0,
            amount_paid: 0,
            balance_due: 0
          });
          tx.trackUpdate(db.StudentFeeAccount, sfa.student_fee_id, backupSfa);
          this._trackMutation(context, "StudentFeeAccount");
        }
      });

      const pkgDetails = db.Package.findById(payload.targetPackageId);
      if (!pkgDetails) {
        throw new EntityNotFoundError("Package", payload.targetPackageId, "Finance");
      }

      const packageFee = pkgDetails.package_fee;
      const balanceDue = Math.max(0, packageFee - totalPaymentsToRollover);

      const packageItems = db.PackageItem.where({ package_id: payload.targetPackageId, entity_type: "course" });
      const courseFeesMap = {};
      packageItems.forEach(pi => {
        const course = db.Course.findById(pi.entity_id);
        courseFeesMap[pi.entity_id] = course ? course.base_fee : 0;
      });
      const metadata = { course_fees: courseFeesMap };

      const pkgEnrollmentRecord = db.Enrollment.insert({
        student_id: payload.studentId,
        enrollment_type: "package",
        item_id: payload.targetPackageId,
        enrollment_date: new Date(),
        status: "active",
        academic_status: "active",
        metadata: metadata
      });
      const pkgEnrollmentId = pkgEnrollmentRecord.enrollment_id;
      tx.trackInsert(db.Enrollment, pkgEnrollmentId);
      this._trackMutation(context, "Enrollment");

      let plan = db.FeePlan.findOne({
        entity_id: payload.targetPackageId,
        entity_type: "package",
        plan_name: "Default Standard Plan"
      });

      if (!plan) {
        plan = db.FeePlan.insert({
          entity_id: payload.targetPackageId,
          entity_type: "package",
          plan_name: "Default Standard Plan",
          total_fee: packageFee,
          discount_allowed: true,
          installment_allowed: true
        });
        tx.trackInsert(db.FeePlan, plan.fee_plan_id);
        this._trackMutation(context, "FeePlan");
      }

      const parentFeeRecord = db.StudentFeeAccount.insert({
        enrollment_id: pkgEnrollmentId,
        fee_plan_id: plan.fee_plan_id,
        total_fee: packageFee,
        discount: 0,
        final_fee: packageFee,
        amount_paid: totalPaymentsToRollover,
        balance_due: balanceDue,
        status: "active",
        remarks: "Created during package upgrade transaction"
      });
      const parentFeeId = parentFeeRecord.student_fee_id;
      tx.trackInsert(db.StudentFeeAccount, parentFeeId);
      this._trackMutation(context, "StudentFeeAccount");

      currentEnrollmentIdsVal.forEach(eid => {
        const enr = db.Enrollment.findById(eid);
        if (enr) {
          const backupEnr = { ...enr };
          db.Enrollment.update(eid, {
            status: "completed",
            academic_status: "completed"
          });
          tx.trackUpdate(db.Enrollment, eid, backupEnr);
          this._trackMutation(context, "Enrollment");
        }
      });

      const packageBatchesVal = payload.packageBatches || [];
      packageBatchesVal.forEach(batch => {
        const existingAllocation = db.BatchAllocation.findOne({
          student_id: payload.studentId,
          course_id: batch.course_id,
          status: "active"
        });

        if (existingAllocation) {
          const backupAlloc = { ...existingAllocation };
          db.BatchAllocation.update(existingAllocation.allocation_id, {
            enrollment_id: pkgEnrollmentId,
            batch_id: batch.batch_id
          });
          tx.trackUpdate(db.BatchAllocation, existingAllocation.allocation_id, backupAlloc);
          this._trackMutation(context, "BatchAllocation");
        } else {
          const allocRecord = db.BatchAllocation.insert({
            student_id: payload.studentId,
            enrollment_id: pkgEnrollmentId,
            course_id: batch.course_id,
            batch_id: batch.batch_id,
            status: "active",
            remarks: "Assigned during package upgrade"
          });
          tx.trackInsert(db.BatchAllocation, allocRecord.allocation_id);
          this._trackMutation(context, "BatchAllocation");
        }
      });

      if (totalPaymentsToRollover > 0) {
        const rolloverPaymentRecord = db.Payment.insert({
          student_fee_id: parentFeeId,
          installment_id: null,
          amount_paid: totalPaymentsToRollover,
          payment_date: new Date(),
          payment_method: "cash",
          transaction_reference: "UPGRADE-ROLLOVER",
          status: "success",
          remarks: "Transferred credit from upgraded standalone courses"
        });
        tx.trackInsert(db.Payment, rolloverPaymentRecord.payment_id);
        this._trackMutation(context, "Payment");
      }

      if (balanceDue > 0) {
        const insRecord = db.Installment.insert({
          student_fee_id: parentFeeId,
          installment_number: 1,
          due_amount: balanceDue,
          paid_amount: 0,
          late_fee_amount: 0,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
          status: "pending"
        });
        tx.trackInsert(db.Installment, insRecord.installment_id);
        this._trackMutation(context, "Installment");
      }

      console.log(`[StudentService] Successfully upgraded student: ${payload.studentId} to package: ${payload.targetPackageId}`);
      return {
        status: "success",
        packageEnrollmentId: pkgEnrollmentId,
        studentFeeId: parentFeeId
      };
    } catch (error) {
      console.error("[StudentService] Package upgrade failed, rolling back...", error);
      tx.rollback();
      throw error;
    }
  },

  /**
   * Decoupled access check. Checks academic status and evaluates payment limits.
   */
  checkAccessStatus(studentId, courseId) {
    const db = DBContext.getInstance();
    const allocations = db.BatchAllocation.where({
      student_id: studentId,
      course_id: courseId
    });
    const allocation = allocations.find(a => a.status === "active" || a.status === "suspended");
    if (!allocation) return { allowed: false, reason: "No active enrollment found.", isOverdue: false };

    if (allocation.status === "suspended") {
      return { allowed: false, reason: "Access suspended due to outstanding dues.", isOverdue: true };
    }

    const enrollment = db.Enrollment.findById(allocation.enrollment_id);
    if (!enrollment) return { allowed: false, reason: "No active enrollment found.", isOverdue: false };

    const feeAccount = db.StudentFeeAccount.findOne({ enrollment_id: enrollment.enrollment_id });
    if (!feeAccount) return { allowed: true };

    const gracePeriodDays = 7;
    const installments = db.Installment.where({
      student_fee_id: feeAccount.student_fee_id
    });
    const overdueInstallments = installments.filter(ins => ins.status === "pending" || ins.status === "partially_paid");

    const isOverdue = overdueInstallments.some(ins => {
      return AttendanceUtil.isPastGracePeriod(ins.due_date, gracePeriodDays);
    });

    if (isOverdue) {
      return { allowed: false, reason: "Suspended: Overdue installment payment.", isOverdue: true };
    }

    return { allowed: true };
  },

  suspendOverdueAccess(studentId, courseId, context) {
    const db = DBContext.getInstance();
    const allocations = db.BatchAllocation.where({
      student_id: studentId,
      course_id: courseId
    });
    const allocation = allocations.find(a => a.status === "active" || a.status === "suspended");
    if (!allocation) return;

    const tx = new TransactionTracker();
    try {
      const backupAlloc = { ...allocation };
      db.BatchAllocation.update(allocation.allocation_id, { status: "suspended" });
      tx.trackUpdate(db.BatchAllocation, allocation.allocation_id, backupAlloc);
      this._trackMutation(context, "BatchAllocation");

      const sisterAllocations = db.BatchAllocation.where({
        enrollment_id: allocation.enrollment_id,
        status: "active"
      });
      sisterAllocations.forEach(sa => {
        const backupSa = { ...sa };
        db.BatchAllocation.update(sa.allocation_id, { status: "suspended" });
        tx.trackUpdate(db.BatchAllocation, sa.allocation_id, backupSa);
        this._trackMutation(context, "BatchAllocation");
      });
    } catch (error) {
      tx.rollback();
      throw error;
    }
  },

  /**
   * Marks a single student's attendance (Upsert pattern).
   */
  markAttendance(payload, context) {
    const db = DBContext.getInstance();

    if (!payload.student_id) throw new ActionValidationError("student_id is required.");
    if (!payload.batch_id) throw new ActionValidationError("batch_id is required.");
    if (!payload.attendance_date) throw new ActionValidationError("attendance_date is required.");
    if (!payload.status) throw new ActionValidationError("status is required.");

    const studentId = String(payload.student_id).trim();
    const batchId = String(payload.batch_id).trim();
    const dateStr = String(payload.attendance_date).trim();
    const status = String(payload.status).trim().toUpperCase();

    let mode = payload.attendance_mode || "Manual";
    const cleanMode = String(mode).trim().toUpperCase();
    if (cleanMode === "QR") mode = "QR";
    else if (cleanMode === "BIOMETRIC") mode = "Biometric";
    else mode = "Manual";

    if (!db.Student.findById(studentId)) {
      throw new SheetDB.EntityNotFoundError("Student", studentId, "Students");
    }
    if (!db.Batch.findById(batchId)) {
      throw new SheetDB.EntityNotFoundError("Batch", batchId, "Academic");
    }

    let entryDate = null;
    let exitDate = null;

    if (payload.entry_time) {
      entryDate = AttendanceUtil.convertJsonToDate(payload.entry_time, dateStr);
    }
    if (payload.exit_time) {
      exitDate = AttendanceUtil.convertJsonToDate(payload.exit_time, dateStr);
      if (entryDate && exitDate && exitDate.getTime() < entryDate.getTime()) {
        exitDate.setUTCDate(exitDate.getUTCDate() + 1);
      }
    }

    const attendanceData = {
      student_id: studentId,
      batch_id: batchId,
      attendance_date: dateStr,
      status: status,
      entry_time: entryDate,
      exit_time: exitDate,
      attendance_mode: mode,
      remarks: payload.remarks || null,
      marked_by: payload.marked_by || null
    };

    const existing = db.StudentAttendance.findOne({
      student_id: studentId,
      batch_id: batchId,
      attendance_date: dateStr
    });

    let resultRecord;
    if (existing) {
      console.log(`[StudentService] Updating existing student attendance ID: ${existing.attendance_id}`);
      resultRecord = db.StudentAttendance.update(existing.attendance_id, attendanceData);
    } else {
      console.log(`[StudentService] Inserting new student attendance for Student: ${studentId}`);
      resultRecord = db.StudentAttendance.insert(attendanceData);
    }
    this._trackMutation(context, "StudentAttendance");
    return resultRecord;
  },

  /**
   * Marks bulk student attendance for a specific batch and date (Upsert pattern).
   */
  markAttendanceBulk(payload, context) {
    const db = DBContext.getInstance();

    if (!payload.batch_id) throw new ActionValidationError("batch_id is required.");
    if (!payload.attendance_date) throw new ActionValidationError("attendance_date is required.");
    if (!payload.records || !Array.isArray(payload.records)) throw new ActionValidationError("records array is required.");

    const batchId = String(payload.batch_id).trim();
    const dateStr = String(payload.attendance_date).trim();

    let defaultMode = payload.attendance_mode || "Manual";
    const cleanDefaultMode = String(defaultMode).trim().toUpperCase();
    if (cleanDefaultMode === "QR") defaultMode = "QR";
    else if (cleanDefaultMode === "BIOMETRIC") defaultMode = "Biometric";
    else defaultMode = "Manual";

    if (!db.Batch.findById(batchId)) {
      throw new SheetDB.EntityNotFoundError("Batch", batchId, "Academic");
    }

    console.log(`[StudentService] Processing bulk attendance for batch: ${batchId} on ${dateStr}`);

    const existingRecords = db.StudentAttendance.where({
      batch_id: batchId,
      attendance_date: dateStr
    });

    const existingMap = {};
    existingRecords.forEach(rec => {
      existingMap[rec.student_id] = rec;
    });

    // Rule-05: Pre-load student lookup map
    const studentMap = {};
    db.Student.all().forEach(s => {
      studentMap[s.student_id] = s;
    });

    const results = [];
    payload.records.forEach(rec => {
      if (!rec.student_id) throw new ActionValidationError("Each record in bulk array must contain student_id.");
      if (!rec.status) throw new ActionValidationError("Each record in bulk array must contain status.");

      const studentId = String(rec.student_id).trim();
      const status = String(rec.status).trim().toUpperCase();
      let mode = rec.attendance_mode || defaultMode;
      const cleanMode = String(mode).trim().toUpperCase();
      if (cleanMode === "QR") mode = "QR";
      else if (cleanMode === "BIOMETRIC") mode = "Biometric";
      else mode = "Manual";

      if (!studentMap[studentId]) {
        throw new SheetDB.EntityNotFoundError("Student", studentId, "Students");
      }

      let entryDate = null;
      let exitDate = null;

      if (rec.entry_time) {
        entryDate = AttendanceUtil.convertJsonToDate(rec.entry_time, dateStr);
      }
      if (rec.exit_time) {
        exitDate = AttendanceUtil.convertJsonToDate(rec.exit_time, dateStr);
        if (entryDate && exitDate && exitDate < entryDate) {
          exitDate.setDate(exitDate.getDate() + 1);
        }
      }

      const attendanceData = {
        student_id: studentId,
        batch_id: batchId,
        attendance_date: dateStr,
        status: status,
        entry_time: entryDate,
        exit_time: exitDate,
        attendance_mode: mode,
        remarks: rec.remarks || null,
        marked_by: payload.marked_by || rec.marked_by || null
      };

      const existing = existingMap[studentId];
      if (existing) {
        results.push(db.StudentAttendance.update(existing.attendance_id, attendanceData));
      } else {
        results.push(db.StudentAttendance.insert(attendanceData));
      }
      this._trackMutation(context, "StudentAttendance");
    });

    return {
      success: true,
      processedCount: results.length,
      records: results
    };
  },

  /**
   * Queries student attendance records and appends calculated durations and master info.
   */
  queryAttendance(payload) {
    const db = DBContext.getInstance();

    const targetQuery = {
      target: "StudentAttendance",
      ...payload
    };

    const results = QueryEngine.execute(targetQuery, db);
    const records = results.data || [];

    // Rule-05: Pre-load lookup tables to avoid N+1 reads
    const studentMap = {};
    db.Student.all().forEach(s => { studentMap[s.student_id] = s; });

    const batchMap = {};
    db.Batch.all().forEach(b => { batchMap[b.batch_id] = b; });

    const courseMap = {};
    db.Course.all().forEach(c => { courseMap[c.course_id] = c; });

    const hydrated = records.map(row => {
      const record = (typeof row.toJSON === 'function') ? row.toJSON() : row;
      const rawEntry = record.entry_time;
      const rawExit = record.exit_time;

      record.duration = AttendanceUtil.calculateDuration(rawEntry, rawExit);

      record.entry_time = AttendanceUtil.convertDateToJson(rawEntry);
      record.exit_time = AttendanceUtil.convertDateToJson(rawExit);

      const student = studentMap[record.student_id];
      record.student_name = student ? student.student_name : "Unknown Student";

      const batch = batchMap[record.batch_id];
      if (batch) {
        record.batch_name = batch.batch_name;
        record.course_id = batch.course_id;

        const course = courseMap[batch.course_id];
        record.course_name = course ? course.name : "Unknown Course";
      } else {
        record.batch_name = "Unknown Batch";
        record.course_id = null;
        record.course_name = "Unknown Course";
      }

      return record;
    });

    results.data = hydrated;
    return results;
  },

  /**
   * Safely purges an untouched student account and its linked leaf dependencies.
   * Delegates pre-flight checks to ValidationEngine.run using StudentDeleteUntouchedRules,
   * then executes a leaf-first LIFO deletion pipeline via SheetDB.AtomicPipeline.
   *
   * @param {Object} payload - Input parameter envelope containing student_id.
   * @param {Object} [context] - Request lifecycle context for mutation tracking.
  /**
   * Permanently hard-deletes a Student account and cascades physical deletion
   * leaf-first across all 10 downstream relational tables via SheetDB.AtomicPipeline.
   *
   * @param {Object} payload - Input payload.
   * @param {string} payload.student_id - Target student ID.
   * @param {boolean} [payload.force=false] - If true, permits purging paid accounts (requires superadmin).
   * @param {string} [payload.reason] - Administrative reason for deletion.
   * @param {Object} context - Execution request context.
   * @returns {Object} Operational summary containing student_id and purged counts.
   * @throws {SheetDB.ValidationError} If validation rules or financial guards fail.
   */
  hardDeleteStudent(payload, context) {
    const db = (context && context.db) || DBContext.getInstance();

    // 1. Run Validation Engine pre-flight pipeline
    const valCtx = new ValidationContext(db, payload ? payload.student_id : null, payload);
    valCtx.user = context ? context.user : null;
    ValidationEngine.run(valCtx, StudentHardDeleteRules);

    if (!valCtx.isValid()) {
      const primaryErr = valCtx.errors[0];
      throw new SheetDB.ValidationError(primaryErr ? primaryErr.message : "Validation failed for student hard deletion.", {
        errorCode: "STUDENT_HARD_DELETE_VALIDATION_FAILURE",
        details: valCtx.errors
      });
    }

    const studentId = payload.student_id;
    const student = valCtx.state.student;

    // 2. Extract pre-discovered graph IDs from validation context state
    const paymentIds = valCtx.state.paymentIds || [];
    const installmentIds = valCtx.state.installmentIds || [];
    const feeAccountIds = valCtx.state.feeAccountIds || [];
    const attendanceIds = valCtx.state.attendanceIds || [];
    const testMarkIds = valCtx.state.testMarkIds || [];
    const allocationIds = valCtx.state.allocationIds || [];
    const enrollmentIds = valCtx.state.enrollmentIds || [];
    const educationIds = valCtx.state.educationIds || [];
    const contactIds = valCtx.state.contactIds || [];
    const addressIds = valCtx.state.addressIds || [];

    // 3. Wrap Context in PipelineContext Facade
    const pipelineContext = (context && typeof context.trackMutation === 'function')
      ? context
      : ((typeof SheetDB !== 'undefined' && SheetDB.PipelineContext)
          ? new SheetDB.PipelineContext(context || { mutationManifest: [] })
          : ((typeof PipelineContext !== 'undefined')
              ? new PipelineContext(context || { mutationManifest: [] })
              : { trackMutation: function(t) { if (context && context.mutationManifest) context.mutationManifest.push(t); } }));

    // 4. Execute Leaf-First Topological Physical Deletion via AtomicPipeline
    const pipeline = new SheetDB.AtomicPipeline(db, pipelineContext);

    if (paymentIds.length > 0) {
      pipeline.addStep("Payment", function(repo) {
        paymentIds.forEach(id => repo.remove(id));
      });
    }
    if (installmentIds.length > 0) {
      pipeline.addStep("Installment", function(repo) {
        installmentIds.forEach(id => repo.remove(id));
      });
    }
    if (feeAccountIds.length > 0) {
      pipeline.addStep("StudentFeeAccount", function(repo) {
        feeAccountIds.forEach(id => repo.remove(id));
      });
    }
    if (attendanceIds.length > 0) {
      pipeline.addStep("StudentAttendance", function(repo) {
        attendanceIds.forEach(id => repo.remove(id));
      });
    }
    if (testMarkIds.length > 0) {
      pipeline.addStep("TestMarks", function(repo) {
        testMarkIds.forEach(id => repo.remove(id));
      });
    }
    if (allocationIds.length > 0) {
      pipeline.addStep("BatchAllocation", function(repo) {
        allocationIds.forEach(id => repo.remove(id));
      });
    }
    if (enrollmentIds.length > 0) {
      pipeline.addStep("Enrollment", function(repo) {
        enrollmentIds.forEach(id => repo.remove(id));
      });
    }
    if (educationIds.length > 0) {
      pipeline.addStep("Education", function(repo) {
        educationIds.forEach(id => repo.remove(id));
      });
    }
    if (contactIds.length > 0) {
      pipeline.addStep("ContactInfo", function(repo) {
        contactIds.forEach(id => repo.remove(id));
      });
    }
    if (addressIds.length > 0) {
      pipeline.addStep("Address", function(repo) {
        addressIds.forEach(id => repo.remove(id));
      });
    }
    pipeline.addStep("Student", function(repo) {
      repo.remove(studentId);
    });

    pipeline.execute();

    return {
      student_id: studentId,
      student_name: student.student_name,
      mode: "hard",
      force: payload.force === true,
      purged_counts: {
        payments: paymentIds.length,
        installments: installmentIds.length,
        fee_accounts: feeAccountIds.length,
        attendance: attendanceIds.length,
        test_marks: testMarkIds.length,
        allocations: allocationIds.length,
        enrollments: enrollmentIds.length,
        education: educationIds.length,
        contacts: contactIds.length,
        addresses: addressIds.length,
        student: 1
      }
    };
  },

  /**
   * Backward-compatible delegation for untouched student account deletion.
   */
  deleteUntouchedStudent(payload, context) {
    return this.hardDeleteStudent({ ...payload, mode: "hard", force: false }, context);
  },

  /**
   * Soft deletes a Student account, cascading status updates across
   * linked enrollments, seating batch allocations, and settling linked fee accounts.
   *
   * @param {Object} payload - Input payload.
   * @param {string} payload.student_id - Target student ID.
   * @param {string} [payload.reason] - Administrative reason for deletion.
   * @param {Object} [payload.financial_settlement] - Optional declarative settlement policy (defaults to 'waive_unpaid').
   * @param {Object} context - Execution request context.
   * @returns {Object} Operational summary containing mutated counts and affected entity IDs.
   * @throws {SheetDB.ValidationError} If validation rules fail.
   */
  softDeleteStudent(payload, context) {
    const db = (context && context.db) || DBContext.getInstance();
    const nowIso = new Date().toISOString();

    // 1. Run Validation Engine pre-flight pipeline
    const valCtx = new ValidationContext(db, payload ? payload.student_id : null, payload);
    ValidationEngine.run(valCtx, StudentSoftDeleteRules);

    if (!valCtx.isValid()) {
      const primaryErr = valCtx.errors[0];
      throw new SheetDB.ValidationError(primaryErr ? primaryErr.message : "Validation failed for student soft deletion.", {
        errorCode: "STUDENT_DELETE_VALIDATION_FAILURE",
        details: valCtx.errors
      });
    }

    const studentId = payload.student_id;
    const student = valCtx.state.student;
    const reasonStr = payload.reason ? String(payload.reason).trim() : "Student soft-deleted via administrative action";

    // 2. Discover linked child records
    const enrollments = db.Enrollment.where({ student_id: studentId });
    const enrollmentIds = enrollments.map(e => e.enrollment_id);

    const allocations = db.BatchAllocation.where({ student_id: studentId });
    const feeAccounts = enrollmentIds.length > 0
      ? db.StudentFeeAccount.all().filter(sfa => enrollmentIds.includes(sfa.enrollment_id))
      : [];
    const feeAccountIds = feeAccounts.map(sfa => sfa.student_fee_id);

    const installments = feeAccountIds.length > 0
      ? db.Installment.all().filter(ins => feeAccountIds.includes(ins.student_fee_id))
      : [];

    // 3. Resolve Financial Settlement Strategy
    const strategyRegistry = (typeof FinancialSettlementStrategyRegistry !== 'undefined')
      ? FinancialSettlementStrategyRegistry
      : globalThis.FinancialSettlementStrategyRegistry;

    const policy = (payload.financial_settlement && payload.financial_settlement.policy) || "waive_unpaid";
    const strategyFn = (strategyRegistry && strategyRegistry[policy])
      ? strategyRegistry[policy]
      : (strategyRegistry ? strategyRegistry["waive_unpaid"] : null);

    // 4. Wrap Context in PipelineContext Facade Contract
    const pipelineContext = (context && typeof context.trackMutation === 'function')
      ? context
      : ((typeof SheetDB !== 'undefined' && SheetDB.PipelineContext)
          ? new SheetDB.PipelineContext(context || { mutationManifest: [] })
          : ((typeof PipelineContext !== 'undefined')
              ? new PipelineContext(context || { mutationManifest: [] })
              : { trackMutation: function(t) { if (context && context.mutationManifest) context.mutationManifest.push(t); } }));

    // 5. Execute Atomic Multi-Table Soft Deletion
    const pipeline = new SheetDB.AtomicPipeline(db, pipelineContext);

    // Step 1: Update Student status to 'deleted' and attach deletion metadata
    pipeline.addStep("Student", function(repo, state) {
      const currentMeta = (student.metadata && typeof student.metadata === 'object' && !Array.isArray(student.metadata))
        ? { ...student.metadata }
        : {};
      currentMeta.deleted_at = nowIso;
      currentMeta.deleted_reason = reasonStr;

      state.softDeletedStudent = repo.update(studentId, {
        status: "deleted",
        metadata: currentMeta
      });
    });

    // Step 2: Cascade active/suspended enrollments to 'discarded' / 'withdrawn'
    if (enrollments.length > 0) {
      pipeline.addStep("Enrollment", function(repo, state) {
        state.cascadedEnrollments = [];
        enrollments.forEach(function(enr) {
          if (enr.status !== "discarded" && enr.status !== "withdrawn") {
            const updatedEnr = repo.update(enr.enrollment_id, {
              status: "discarded",
              academic_status: "withdrawn"
            });
            state.cascadedEnrollments.push(updatedEnr);
          }
        });
      });
    }

    // Step 3: Cascade active/suspended batch allocations to 'dropped'
    if (allocations.length > 0) {
      pipeline.addStep("BatchAllocation", function(repo, state) {
        state.cascadedAllocations = [];
        allocations.forEach(function(alloc) {
          if (alloc.status !== "dropped" && alloc.status !== "completed") {
            const updatedAlloc = repo.update(alloc.allocation_id, {
              status: "dropped",
              dropped_at: alloc.dropped_at || nowIso,
              remarks: alloc.remarks ? `${alloc.remarks} | Dropped on student soft-delete` : "Dropped on student soft-delete"
            });
            state.cascadedAllocations.push(updatedAlloc);
          }
        });
      });
    }

    // Step 4: Apply Financial Settlement Strategy to linked fee accounts
    if (feeAccounts.length > 0 && typeof strategyFn === 'function') {
      feeAccounts.forEach(function(feeAccount) {
        const accountInstallments = installments.filter(ins => ins.student_fee_id === feeAccount.student_fee_id);
        const strategyContext = {
          feeAccount: feeAccount,
          installments: accountInstallments,
          payload: payload,
          user: context ? context.user : null,
          nowIso: nowIso
        };
        strategyFn(strategyContext, pipeline);
      });
    }

    pipeline.execute();

    // 5. Register touched tables into context mutation manifest
    const touchedTables = ["Student", "Enrollment", "BatchAllocation", "StudentFeeAccount", "Installment"];
    touchedTables.forEach(tableName => {
      this._trackMutation(context, tableName);
    });

    return {
      student_id: studentId,
      student_name: student.student_name,
      status: "deleted",
      deleted_at: nowIso,
      cascaded_counts: {
        enrollments: enrollments.length,
        allocations: allocations.length,
        fee_accounts: feeAccounts.length,
        installments: installments.length
      },
      financial_settlement_policy: policy
    };
  }
};

// Bind to global namespace
globalThis.StudentService = StudentService;

