-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` ENUM('MANAGER', 'SUPERVISOR', 'SALESPERSON') NOT NULL DEFAULT 'SALESPERSON',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `phone` VARCHAR(30) NULL,
    `avatarUrl` VARCHAR(500) NULL,
    `supervisorId` VARCHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_role_idx`(`role`),
    INDEX `users_supervisorId_idx`(`supervisorId`),
    INDEX `users_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `userAgent` VARCHAR(500) NULL,
    `ipAddress` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `refresh_tokens_userId_idx`(`userId`),
    INDEX `refresh_tokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(36) NOT NULL,
    `companyName` VARCHAR(200) NOT NULL,
    `tradeName` VARCHAR(200) NULL,
    `cnpj` VARCHAR(20) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(30) NULL,
    `whatsapp` VARCHAR(30) NULL,
    `address` VARCHAR(255) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(50) NULL,
    `zipCode` VARCHAR(20) NULL,
    `contactName` VARCHAR(150) NULL,
    `contactRole` VARCHAR(100) NULL,
    `status` ENUM('LEAD', 'PROSPECT', 'ACTIVE', 'AT_RISK', 'CHURNED') NOT NULL DEFAULT 'LEAD',
    `origin` VARCHAR(100) NULL,
    `tags` TEXT NULL,
    `notes` TEXT NULL,
    `salespersonId` VARCHAR(36) NOT NULL,
    `forecastMode` ENUM('AUTO', 'MANUAL') NOT NULL DEFAULT 'AUTO',
    `forecastIntervalDays` INTEGER NULL,
    `manualIntervalDays` INTEGER NULL,
    `lastOrderAt` DATETIME(3) NULL,
    `nextReplenishmentAt` DATETIME(3) NULL,
    `daysOverdue` INTEGER NOT NULL DEFAULT 0,
    `totalOrders` INTEGER NOT NULL DEFAULT 0,
    `totalRevenue` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `averageTicket` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `customers_cnpj_key`(`cnpj`),
    INDEX `customers_salespersonId_idx`(`salespersonId`),
    INDEX `customers_status_idx`(`status`),
    INDEX `customers_nextReplenishmentAt_idx`(`nextReplenishmentAt`),
    INDEX `customers_daysOverdue_idx`(`daysOverdue`),
    INDEX `customers_deletedAt_idx`(`deletedAt`),
    INDEX `customers_companyName_idx`(`companyName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_transfers` (
    `id` VARCHAR(36) NOT NULL,
    `customerId` VARCHAR(36) NOT NULL,
    `fromSalespersonId` VARCHAR(36) NULL,
    `toSalespersonId` VARCHAR(36) NOT NULL,
    `transferredById` VARCHAR(36) NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customer_transfers_customerId_idx`(`customerId`),
    INDEX `customer_transfers_fromSalespersonId_idx`(`fromSalespersonId`),
    INDEX `customer_transfers_toSalespersonId_idx`(`toSalespersonId`),
    INDEX `customer_transfers_transferredById_idx`(`transferredById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_events` (
    `id` VARCHAR(36) NOT NULL,
    `customerId` VARCHAR(36) NOT NULL,
    `authorId` VARCHAR(36) NULL,
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `metadata` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customer_events_customerId_idx`(`customerId`),
    INDEX `customer_events_authorId_idx`(`authorId`),
    INDEX `customer_events_type_idx`(`type`),
    INDEX `customer_events_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(36) NOT NULL,
    `customerId` VARCHAR(36) NOT NULL,
    `createdById` VARCHAR(36) NOT NULL,
    `orderNumber` VARCHAR(50) NULL,
    `orderedAt` DATETIME(3) NOT NULL,
    `channel` ENUM('WHATSAPP', 'PHONE', 'EMAIL', 'IN_PERSON', 'ECOMMERCE', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `totalAmount` DECIMAL(14, 2) NOT NULL,
    `totalVolume` DECIMAL(14, 3) NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'BRL',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `orders_customerId_idx`(`customerId`),
    INDEX `orders_createdById_idx`(`createdById`),
    INDEX `orders_orderedAt_idx`(`orderedAt`),
    INDEX `orders_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` VARCHAR(36) NOT NULL,
    `orderId` VARCHAR(36) NOT NULL,
    `productSku` VARCHAR(50) NULL,
    `productName` VARCHAR(200) NOT NULL,
    `quantity` DECIMAL(14, 3) NOT NULL,
    `unit` VARCHAR(10) NOT NULL DEFAULT 'UN',
    `unitPrice` DECIMAL(14, 2) NOT NULL,
    `subtotal` DECIMAL(14, 2) NOT NULL,

    INDEX `order_items_orderId_idx`(`orderId`),
    INDEX `order_items_productSku_idx`(`productSku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `type` ENUM('CALL', 'EMAIL', 'MEETING', 'FOLLOW_UP', 'VISIT', 'REPLENISHMENT_DUE', 'REPLENISHMENT_OVERDUE') NOT NULL DEFAULT 'FOLLOW_UP',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('PENDING', 'IN_PROGRESS', 'DONE', 'CANCELED') NOT NULL DEFAULT 'PENDING',
    `dueDate` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `assigneeId` VARCHAR(36) NOT NULL,
    `createdById` VARCHAR(36) NULL,
    `customerId` VARCHAR(36) NULL,
    `isAutomatic` BOOLEAN NOT NULL DEFAULT false,
    `automationRef` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `tasks_assigneeId_idx`(`assigneeId`),
    INDEX `tasks_customerId_idx`(`customerId`),
    INDEX `tasks_status_idx`(`status`),
    INDEX `tasks_dueDate_idx`(`dueDate`),
    INDEX `tasks_priority_idx`(`priority`),
    INDEX `tasks_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `interactions` (
    `id` VARCHAR(36) NOT NULL,
    `customerId` VARCHAR(36) NOT NULL,
    `type` ENUM('CALL', 'EMAIL', 'MEETING', 'WHATSAPP', 'WHATSAPP_AI', 'NOTE', 'SYSTEM') NOT NULL,
    `direction` ENUM('OUTBOUND', 'INBOUND', 'INTERNAL') NOT NULL DEFAULT 'OUTBOUND',
    `status` ENUM('PENDING', 'SENT', 'DELIVERED', 'READ', 'REPLIED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `content` LONGTEXT NOT NULL,
    `channel` VARCHAR(50) NULL,
    `templateId` VARCHAR(36) NULL,
    `automationRef` VARCHAR(100) NULL,
    `authorId` VARCHAR(36) NULL,
    `externalId` VARCHAR(191) NULL,
    `scheduledAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `repliedAt` DATETIME(3) NULL,
    `failedReason` VARCHAR(500) NULL,
    `jsonMetadata` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `interactions_customerId_idx`(`customerId`),
    INDEX `interactions_authorId_idx`(`authorId`),
    INDEX `interactions_type_idx`(`type`),
    INDEX `interactions_status_idx`(`status`),
    INDEX `interactions_externalId_idx`(`externalId`),
    INDEX `interactions_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_templates` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `trigger` ENUM('FIRST_CONTACT', 'REPLENISHMENT_REMINDER', 'REPLENISHMENT_OVERDUE', 'RETRY_1H', 'RETRY_3H', 'RETRY_24H', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM',
    `body` TEXT NOT NULL,
    `aiInstructions` TEXT NULL,
    `channel` VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `message_templates_trigger_idx`(`trigger`),
    INDEX `message_templates_isActive_idx`(`isActive`),
    INDEX `message_templates_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `automation_rules` (
    `id` VARCHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `config` LONGTEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `automation_rules_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(36) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `severity` ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'INFO',
    `title` VARCHAR(200) NOT NULL,
    `message` TEXT NOT NULL,
    `linkUrl` VARCHAR(500) NULL,
    `customerId` VARCHAR(36) NULL,
    `taskId` VARCHAR(36) NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_idx`(`userId`),
    INDEX `notifications_readAt_idx`(`readAt`),
    INDEX `notifications_customerId_idx`(`customerId`),
    INDEX `notifications_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_supervisorId_fkey` FOREIGN KEY (`supervisorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_salespersonId_fkey` FOREIGN KEY (`salespersonId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_transfers` ADD CONSTRAINT `customer_transfers_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_events` ADD CONSTRAINT `customer_events_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_events` ADD CONSTRAINT `customer_events_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interactions` ADD CONSTRAINT `interactions_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interactions` ADD CONSTRAINT `interactions_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `message_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `interactions` ADD CONSTRAINT `interactions_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_templates` ADD CONSTRAINT `message_templates_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
