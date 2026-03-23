#!/bin/sh
set -e

echo "Running Prisma migrations..."

# Try migrate deploy first (handles fresh DB and already-migrated DB)
if npx prisma migrate deploy 2>&1; then
  echo "Migrations applied successfully."
  exit 0
fi

echo "migrate deploy failed — attempting to resolve for legacy db-push database..."

# Legacy DB created with `db push` has no _prisma_migrations table.
# Mark the initial migration as already applied (tables already exist).
npx prisma migrate resolve --applied 20260318000000_init

# Try deploying again (this will attempt the rename migration)
if npx prisma migrate deploy 2>&1; then
  echo "Migrations applied after resolving init baseline."
  exit 0
fi

# If that also failed, the rename was already applied (e.g. after force-reset).
# Mark it as applied too.
echo "Rename migration already applied — marking as resolved..."
npx prisma migrate resolve --applied 20260319000000_remove_legacy_auth

npx prisma migrate deploy
echo "All migrations resolved."
