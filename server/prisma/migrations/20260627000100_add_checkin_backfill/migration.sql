ALTER TABLE `check_ins`
  ADD COLUMN `isBackfill` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `backfillReason` VARCHAR(32) NULL;
