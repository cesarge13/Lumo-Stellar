-- Migración segura: Agregar activeRole y tabla user_profiles
-- Esta migración NO causa pérdida de datos

-- 1. Agregar columna activeRole a users (opcional, sin pérdida de datos)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'activeRole'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "activeRole" "UserRole";
    CREATE INDEX IF NOT EXISTS "users_activeRole_idx" ON "users"("activeRole");
  END IF;
END $$;

-- 2. Crear tabla user_profiles (nueva tabla, sin pérdida de datos)
CREATE TABLE IF NOT EXISTS "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "avatar" TEXT,
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- 3. Agregar foreign key constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_profiles_userId_fkey'
  ) THEN
    ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Crear índices
CREATE INDEX IF NOT EXISTS "user_profiles_userId_idx" ON "user_profiles"("userId");
CREATE INDEX IF NOT EXISTS "user_profiles_role_idx" ON "user_profiles"("role");
CREATE INDEX IF NOT EXISTS "user_profiles_isActive_idx" ON "user_profiles"("isActive");

-- 5. Crear unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_userId_role_key" ON "user_profiles"("userId", "role");

