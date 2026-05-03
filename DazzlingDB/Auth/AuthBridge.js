/**
 * @file AuthBridge.js
 * Facade for the Auth Layer. The only interface the ERP talks to.
 */

class AuthBaseError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

class AuthenticationError extends AuthBaseError {}
class AuthorizationError extends AuthBaseError {}

const AuthBridge = {
  
  /**
   * Registers a new user.
   */
  registerUser(payload) {
    const db = DBContext.getInstance();
    console.log(`[AuthBridge] Registering user: ${payload.username}`);

    if (db.User.exists({ username: payload.username })) {
      throw new AuthBaseError(`Username '${payload.username}' is already taken.`);
    }

    if (!AuthCore.isStrongPassword(payload.password)) {
      throw new AuthBaseError("Password is too weak (minimum 8 characters).");
    }

    const newUser = db.User.insert({
      ...payload,
      password_hash: AuthCore.hashPassword(payload.password),
      status: "active",
      role: payload.role || "guest"
    });

    delete newUser.password_hash;
    return newUser;
  },

  /**
   * Authenticates user and returns session.
   */
  login(username, password, clientInfo = {}) {
    const db = DBContext.getInstance();
    console.log(`[AuthBridge] Attempting login for: ${username}`);

    const user = db.User.findOne({ username: username });

    if (!user) throw new AuthenticationError("Invalid username or password.");
    if (user.status !== "active") throw new AuthenticationError(`Account is ${user.status}.`);

    if (!AuthCore.verifyPassword(password, user.password_hash)) {
      throw new AuthenticationError("Invalid username or password.");
    }

    const token = SessionManager.createSession(user.user_id, clientInfo);

    // Update last login
    db.User.update(user.user_id, { last_login: new Date() });

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
   * Invalidates a session.
   */
  logout(token) {
    console.log(`[AuthBridge] Logging out token: ${token}`);
    SessionManager.destroySession(token);
    return { success: true, message: "Logged out successfully" };
  },

  /**
   * Resolves a token into a UserContext object.
   * Called by ApiDispatcher on every request.
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

    return {
      userId: user.user_id,
      username: user.username,
      role: user.role,
      isValid: true
    };
  },

  /**
   * Checks if user has access to a specific table.
   */
  checkAccess(userContext, tableName) {
    return RBAC.canAccessTable(userContext, tableName);
  }
};
