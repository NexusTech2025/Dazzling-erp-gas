/**
 * @file MockDBContext.js
 * Bootstrap database repositories by invoking the production SheetDB.init() facade with mocked gateways.
 * Replicates the production DBContext IIFE singleton pattern for high-fidelity behavior.
 */
const { MockTableGateway } = require('./MockTableGateway');

function setupMockDBContext() {
  // Bind MockTableGateway & infrastructure stubs to global scope so SheetDB.init() resolves them
  global.TableGateway = MockTableGateway;
  global.SpreadsheetFileSystem = class { };
  global.SheetDataSource = class { };

  const virtualSchema = {
    database: "DazzlingDB_Virtual",
    version: "1.0.0",
    categories: {
      Core: {
        tables: {
          Branch: {
            primaryKey: "branch_id",
            columns: {
              branch_id: { type: "auto", idPrefix: "BRN" },
              branch_name: { type: "string" }
            }
          }
        }
      },
      Academic: {
        tables: {
          CourseType: {
            primaryKey: "segment_id",
            columns: {
              segment_id: { type: "auto", idPrefix: "SEG" },
              segment_name: { type: "string", required: true },
              entity_label: { type: "string" },
              description: { type: "string" },
              status: { type: "string", default: "active" }
            },
            relations: {
              courses: {
                type: "hasMany",
                target: "Course",
                foreignKey: "segment_id"
              }
            }
          },
          Course: {
            primaryKey: "course_id",
            columns: {
              course_id: { type: "auto", idPrefix: "CRS" },
              segment_id: { type: "foreign_key", onDelete: "protect" },
              entity_type: { type: "string" },
              name: { type: "string", required: true },
              short_code: { type: "string", unique: true },
              language_medium: { type: "string", required: true },
              description: { type: "string" },
              duration_value: { type: "number" },
              duration_unit: { type: "string", default: "months" },
              base_fee: { type: "number", required: true },
              default_installment_count: { type: "number", default: 1 },
              status: { type: "string", default: "active" },
              metadata: { type: "json" }
            },
            relations: {
              coursetype: {
                type: "belongsTo",
                target: "CourseType",
                foreignKey: "segment_id"
              },
              teachersubjects: {
                type: "hasMany",
                target: "TeacherSubject",
                foreignKey: "subject_id"
              },
              packageitems: {
                type: "hasMany",
                target: "PackageItem",
                foreignKey: "entity_id"
              }
            }
          },
          TeacherSubject: {
            primaryKey: "teacher_subject_id",
            columns: {
              teacher_subject_id: { type: "auto", idPrefix: "TSUB" },
              teacher_id: { type: "string" },
              subject_id: { type: "string" }
            },
            relations: {
              subject: {
                type: "belongsTo",
                target: "Course",
                foreignKey: "subject_id"
              }
            }
          },
          Package: {
            primaryKey: "package_id",
            columns: {
              package_id: { type: "auto", idPrefix: "PKG" },
              name: { type: "string", required: true },
              description: { type: "string" },
              target_class: { type: "string" },
              board: { type: "string" },
              month: { type: "number" },
              package_fee: { type: "number", required: true },
              discount_percent: { type: "number" },
              status: { type: "string", default: "active" }
            },
            relations: {
              packageperks: {
                type: "hasMany",
                target: "PackagePerk",
                foreignKey: "package_id"
              },
              packageitems: {
                type: "hasMany",
                target: "PackageItem",
                foreignKey: "package_id"
              }
            }
          },
          PackageItem: {
            primaryKey: "item_id",
            columns: {
              item_id: { type: "auto", idPrefix: "PKI" },
              package_id: { type: "foreign_key", required: true },
              entity_type: { type: "string" },
              entity_id: { type: "foreign_key", required: true }
            },
            relations: {
              package: {
                type: "belongsTo",
                target: "Package",
                foreignKey: "package_id"
              },
              entity: {
                type: "belongsToPolymorphic",
                typeField: "entity_type",
                idField: "entity_id",
                mapping: {
                  course: "Course",
                  subject: "Course"
                }
              }
            }
          },
          PackagePerk: {
            primaryKey: "perk_id",
            columns: {
              perk_id: { type: "auto", idPrefix: "PRK" },
              package_id: { type: "foreign_key" },
              perk_title: { type: "string", required: true },
              perk_description: { type: "string" },
              icon: { type: "string" },
              display_order: { type: "number" }
            },
            relations: {
              package: {
                type: "belongsTo",
                target: "Package",
                foreignKey: "package_id"
              }
            }
          }
        }
      }
    }
  };
  console.log("🛠️ [MockDBContext] Configuring virtual database namespaces and stubs...");

  // Bind singleton context globally matching production signature using an IIFE closure
  global.DBContext = (function () {
    let instance = null;

    function _init() {
      console.log("[MockDBContext] Bootstrapping virtual database facade using SheetDB.init()...");

      // 1. Run registrations prior to bootstrapping SheetDB (identical to production)
      if (typeof global.registerDatabaseValidators === 'function') {
        try {
          console.log("[MockDBContext] Executing registerDatabaseValidators()...");
          global.registerDatabaseValidators();
        } catch (e) {
          console.warn(`[MockDBContext] Validator registration bypassed: ${e.message}`);
        }
      } else {
        console.warn("[MockDBContext] Warning: registerDatabaseValidators is not defined globally.");
      }

      if (typeof global.registerPolymorphicMappings === 'function') {
        try {
          console.log("[MockDBContext] Executing registerPolymorphicMappings()...");
          global.registerPolymorphicMappings();
        } catch (e) {
          console.warn(`[MockDBContext] Polymorphic mapping registration bypassed: ${e.message}`);
        }
      } else {
        console.warn("[MockDBContext] Warning: registerPolymorphicMappings is not defined globally.");
      }

      // 2. Call the actual SheetDB.init() compiler
      console.log("[MockDBContext] Initializing database facade...");
      const db = globalThis.init("Virtual_Sandbox_Folder", virtualSchema, {
        allowAutoOverride: true
      });

      // 3. Attach bootstrapRepositories helper
      db.bootstrapRepositories = function () {
        console.log("[MockDBContext] bootstrapRepositories invoked: resetting database instance.");
        instance = _init();
        return instance;
      };

      return db;
    }

    return {
      getInstance: function () {
        if (!instance) {
          instance = _init();
        }
        return instance;
      },
      ping: function () {
        return { status: "OK", message: "Virtual database context is active." };
      }
    };
  })();

  global.DATABASE_SCHEMA = virtualSchema;
  console.log("✨ [MockDBContext] Successfully registered global DBContext singleton closure.");
}

module.exports = { setupMockDBContext };
