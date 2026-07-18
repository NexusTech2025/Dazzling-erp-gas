/**
 * @file DevBootstrap_ApiTest.js
 * Generates a 24-hour Super Admin Token for development and testing.
 * 
 * Instructions: Run `runDevBootstrap()` once per day from the Apps Script editor.
 */

function runDevBootstrap() {
  // Defaults to DEVELOPMENT environment bootstrap
  DevBootstrap.run("DEVELOPMENT");
}
