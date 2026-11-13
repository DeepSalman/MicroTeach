# Security and privacy model

## Secrets

- Set `DATABASE_URL` in the deployment provider's secret environment. Production startup fails when it is absent.
- Keep local `back_end/.env` untracked. Copy `back_end/.env.example` to create a local configuration.
- A database connection string and a populated local `.env` were previously committed. Rotate any real database passwords and revoke the old credentials. Removing a file from the current Git index does not erase old commits; coordinate history cleanup with everyone using this repository.
- Production database setup does not insert demo users. `supabase_seed_demo.sql` is only for an isolated development database because its accounts use a published default password.

## Sessions and access

- Login creates a 256-bit random session token. Only its SHA-256 hash is stored in `Auth_Sessions`. Browser sessions expire after 12 hours; opting into "Remember me" extends this to seven days.
- Production sends the token in a first-party `__Host-` cookie with `Secure`, `HttpOnly`, `SameSite=Strict`, and `Path=/`. Logout deletes the server record and clears the cookie.
- The API reloads the user's role and admin flag from the database on each authenticated request. Routes deny access unless their policy explicitly allows it. IDs and admin attribution supplied by clients do not establish identity.
- The frontend keeps the current user in memory. It removes the identity object stored by older versions in `localStorage`.

## Privacy by default

- Public profiles omit email, phone number, student ID, wallet balance, and admin status. The account owner and administrators can see the full profile.
- Tutor identity documents are returned only through an administrator-authorized file endpoint. Application lists contain document metadata rather than image data.
- Chat attachments are returned only through a conversation-member endpoint. Message lists contain attachment metadata rather than embedded file data.
- Post application lists return every applicant only to the post owner or an administrator; other signed-in users see only their own application.
- Supabase tables have row-level security enabled, and the `anon` and `authenticated` Data API roles have no table or compatibility-view privileges. Browser requests must use the Express API.
- Private API responses and file downloads use `Cache-Control: no-store`.

## Deployment

- Use a same-site frontend and API. The bundled Vercel deployment serves both on one origin. For separate services, use subdomains of the same site and set `FRONTEND_ORIGIN` to the exact HTTPS frontend origin. A frontend on an unrelated domain needs a same-origin API proxy; cross-site cookies are unreliable in privacy-focused browsers.
- Run the additive session migration in `back_end/migrations/` for an existing database before deploying this version. On Supabase, also run `002_lock_down_supabase_api.sql`. Both fresh database setup scripts declare `Auth_Sessions`. The application does not need permission to create tables at runtime.
- Serve the API over HTTPS in production. Do not expose the upload directory as public static content.
