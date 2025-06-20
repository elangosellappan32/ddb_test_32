# Plan for Rebuilding Allocation Without Period Allocation and Supporting Site Allocation Without Surge

## Information Gathered

- Frontend `Allocation.js` heavily uses period allocation (c1 to c5) in UI, data fetching, and allocation logic.
- `PeriodAllocationValidator.js` is empty or missing, so no existing validation logic there.
- Backend `allocationController.js` contains allocation logic, validation, and processing based on periods c1 to c5.
- Backend `allocationDAL.js` stores allocation data keyed by period and includes period fields in the data model.
- Allocation data model and APIs are tightly coupled with period allocation.

## Plan

### Frontend Changes

- Refactor `frontend/src/components/Allocation/Allocation.js`:
  - Remove all period allocation logic (c1 to c5).
  - Change UI to show allocation by site only, removing period columns and related UI elements.
  - Adjust data fetching and state management to work with site allocation data.
  - Remove or replace any period allocation validation or dialogs.
  - Adjust allocation summary and results to reflect site allocation without periods.
  - Ensure no UI surge or performance issues by optimizing state updates and rendering.

- Remove or archive `PeriodAllocationValidator.js` as it is unused.

### Backend Changes

- Refactor `backend/allocation/allocationController.js`:
  - Remove period-based validation and processing.
  - Change allocation processing to work with site allocation only.
  - Adjust APIs to accept and return allocation data without period fields.
  - Remove or refactor functions that depend on period allocation (e.g., prioritizeAllocation, processSequencedAllocation).

- Refactor `backend/allocation/allocationDAL.js`:
  - Remove period field from data model and keys.
  - Adjust data access methods to work with site allocation only.
  - Ensure data integrity and backward compatibility if needed.

### Testing and Validation

- Test frontend UI for correct display and functionality of site allocation.
- Test backend APIs for correct handling of site allocation data.
- Verify allocation creation, update, retrieval, and deletion work as expected.
- Monitor performance and ensure no surge or glitches in the allocation page.

## Dependent Files to Edit

- frontend/src/components/Allocation/Allocation.js
- backend/allocation/allocationController.js
- backend/allocation/allocationDAL.js

## Followup Steps

- Implement the above changes incrementally.
- Run unit and integration tests.
- Perform manual UI testing.
- Deploy and monitor for issues.

---

Please confirm if you approve this plan so I can proceed with the implementation.
