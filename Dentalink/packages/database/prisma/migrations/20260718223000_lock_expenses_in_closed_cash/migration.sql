-- Closed cash-session expenses are accounting evidence. Protect them from every direct write path,
-- including future generic endpoints, imports and administrative scripts.

CREATE OR REPLACE FUNCTION "prevent_locked_cash_expense_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  locked_session RECORD;
BEGIN
  SELECT register."publicNumber", register."status"
    INTO locked_session
  FROM "CashMovement" AS movement
  INNER JOIN "CashRegister" AS register ON register."id" = movement."cashRegisterId"
  WHERE movement."expenseId" = OLD."id"
    AND register."status" IN ('CLOSING', 'CLOSED', 'CANCELLED')
  ORDER BY
    CASE register."status"
      WHEN 'CLOSED' THEN 1
      WHEN 'CLOSING' THEN 2
      ELSE 3
    END
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'EXPENSE_LOCKED_BY_CASH_SESSION',
      DETAIL = format('cashSessionNumber=CAJ-%s;status=%s', lpad(locked_session."publicNumber"::text, 6, '0'), locked_session."status"),
      HINT = 'Create a later correction; do not rewrite the original expense or cash movement.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Expense_prevent_locked_update" ON "Expense";
CREATE TRIGGER "Expense_prevent_locked_update"
BEFORE UPDATE ON "Expense"
FOR EACH ROW
EXECUTE FUNCTION "prevent_locked_cash_expense_mutation"();

DROP TRIGGER IF EXISTS "Expense_prevent_locked_delete" ON "Expense";
CREATE TRIGGER "Expense_prevent_locked_delete"
BEFORE DELETE ON "Expense"
FOR EACH ROW
EXECUTE FUNCTION "prevent_locked_cash_expense_mutation"();
