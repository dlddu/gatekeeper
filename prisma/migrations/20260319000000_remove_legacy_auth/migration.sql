-- Migration: remove_legacy_auth
-- Removes passwordHash field and renames oidcSub to authentikUid

-- Drop passwordHash column
ALTER TABLE "User" DROP COLUMN "passwordHash";

-- Rename oidcSub to authentikUid
ALTER TABLE "User" RENAME COLUMN "oidcSub" TO "authentikUid";
