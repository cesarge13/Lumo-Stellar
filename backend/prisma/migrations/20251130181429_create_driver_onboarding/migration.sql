-- CreateEnum: DriverOnboardingStatus
DO $$ BEGIN
 CREATE TYPE "DriverOnboardingStatus" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: DriverDocumentType
DO $$ BEGIN
 CREATE TYPE "DriverDocumentType" AS ENUM('NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'DRIVER_LICENSE_FRONT', 'DRIVER_LICENSE_BACK', 'PROOF_OF_ADDRESS', 'BANK_STATEMENT', 'VEHICLE_REGISTRATION', 'VEHICLE_INSURANCE', 'CRIMINAL_RECORD', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: DocumentStatus
DO $$ BEGIN
 CREATE TYPE "DocumentStatus" AS ENUM('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: DriverType (necesario para la tabla driver_onboarding)
DO $$ BEGIN
 CREATE TYPE "DriverType" AS ENUM('INDEPENDENT', 'COMPANY');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: TaxIdType (necesario para la tabla driver_onboarding)
DO $$ BEGIN
 CREATE TYPE "TaxIdType" AS ENUM('RUT', 'CUIT', 'RFC', 'CPF', 'CNPJ', 'NIT', 'RUC', 'NIT_BOL', 'SIN', 'EIN', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- CreateTable: driver_onboarding
CREATE TABLE IF NOT EXISTS "driver_onboarding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "DriverOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 5,
    
    -- Información personal
    "fullName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "nationalId" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    
    -- Tipo de conductor
    "driverType" "DriverType" NOT NULL DEFAULT 'INDEPENDENT',
    
    -- Información de empresa
    "companyName" TEXT,
    "companyTaxId" TEXT,
    "companyAddress" TEXT,
    "companyCity" TEXT,
    "companyCountry" TEXT,
    
    -- Referente fiscal
    "taxId" TEXT,
    "taxIdType" "TaxIdType",
    
    -- Información de licencia
    "licenseNumber" TEXT,
    "licenseExpiryDate" TIMESTAMP(3),
    "licenseIssuedBy" TEXT,
    
    -- Información bancaria
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountType" TEXT,
    "routingNumber" TEXT,
    "bankCountry" TEXT,
    
    -- Vehículo
    "vehicleId" TEXT,
    
    -- Revisión y aprobación
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "notes" TEXT,
    
    -- Metadata
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable: driver_documents
CREATE TABLE IF NOT EXISTS "driver_documents" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "type" "DriverDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "driver_onboarding_userId_idx" ON "driver_onboarding"("userId");
CREATE INDEX IF NOT EXISTS "driver_onboarding_status_idx" ON "driver_onboarding"("status");
CREATE INDEX IF NOT EXISTS "driver_onboarding_currentStep_idx" ON "driver_onboarding"("currentStep");
CREATE UNIQUE INDEX IF NOT EXISTS "driver_onboarding_userId_key" ON "driver_onboarding"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "driver_onboarding_vehicleId_key" ON "driver_onboarding"("vehicleId");

-- CreateIndex para driver_documents
CREATE INDEX IF NOT EXISTS "driver_documents_onboardingId_idx" ON "driver_documents"("onboardingId");
CREATE INDEX IF NOT EXISTS "driver_documents_type_idx" ON "driver_documents"("type");
CREATE INDEX IF NOT EXISTS "driver_documents_status_idx" ON "driver_documents"("status");

-- AddForeignKey
ALTER TABLE "driver_onboarding" ADD CONSTRAINT "driver_onboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "driver_onboarding" ADD CONSTRAINT "driver_onboarding_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey para driver_documents
ALTER TABLE "driver_documents" ADD CONSTRAINT "driver_documents_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "driver_onboarding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

