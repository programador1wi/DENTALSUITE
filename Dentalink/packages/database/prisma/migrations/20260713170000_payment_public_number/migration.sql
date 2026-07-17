ALTER TABLE "Payment"
ADD COLUMN "paymentNumber" INTEGER;

DO $$
DECLARE
  payment_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO payment_count FROM "Payment";
  IF payment_count > 900000 THEN
    RAISE EXCEPTION 'Cannot backfill six digit payment numbers: % payments exceed 900000 available numbers', payment_count;
  END IF;

  WITH ordered AS (
    SELECT
      "id",
      ROW_NUMBER() OVER (ORDER BY "paidAt", "createdAt", "id") AS row_number
    FROM "Payment"
    WHERE "paymentNumber" IS NULL
  )
  UPDATE "Payment" p
  SET "paymentNumber" = 100000 + ordered.row_number - 1
  FROM ordered
  WHERE p."id" = ordered."id";
END $$;

CREATE UNIQUE INDEX "Payment_paymentNumber_key" ON "Payment"("paymentNumber");
