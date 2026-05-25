/**
 * ==============================================================
 * SessionManager.gs
 * ==============================================================
 *
 * Responsibility:
 * - Manage active user sessions
 * - Interface with CacheService
 * - Provide token <-> userId mapping
 * - Track active tokens for debug/admin visibility
 * ==============================================================
 */

class SessionManager {

  /**
   * Create a new session and return the token.
   *
   * @param {string} userId
   * @param {number} ttlSeconds - Duration (default 1 hour)
   * @returns {string} token
   */
  static create(userId, ttlSeconds = 3600) {
    if (!userId) {
      throw new Error("userId is required to create a session.");
    }

    const token = AuthUtils.generateToken();
    const cache = CacheService.getScriptCache();

    // 1. Store in Cache (Primary)
    cache.put(token, userId, ttlSeconds);

    // 2. Register in Tracking (For visibility)
    SessionManager._addToRegistry(token, userId);

    return token;
  }

  /**
   * Retrieve userId by token.
   *
   * @param {string} token
   * @returns {string|null} userId or null if expired/invalid
   */
  static getUserId(token) {
    if (!token) return null;

    const cache = CacheService.getScriptCache();
    const userId = cache.get(token);

    // If cache is empty but registry has it, it expired. Clean it.
    if (!userId) {
      SessionManager._removeFromRegistry(token);
    }

    return userId;
  }

  /**
   * Remove a session.
   *
   * @param {string} token
   */
  static destroy(token) {
    if (!token) return;

    const cache = CacheService.getScriptCache();
    cache.remove(token);
    SessionManager._removeFromRegistry(token);
  }

  /**
   * List all active sessions from the registry.
   * Note: Some might be dead if they expired without being checked.
   * 
   * @returns {Array} [{ token, userId, isAlive }]
   */
  static listSessions() {
    const registry = SessionManager._getRegistry();
    const cache = CacheService.getScriptCache();
    const results = [];

    Object.keys(registry).forEach(token => {
      const userIdFromCache = cache.get(token);
      results.push({
        token: token,
        userId: registry[token],
        isAlive: !!userIdFromCache
      });
    });

    return results;
  }

  /**
   * Registry Management (via ScriptProperties)
   * @private
   */
  static _getRegistry() {
    const raw = PropertiesService.getScriptProperties().getProperty("SESSION_REGISTRY");
    return raw ? JSON.parse(raw) : {};
  }

  static _addToRegistry(token, userId) {
    const registry = SessionManager._getRegistry();
    registry[token] = userId;
    PropertiesService.getScriptProperties().setProperty("SESSION_REGISTRY", JSON.stringify(registry));
  }

  static _removeFromRegistry(token) {
    const registry = SessionManager._getRegistry();
    if (registry[token]) {
      delete registry[token];
      PropertiesService.getScriptProperties().setProperty("SESSION_REGISTRY", JSON.stringify(registry));
    }
  }

  /**
   * Extend an existing session.
   */
  static touch(token, ttlSeconds = 3600) {
    const userId = SessionManager.getUserId(token);
    if (userId) {
      const cache = CacheService.getScriptCache();
      cache.put(token, userId, ttlSeconds);
    }
  }
}
