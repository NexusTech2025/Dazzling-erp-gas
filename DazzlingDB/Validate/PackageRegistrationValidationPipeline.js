/**
 * Specific validation rules for registration requests against the Package domain model.
 * Path: DazzlingDB/Validate/PackageRegistrationValidationPipeline.js
 */
const PackageRegistrationRules = [
  {
    name: "package_required_fields",
    validator: (ctx) => {
      const { name, package_fee } = ctx.payload;
      if (name === undefined || name === null || String(name).trim() === "") {
        ctx.state.missingField = "name";
        ctx.state.errorMessage = "Package 'name' is required.";
        return false;
      }
      if (package_fee === undefined || package_fee === null || isNaN(Number(package_fee))) {
        ctx.state.missingField = "package_fee";
        ctx.state.errorMessage = "Package 'package_fee' must be a valid number.";
        return false;
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError(ctx.state.missingField, ctx.state.errorMessage);
    }
  },
  {
    name: "package_perks_valid",
    validator: (ctx) => {
      const { perks } = ctx.payload;
      if (perks === undefined || perks === null) return true;
      if (!Array.isArray(perks)) {
        ctx.state.perksError = "Perks must be an array.";
        return false;
      }
      for (let i = 0; i < perks.length; i++) {
        const perk = perks[i];
        if (!perk || perk.perk_title === undefined || perk.perk_title === null || String(perk.perk_title).trim() === "") {
          ctx.state.perksError = `Perk at index ${i} is missing the required 'perk_title'.`;
          return false;
        }
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError("perks", ctx.state.perksError || "Perks validation failed.");
    }
  },
  {
    name: "package_entities_valid",
    validator: (ctx) => {
      const { courses } = ctx.payload;
      if (courses === undefined || courses === null) return true;
      if (!Array.isArray(courses)) {
        ctx.state.coursesError = "Courses must be an array.";
        return false;
      }

      // Dynamic lookup of allowed polymorphic entity types
      const packageItemRelations = ctx.db.PackageItem.registry.getRelations("PackageItem");
      const mapping = packageItemRelations && packageItemRelations.entity ? packageItemRelations.entity.mapping : null;
      const allowedTypes = mapping ? Object.keys(mapping) : ["course", "subject"];

      // Setup cache/maps for validation checks
      const allSegments = ctx.db.CourseType.all();
      const segmentMap = {};
      allSegments.forEach(s => {
        segmentMap[s.segment_id] = s;
        if (s.segment_name) {
          segmentMap["name_" + s.segment_name.toLowerCase().trim()] = s;
        }
      });
      const activeSegment = allSegments.find(s => s.status === "active") || allSegments[0];

      const existingCourses = ctx.db.Course.all();
      const courseMap = {};
      existingCourses.forEach(c => {
        courseMap[c.course_id] = c;
        if (c.short_code) {
          courseMap["code_" + c.short_code.toLowerCase().trim()] = c;
        }
      });

      // Keep track of short codes seen in this payload to check payload-level duplicates
      const payloadShortCodes = new Set();

      for (let i = 0; i < courses.length; i++) {
        const item = courses[i];
        if (!item) {
          ctx.state.coursesError = `Course item at index ${i} is null or undefined.`;
          return false;
        }

        const normalizedType = typeof item.entity_type === "string"
          ? item.entity_type.toLowerCase().trim()
          : item.entity_type;

        if (!allowedTypes.includes(normalizedType)) {
          ctx.state.coursesError = `Validation failed at index ${i}: entity_type '${item.entity_type}' must be one of: ${allowedTypes.join(", ")}.`;
          return false;
        }

        if (item.on_demand === true) {
          // Verify required fields for on-demand course creation
          if (!item.name || String(item.name).trim() === "") {
            ctx.state.coursesError = `On-demand course at index ${i} is missing the required 'name'.`;
            return false;
          }

          // Resolve segment
          let segmentId = item.segment_id;
          if (!segmentId) {
            if (item.segment_name) {
              const ct = segmentMap["name_" + item.segment_name.toLowerCase().trim()];
              if (ct) segmentId = ct.segment_id;
            }
            if (!segmentId && activeSegment) {
              segmentId = activeSegment.segment_id;
            }
          }

          if (!segmentId) {
            ctx.state.coursesError = `Could not resolve segment for on-demand course at index ${i}. Please provide a valid 'segment_id' or 'segment_name'.`;
            return false;
          }

          const segment = segmentMap[segmentId];
          if (!segment) {
            ctx.state.coursesError = `CourseType (segment_id: '${segmentId}') referenced at index ${i} does not exist.`;
            return false;
          }

          // Uniqueness checks for short_code
          if (item.short_code) {
            const codeKey = item.short_code.toLowerCase().trim();

            // Payload-level uniqueness
            if (payloadShortCodes.has(codeKey)) {
              ctx.state.coursesError = `Duplicate course short_code '${item.short_code}' found within the request payload.`;
              return false;
            }
            payloadShortCodes.add(codeKey);

            // Database-level uniqueness
            const duplicateInDb = courseMap["code_" + codeKey];
            if (duplicateInDb) {
              ctx.state.coursesError = `Failed to save Course at index ${i}: Unique constraint violation on column 'short_code' (value '${item.short_code}' already exists).`;
              return false;
            }
          }

          // Cache resolved segment ID back into validation payload state to avoid re-resolving in Service
          item._resolvedSegmentId = segmentId;

        } else {
          // Standard course existence check
          if (!item.entity_id) {
            ctx.state.coursesError = `Course at index ${i} requires either 'entity_id' or 'on_demand: true'.`;
            return false;
          }
          const course = courseMap[item.entity_id];
          if (!course) {
            ctx.state.coursesError = `Referenced course ID '${item.entity_id}' at index ${i} does not exist.`;
            return false;
          }
        }
      }
      return true;
    },
    onError: (ctx) => {
      ctx.addError("courses", ctx.state.coursesError || "Courses validation failed.");
    }
  }
];

// Global export for Google Apps Script context
globalThis.PackageRegistrationRules = PackageRegistrationRules;
