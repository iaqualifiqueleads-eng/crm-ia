/*
  Warnings:

  - You are about to drop the column `days_overdue` on the `notifications` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `customers` ADD COLUMN `days_overdue` INTEGER NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `notifications` DROP COLUMN `days_overdue`;
