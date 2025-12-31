-- AlterTable: Agregar campos de cancelación a trips
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT;
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

-- CreateIndex: Índices para campos de cancelación
CREATE INDEX IF NOT EXISTS "trips_cancelledAt_idx" ON "trips"("cancelledAt");
CREATE INDEX IF NOT EXISTS "trips_cancelledBy_idx" ON "trips"("cancelledBy");

