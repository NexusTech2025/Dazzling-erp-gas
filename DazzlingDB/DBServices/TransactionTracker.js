/**
 * @file TransactionTracker.js
 * Legacy proxy pointing to SheetDB.TransactionTracker.
 * Preserves backwards compatibility for services referencing TransactionTracker from global scope.
 */
globalThis.TransactionTracker = SheetDB.TransactionTracker;
