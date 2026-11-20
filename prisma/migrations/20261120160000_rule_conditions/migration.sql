CREATE TYPE "RuleCondition" AS ENUM ('ANY', 'MIN_AMOUNT', 'SENDER');
CREATE TYPE "RuleMode" AS ENUM ('EACH_INFLOW', 'MONTHLY_TARGET');
ALTER TABLE "SplitRule" ADD COLUMN "conditionType" "RuleCondition" NOT NULL DEFAULT 'ANY';
ALTER TABLE "SplitRule" ADD COLUMN "conditionMinMinor" BIGINT;
ALTER TABLE "SplitRule" ADD COLUMN "conditionSender" TEXT;
ALTER TABLE "SplitRule" ADD COLUMN "executionMode" "RuleMode" NOT NULL DEFAULT 'EACH_INFLOW';
ALTER TABLE "SplitRule" ADD COLUMN "monthlyTargetMinor" BIGINT;
ALTER TABLE "Payin" ADD COLUMN "senderName" TEXT;
-- Each condition/mode carries exactly the value it needs.
ALTER TABLE "SplitRule" ADD CONSTRAINT split_rule_condition CHECK (
  ("conditionType" = 'ANY') OR
  ("conditionType" = 'MIN_AMOUNT' AND "conditionMinMinor" > 0) OR
  ("conditionType" = 'SENDER' AND length(trim("conditionSender")) > 0));
ALTER TABLE "SplitRule" ADD CONSTRAINT split_rule_mode CHECK (
  ("executionMode" = 'EACH_INFLOW') OR ("executionMode" = 'MONTHLY_TARGET' AND "monthlyTargetMinor" > 0));
