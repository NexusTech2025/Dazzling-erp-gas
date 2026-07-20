/**
 * @file SyncPromise.js
 * Synchronous, single-threaded Promise implementation designed explicitly for
 * Google Apps Script environments. Supports recursive thenable unwrapping 
 * and automated error propagation pipelines.
 */

class SyncPromise {
  /**
   * Initializes the promise state, registers boundaries, and runs the executor synchronously.
   * @param {function(function(*): void, function(*): void): void} executor - Execution logic block.
   */
  constructor(executor) {
    this.state = "pending"; // pending, fulfilled, rejected
    this.value = undefined;
    this.handlers = [];

    // Bind resolvers to this instance
    const resolve = (val) => this._resolve(val);
    const reject = (reason) => this._reject(reason);

    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }

  /**
   * Resolves the promise instance. Recursively unwraps thenable payloads.
   * @param {*} value - Target resolution value or inner thenable.
   * @returns {void}
   * @internal
   * @throws {CircularReferenceError} Rejects with custom CircularReferenceError on circular resolution.
   */
  _resolve(value) {
    if (this.state !== "pending") return;

    // Identity Comparison Gate to prevent Call Stack Exhaustion (Promises/A+ 2.3.1 Compliance)
    if (this === value) {
      this._reject(new CircularReferenceError(
        "SyncPromise Resolution Deadlock Detected: A promise cannot be resolved with itself " +
        "to prevent infinite loop V8 stack overflow loops."
      ));
      return;
    }

    // Duck-typing gate checking for thenables (unwraps recursively)
    if (isThenable(value)) {
      try {
        value.then(
          (val) => this._resolve(val),
          (reason) => this._reject(reason)
        );
      } catch (err) {
        this._reject(err);
      }
      return;
    }

    this.state = "fulfilled";
    this.value = value;
    this._executeHandlers();
  }

  /**
   * Rejects the promise instance with an error reason.
   * @param {*} reason - The rejection error or message.
   * @returns {void}
   * @internal
   */
  _reject(reason) {
    if (this.state !== "pending") return;
    this.state = "rejected";
    this.value = reason;
    this._executeHandlers();
  }

  /**
   * Sequentially flushes and executes all deferred down-chain closures.
   * @returns {void}
   * @private
   */
  _executeHandlers() {
    if (this.state === "pending") return;
    
    const currentHandlers = this.handlers;
    this.handlers = [];
    
    for (let i = 0; i < currentHandlers.length; i++) {
      currentHandlers[i]();
    }
  }

  /**
   * Registers success/failure callbacks and returns a new SyncPromise instance.
   * @param {function(*): *} [onFulfilled] - Callback for fulfillment resolution.
   * @param {function(*): *} [onRejected] - Callback for rejection recovery.
   * @returns {SyncPromise} Decoupled child promise link.
   */
  then(onFulfilled, onRejected) {
    return new SyncPromise((resolve, reject) => {
      const handle = () => {
        try {
          if (this.state === "fulfilled") {
            if (typeof onFulfilled === "function") {
              resolve(onFulfilled(this.value));
            } else {
              resolve(this.value);
            }
          } else if (this.state === "rejected") {
            if (typeof onRejected === "function") {
              resolve(onRejected(this.value));
            } else {
              reject(this.value);
            }
          }
        } catch (err) {
          reject(err);
        }
      };

      if (this.state === "pending") {
        this.handlers.push(handle);
      } else {
        handle();
      }
    });
  }

  /**
   * Registers a rejection handler to capture error vectors along the pipeline.
   * @param {function(*): *} onRejected - Rejection recovery callback.
   * @returns {SyncPromise}
   */
  catch(onRejected) {
    return this.then(undefined, onRejected);
  }

  /**
   * Registers an execution finalizer callback that triggers regardless of execution outcomes.
   * @param {function(): void} callback - Finalizer function block.
   * @returns {SyncPromise}
   */
  finally(callback) {
    return this.then(
      (value) => {
        const res = callback();
        if (isThenable(res)) {
          return SyncPromise.resolve(res).then(() => value);
        }
        return value;
      },
      (reason) => {
        const res = callback();
        if (isThenable(res)) {
          return SyncPromise.resolve(res).then(() => { throw reason; });
        }
        throw reason;
      }
    );
  }

  /**
   * Standard static factory helper creating a pre-fulfilled SyncPromise.
   * @param {*} value - The resolved value payload.
   * @returns {SyncPromise}
   */
  static resolve(value) {
    if (value instanceof SyncPromise) return value;
    return new SyncPromise((resolve) => resolve(value));
  }

  /**
   * Standard static factory helper creating a pre-rejected SyncPromise.
   * @param {*} reason - The rejected error payload.
   * @returns {SyncPromise}
   */
  static reject(reason) {
    return new SyncPromise((_, reject) => reject(reason));
  }

  /**
   * Synchronously evaluates an array of values/promises and resolves with a collective list.
   * @param {Array<*>} values - Array of promise wrappers or plain values.
   * @returns {SyncPromise}
   * @throws {TypeError} If values input is not an array.
   */
  static all(values) {
    return new SyncPromise((resolve, reject) => {
      if (!Array.isArray(values)) {
        return reject(new TypeError("Argument must be an array"));
      }
      if (values.length === 0) {
        return resolve([]);
      }

      const results = new Array(values.length);
      let completed = 0;

      values.forEach((val, index) => {
        SyncPromise.resolve(val).then(
          (res) => {
            results[index] = res;
            completed++;
            if (completed === values.length) {
              resolve(results);
            }
          },
          reject
        );
      });
    });
  }
}

// Bind to shared global context footprint
globalThis.SyncPromise = SyncPromise;