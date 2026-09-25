# backend/scripts

Maintenance tooling for the Archive Engine. Everything here reads its configuration from
`backend/.env` (see `backend/.env.example`) through `dotenv` or `scriptEnv.js` — no script
carries a credential, and none should. This repository is public: anything committed here
is published.

Run from the repository root, e.g. `node backend/scripts/db_diag.js`.

## Scripts

| Script | Writes? | Target | Purpose |
| :--- | :--- | :--- | :--- |
| `backfill_normalized_titles.js` | yes (`--dry-run` to report only) | `MONGODB_URI` | One-shot backfill of `Quest.normalizedTitle`. See the procedure below. |
| `db_diag.js` | no | `MONGODB_URI` | Lists collections and document counts. Prints host/database only, never the URI. |
| `sync_metadata.js` | yes | `MONGODB_URI` | Fills `totalChapters` for records that have none, from AniList then Jikan. |
| `push_local_data.js` | yes (production) | local DB → production API | One-way copy of local records into production via the API. |
| `setup_admin.js` | yes | local API (`:5000`) | Creates/resets the Sovereign account through `/api/auth/upsert-sovereign`. |
| `sync_production.js` | yes (production) | production API | Same as `setup_admin.js`, against production. |
| `standardize_sovereign.js` | yes | `MONGODB_URI` | Resets the Sovereign password directly in the database and retires older sessions. |
| `test_guest_login.js` | creates a sandbox | local API | Smoke test: guest session issues a `GUEST` identity. |
| `test_guest_quests.js` | creates a sandbox | local API | Smoke test: a guest can read its seeded sandbox. |
| `test_tenancy.js` | creates a sandbox | local API | Smoke test: guest writes land in the guest's own database. |
| `test_sovereign_login.js` | no | local API | Smoke test: the Sovereign account authenticates. |
| `verify_perf.js` | no | production API (`--local` for `:5000`) | Times login and the batched `/api/boot/initial-data`. |
| `scriptEnv.js` | — | — | Shared: reads required variables and the session cookie. |

The local-API scripts need the backend running on port 5000 (`PORT=5000 node backend/server.js`).

Pruned in the 2026-09 pass (all unreferenced one-offs): `check_current_users`,
`check_metadata`, `check_prod_quests`, `extract_prod_titles`, `fetch_quest`,
`list_quests`, plus three that no longer ran — `inspect_quests` (read a `quests`
collection that does not exist), `scan_users` (wrong `.env` path, hard-coded user) and
`bulk_classify` (crashed on start; superseded by `POST /api/admin/bulk-classify`, the
profile's Re-Calibrate). `reset_sandbox` was removed as a hazard: it deleted every record
in `test_records` and then called `initDatabase` without a template, which only
deduplicates — the base-record seed it once reloaded no longer exists — so its sole effect
was to leave the guest template, and therefore every new guest sandbox, empty.

## Production backfill: `normalizedTitle`

Documents written before `normalizedTitle` existed have no value for it, so every quest
create still runs the legacy fallback scan in `POST /api/quests`. The backfill removes that
cost. It has **not** been run against production. It only ever sets `normalizedTitle`
(never deletes, never touches another field) and is idempotent, but it is still a write to
the live archive, so:

1. **Back up first.** Take an Atlas on-demand snapshot, or
   `mongodump --uri "<production MONGODB_URI>" --db akashic_records --out <dir>`.
2. **Dry run.** With the production `MONGODB_URI` in `backend/.env`:
   ```bash
   node backend/scripts/backfill_normalized_titles.js akashic_records --dry-run
   node backend/scripts/backfill_normalized_titles.js test_records --dry-run
   ```
   `test_records` is the guest template; backfilling it means every new sandbox is cloned
   with the field already set. Guest sandboxes (`gsb_*`) expire within two hours and do not
   need it, so `--all` is unnecessary.
3. **Read the collisions.** A collision is two titles that normalise to the same key. They
   are reported, not resolved. Decide on each before going further — resolving them with
   `POST /api/admin/purge-duplicates` deletes records and is not reversible.
4. **Run it.** The same two commands without `--dry-run`.
5. **Verify.** Re-run the dry run: it should report `would_update=0`.
6. **Later, optionally:** once the dry run is clean and purge-duplicates reports nothing,
   the index on `normalizedTitle` in `backend/models/Quest.js` can be made unique and the
   legacy fallback in `POST /api/quests` removed. That is a code change with its own review.

This needs the owner's production credentials and is the owner's to run.
