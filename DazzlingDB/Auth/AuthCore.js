/**
 * @file AuthCore.js
 * Cryptographic engine for the Auth Layer.
 * Handles salted hashing, validation, and token generation.
 */

const AuthCore = {
  /**
   * Computes a SHA-256 hash of a string with an optional salt.
   * @param {string} plainText
   * @param {string} salt
   * @returns {string} Hex representation of the hash
   */
  hashPassword(plainText, salt = "") {
    if (!plainText) throw new Error("Password cannot be empty.");
    const input = plainText + salt;
    const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);
    return signature.map(byte => {
      const hex = (byte & 0xFF).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  },

  /**
   * Verifies if a plain text password matches a hash given a salt.
   * @param {string} plainText
   * @param {string} hash
   * @param {string} salt
   * @returns {boolean}
   */
  verifyPassword(plainText, hash, salt) {
    return this.hashPassword(plainText, salt) === hash;
  },

  /**
   * Generates a random secure salt.
   * @returns {string}
   */
  generateSalt() {
    return Utilities.getUuid().split('-')[0]; // Simple 8-char salt
  },

  /**
   * Generates a cryptographically secure UUID for tokens.
   * @returns {string} UUIDv4
   */
  generateToken() {
    return Utilities.getUuid();
  },

  /**
   * Validates password strength.
   * Enforces minimum 8 characters, at least one uppercase letter,
   * one lowercase letter, one digit, and one special character.
   * @param {string} password
   * @returns {boolean}
   */
  isStrongPassword(password) {
    if (!password || password.length < 8) return false;
    // Enforce one uppercase, one lowercase, one digit, and one special character
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-=_+\[\]{}|;:',.<>?\/])[A-Za-z\d!@#$%^&*()\-=_+\[\]{}|;:',.<>?\/]{8,}$/;
    return regex.test(password);
  }
};
