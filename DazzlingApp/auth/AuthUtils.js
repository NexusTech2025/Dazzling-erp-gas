/**
 * ==============================================================
 * AuthUtils.gs
 * ==============================================================
 *
 * Responsibility:
 * - Low-level security operations
 * - Hashing and token generation
 * - Stateless and pure logic
 *
 * MUST NOT:
 * - Access SpreadsheetApp
 * - Access Repositories
 * ==============================================================
 */

class AuthUtils {

  /**
   * Securely hash a password using SHA-256 and a secret pepper.
   *
   * @param {string} password - Raw password
   * @returns {string} Hex-encoded hash
   */
  static hashPassword(password) {
    if (!password) {
      throw new Error("Password is required for hashing.");
    }

    // Combine password with secret pepper from Config
    const input = password + CONFIG.SECRET_PEPPER;

    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      input,
      Utilities.Charset.UTF_8
    );

    // Convert byte array to hex string
    return digest.map(byte => {
      let hex = (byte & 0xFF).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }

  /**
   * Compare a raw password against a hashed version.
   *
   * @param {string} rawPassword
   * @param {string} hashedPassword
   * @returns {boolean}
   */
  static verifyPassword(rawPassword, hashedPassword) {
    const newHash = this.hashPassword(rawPassword);
    return newHash === hashedPassword;
  }

  /**
   * Generate a unique session token.
   *
   * @returns {string} UUID v4
   */
  static generateToken() {
    return Utilities.getUuid();
  }
}
