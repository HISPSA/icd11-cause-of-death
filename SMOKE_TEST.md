# Smoke test — Tracker API migration, DHIS2 2.42

Covers the migration to the new Tracker API and the Global Shell header fix.
The migration spans two repositories and must be tested with both in place:
this app, and the `tracker-capture-app-core` branch that carries the
`DataApiClass` shim. Build the core (`yarn build`) before testing — the app
imports its `dist/`, so a source-only checkout runs the old bundle.

Verified so far: **static only.** The app and core both build, and the production
bundle contains zero legacy tracker endpoints. Endpoint and parameter names were
checked against the 2.42 API docs. **Nothing below has been run against a live
instance yet.**

Tested on: `<instance URL>` · DHIS2 version: `<x.y.z>` · Date: `<date>` · Tester: `<name>`

Open the browser devtools **Network** tab for all of these — a shim bug usually
shows as a 200 with the wrong shape, not an error. Nothing should call
`/api/trackedEntityInstances`, `/api/events` or `/api/enrollments`; every tracker
call should go to `/api/tracker/*`.

### Reads

| # | Action | Exercises | Watch for | Result |
|---|---|---|---|---|
| 1 | Open the registered list | `getTrackedEntityInstanceListByQuery` → `_toGrid` | Rows render at all. Empty table = grid rebuilt with wrong header names | |
| 2 | Check the row count / total | `_toGrid` pager from `res.pager` | Total matches reality; not just the current page size | |
| 3 | Page forward, then back | `page` / `pageSize` | Page 2 differs from page 1; going back gives page 1 again | |
| 4 | Sort by Last Updated, both directions | `_convertOrder` → `updatedAt:asc\|desc` | Order actually changes and reverses | |
| 5 | Sort by an attribute column | `order=<UID>:asc\|desc` | Sorts by that attribute, not silently ignored | |
| 6 | Filter a text column | `_convertFilter` → `filter=UID:LIKE:val` | Narrows results; no 409/400 | |
| 7 | Filter a dropdown column | `filter=UID:EQ:val` | Exact match only | |
| 8 | Two filters at once | repeated `&filter=` | Both applied (AND), not just the last one | |
| 9 | Search by program | `searchTei` | Returns matches from outside the selected org unit (`orgUnitMode=ACCESSIBLE`) | |
| 10 | Search by tracked entity type | `searchTeiByTet` | Same, scoped by TET | |
| 11 | Open a record from the list | `getTrackedEntityInstanceById` | Attributes, enrollment **and** existing events all populate | |

### Writes

| # | Action | Exercises | Watch for | Result |
|---|---|---|---|---|
| 12 | Register a new TEI | `pushTrackedEntityInstance` → `POST /api/tracker` | 200 with `status: OK`; record appears in the list | |
| 13 | Enrol it | `pushEnrollment` | Enrollment date saved correctly (`enrolledAt`) | |
| 14 | Fill and save a stage | `pushEvents` | Data values persist after a page reload | |
| 15 | Reopen and edit a saved record | `putTrackedEntityInstance` | Edit sticks — this is UPDATE, not a duplicate CREATE | |
| 16 | Complete the event | `pushEvents` | Status flips to completed | |
| 17 | Reopen the completed event | `pushEvents` | Reverts to active | |
| 18 | Leave an optional date blank and save | `toNewEvent` / `toNewEnrollment` | **Saves cleanly.** Blank dates are dropped rather than sent as `"Invalid date"` | |

### Deletes — highest risk, no prior equivalent

| # | Action | Exercises | Watch for | Result |
|---|---|---|---|---|
| 19 | Delete an enrollment | `deleteEnrollment` → `importStrategy=DELETE` | **Brand new method** — nothing equivalent existed before. Enrollment gone, TEI still present | |
| 20 | Delete a TEI | `deleteTei` | TEI gone from the list after refresh, not just from the local view | |

### Header bar (Global Shell)

| # | Action | Watch for | Result |
|---|---|---|---|
| 21 | Open the app through the DHIS2 menu | Exactly **one** header bar | |
| 22 | Confirm no dead space under it | Content starts immediately; no 48px gap | |
| 23 | Open the app URL directly (outside the shell) | App's own header appears — it should not vanish entirely | |

### Known weak points

If something breaks, these are the likeliest culprits:

- **`_toGrid()`** — rebuilds the legacy `headers`/`rows`/`metaData.pager` shape the
  list view indexes into by name (`instance`, `lastupdated`, attribute UIDs). A
  mismatch gives an empty or misaligned table rather than an error. Covers #1–#8.
- **`deleteEnrollment()`** — new code, no prior equivalent. Covers #19.
- **Date dropping** in `toNewEvent`/`toNewEnrollment` — values that stringify to
  `"Invalid date"` are dropped rather than rejected. Covers #18. Worth deciding
  whether silently dropping is right, or whether it should fail loudly.
- **Attribute-UID sorting** (#5) — passed straight through without translation, so
  it depends on 2.42 accepting attribute UIDs in `order`.

### Result

- [ ] All passed
- [ ] Passed with issues (noted below)
- [ ] Blocked

<!-- Paste any failing request URL + response body here -->
