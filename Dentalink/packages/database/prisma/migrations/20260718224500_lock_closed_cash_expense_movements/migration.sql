-- A closed cash session must remain immutable even when a writer bypasses Expense
-- and attempts to alter the linked CashMovement directly.

CREATE OR REPLACE FUNCTION "prevent_locked_cash_expense_movement_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  source_register RECORD;
  target_register RECORD;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD."expenseId" IS NOT NULL THEN
    SELECT register."publicNumber", register."status"
      INTO source_register
    FROM "CashRegister" AS register
    WHERE register."id" = OLD."cashRegisterId"
      AND register."status" IN ('CLOSING', 'CLOSED', 'CANCELLED');

    IF FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'EXPENSE_MOVEMENT_LOCKED_BY_CASH_SESSION',
        DETAIL = format('cashSessionNumber=CAJ-%s;status=%s', lpad(source_register."publicNumber"::text, 6, '0'), source_register."status"),
        HINT = 'Create a later correction; do not rewrite or delete the original cash movement.';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW."expenseId" IS NOT NULL THEN
    SELECT register."publicNumber", register."status"
      INTO target_register
    FROM "CashRegister" AS register
    WHERE register."id" = NEW."cashRegisterId"
      AND register."status" IN ('CLOSING', 'CLOSED', 'CANCELLED');

    IF FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'EXPENSE_MOVEMENT_LOCKED_BY_CASH_SESSION',
        DETAIL = format('cashSessionNumber=CAJ-%s;status=%s', lpad(target_register."publicNumber"::text, 6, '0'), target_register."status"),
        HINT = 'Create a later correction; do not attach a movement to a locked cash session.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "CashMovement_prevent_locked_expense_write" ON "CashMovement";
CREATE TRIGGER "CashMovement_prevent_locked_expense_write"
BEFORE INSERT OR UPDATE OR DELETE ON "CashMovement"
FOR EACH ROW
EXECUTE FUNCTION "prevent_locked_cash_expense_movement_mutation"();
