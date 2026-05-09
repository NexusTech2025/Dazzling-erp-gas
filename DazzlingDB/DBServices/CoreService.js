/**
 * @file CoreService.js
 * Domain Service for Organizational Foundation (Branches, Promos, Settings).
 */

const CoreService = {

  /**
   * BRANCH MANAGEMENT
   */

  /**
   * Registers a new physical branch location.
   */
  createBranch(payload) {
    const db = DBContext.getInstance();
    console.log(`[CoreService] Provisioning new branch: ${payload.branch_name}`);
    
    try {
      return db.Branch.insert({
        ...payload,
        status: payload.status || "active"
      });
    } catch (e) {
      console.error("[CoreService] Branch creation failed:", e.message);
      throw new SheetDB.IntegrityError("Failed to create branch.", { originalError: e });
    }
  },

  /**
   * Updates existing branch details.
   */
  updateBranch(branchId, payload) {
    const db = DBContext.getInstance();
    console.log(`[CoreService] Updating branch: ${branchId}`);

    const branch = db.Branch.findById(branchId);
    if (!branch) {
      throw new SheetDB.EntityNotFoundError("Branch", branchId, "Core");
    }

    return db.Branch.update(branchId, payload);
  },

  /**
   * PROMO CODE MANAGEMENT
   */

  /**
   * Creates a promotional discount code.
   * Performs relational check on the target entity (Course/Package).
   */
  createPromoCode(payload) {
    const db = DBContext.getInstance();
    console.log(`[CoreService] Creating PromoCode: ${payload.code}`);

    // 1. Uniqueness check (Native unique constraint will handle this, but we can be proactive)
    if (db.PromoCode.exists({ code: payload.code })) {
      throw new SheetDB.ConflictError(`The promo code '${payload.code}' already exists.`);
    }

    // 2. Relational Integrity Check
    if (payload.entity_id) {
      const entityTable = payload.entity_type === 'package' ? 'Package' : 'Course';
      if (!db[entityTable].findById(payload.entity_id)) {
        throw new SheetDB.IntegrityError(
          `Cannot link promo to non-existent ${payload.entity_type}: ${payload.entity_id}`
        );
      }
    }

    return db.PromoCode.insert({
      ...payload,
      status: payload.status || "active",
      max_usage: payload.max_usage || 100
    });
  },

  /**
   * Validates if a promo code is active and applicable.
   * Useful for the Frontend Checkout process.
   */
  validatePromoCode(code, entityType, entityId) {
    const db = DBContext.getInstance();
    console.log(`[CoreService] Validating code '${code}' for ${entityType} ${entityId}`);

    const promo = db.PromoCode.findOne({ code: code, status: "active" });

    if (!promo) {
      throw new SheetDB.EntityNotFoundError("PromoCode", code, "Core");
    }

    // Logic for entity binding
    if (promo.entity_id && promo.entity_id !== entityId) {
      throw new SheetDB.ValidationError("This promo code is not applicable to the selected item.");
    }

    // Check expiration
    if (promo.valid_until && new Date(promo.valid_until) < new Date()) {
      throw new SheetDB.ValidationError("This promo code has expired.");
    }

    return promo;
  }
};
