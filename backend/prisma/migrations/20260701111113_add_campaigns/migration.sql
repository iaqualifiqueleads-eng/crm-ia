-- CreateTable campaigns
CREATE TABLE `campaigns` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `status` ENUM('DRAFT', 'RUNNING', 'PAUSED', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'RUNNING',
    `filters` LONGTEXT NOT NULL,
    `templateId` VARCHAR(36) NOT NULL,
    `totalCustomers` INTEGER NOT NULL DEFAULT 0,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `skippedCount` INTEGER NOT NULL DEFAULT 0,
    `createdById` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `executedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,

    INDEX `campaigns_status_idx`(`status`),
    INDEX `campaigns_createdById_idx`(`createdById`),
    INDEX `campaigns_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable campaign_customers
CREATE TABLE `campaign_customers` (
    `id` VARCHAR(36) NOT NULL,
    `campaignId` VARCHAR(36) NOT NULL,
    `customerId` VARCHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `jobId` VARCHAR(100) NULL,
    `sentAt` DATETIME(3) NULL,
    `failedReason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `campaign_customers_campaignId_idx`(`campaignId`),
    INDEX `campaign_customers_customerId_idx`(`customerId`),
    INDEX `campaign_customers_status_idx`(`status`),
    UNIQUE INDEX `campaign_customers_campaignId_customerId_key`(`campaignId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey campaigns -> message_templates
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_templateId_fkey`
    FOREIGN KEY (`templateId`) REFERENCES `message_templates`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey campaigns -> users
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey campaign_customers -> campaigns
ALTER TABLE `campaign_customers` ADD CONSTRAINT `campaign_customers_campaignId_fkey`
    FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey campaign_customers -> customers
ALTER TABLE `campaign_customers` ADD CONSTRAINT `campaign_customers_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
