# Fix report

Record each future fix here with a date, a brief description, and any deployment action still required.

## 2026-11-13 — Security issues 1 and 2

| Topic | Fix |
| --- | --- |
| Tracked database secret | Removed `back_end/.env` from Git tracking while retaining the local file, ignored environment files, scrubbed the example, and required `DATABASE_URL` in production. Remote database credentials must still be rotated because earlier Git commits retain the old value. |
| Demo credentials in production setup | Moved PostgreSQL demo accounts into `supabase_seed_demo.sql` and blocked the MySQL demo seeder in production. The production schema now creates tables without known accounts. |
| Login sessions | Added random server-side sessions. The database stores a hash of the session token; production browsers receive a `Secure`, `HttpOnly`, `SameSite=Strict` cookie. Logout revokes the session. |
| Backend authorization | Added a default-deny access policy for API routes. It checks the current database user, administrator role, ownership, and conversation or application membership; client-supplied user IDs no longer establish identity. |
| Private data exposure | Reduced public profile and application data, protected identity documents and chat attachments with access checks, removed public upload serving, and disabled caching of private responses. The frontend no longer persists the signed-in user in local storage. |
| Supabase Data API | Enabled row-level security and revoked direct `anon` and `authenticated` access to application tables and compatibility views, so private data goes through the authorized backend API. |
| Deployment and verification | Added additive database migrations and security deployment instructions. Five backend tests, the frontend build, JavaScript syntax checks, and Git diff checks passed. Live database migration and production deployment were not performed. |

### Required rollout

Rotate the exposed database password, revoke the old credential, update deployment secrets, run the applicable migration files in `back_end/migrations/`, and deploy this code. Coordinate any Git history cleanup after rotation; removing the file from tracking does not remove old commits.

## 2026-11-13 — Security issues 3 and 4

| Topic | Fix |
| --- | --- |
| Wallet self-credit | Removed the client-controlled top-up API and its frontend form. Online funding is unavailable until a payment provider's signed confirmation is integrated; only the existing administrator-only audited adjustment can credit funds after manual verification. |
| Duplicate bounty settlement | Added a post-level database lock, an atomic single-use escrow settlement record, and a check for historical payouts. Completion, cancellation, refunds, takedowns, dispute decisions, and post creation now keep the balance and ledger changes in database transactions. The direct bounty-payment API and bypassing post-status endpoint were removed. |
| Existing data rollout | Added PostgreSQL migration 003 and MySQL migration 002 to create and backfill settlement records. Apply the appropriate migration before deploying; review historical transactions for earlier duplicate credits or missing escrow holds. |
| Validation | Backend syntax checks, the frontend production build, and Git whitespace checks passed. Database migrations and concurrent settlement behavior still need validation against a live database before production rollout. |

## 2026-11-13 — Security issues 5 and 6

| Topic | Fix |
| --- | --- |
| Identity documents | Added administrator checks inside the application list and file handlers. The list now sends only document IDs, types, and dates. New uploads stay in memory until stored in the private database, avoiding duplicate disk files. Legacy disk reads are confined to the expected directory, and document responses disable caching and restrict active content. |
| Private messages | Message history and attachment queries now join against the signed-in conversation member; inbox, unread, read-cursor, sender, and conversation creation use the session identity. Message pages are bounded, and responses use an attachment flag rather than exposing storage paths. |
| Account data | Added handler-level administrator checks for the user list and ownership checks for profile updates. Public profiles select only public columns from the database. |
| Existing data rollout | Added PostgreSQL migration 004 and MySQL migration 003, and updated fresh schemas. Apply the matching migration before deployment; inventory legacy identity document files and remove only verified duplicate copies. |
| Validation | Backend syntax checks, the frontend production build, and Git whitespace checks passed. Live database access checks and migration execution remain to be performed in the deployment environment. |

## 2026-11-13 — Security issues 7, 8, and 9

| Topic | Fix |
| --- | --- |
| Tutor approval bypass | Require an approved teacher application alongside tutor role and verification for post applications and session bookings, and recheck before acceptance. Administrator role and verification controls cannot grant tutor access without approval; reviews accept only pending applications. Older unapproved tutor accounts can submit documents for review. Demo tutor records now include explicit approvals. |
| Active upload content | Match uploaded file bytes, declared MIME type, and extension against an allowlist. Reject SVG, HTML, and mismatches. Store new chat attachments only in the private database; constrain and validate legacy disk files. Serve PDFs as downloads and raster images with fixed MIME types, `nosniff`, and a sandbox policy. Align browser file pickers with the allowed types and preserve attachment bytes when legacy conversations are merged. |
| Escrow and ledger consistency | Kept the earlier transactional post hold and one-time settlement design. Manual balance adjustments now validate exact cents and write a signed audit entry in the same locked transaction. Administrative post removal now closes the post while retaining its escrow and dispute history. |
| Rollout | No new schema migration is required. Re-review legacy tutors without an approved application, inventory old uploads, and reconcile historical administrator debit entries whose stored amount was positive. |
| Validation | Backend syntax checks, the frontend production build, and Git whitespace checks passed. Live database and concurrent transaction behavior still require deployment-environment verification. |
