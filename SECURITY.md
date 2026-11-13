# Security and privacy model

## Secrets

- Set `DATABASE_URL` in the deployment provider's secret environment. Production startup fails when it is absent.
- Database TLS verifies the server certificate. If Node does not trust the provider's root, set `DATABASE_CA_CERT` to the provider's PEM root certificate in the deployment environment. SSL URL parameters are rejected or ignored so they cannot override the verified TLS configuration.
- Keep local `back_end/.env` untracked. Copy `back_end/.env.example` to create a local configuration.
- A database connection string and a populated local `.env` were previously committed. Rotate any real database passwords and revoke the old credentials. Removing a file from the current Git index does not erase old commits; coordinate history cleanup with everyone using this repository.
- Production database setup does not insert demo users. `supabase_seed_demo.sql` is only for an isolated development database because its accounts use a published default password.

## Sessions and access

- Login creates a 256-bit random session token. Only its SHA-256 hash is stored in `Auth_Sessions`. Browser sessions expire after 12 hours; opting into "Remember me" extends this to seven days.
- Production sends the token in a first-party `__Host-` cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, and `Path=/`. Logout deletes the server record and clears the cookie.
- The API reloads the user's role and admin flag from the database on each authenticated request. Routes deny access unless their policy explicitly allows it. IDs and admin attribution supplied by clients do not establish identity.
- Tutor applications and session bookings require a tutor role, verification, and an approved teacher application. Acceptance checks eligibility again. Role and verification admin controls cannot grant tutor access without that approval; only pending applications can be reviewed.
- The frontend keeps the current user in memory. It removes the identity object stored by older versions in `localStorage`.

## Privacy by default

- Public profiles omit email, phone number, student ID, wallet balance, and admin status. The account owner and administrators can see the full profile.
- Tutor identity documents are returned only through an administrator-authorized file endpoint. Application lists include document type and ID only. New uploads are held in memory until written to the private database, with no second disk copy. Legacy disk documents remain readable through a constrained path until operators clean up verified duplicates.
- Chat histories and attachments are queried through the signed-in user's conversation membership. Message lists return an attachment flag rather than an internal file path, with a bounded page size.
- New identity and chat uploads accept only a short list of raster images and PDFs where the filename extension, declared MIME type, and file signature agree. New attachments are stored in the private database without a second disk copy. Legacy files are read only from their expected directories and are checked before delivery. PDF responses are downloads; raster images use a fixed image MIME type, `nosniff`, and a sandboxed response.
- Account listings are restricted to administrators. Public profile queries select only public fields; profile updates use the authenticated user or administrator identity.
- Post application lists return every applicant only to the post owner or an administrator; other signed-in users see only their own application.
- Supabase tables have row-level security enabled, and the `anon` and `authenticated` Data API roles have no table or compatibility-view privileges. Browser requests must use the Express API.
- Private API responses and file downloads use `Cache-Control: no-store`.
- Username availability checks accept only normalized, valid handles and return only an availability boolean with `Cache-Control: no-store`. The database enforces case-insensitive uniqueness at registration, so a live availability result does not reserve a name. Existing accounts retain a null username until a future profile flow lets them choose one.

## Wallet and escrow

- The browser can read its wallet but cannot credit it. Self-service top-ups and the direct bounty-payment endpoint were removed. Online funding must remain unavailable until a payment provider's signed, verified confirmation is integrated. An authorized administrator can make an audited manual adjustment after independently verifying funds.
- A bounty is reserved with the post creation in one database transaction. Completion, cancellation, post closure or deletion, moderation, and dispute resolution all lock the post and use the same single-use `Escrow_Settlements` record before updating balances and ledger entries.
- Manual administrator adjustments use exact integer cents, a row lock, a single database transaction, and a signed ledger amount. Administrative post removal closes the post instead of deleting its financial context.
- Existing settlement transactions are backfilled into the settlement table by the migration. Review historical ledger entries separately for any duplicate payments or unreferenced holds created before this fix.

## Deployment

- Use a same-site frontend and API. The bundled Vercel deployment serves both on one origin. For separate services, use subdomains of the same site and set `FRONTEND_ORIGIN` to the exact HTTPS frontend origin. A frontend on an unrelated domain needs a same-origin API proxy; cross-site cookies are unreliable in privacy-focused browsers.
- Run the additive migrations in `back_end/migrations/` for an existing database before deploying this version. On Supabase, run PostgreSQL migrations 001 through 005 in order; on MySQL, run 001 through 004. Both fresh database setup scripts declare the session, escrow, document, attachment, and username columns. The application does not need permission to create these tables at runtime.
- After migration, inventory old `uploads/teacher_documents` files. Remove a file only after confirming its document row has `file_data`; retain and privately migrate any disk-only rows before removing their files.
- Review older tutor accounts that have a tutor role and verification but no approved application. They cannot take new work until their identity application is approved. Do not create approval records merely from their legacy role flags. The isolated demo seeds include explicit approvals for their sample tutors.
- Review historical administrator adjustments with positive amounts that represented debits; older ledger entries did not store the direction in the amount. Reconcile those records before relying on aggregate ledger calculations.
- Serve the API over HTTPS in production. Do not expose the upload directory as public static content.
