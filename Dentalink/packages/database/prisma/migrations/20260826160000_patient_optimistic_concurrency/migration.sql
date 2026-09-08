-- Expand: add an optimistic-concurrency token without breaking legacy writers.
ALTER TABLE "Patient"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
