-- D1 Migration / Utility: Reset All Committee 2FA Credentials
-- Wipes all existing 2FA rows so officers cleanly re-enroll via in-portal setup upon their next login.
DELETE FROM "twoFactor";
UPDATE "user" SET "twoFactorEnabled" = 0 WHERE role >= 1 OR email LIKE '%@kclmc.org';
