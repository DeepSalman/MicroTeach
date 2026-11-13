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
