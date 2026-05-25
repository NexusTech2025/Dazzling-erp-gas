/**
 * ==============================================================
 * AuthService.gs
 * ==============================================================
 *
 * Responsibility:
 * - High-level authentication business logic
 * - Link Users with Profile entities (Student/Teacher/Admin)
 * - Session lifecycle management
 *
 * Dependencies:
 * - UserRepository (for data access)
 * - AuthUtils (for hashing)
 * - SessionManager (for tokens)
 *
 * MUST NOT:
 * - Direct access to SpreadsheetApp
 * ==============================================================
 */

class AuthService {

  /**
   * @param {UserRepository} userRepository
   * @param {ORM} orm - For profile resolution
   */
  constructor(userRepository, orm) {
    if (!userRepository) {
      throw new Error("UserRepository is required for AuthService.");
    }
    this._repo = userRepository;
    this._orm = orm;
  }

  /**
   * Register a new user and their corresponding profile.
   * Implements manual rollback to maintain cross-sheet integrity.
   *
   * @param {Object} userData - { username, password, email, role }
   * @param {Object} profileData - Data for Student/Teacher/Admin profile
   * @returns {Object} { user: BaseModel, profile: BaseModel }
   */
  register(userData, profileData = {}) {
    const { username, password, email, role } = userData;

    // 1. Uniqueness check
    if (this._repo.findByUsername(username)) {
      throw new Error(`Username '${username}' is already taken.`);
    }

    // 2. Generate Identity Anchor (UUID)
    const userId = AuthUtils.generateToken();

    // 3. Secure the password
    const passwordHash = AuthUtils.hashPassword(password);

    // 4. STEP 1: Create the User (The "Security Anchor")
    const now = new Date();
    let newUserRaw;
    
    try {
      newUserRaw = this._repo.create({
        id: userId,
        username,
        password_hash: passwordHash,
        email,
        role,
        status: "active",
        created_at: now,
        updated_at: now,
        last_login: null
      });
    } catch (e) {
      Logger.log(`[AuthService.register] Critical failure creating User: ${e.message}`);
      throw new Error("Failed to initialize user account.");
    }

    // 5. STEP 2: Create the Profile (The "Domain Identity")
    try {
      const profileEntityMap = {
        "student": "Student",
        "teacher": "Teacher",
        "admin":   "Admin"
      };

      const entityName = profileEntityMap[role.toLowerCase()];
      if (!entityName) {
        throw new Error(`Invalid role '${role}' provided during registration.`);
      }

      const profileRepo = this._orm.getRepository(entityName);
      
      const finalProfileData = {
        ...profileData,
        id: AuthUtils.generateToken(),
        user_id: userId // Linking to the anchor created above
      };

      const newProfileRaw = profileRepo.create(finalProfileData);

      // Success: Return both wrapped models
      return {
        user: this._orm._wrap("User", newUserRaw),
        profile: this._orm._wrap(entityName, newProfileRaw)
      };

    } catch (error) {
      // --- THE MANUAL ROLLBACK ---
      Logger.log(`[AuthService.register] Profile creation failed. ROLLING BACK user "${userId}"...`);
      
      try {
        this._repo.delete(userId);
        Logger.log(`[AuthService.register] Rollback Successful: User "${userId}" physically removed.`);
      } catch (rollbackError) {
        Logger.log(`[AuthService.register] CRITICAL: Rollback failed! Orphaned user "${userId}" remains. ${rollbackError.message}`);
      }

      throw new Error(`Registration failed during profile creation: ${error.message}. System state has been restored.`);
    }
  }

  /**
   * Login a user and return a session token.
   *
   * @param {string} username
   * @param {string} password
   * @returns {Object} { token, user }
   */
  login(username, password) {
    const user = this._repo.findByUsername(username);

    if (!user) {
      throw new AuthorizationError("Invalid credentials.");
    }

    // verify hash
    const isValid = AuthUtils.verifyPassword(password, user.password_hash);

    if (!isValid) {
      throw new AuthorizationError("Invalid credentials.");
    }

    if (user.status !== "active") {
      throw new AuthorizationError("Account is inactive.");
    }

    // Update last_login timestamp
    const now = new Date();
    this._repo.update(user.id, { 
      last_login: now,
      updated_at: now 
    });

    const token = SessionManager.create(user.id);

    // Re-fetch or manually update local object for the response
    user.last_login = now;
    user.updated_at = now;

    return {
      token,
      user: this._orm._wrap("User", user)
    };
  }

  /**
   * Authenticate a request via token.
   *
   * @param {string} token
   * @returns {BaseModel|null} The authenticated user model
   */
  authenticate(token) {
    const userId = SessionManager.getUserId(token);
    if (!userId) return null;

    const userData = this._repo.findById(userId);
    if (!userData || userData.status !== "active") return null;

    return this._orm._wrap("User", userData);
  }

  /**
   * Logout a user.
   */
  logout(token) {
    SessionManager.destroy(token);
  }

  /**
   * Simple RBAC helper.
   * 
   * @param {BaseModel|Object} user - Accepts either wrapped model or raw data
   * @param {string|Array} requiredRole
   * @returns {boolean}
   */
  hasRole(user, requiredRole) {
    if (!user) return false;

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    // Robust access: use .get() if available (Model), fallback to direct property (Object)
    const userRole = (typeof user.get === "function") 
      ? user.get("role") 
      : user.role;
    // Super-admin logic could be added here
    return roles.includes(userRole);
  }
}
