/**
 * @file ApiTestHelper.js
 * Reusable utilities for API testing in the Apps Script environment.
 * 
 * Provides a standardized logging interface and a unified mock dispatcher
 * so that all API tests share the same robust execution environment.
 */

const ApiTestHelper = (function() {
  
  const logger = {
    phase: (msg) => console.log(`\n=========================================\n🚀 PHASE: ${msg}\n=========================================`),
    action: (msg) => console.log(`   ▶️ ${msg}`),
    detail: (msg) => console.log(`      ↳ ${msg}`),
    success: (msg) => console.log(`   ✅ SUCCESS: ${msg}`),
    error: (msg) => console.error(`   ❌ ERROR: ${msg}`),
    data: (label, obj) => console.log(`   📦 ${label}:\n`, JSON.stringify(obj, null, 2))
  };

  /**
   * Simulates a Web Request to the ApiDispatcher.
   * 
   * @param {string} action - The action key (e.g., 'student_register').
   * @param {Object} payload - The request parameters.
   * @param {string} [token=null] - Optional auth token.
   * @returns {Object} The successfully returned data payload.
   * @throws {Error} If the API response indicates failure.
   */
  function callApi(action, payload, token = null) {
    const mockEvent = {
      postData: {
        contents: JSON.stringify({
          action: action,
          token: token,
          payload: payload 
        })
      }
    };
    
    const output = ApiDispatcher.dispatch(mockEvent);
    let response;
    
    if (output.getContent) {
      response = JSON.parse(output.getContent());
    } else {
      response = output;
    }

    if (!response.success) {
      throw new Error(`[API Error] Action '${action}' failed: ${response.error ? response.error.message : 'Unknown Error'}`);
    }
    return response.data;
  }

  return {
    logger: logger,
    callApi: callApi
  };

})();
