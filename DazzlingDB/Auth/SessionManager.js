/**
 * @file SessionManager.js
 * State management for active login tokens.
 * Uses DB as Source of Truth, CacheService for performance.
 */

const SessionManager = {

  _CACHE_TTL: 3600, // 1 hour in cache
  _DB_TTL_HOURS: 8, // 8 hours in database

  /**
   * Creates a new session.
   * @param {string} userId
   * @param {Object} clientInfo
   * @returns {string} token
   */
  createSession(userId, clientInfo = {}) {
    const db = DBContext.getInstance();
    const token = AuthCore.generateToken();

    const expiry = new Date();
    expiry.setHours(expiry.getHours() + this._DB_TTL_HOURS);

    // 1. Persist to Database (Source of Truth)
    db.Session.insert({
      token: token,
      user_id: userId,
      expires_at: expiry,
      client_info: JSON.stringify(clientInfo)
    });

    // 2. Write to Cache (Performance)
    const cache = CacheService.getScriptCache();
    cache.put(token, userId, this._CACHE_TTL);

    return token;
  },

  /**
   * Retrieves a valid userId for a given token.
   * @param {string} token
   * @returns {string|null} userId or null if invalid/expired
   */
  getValidUserId(token) {
    if (!token) return null;

    // 1. Try Cache First (Fast)
    const cache = CacheService.getScriptCache();
    const cachedUserId = cache.get(token);
    if (cachedUserId) return cachedUserId;

    // 2. Fallback to Database (Source of Truth)
    const db = DBContext.getInstance();
    const session = db.Session.findOne({ token: token });

    if (!session) return null;

    // 3. Check DB Expiration
    if (new Date(session.expires_at) < new Date()) {
      this.destroySession(token); // Cleanup dead session
      return null;
    }

    // 4. Session is valid. Repopulate Cache.
    cache.put(token, session.user_id, this._CACHE_TTL);
    return session.user_id;
  },

  /**
   * Destroys a session (Logout).
   * @param {string} token
   */
  destroySession(token) {
    if (!token) return;

    // 1. Clear Cache
    const cache = CacheService.getScriptCache();
    cache.remove(token);

    // 2. Clear Database
    const db = DBContext.getInstance();
    const session = db.Session.findOne({ token: token });
    if (session) {
      db.Session.remove(session.session_id);
    }
  }
};
