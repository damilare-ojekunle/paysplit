-- Ledger entries are immutable: corrections are new reversing transactions.
CREATE OR REPLACE FUNCTION ledger_entry_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entry_no_update BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION ledger_entry_immutable();

-- Every ledger transaction must balance (sum of signed entries = 0), checked at commit.
CREATE OR REPLACE FUNCTION ledger_txn_balanced() RETURNS trigger AS $$
DECLARE total NUMERIC;
BEGIN
  SELECT COALESCE(SUM("amountMinor"), 0) INTO total FROM "LedgerEntry" WHERE "transactionId" = NEW."transactionId";
  IF total <> 0 THEN
    RAISE EXCEPTION 'Ledger transaction % is unbalanced (sum=%)', NEW."transactionId", total;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entry_balanced AFTER INSERT ON "LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ledger_txn_balanced();

-- Rules: exactly one destination matching destinationType, valid allocation values.
ALTER TABLE "SplitRule" ADD CONSTRAINT split_rule_destination CHECK (
  ("destinationType" = 'WALLET' AND "walletId" IS NOT NULL AND "beneficiaryId" IS NULL) OR
  ("destinationType" = 'BENEFICIARY' AND "beneficiaryId" IS NOT NULL AND "walletId" IS NULL));
ALTER TABLE "SplitRule" ADD CONSTRAINT split_rule_value CHECK (
  ("method" = 'FIXED' AND "amountMinor" > 0 AND "percentBps" IS NULL) OR
  ("method" = 'PERCENT' AND "percentBps" BETWEEN 1 AND 10000 AND "amountMinor" IS NULL));
ALTER TABLE "SplitRule" ADD CONSTRAINT split_rule_priority CHECK ("priority" BETWEEN 1 AND 10);
ALTER TABLE "Payin" ADD CONSTRAINT payin_positive CHECK ("amountMinor" > 0);
ALTER TABLE "Transfer" ADD CONSTRAINT transfer_positive CHECK ("amountMinor" > 0);
