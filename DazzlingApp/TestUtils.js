/**
 * Basic assertion utilities for GAS
 */

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error("Assertion Failed: " + message);
  }
  Logger.log("✔ " + message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `Assertion Failed: ${message} | Expected: ${expected}, Got: ${actual}`
    );
  }
  Logger.log("✔ " + message);
}

function assertThrows(fn, message) {
  try {
    fn();
    throw new Error("Expected error not thrown: " + message);
  } catch (error) {
    Logger.log("✔ " + message);
  }
}