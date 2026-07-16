# TODO: Fix Multiple Active Config Support in `staff_update_salary_config`

## Issue Description
Currently, the `staff_update_salary_config` action does not properly support multiple active salary configurations for a teacher. Whenever an update is run on two salary configurations at once, the system sets all other active configurations to `expired` (or triggers unintended status expirations across the board).

## Objective
Diagnose and refactor the status lifecycle transition code within the salary config service to support co-existing active configurations where applicable, preventing automated bulk overrides from force-expiring other valid active configurations.

## Target Diagnostics Tasks
- [ ] Locate the lifecycle validation or trigger code responsible for auto-expiring active configurations during updates.
- [ ] Analyze the current database queries and update operations inside the Salary Config services.
- [ ] Fix the logic so updates on individual configurations do not sweep and expire other active records unless explicitly required.
- [ ] Add unit test coverage verifying that multiple active configurations can be updated without expiring unrelated configurations.
