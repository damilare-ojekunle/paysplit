ALTER TABLE "User" ADD COLUMN "employer" TEXT;
ALTER TABLE "User" ADD COLUMN "monthlySalaryMinor" BIGINT;
ALTER TABLE "User" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "User" ADD CONSTRAINT user_salary_positive CHECK ("monthlySalaryMinor" IS NULL OR "monthlySalaryMinor" > 0);
