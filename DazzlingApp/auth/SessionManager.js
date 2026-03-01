/**
 * ==============================================================
 * SessionManager.gs
 * ==============================================================
 *
 * Responsibility:
 * - Manage active user sessions
 * - Interface with CacheService
 * - Provide token <-> userId mapping
 *
 * Architecture:
 * - Stateless (per-request)
 * - Time-To-Live (TTL) managed by Google Cache
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

    // Store token -> userId mapping
    cache.put(token, userId, ttlSeconds);

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
    return cache.get(token);
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
  }

  /**
   * Extend an existing session.
   */
  static touch(token, ttlSeconds = 3600) {
    const userId = this.getUserId(token);
    if (userId) {
      const cache = CacheService.getScriptCache();
      cache.put(token, userId, ttlSeconds);
    }
  }
}
