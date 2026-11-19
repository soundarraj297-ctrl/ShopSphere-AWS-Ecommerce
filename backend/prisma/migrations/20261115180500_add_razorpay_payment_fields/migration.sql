ALTER TABLE `Order`
ADD COLUMN `paymentStatus` VARCHAR(191) NULL,
ADD COLUMN `razorpayOrderId` VARCHAR(191) NULL,
ADD COLUMN `razorpayPaymentId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Order_razorpayOrderId_key`
ON `Order`(`razorpayOrderId`);

CREATE UNIQUE INDEX `Order_razorpayPaymentId_key`
ON `Order`(`razorpayPaymentId`);