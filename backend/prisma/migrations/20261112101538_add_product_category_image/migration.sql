-- AlterTable
ALTER TABLE `Product` ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT 'General',
    ADD COLUMN `imageUrl` TEXT NULL;
