-- AlterTable: Agregar campos de empresa y referente fiscal a DriverOnboarding
ALTER TABLE "driver_onboarding" ADD COLUMN IF NOT EXISTS "driver_type" "DriverType" NOT NULL DEFAULT 'INDEPENDENT';
ALTER TABLE "driver_onboarding" ADD COLUMN IF NOT EXISTS "company_name" TEXT;
ALTER TABLE "driver_onboarding" ADD COLUMN IF NOT EXISTS "company_tax_id" TEXT;
ALTER TABLE "driver_onboarding" ADD COLUMN IF NOT EXISTS "company_address" TEXT;
ALTER TABLE "driver_onboarding" ADD COLUMN IF NOT EXISTS "company_city" TEXT;
ALTER TABLE "driver_onboarding" ADD COLUMN IF NOT EXISTS "company_country" TEXT;
ALTER TABLE "driver_onboarding" ADD COLUMN IF NOT EXISTS "tax_id" TEXT;
ALTER TABLE "driver_onboarding" ADD COLUMN IF NOT EXISTS "tax_id_type" "TaxIdType";
ALTER TABLE "driver_onboarding" ADD COLUMN IF NOT EXISTS "bank_country" TEXT;

-- CreateEnum: Crear enum DriverType si no existe
DO $$ BEGIN
 CREATE TYPE "DriverType" AS ENUM('INDEPENDENT', 'COMPANY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: Crear enum TaxIdType si no existe
DO $$ BEGIN
 CREATE TYPE "TaxIdType" AS ENUM('RUT', 'CUIT', 'RFC', 'CPF', 'CNPJ', 'NIT', 'RUC', 'NIT_BOL', 'SIN', 'EIN', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
