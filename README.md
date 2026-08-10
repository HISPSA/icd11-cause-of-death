# WHO ICD11 Cause Of Death

## Overview

The app provides a standardized approach to record cause of death information, following the International Statistical Classification of Diseases and Related Health Problems (ICD) guidelines. The app is linked with ICD 11 browser for searching the ICD 11 codes for the cause of death/medical condition entered by the user. Health workers can input data directly into the app, eliminating delays and reducing errors associated with coding in manual register.

## Feature

- Digital Mortality Rule Engine: WHO electronic MCCD form with embedded digital mortality rule base; rule engine for automated selection of Underlying Cause of Death.
- Cause of Death Certificate Generation: Generation of customized death certificate with extended options for countries to adopt their specific requirements while maintaining the core data points.
- Data Analytics: Standard and custom dashboards based on multiple ICD-11 special mortality tabulation lists, WHO standard analytics and ICD Chapter-wise analysis.
- Data Export and External Analysis: Allows ANACoD3 real time export for external and enhanced analysis.
- Easy Configuration: The CoD app allows both custom and manual installation options depending on the current configuration status of DHIS2 in country.

## Setting up

> [!NOTE]
> The app is using some components from tracker-capture-app-core, so we must download it to our local in order to set the app up (Download here https://github.com/hispvn/tracker-capture-app-core)

- Go to tracker-capture-app-core then run these commands one by one
```
yarn install
yarn build
yarn link
cd node_modules/react
yarn link
cd ../react-dom
yarn link
```

- Then go to icd11-cause-of-death and run these following commands
```
yarn link tracker-capture-app-core
yarn link react
yarn link react-dom
```

## Run locally (for development only)

- We have to add `.env` file to the root directory of the source code, and please follow the format
```
REACT_APP_BASE_URL=[PLACE YOUR INSTANCE URL HERE]
REACT_APP_USERNAME=[PLACE USERNAME HERE]
REACT_APP_PASSWORD=[PLACE PASSWORD HERE]
REACT_APP_ICD11_API_URL=https://dhis2.world/services/icd11
REACT_APP_ICD11_API_URL_PRODUCTION=../../../../services/icd11
```

- Then run `yarn start` in the root directory

## Build (for production)

- We have to add `.env` file to the root directory of the source code, and please follow the format
```
REACT_APP_BASE_URL=../../..
REACT_APP_USERNAME=
REACT_APP_PASSWORD=
REACT_APP_ICD11_API_URL=https://dhis2.world/services/icd11
REACT_APP_ICD11_API_URL_PRODUCTION=../../../../services/icd11
```

- Then run `yarn build` in the root directory

> [!IMPORTANT]
> The `.env` file is **required** even for a production build. `REACT_APP_BASE_URL` is baked into the bundle at build time and is used by the header bar (via `@dhis2/app-runtime`). If it is missing, the value becomes `undefined`, API calls resolve relative to the installed app path, and requests such as `systemSettings/applicationTitle` 404 (e.g. `.../api/apps/ICD-11-Cause-of-Death/api/systemSettings/applicationTitle`). Use `../../..` for production — it resolves to the DHIS2 instance root from the app path and is portable across instances. A full absolute URL (e.g. `https://your-instance/za-eidsr`) also works but ties the build to one server.

---

# Troubleshooting & Fixes

This section records issues encountered while building/deploying this app on **Node 20** against a **DHIS2 2.41** instance, and how each was resolved. Most build errors trace back to the old Create React App (CRA 4 / webpack 4) toolchain fighting modern Node and dependencies.

## Build & dependency errors

### 1. `babel-jest` version conflict (preflight check)
`react-scripts` expects `babel-jest@^26` but a newer `27.x` was hoisted into `node_modules`.
- Find the culprit: `npm ls babel-jest`
- `rm -rf node_modules package-lock.json`, remove any explicit `babel-jest` from `package.json`, then reinstall.
- Escape hatch: add `SKIP_PREFLIGHT_CHECK=true` to `.env` (masks the issue).

### 2. OpenSSL error `ERR_OSSL_EVP_UNSUPPORTED`
Old webpack uses a hash algorithm OpenSSL 3 (Node 17+) rejects.
- Workaround: `export NODE_OPTIONS=--openssl-legacy-provider` before `yarn build`, or add the flag to the build script.
- Real fix: upgrade to `react-scripts@5` (webpack 5), then remove the flag.

### 3. `react-draggable` — "Can't import the named export 'Children'"
`react-draggable`'s `.mjs` build is incompatible with webpack 4.
- Fast patch: `npm install react-draggable@4.4.3` (pre-`.mjs`).
- Real fix: upgrade to `react-scripts@5`.

### 4. Module not found: `deep-equal`
A transitive dependency was not installed.
- `yarn add deep-equal` (or run a full `yarn install` in the affected package).

### 5. Module not found: `react` / `tracker-capture-app-core`
A fresh copy of the project had no dependencies installed, or the local core package was not linked.
- Run `yarn install` in the project folder.
- Ensure `tracker-capture-app-core` is built and linked (see **Setting up** above). Each copy of the project needs its own `yarn install` + `yarn link`.

## Configuration / deployment errors

### 6. Header bar API 404 (`systemSettings/applicationTitle`)
Caused by a missing `.env` → `REACT_APP_BASE_URL` undefined → relative URL resolution. See the **IMPORTANT** note in *Build (for production)* above. Fix: add `.env` with `REACT_APP_BASE_URL=../../..`, rebuild, reinstall.

### 7. `manifest.webapp` base URL
`activities.dhis.href` must be `"*"`. DHIS2 replaces `*` with the instance base URL **when the app is installed through App Management**. If you copy files into the apps folder manually, `*` is not replaced. Always install by uploading the built zip via **App Management → Upload**. (Note: this only affects code paths that read the manifest; the header bar uses `REACT_APP_BASE_URL`, see #6.)

## Tracker API migration (DHIS2 2.41 / 2.42)

The legacy Tracker API (`/api/trackedEntityInstances`, `/api/events`, `/api/enrollments`, and the `/query` grid endpoint) is deprecated and returns **404** on 2.41+. All tracker calls were migrated to the **new Tracker API** (`/api/tracker/*`).

**Where:** `tracker-capture-app-core-main/src/api/DataApiClass.js` (rebuild the core with `yarn build` after editing so `dist/` updates), plus two direct delete calls in `src/components/Form/index.js`.

> [!WARNING]
> **Edit the copy of the core that `yarn link` actually resolves to.** `node_modules/tracker-capture-app-core` is a symlink to `~/.config/yarn/link/tracker-capture-app-core`, which in turn points at a checkout on disk. If more than one checkout of the core exists, it is easy to migrate one while the app keeps building against the other — the symptom is that the code looks migrated but the app still 404s. Verify with:
> ```
> readlink -f node_modules/tracker-capture-app-core
> grep -o -E "/api/(trackedEntityInstances|events|enrollments)" <that path>/dist/index.js | sort -u
> ```
> The second command must print nothing. `dist/` is what the app imports, so a source-only edit has no effect until the core is rebuilt.

There is no separate `TrackerApiClass` — an earlier partial attempt by that name was removed because nothing in the app referenced it, and it duplicated `DataApiClass` inconsistently. All tracker access goes through `dataApi`.

**Approach — a translation shim in `DataApiClass`** so the app's Redux/component code keeps using the legacy object shapes:

- **Reads** call `/api/tracker/trackedEntities` and convert the response back to the legacy shape:
  - `trackedEntities` → `trackedEntityInstances`, `trackedEntity` → `trackedEntityInstance`
  - `enrolledAt` → `enrollmentDate`, enrollment `occurredAt` → `incidentDate`
  - event `occurredAt` → `eventDate`, `scheduledAt` → `dueDate`
  - The list method also rebuilds the old grid format (`headers` / `rows` / `metaData.pager`) that `RegisteredTeiList` expects.
- **Query params:** `ou` → `orgUnits`, `ouMode` → `orgUnitMode`, `programStatus` → `enrollmentStatus`, `attribute=` filters → `filter=`, and sort keys `created` → `createdAt`, `lastupdated` → `updatedAt`. All four names verified against the 2.42 docs; `programStatus` is deprecated for removal in v43. Filter operators (`EQ`, `LIKE`) are case-insensitive.
- **Writes** go through the unified import endpoint `POST /api/tracker?async=false&importStrategy=CREATE_AND_UPDATE`, wrapping payloads as `{ trackedEntities | enrollments | events: [...] }`, renaming the same date fields in reverse, and stripping client-only flags (`isNew`, `isDirty`, `isSaved`).
- **Deletes** use `importStrategy=DELETE` via `dataApi.deleteTei()`, `dataApi.deleteEnrollment()`, `dataApi.deleteEvent()`.

**After migrating, smoke-test:** the registered list (load, paginate, sort, filter), search by program and by tracked entity type, opening a record, and create / save / complete / reopen / delete.

See [SMOKE_TEST.md](SMOKE_TEST.md) for the full checklist, with the failure mode to watch for on each step. The delete paths and the list pager do the most shape translation and are worth doing first.

## Recommended long-term fix

Upgrade `react-scripts` to v5 (or migrate off CRA, e.g. to Vite). This resolves issues #1–#3 at once and removes the need for the `--openssl-legacy-provider` flag.