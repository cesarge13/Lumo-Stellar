/**
 * Backend API para Operations
 * Manejo de usuarios, tokens, WhatsApp y registros
 */

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { PrismaClient } from '@prisma/client'

// Cargar variables de entorno desde el directorio backend
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Detectar si estamos dentro de Docker o fuera y ajustar DATABASE_URL
const adjustDatabaseUrl = () => {
  // Si DATABASE_URL ya está configurada explícitamente, usarla
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('@postgres:')) {
    return // Ya está configurada correctamente
  }

  // Detectar si estamos en Docker
  let isDocker = false
  try {
    fs.accessSync('/.dockerenv')
    isDocker = true
  } catch {
    isDocker = false
  }

  // Si estamos fuera de Docker y DATABASE_URL usa 'postgres' como host, cambiarlo a 'localhost'
  if (!isDocker && process.env.DATABASE_URL && process.env.DATABASE_URL.includes('@postgres:')) {
    process.env.DATABASE_URL = process.env.DATABASE_URL.replace('@postgres:', '@localhost:')
    console.log('🔍 Detectado: Backend corriendo fuera de Docker, usando "localhost" como host de base de datos')
  } else if (isDocker) {
    console.log('🔍 Detectado: Backend corriendo dentro de Docker, usando "postgres" como host de base de datos')
  }
}

// Ajustar DATABASE_URL antes de crear PrismaClient
adjustDatabaseUrl()

const app = express()
const prisma = new PrismaClient()
const PORT = Number(process.env.PORT) || 3000

// Inicializar root admin si no existe (solo en producción o si está configurado)
// Se ejecuta de forma asíncrona para no bloquear el inicio de la aplicación
if (process.env.NODE_ENV === 'production' || process.env.ROOT_ADMIN_EMAIL) {
  // Usar setTimeout para ejecutar después de que el servidor esté listo
  setTimeout(async () => {
    try {
      // Usar require para evitar problemas con rootDir de TypeScript
      const initRootAdminPath = path.join(__dirname, '../../scripts/init-root-admin')
      const { initRootAdmin } = await import(initRootAdminPath)
      await initRootAdmin()
    } catch (err: any) {
      // No bloquear el inicio de la aplicación si hay error
      console.warn('No se pudo inicializar root admin automáticamente:', err?.message || err)
      console.warn('Puedes crear el root admin manualmente usando: npx tsx scripts/create-root-admin.ts')
    }
  }, 2000) // Esperar 2 segundos para que Prisma esté listo
}

// Middleware
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:5173', 'http://localhost:5174', 'http://72.60.136.211:5174']

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true)
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(null, true) // Permitir todos en desarrollo
    }
  },
  credentials: true
}))
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Rutas
import authRoutes from './routes/authRoutes'
import adminRoutes from './routes/adminRoutes'
import currencyRoutes from './routes/currencyRoutes'
import pricingRoutes from './routes/pricingRoutes'
import tripRoutes from './routes/tripRoutes'
import driverRoutes from './routes/driverRoutes'
import driverVehicleRoutes from './routes/driverVehicleRoutes'
import notificationRoutes from './routes/notificationRoutes'
import driverAlertRoutes from './routes/driverAlertRoutes'
import onboardingRoutes from './routes/onboardingRoutes'
import uploadRoutes from './routes/uploadRoutes'
import paymentRoutes from './routes/paymentRoutes'
import walletRoutes from './routes/walletRoutes'
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/currency', currencyRoutes)
app.use('/api/pricing', pricingRoutes)
app.use('/api/trips', tripRoutes)
// Rutas específicas de driver deben ir ANTES de la ruta general /api/driver
app.use('/api/driver/vehicles', driverVehicleRoutes)
app.use('/api/driver/alerts', driverAlertRoutes)
app.use('/api/driver', driverRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/onboarding', onboardingRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/wallet', walletRoutes)
// app.use('/api/users', userRoutes)
// app.use('/api/whatsapp', whatsappRoutes)

// Manejo de errores
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

// Inicializar storage (con reintentos, no bloquea el inicio del servidor)
import { initializeStorage } from './services/storageService'
initializeStorage(5, 2000).then(() => {
  console.log('✅ Storage inicializado correctamente')
}).catch((error) => {
  // Este catch no debería ejecutarse ya que initializeStorage no lanza errores
  console.warn('⚠️  Storage no disponible:', error.message)
})

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT}`)
  console.log(`📊 Ambiente: ${process.env.NODE_ENV || 'development'}`)
  console.log(`🌐 Accesible desde: http://localhost:${PORT} y http://[IP]:${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM recibido, cerrando servidor...')
  await prisma.$disconnect()
  process.exit(0)
})

export { app, prisma }





