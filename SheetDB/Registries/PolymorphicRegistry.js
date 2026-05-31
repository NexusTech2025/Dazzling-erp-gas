/**
 * @file PolymorphicRegistry.js
 * Layer: Registries - Dynamic Mappings
 * 
 * Responsibility:
 * - Map logical polymorphic type codes to physical Sheet table names.
 */

const PolymorphicRegistry = (function() {
  const _mappings = new Map();

  return {
    /**
     * Registers a mapping between a type code and a target table name.
     * @param {string} typeCode - Shorthand code (e.g. "course", "package")
     * @param {string} targetTable - Exact sheet/table name (e.g. "Course", "Package")
     */
    register(typeCode, targetTable) {
      if (typeof typeCode !== 'string' || typeCode.trim() === '') {
        throw new Error("[PolymorphicRegistry] Type code must be a non-empty string.");
      }
      if (typeof targetTable !== 'string' || targetTable.trim() === '') {
        throw new Error("[PolymorphicRegistry] Target table name must be a non-empty string.");
      }
      _mappings.set(typeCode.toLowerCase(), targetTable);
      console.log(`[PolymorphicRegistry] Registered mapping: '${typeCode.toLowerCase()}' -> '${targetTable}'`);
    },
    
    /**
     * Resolves a type code to its target table name.
     * @param {string} typeCode
     * @returns {string} Target table name.
     * @throws {Error} If no mapping is registered.
     */
    resolve(typeCode) {
      if (!typeCode) return null;
      const target = _mappings.get(String(typeCode).toLowerCase());
      if (!target) {
        throw new Error(`No target table registered for type code '${typeCode}'`);
      }
      return target;
    },
    
    /**
     * Checks if a type code has a registered target table mapping.
     * @param {string} typeCode
     * @returns {boolean}
     */
    has(typeCode) {
      if (!typeCode) return false;
      return _mappings.has(String(typeCode).toLowerCase());
    },
    
    /**
     * Clears all registered polymorphic mappings.
     */
    clear() {
      _mappings.clear();
      console.log("[PolymorphicRegistry] All mappings cleared.");
    }
  };
})();

// Bind to Global Scope
globalThis.PolymorphicRegistry = PolymorphicRegistry;
