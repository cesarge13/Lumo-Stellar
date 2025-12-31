/**
 * Rutas para conductores
 */

import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/requireRole'
import { UserRole } from '@prisma/client'
import {
  getAvailableTrips,
  getDriverTrips,
  getTripDetailsForDriver,
  acceptTrip,
  rejectTrip,
  startTrip,
  completeTrip,
} from '../services/driverService'
import { cancelTrip } from '../services/tripService'

const router = Router()

// Todas las rutas requieren autenticación y rol de conductor
router.use(authenticate)
router.use(requireRole(UserRole.DRIVER))

/**
 * GET /api/driver/trips/available
 * Obtiene viajes disponibles para el conductor
 */
router.get('/trips/available', async (req, res) => {
  try {
    const driverId = req.user!.id
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const vehicleType = req.query.vehicleType as string | undefined
    const maxDistance = req.query.maxDistance ? parseFloat(req.query.maxDistance as string) : undefined

    const result = await getAvailableTrips(driverId, {
      page,
      limit,
      vehicleType,
      maxDistance,
    })

    res.json(result)
  } catch (error: any) {
    console.error('Error getting available trips:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * GET /api/driver/trips
 * Obtiene los viajes del conductor
 */
router.get('/trips', async (req, res) => {
  try {
    const driverId = req.user!.id
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const status = req.query.status as string | string[] | undefined

    const result = await getDriverTrips(driverId, {
      page,
      limit,
      status: status as any,
    })

    res.json(result)
  } catch (error: any) {
    console.error('Error getting driver trips:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * GET /api/driver/trips/:id
 * Obtiene detalles de un viaje específico
 */
router.get('/trips/:id', async (req, res) => {
  try {
    const driverId = req.user!.id
    const tripId = req.params.id

    const trip = await getTripDetailsForDriver(tripId, driverId)

    res.json(trip)
  } catch (error: any) {
    console.error('Error getting trip details:', error)
    if (error.message === 'Viaje no encontrado o no disponible') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message,
      })
    }
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * POST /api/driver/trips/:id/accept
 * Acepta un viaje
 */
router.post('/trips/:id/accept', async (req, res) => {
  try {
    const driverId = req.user!.id
    const tripId = req.params.id
    const { vehicleId, alertId } = req.body

    const trip = await acceptTrip(tripId, driverId, vehicleId, alertId)

    res.json(trip)
  } catch (error: any) {
    console.error('Error accepting trip:', error)
    res.status(400).json({
      error: 'Bad Request',
      message: error.message,
    })
  }
})

/**
 * POST /api/driver/trips/:id/reject
 * Rechaza un viaje
 */
router.post('/trips/:id/reject', async (req, res) => {
  try {
    const driverId = req.user!.id
    const tripId = req.params.id
    const { reason } = req.body

    const result = await rejectTrip(tripId, driverId, reason)

    res.json(result)
  } catch (error: any) {
    console.error('Error rejecting trip:', error)
    res.status(400).json({
      error: 'Bad Request',
      message: error.message,
    })
  }
})

/**
 * POST /api/driver/trips/:id/start
 * Inicia un viaje
 * Requiere: PIN o QR code, y opcionalmente GPS del conductor
 */
router.post('/trips/:id/start', async (req, res) => {
  try {
    const driverId = req.user!.id
    const tripId = req.params.id
    const { pin, qrCode, driverLatitude, driverLongitude } = req.body

    if (!pin && !qrCode) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Debes proporcionar un PIN o escanear el código QR',
      })
    }

    const trip = await startTrip(tripId, driverId, {
      pin,
      qrCode,
      driverLatitude: driverLatitude ? parseFloat(driverLatitude) : undefined,
      driverLongitude: driverLongitude ? parseFloat(driverLongitude) : undefined,
    })

    res.json(trip)
  } catch (error: any) {
    console.error('Error starting trip:', error)
    res.status(400).json({
      error: 'Bad Request',
      message: error.message,
    })
  }
})

/**
 * POST /api/driver/trips/:id/complete
 * Completa un viaje
 * Opcionalmente verifica GPS (conductor cerca del destino)
 * Genera automáticamente el QR de pago Stellar usando la dirección del conductor
 */
router.post('/trips/:id/complete', async (req, res) => {
  try {
    const driverId = req.user!.id
    const tripId = req.params.id
    const { driverLatitude, driverLongitude } = req.body

    const trip = await completeTrip(tripId, driverId, {
      driverLatitude: driverLatitude ? parseFloat(driverLatitude) : undefined,
      driverLongitude: driverLongitude ? parseFloat(driverLongitude) : undefined,
    })

    res.json(trip)
  } catch (error: any) {
    console.error('Error completing trip:', error)
    res.status(400).json({
      error: 'Bad Request',
      message: error.message,
    })
  }
})

/**
 * PATCH /api/driver/trips/:id/cancel
 * Cancela un viaje (solo para conductores)
 */
router.patch('/trips/:id/cancel', async (req, res) => {
  try {
    const driverId = req.user!.id
    const tripId = req.params.id
    const { reason } = req.body

    const trip = await cancelTrip(tripId, driverId, reason, 'DRIVER')

    res.json(trip)
  } catch (error: any) {
    console.error('Error cancelling trip:', error)
    const statusCode = error.message.includes('no encontrado') ? 404
      : error.message.includes('permiso') ? 403
      : error.message.includes('cancelado') || error.message.includes('completado') ? 400
      : 500
    res.status(statusCode).json({
      error: statusCode === 404 ? 'Not Found' : statusCode === 403 ? 'Forbidden' : 'Bad Request',
      message: error.message,
    })
  }
})

export default router


