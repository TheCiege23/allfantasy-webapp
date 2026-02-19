-- Drop and recreate SportsDataCache with new schema
-- The production table has a different column structure that cannot be migrated in-place

DROP TABLE IF EXISTS "SportsDataCache";

CREATE TABLE "SportsDataCache" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SportsDataCache_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "SportsDataCache_expiresAt_idx" ON "SportsDataCache"("expiresAt");
