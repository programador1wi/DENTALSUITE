-- Financial integrity check constraints
ALTER TABLE "Payment"
ADD CONSTRAINT "chk_payment_amount_non_negative" CHECK ("amount" >= 0) NOT VALID,
ADD CONSTRAINT "chk_payment_gross_amount_non_negative" CHECK ("grossAmount" >= 0) NOT VALID,
ADD CONSTRAINT "chk_payment_net_amount_non_negative" CHECK ("netAmount" >= 0) NOT VALID;

ALTER TABLE "CashMovement"
ADD CONSTRAINT "chk_cash_movement_amount_non_negative" CHECK ("amount" >= 0) NOT VALID;

ALTER TABLE "TreatmentPlanItem"
ADD CONSTRAINT "chk_treatment_plan_item_total_non_negative" CHECK ("total" >= 0) NOT VALID,
ADD CONSTRAINT "chk_treatment_plan_item_unit_price_non_negative" CHECK ("unitPrice" >= 0) NOT VALID;

ALTER TABLE "Refund"
ADD CONSTRAINT "chk_refund_amount_non_negative" CHECK ("amount" >= 0) NOT VALID;

ALTER TABLE "Installment"
ADD CONSTRAINT "chk_installment_amount_non_negative" CHECK ("amount" >= 0) NOT VALID,
ADD CONSTRAINT "chk_installment_paid_amount_non_negative" CHECK ("paidAmount" >= 0) NOT VALID;

ALTER TABLE "Payment" VALIDATE CONSTRAINT "chk_payment_amount_non_negative";
ALTER TABLE "Payment" VALIDATE CONSTRAINT "chk_payment_gross_amount_non_negative";
ALTER TABLE "Payment" VALIDATE CONSTRAINT "chk_payment_net_amount_non_negative";
ALTER TABLE "CashMovement" VALIDATE CONSTRAINT "chk_cash_movement_amount_non_negative";
ALTER TABLE "TreatmentPlanItem" VALIDATE CONSTRAINT "chk_treatment_plan_item_total_non_negative";
ALTER TABLE "TreatmentPlanItem" VALIDATE CONSTRAINT "chk_treatment_plan_item_unit_price_non_negative";
ALTER TABLE "Refund" VALIDATE CONSTRAINT "chk_refund_amount_non_negative";
ALTER TABLE "Installment" VALIDATE CONSTRAINT "chk_installment_amount_non_negative";
ALTER TABLE "Installment" VALIDATE CONSTRAINT "chk_installment_paid_amount_non_negative";
