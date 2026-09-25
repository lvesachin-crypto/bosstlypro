# Architecture
- Self-hosted backend lives in `server/` (copy of the Express API, own npm package); database structure lives in root `schema.sql` — keep both in sync when tables change.
- Auth: own email/password login in server/ (bcrypt digests in lovable_legacy.auth_credentials, HMAC-signed httpOnly cookie via SESSION_SECRET); Clerk removed — no third-party auth dependency on VPS.
