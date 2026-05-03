/**
 * @file AuthCore.js
 * Cryptographic engine for the Auth Layer.
 * Handles hashing, validation, and token generation.
 */

const AuthCore = {
  /**
   * Computes a SHA-256 hash of a string.
   * @param {string} plainText
   * @returns {string} Hex representation of the hash
   */
  hashPassword(plainText) {
    if (!plainText) throw new Error("Password cannot be empty.");
    const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, plainText);
    return signature.map(byte => {
      const hex = (byte & 0xFF).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  },

  /**
   * Verifies if a plain text password matches a hash.
   * @param {string} plainText
   * @param {string} hash
   * @returns {boolean}
   */
  verifyPassword(plainText, hash) {
    return this.hashPassword(plainText) === hash;
  },

  /**
   * Generates a cryptographically secure UUID for tokens.
   * @returns {string} UUIDv4
   */
  generateToken() {
    return Utilities.getUuid();
  },

  /**
   * Validates password strength (basic).
   * @param {string} password
   * @returns {boolean}
   */
  isStrongPassword(password) {
    return password && password.length >= 8;
  }
};
