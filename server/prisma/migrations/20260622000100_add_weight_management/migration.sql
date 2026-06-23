ALTER TABLE `users`
  ADD COLUMN `heightCm` DECIMAL(5, 2) NULL,
  ADD COLUMN `targetWeightKg` DECIMAL(5, 2) NULL,
  ADD COLUMN `weightUnit` VARCHAR(8) NOT NULL DEFAULT 'kg';

CREATE TABLE `weight_records` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `weightKg` DECIMAL(5, 2) NOT NULL,
  `measuredAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `weight_records_userId_measuredAt_idx`(`userId`, `measuredAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `weight_records`
  ADD CONSTRAINT `weight_records_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
