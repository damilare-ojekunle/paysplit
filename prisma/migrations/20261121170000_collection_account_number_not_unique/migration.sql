-- Flutterwave's sandbox issues the same virtual account number to every customer,
-- so a unique constraint blocks every user after the first. Keep it as a plain index.
DROP INDEX "CollectionAccount_provider_accountNumber_key";
CREATE INDEX "CollectionAccount_provider_accountNumber_idx" ON "CollectionAccount"("provider", "accountNumber");
