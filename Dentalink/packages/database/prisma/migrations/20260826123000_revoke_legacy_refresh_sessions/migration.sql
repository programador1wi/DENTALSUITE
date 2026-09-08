-- Refresh JWTs issued before the selector transition stored a tokenId that did
-- not match Session.id. They cannot be selected in constant time, so revoke
-- them once and require a new login instead of retaining the bcrypt scan.
UPDATE "Session"
SET "revokedAt" = CURRENT_TIMESTAMP
WHERE "revokedAt" IS NULL;
