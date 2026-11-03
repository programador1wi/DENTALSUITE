-- Repair drift from an already-applied reconciliation migration whose local file
-- later gained this field. Keep the repair additive and safe to re-run manually.
ALTER TABLE "PaymentMethod"
  ADD COLUMN IF NOT EXISTS "includeInGraphicalReports" BOOLEAN NOT NULL DEFAULT true;
