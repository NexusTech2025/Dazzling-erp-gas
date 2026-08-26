/**
 * @file AuthBridge.js
 * Facade for the Auth Layer. The only interface the ERP talks to.
 * Implements Salted Hashing and Brute-Force Protection.
 */

const AuthBridge = {
  
  _MAX_FAILED_ATTEMPTS: typeof SECURITY_LOCKOUT_ATTEMPTS !== 'undefined' ? SECURITY_LOCKOUT_ATTEMPTS : 5,
  _LOCKOUT_TTL_CACHE: typeof SECURITY_LOCKOUT_DURATION_MINS !== 'undefined' ? SECURITY_LOCKOUT_DURATION_MINS * 60 : 900, // lockout in cache (seconds)

  /**
   * Registers a new user with a unique salt.
   */
  registerUser(payload) {
    const db = DBContext.getInstance();
    console.log(`[AuthBridge] Registering user: ${payload.username}`);

    if (db.User.exists({ username: payload.username })) {
      throw new SheetDB.ConflictError(`Username '${payload.username}' is already taken.`);
    }

    if (!AuthCore.isStrongPassword(payload.password)) {
      throw new SheetDB.ValidationError("Password is too weak (minimum 8 characters).");
    }

    const salt = AuthCore.generateSalt();
    const insertPayload = {
      ...payload,
      password_salt: salt,
      password_hash: AuthCore.hashPassword(payload.password, salt),
      status: "active",
      role: payload.role || "guest",
      failed_attempts: 0
    };
    if (payload.user_id) {
      insertPayload.user_id = payload.user_id;
    }
    const newUser = db.User.insert(insertPayload);

    delete newUser.password_hash;
    delete newUser.password_salt;
    return newUser;
  },

  /**
   * Authenticates user with Salted Hashing and Brute-Force checks.
   */
  login(username, password, clientInfo = {}) {
    const db = DBContext.getInstance();
    const cache = CacheService.getScriptCache();
    
    console.log(`[AuthBridge] Attempting login for: ${username}`);

    // 1. Check Cache Lockout
    if (cache.get(`lockout_${username}`)) {
      throw new AuthAccountLockedError(`Account temporarily locked due to multiple failed attempts. Please try again in ${typeof SECURITY_LOCKOUT_DURATION_MINS !== 'undefined' ? SECURITY_LOCKOUT_DURATION_MINS : 15} minutes.`);
    }

    const user = db.User.findOne({ username: username });

    if (!user) throw new AuthAuthenticationError("Invalid username or password.");
    
    // 2. Check DB Status
    if (user.status !== "active") {
      throw new AuthAuthenticationError(`Account is ${user.status}.`);
    }

    // 3. Check DB Lockout (failed_attempts)
    if (user.failed_attempts >= this._MAX_FAILED_ATTEMPTS) {
      cache.put(`lockout_${username}`, "true", this._LOCKOUT_TTL_CACHE);
      throw new AuthAccountLockedError("Account locked. Please contact administrator.");
    }

    // 4. Verify Salted Password
    if (!AuthCore.verifyPassword(password, user.password_hash, user.password_salt)) {
      this._handleLoginFailure(user);
      throw new AuthAuthenticationError("Invalid username or password.");
    }

    // SUCCESS: Reset failures and create session
    db.User.update(user.user_id, { 
      failed_attempts: 0,
      last_login: new Date() 
    });

    const token = SessionManager.createSession(user.user_id, clientInfo);

    return {
      token: token,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role
      }
    };
  },

  /**
   * Private: Increments failed attempt counter and triggers lockout.
   */
  _handleLoginFailure(user) {
    const db = DBContext.getInstance();
    const newCount = (user.failed_attempts || 0) + 1;
    
    db.User.update(user.user_id, { failed_attempts: newCount });
    
    console.warn(`[AuthBridge] Failed login for ${user.username}. Attempt: ${newCount}`);
    
    if (newCount >= this._MAX_FAILED_ATTEMPTS) {
      const cache = CacheService.getScriptCache();
      cache.put(`lockout_${user.username}`, "true", this._LOCKOUT_TTL_CACHE);
      console.error(`[AuthBridge] ACCOUNT LOCKED: ${user.username}`);
    }
  },

  /**
   * Invalidates a session.
   */
  logout(token) {
    console.log(`[AuthBridge] Logging out token: ${token}`);
    SessionManager.destroySession(token);
    return { success: true, message: "Logged out successfully" };
  },

  /**
   * Provisions a User account and atomically binds it to a domain entity via the UserAccount junction table.
   * 
   * @param {Object} userData - User credentials payload (username, password, optional role).
   * @param {string} entityType - Target model discriminator ('Teacher' | 'Student' | 'StaffMember').
   * @param {string} entityId - Target entity primary key (e.g. 'TCH-XXXXXXXX').
   * @param {Object} context - Request execution context.
   * @returns {Object} Result envelope with user_id, account_link_id, username, entity_type, entity_id.
   * @throws {UserAccountLinkError} If entity does not exist or already has an active linked user.
   * @throws {SheetDB.ConflictError} If username is already taken.
   * @throws {SheetDB.ValidationError} If password does not meet complexity rules.
   */
  createUserForEntity(userData, entityType, entityId, context) {
    const db = DBContext.getInstance();
    console.log(`[AuthBridge.createUserForEntity] Provisioning user for ${entityType}: ${entityId}`);

    // 1. Boundary & Pre-flight Validation
    if (!userData || typeof userData !== 'object' || !userData.username || typeof userData.username !== 'string' || !userData.username.trim() || !userData.password || typeof userData.password !== 'string' || !userData.password) {
      throw new UserAccountLinkError("Fields 'userData.username' and 'userData.password' are required.", null, "USER_CREDENTIALS_REQUIRED");
    }
    if (!["Teacher", "Student", "StaffMember"].includes(entityType)) {
      throw new UserAccountLinkError(`Unsupported entity type: '${entityType}'.`, null, "INVALID_ENTITY_TYPE");
    }
    if (!entityId || typeof entityId !== 'string' || !entityId.trim()) {
      throw new UserAccountLinkError("Parameter 'entityId' is required.", null, "ENTITY_ID_REQUIRED");
    }

    const cleanUsername = String(userData.username).trim();
    const cleanEntityId = String(entityId).trim();

    // 2. Target Entity Existence Check
    const targetRepo = db[entityType];
    const targetEntity = targetRepo ? targetRepo.findById(cleanEntityId) : null;
    if (!targetRepo || !targetEntity) {
      throw new UserAccountLinkError(`${entityType} with ID '${cleanEntityId}' does not exist.`, null, "ENTITY_NOT_FOUND");
    }

    // 3. Prevent Duplicate Active Link for this Entity
    if (db.UserAccount && db.UserAccount.isTableExist()) {
      const existingLink = db.UserAccount.findOne({ entity_type: entityType, entity_id: cleanEntityId, status: "active" });
      if (existingLink) {
        const linkedUser = db.User.findById(existingLink.user_id);
        const username = linkedUser ? linkedUser.username : existingLink.user_id;
        throw new UserAccountLinkError(`${entityType} '${cleanEntityId}' is already linked to active user '${username}'.`, null, "ENTITY_ALREADY_LINKED");
      }
    }

    // 4. Validate Credentials (Uniqueness & Password Complexity)
    if (db.User.exists({ username: cleanUsername })) {
      throw new SheetDB.ConflictError(`Username '${cleanUsername}' is already taken.`);
    }
    if (!AuthCore.isStrongPassword(userData.password)) {
      throw new SheetDB.ValidationError("Password is too weak (minimum 8 characters, uppercase, lowercase, digit, and symbol required).");
    }

    // Principle of Least Privilege: Default StaffMember credentials based on entity profile
    let role = userData.role;
    if (!role) {
      if (entityType === "Teacher") {
        role = "teacher";
      } else if (entityType === "Student") {
        role = "student";
      } else if (entityType === "StaffMember") {
        role = (targetEntity && targetEntity.role === "admin") ? "admin" : "user";
      } else {
        role = "guest";
      }
    }

    // 5. Atomic Multi-Step Persistence via SheetDB.AtomicPipeline & PipelineContext
    const pipeCtx = new SheetDB.PipelineContext(context);
    const pipeline = (typeof AtomicPipeline !== 'undefined' ? AtomicPipeline : SheetDB.AtomicPipeline);

    return pipeline.begin(db, pipeCtx)
      .addStep("User", (repo, state) => {
        console.log(`[AuthBridge.createUserForEntity] [Step: User] Creating credentials for ${cleanUsername}...`);
        const salt = AuthCore.generateSalt();
        state.user = repo.insert({
          username: cleanUsername,
          password_salt: salt,
          password_hash: AuthCore.hashPassword(userData.password, salt),
          role: role,
          status: "active",
          failed_attempts: 0
        });
        state.userId = state.user.user_id;
      })
      .addStep("UserAccount", (repo, state) => {
        console.log(`[AuthBridge.createUserForEntity] [Step: UserAccount] Binding user ${state.userId} to ${entityType}:${cleanEntityId}`);
        state.accountLink = repo.insert({
          user_id: state.userId,
          entity_type: entityType,
          entity_id: cleanEntityId,
          status: "active",
          created_at: new Date()
        });
        state.accountLinkId = state.accountLink.account_link_id;
      })
      .execute((state) => {
        console.log(`[AuthBridge.createUserForEntity] Successfully committed user mapping: ${state.accountLinkId}`);
        return {
          account_link_id: state.accountLinkId,
          user_id: state.userId,
          username: state.user.username,
          role: state.user.role,
          entity_type: entityType,
          entity_id: cleanEntityId,
          status: "active"
        };
      });
  },

  /**
   * Resolves a token into a UserContext object.
   */
  resolveContext(token) {
    if (!token) return { isValid: false, role: "guest" };

    const userId = SessionManager.getValidUserId(token);
    if (!userId) return { isValid: false, role: "guest" };

    const db = DBContext.getInstance();
    const user = db.User.findById(userId);

    if (!user || user.status !== "active") {
      return { isValid: false, role: "guest" };
    }

    const context = {
      userId: user.user_id,
      username: user.username,
      role: user.role,
      isValid: true,
      entityType: null,
      entityId: null
    };

    // Hydrate linked entity if exists in UserAccount junction table
    if (db.UserAccount && db.UserAccount.isTableExist()) {
      const link = db.UserAccount.findOne({ user_id: user.user_id, status: "active" });
      if (link) {
        context.entityType = link.entity_type;
        context.entityId = link.entity_id;
      }
    }

    return context;
  },

  /**
   * Checks if any admin user exists in the system.
   * Used for First-Run Wizard detection.
   */
  isSystemInitialized() {
    const db = DBContext.getInstance();
    // Safe Check: Verify table exists physically before checking for data
    if (!db.User.isTableExist()) return false;
    return db.User.exists({ role: "admin" });
  },

  /**
   * Dynamically generates a secure setup key, persists it, and emails the project owner.
   * Only executed if the system is not initialized.
   * @returns {void}
   */
  ensureSetupKeyEmailed() {
    const props = PropertiesService.getScriptProperties();
    let setupKey = props.getProperty("SETUP_KEY");
    if (!setupKey) {
      setupKey = AuthCore.generateToken();
      props.setProperty("SETUP_KEY", setupKey);
      
      const email = Session.getEffectiveUser().getEmail();
      if (email) {
        try {
          MailApp.sendEmail({
            to: email,
            subject: "🔑 DazzlingDB: Secure Setup Key Generated",
            body: `Hello,\n\nA secure setup key has been generated for your DazzlingDB instance.\n\nSetup Key: ${setupKey}\n\nUse this key in the First-Run Wizard to initialize your superadmin account.`
          });
          console.log("[AuthBridge] Setup key generated and emailed to project owner.");
        } catch (e) {
          console.error(`[AuthBridge] Failed to send setup key email: ${e.message}`);
        }
      } else {
        console.warn("[AuthBridge] No email address retrieved for effective user. SETUP_KEY is stored in Script Properties.");
      }
    }
  },

  /**
   * Checks if user has access to a specific table.
   */
  checkAccess(userContext, tableName) {
    return RBAC.canAccessTable(userContext, tableName);
  }
}
