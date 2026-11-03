CREATE INDEX "Payment_voidedById_idx" ON "Payment"("voidedById");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_voidedById_fkey"
FOREIGN KEY ("voidedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
