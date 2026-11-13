# Supabase database root certificate

`supabase-prod-ca-2021.crt` is Supabase's public Root 2021 CA, used to verify database TLS for `*.pooler.supabase.com` and `db.*.supabase.co` hosts. It is a trust certificate, not a secret.

- Source: `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`
- SHA-256 fingerprint: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`
- Expires: 2031-04-26

Before replacing it, download the current certificate from the project's Supabase Database Settings and verify its fingerprint. The `DATABASE_CA_CERT` environment variable can override this file when the provider rotates its CA.
