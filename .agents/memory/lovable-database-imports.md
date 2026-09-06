---
name: Lovable database imports
description: Safe handling and compatibility rules for importing the original Supabase PostgreSQL backup.
---

Preserve imported Lovable/Supabase application tables in an isolated PostgreSQL schema rather than restoring over the active Replit schema. Never transplant Supabase passwords, sessions, refresh tokens, or confirmation/recovery tokens into Clerk. Safe identity metadata can be retained for email-based account claiming.

**Why:** The source backup contains Supabase platform schemas and was produced in PostgreSQL custom dump format 1.16, which older PostgreSQL 16 restore tools cannot read. Restoring it directly would collide with active tables and import incompatible authentication internals.

**How to apply:** Use PostgreSQL 17+ restore tooling to stage the archive, transfer public application tables into an isolated schema, compare every source/destination row count, and let Clerk users claim compatible profile/wallet records only after a server-side email match.