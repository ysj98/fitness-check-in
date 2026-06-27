CREATE TABLE `users` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `openid` VARCHAR(191) NOT NULL,
  `nickname` VARCHAR(191) NOT NULL DEFAULT '运动达人',
  `avatarUrl` VARCHAR(191) NULL,
  `gender` VARCHAR(191) NULL,
  `birthday` VARCHAR(191) NULL,
  `dailyGoal` INTEGER NOT NULL DEFAULT 1,
  `heightCm` DECIMAL(5, 2) NULL,
  `targetWeightKg` DECIMAL(5, 2) NULL,
  `weightUnit` VARCHAR(8) NOT NULL DEFAULT 'kg',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `users_openid_key`(`openid`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `check_ins` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `checkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `isBackfill` BOOLEAN NOT NULL,
  `backfillReason` VARCHAR(32) NULL,
  `sportType` VARCHAR(16) NOT NULL,
  `durationMinutes` INTEGER NOT NULL,

  INDEX `check_ins_userId_checkedAt_idx`(`userId`, `checkedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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

ALTER TABLE `check_ins`
  ADD CONSTRAINT `check_ins_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `weight_records`
  ADD CONSTRAINT `weight_records_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
