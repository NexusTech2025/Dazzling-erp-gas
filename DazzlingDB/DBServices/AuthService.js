/**
 * @file AuthService.js
 * Domain Service for Identity, Authentication, and Session Management.
 */

/**
 * 🔐 AUTH ERROR HIERARCHY
 */
class AuthBaseError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}

class AuthenticationError extends AuthBaseError {}
class AuthorizationError extends AuthBaseError {}
class UserNotFoundError extends AuthBaseError {}
class AccountLockedError extends AuthenticationError {}

const AuthService = {
  
  /**
   * IDENTITY MANAGEMENT
   */

  /**
   * Registers a new user with secure password hashing.
   */
  registerUser(payload) {
    const db = DBContext.getInstance();
    console.log(`[AuthService] Registering user: ${payload.username}`);

    if (db.User.exists({ username: payload.username })) {
      throw new AuthBaseError(`Username '${payload.username}' is already taken.`);
    }

    const newUser = db.User.insert({
      ...payload,
      password_hash: this._hashPassword(payload.password),
      status: "active",
      role: payload.role || "guest"
    });

    // Strip password from returned object for safety
    delete newUser.password_hash;
    return newUser;
  },

  /**
   * AUTHENTICATION LOGIC
   */

  /**
   * Authenticates user credentials and generates a session token.
   */
  login(username, password, clientInfo = {}) {
    const db = DBContext.getInstance();
    console.log(`[AuthService] Attempting login for: ${username}`);

    const user = db.User.findOne({ username: username });

    if (!user) {
      throw new AuthenticationError("Invalid username or password.");
    }

    if (user.status !== "active") {
      throw new AccountLockedError(`Account is ${user.status}. Please contact admin.`);
    }

    // Verify Hashed Password
    const inputHash = this._hashPassword(password);
    if (user.password_hash !== inputHash) {
      this._handleFailedAttempt(user);
      throw new AuthenticationError("Invalid username or password.");
    }

    // Generate Session
    const token = this._generateToken();
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 8); // 8-hour session

    db.Session.insert({
      token: token,
      user_id: user.user_id,
      expires_at: expiry,
      client_info: JSON.stringify(clientInfo)
    });

    // Update last login
    db.User.update(user.user_id, { last_login: new Date() });

    return {
      token: token,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role
      },
      expires_at: expiry
    };
  },

  /**
   * Invalidates a session token.
   */
  logout(token) {
    const db = DBContext.getInstance();
    console.log(`[AuthService] Logging out token: ${token}`);
    db.Session.delete(token);
    return true;
  },

  /**
   * Validates if a token is active and not expired.
   * Returns the User model if valid.
   */
  validateSession(token) {
    const db = DBContext.getInstance();
    const session = db.Session.findById(token);

    if (!session) return null;

    if (new Date(session.expires_at) < new Date()) {
      db.Session.delete(token);
      return null;
    }

    return db.User.findById(session.user_id);
  },

  /**
   * AUTHORIZATION (RBAC)
   */

  /**
   * Checks if a user has one of the required roles.
   */
  hasRole(user, allowedRoles = []) {
    if (!user) return false;
    return allowedRoles.includes(user.role) || user.role === 'admin';
  },

  /**
   * INTERNAL UTILITIES
   */

  /**
   * Computes SHA-256 hash of a string.
   * @private
   */
  _hashPassword(password) {
    const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
    return signature.map(byte => {
      const hex = (byte & 0xFF).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  },

  /**
   * Generates a random secure token string.
   * @private
   */
  _generateToken() {
    return Utilities.getUuid();
  },

  /**
   * Reserved for brute-force protection logic.
   * @private
   */
  _handleFailedAttempt(user) {
    // In a production system, increment a counter and lock after N tries
    console.warn(`[AuthService] Failed login attempt for: ${user.username}`);
  }
};
