/*
  Warnings:

  - You are about to drop the column `inProgress` on the `Order` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'aid', 'refunded');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('pending', 'delivered', 'failed');

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "inProgress",
ADD COLUMN     "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'unpaid';
