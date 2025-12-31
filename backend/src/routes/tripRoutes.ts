/**
 * Rutas para gestión de viajes (pasajeros)
 */

import express from 'express'
import { authenticate } from '../middleware/auth'
import { createTrip, listTrips, cancelTrip } from '../services/tripService'
import { renewStartPin } from '../services/driverService'
import { PrismaClient, TripStatus } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

/**
 * POST /api/trips
 * Crea un nuevo viaje (solo para pasajeros)
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado',
      })
    }

    // Verificar que el usuario sea pasajero
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    if (!user || (user.role !== 'PASSENGER' && user.role !== 'ADMIN')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo los pasajeros pueden crear viajes',
      })
    }

    const {
      originAddress,
      originLatitude,
      originLongitude,
      destinationAddress,
      destinationLatitude,
      destinationLongitude,
      originPlaceId,
      destinationPlaceId,
      passengers,
      isRoundTrip,
      returnScheduledAt,
      preferredVehicleType,
      scheduledAt,
      distance,
      duration,
      distanceText,
      durationText,
      basePrice,
      distancePrice,
      timePrice,
      totalPrice,
      currency,
      routePolyline,
      routeBounds,
    } = req.body

    // Validaciones
    if (!originAddress || !destinationAddress) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Origen y destino son requeridos',
      })
    }

    if (
      typeof originLatitude !== 'number' ||
      typeof originLongitude !== 'number' ||
      typeof destinationLatitude !== 'number' ||
      typeof destinationLongitude !== 'number'
    ) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Coordenadas inválidas',
      })
    }

    if (!distance || !duration || !totalPrice) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Distancia, duración y precio son requeridos',
      })
    }

    // Validar número de pasajeros (máximo 7)
    const validPassengers = Math.min(Math.max(passengers || 1, 1), 7)

    // Validar ida y vuelta
    if (isRoundTrip && !returnScheduledAt) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'La fecha de vuelta es requerida para viajes de ida y vuelta',
      })
    }

    const trip = await createTrip(userId, {
      originAddress,
      originLatitude,
      originLongitude,
      destinationAddress,
      destinationLatitude,
      destinationLongitude,
      originPlaceId,
      destinationPlaceId,
      passengers: validPassengers,
      isRoundTrip: isRoundTrip || false,
      returnScheduledAt: returnScheduledAt ? new Date(returnScheduledAt) : undefined,
      preferredVehicleType,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      distance,
      duration,
      distanceText,
      durationText,
      basePrice: basePrice || 0,
      distancePrice: distancePrice || 0,
      timePrice: timePrice || 0,
      totalPrice,
      currency: currency || 'CLP',
      routePolyline,
      routeBounds,
    })

    res.status(201).json(trip)
  } catch (error: any) {
    console.error('Error creating trip:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * GET /api/trips
 * Lista viajes del pasajero autenticado
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado',
      })
    }

    const status = req.query.status as string | undefined
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20

    // Parsear status (puede ser uno o varios separados por coma)
    let statusFilter: TripStatus | TripStatus[] | undefined
    if (status) {
      const statuses = status.split(',').map(s => s.trim()) as TripStatus[]
      statusFilter = statuses.length === 1 ? statuses[0] : statuses
    }

    const result = await listTrips({
      passengerId: userId,
      status: statusFilter,
      page,
      limit,
    })

    res.json(result.trips)
  } catch (error: any) {
    console.error('Error listing trips:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * GET /api/trips/:id
 * Obtiene un viaje específico del pasajero
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado',
      })
    }

    const trip = await prisma.trip.findFirst({
      where: {
        id: req.params.id,
        passengerId: userId,
      },
      include: {
        passenger: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            preferredCurrency: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            year: true,
            licensePlate: true,
            color: true,
            type: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            method: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!trip) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Viaje no encontrado',
      })
    }

    res.json(trip)
  } catch (error: any) {
    console.error('Error getting trip:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * POST /api/trips/:id/renew-pin
 * Renueva el PIN de inicio de un viaje (solo para pasajeros)
 */
router.post('/:id/renew-pin', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado',
      })
    }

    const tripId = req.params.id
    const result = await renewStartPin(tripId, userId)

    res.json(result)
  } catch (error: any) {
    console.error('Error renewing start PIN:', error)
    res.status(400).json({
      error: 'Bad Request',
      message: error.message,
    })
  }
})

/**
 * PATCH /api/trips/:id/cancel
 * Cancela un viaje (solo para pasajeros)
 */
router.patch('/:id/cancel', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado',
      })
    }

    // Verificar que el usuario sea pasajero
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    })

    if (!user || (user.role !== 'PASSENGER' && user.role !== 'ADMIN')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Solo los pasajeros pueden cancelar viajes',
      })
    }

    const tripId = req.params.id
    const { reason } = req.body

    const trip = await cancelTrip(tripId, userId, reason, user.role === 'ADMIN' ? 'ADMIN' : 'PASSENGER')

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

