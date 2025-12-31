-- AlterEnum: Agregar STELLAR al enum PaymentMethod
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'STELLAR';

-- AlterTable: Agregar stellarAddress a users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stellarAddress" TEXT;

-- AlterTable: Agregar campos de pago Stellar a trips
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "paymentQrCode" TEXT;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "paymentAddress" TEXT;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "paymentExpiresAt" TIMESTAMP(3);
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "stellarTransactionId" TEXT;

