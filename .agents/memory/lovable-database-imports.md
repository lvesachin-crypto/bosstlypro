---
name: Lovable database imports
description: Safe handling and compatibility rules for importing the original Supabase PostgreSQL backup.
---

Preserve imported Lovable/Supabase application tables in an isolated PostgreSQL schema rather than restoring over the active Replit schema. Never transplant Supabase passwords, sessions, refresh tokens, or confirmation/recovery tokens into Clerk. Safe identity metadata can be retained for email-based account claiming.

**Why:** The source backup contains Supabase platform schemas and was produced in PostgreSQL custom dump format 1.16, which older PostgreSQL 16 restore tools cannot read. Restoring it directly would collide with active tables and import incompatible authentication internals.

**How to apply:** Use PostgreSQL 17+ restore tooling to stage the archive, transfer public application tables into an isolated schema, compare every source/destination row count, and let Clerk users claim compatible profile/wallet records only after a server-side email match.

Legacy Supabase password digests are bcrypt and can be imported into Clerk without knowing plaintext passwords. Set the original Supabase UUID as Clerk's external ID so identity linkage remains deterministic.

**Why:** Requiring every returning user to sign up again would disconnect existing accounts and balances. Clerk accepts supported password digests during backend user creation.

**How to apply:** Import only email, bcrypt digest, and legacy UUID—never Supabase sessions, tokens, or recovery secrets. Clerk Development and Production are separate stores, so repeat a controlled import for Production when publishing.

After a password-digest migration, clear Clerk's per-user compromised-password flag for imported accounts only when preserving existing passwords is an explicit requirement.

**Why:** Clerk can accept a valid migrated bcrypt digest yet still block login and force a reset when the password appears in breach data.

**How to apply:** Use Clerk's supported `unsetPasswordCompromised` backend operation for migrated users identified by legacy external IDs. Explain that this weakens breach protection for those passwords.