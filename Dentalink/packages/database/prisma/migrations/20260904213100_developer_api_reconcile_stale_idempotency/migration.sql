-- Records left by the previous split-commit implementation cannot prove
-- whether their business write committed. Never authorize a replay from age.
UPDATE "ApiIdempotencyRecord"
SET status = 'UNCERTAIN', "lockedUntil" = NOW()
WHERE status = 'PROCESSING' AND "lockedUntil" <= NOW();
