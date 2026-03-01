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
   *
   * @param {Object} userData - { username, password, email, role }
   * @param {Object} profileData - Data for Student/Teacher/Admin profile
   * @returns {BaseModel} The created User model
   */
  register(userData, profileData = {}) {
    const { username, password, email, role } = userData;

    // 1. Uniqueness check
    if (this._repo.findByUsername(username)) {
      throw new Error(`Username '${username}' is already taken.`);
    }

    // 2. Generate Identity Anchor
    const userId = AuthUtils.generateToken();

    // 3. Secure the password
    const passwordHash = AuthUtils.hashPassword(password);

    // 4. Create the User (The "Key")
    const now = new Date();
    const newUserRaw = this._repo.create({
      id: userId,
      username,
      password_hash: passwordHash,
      email,
      role,
      status: "active",
      created_at: now,
      updated_at: now
    });

    // 5. Create the Profile (The "Identity")
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
      user_id: userId
    };

    profileRepo.create(finalProfileData);

    return this._orm.wrap("User", newUserRaw);
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

    const token = SessionManager.create(user.id);

    return {
      token,
      user: this._orm.wrap("User", user)
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

    return this._orm.wrap("User", userData);
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
   * @param {BaseModel} user
   * @param {string|Array} requiredRole
   * @returns {boolean}
   */
  hasRole(user, requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const userRole = user.get("role");

    // Super-admin logic could be added here
    return roles.includes(userRole);
  }
}
