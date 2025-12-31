/**
 * Rutas para gestión de pagos Stellar
 */

import express from 'express'
import { authenticate } from '../middleware/auth'
import { PrismaClient, PaymentStatus, TripStatus } from '@prisma/client'
import { verifyStellarTransaction } from '../services/stellarService'

const router = express.Router()
const prisma = new PrismaClient()

/**
 * POST /api/payments/:paymentId/verify
 * Verifica un pago Stellar y completa el viaje
 */
router.post('/:paymentId/verify', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id
    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado',
      })
    }

    const { paymentId } = req.params
    const { transactionId } = req.body

    if (!transactionId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'transactionId es requerido',
      })
    }

    // Obtener el pago
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        trip: {
          include: {
            driver: {
              select: {
                stellarAddress: true,
              },
            },
          },
        },
      },
    })

    if (!payment) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Pago no encontrado',
      })
    }

    // Verificar que el pago pertenece al usuario
    if (payment.userId !== userId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No tienes permiso para verificar este pago',
      })
    }

    // Verificar que el pago está pendiente
    if (payment.status !== PaymentStatus.PENDING) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `El pago ya está ${payment.status}`,
      })
    }

    // Verificar la transacción en Stellar
    const paymentDetails = payment.paymentMethodDetails as any
    const stellarAddress = paymentDetails?.stellarAddress || payment.trip?.driver?.stellarAddress
    const xlmAmount = paymentDetails?.xlmAmount

    if (!stellarAddress || !xlmAmount) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Información de pago Stellar incompleta',
      })
    }

    const verification = await verifyStellarTransaction(
      transactionId,
      stellarAddress,
      xlmAmount
    )

    if (!verification.verified) {
      return res.status(400).json({
        error: 'Bad Request',
        message: verification.error || 'No se pudo verificar la transacción',
      })
    }

    // Actualizar el pago
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.COMPLETED,
        transactionId,
        processedAt: new Date(),
      },
    })

    // Si el viaje existe, marcarlo como COMPLETED y actualizar stellarTransactionId
    if (payment.tripId) {
      await prisma.trip.update({
        where: { id: payment.tripId },
        data: {
          status: TripStatus.COMPLETED,
          stellarTransactionId: transactionId,
        },
      })

      // Crear notificación para el conductor
      if (payment.trip?.driverId) {
        const { createNotification } = await import('../services/notificationService')
        const { NotificationType, NotificationPriority } = await import('@prisma/client')

        await createNotification({
          userId: payment.trip.driverId,
          type: NotificationType.PAYMENT_COMPLETED,
          title: 'Pago recibido',
          message: `Has recibido el pago del viaje ${payment.trip.tripNumber}`,
          priority: NotificationPriority.HIGH,
          data: {
            tripId: payment.tripId,
            paymentId: paymentId,
            transactionId,
          },
          actionUrl: `/driver/trips/${payment.tripId}`,
          actionLabel: 'Ver viaje',
        }).catch(() => null)
      }
    }

    res.json({
      payment: updatedPayment,
      verified: true,
      message: 'Pago verificado y viaje completado exitosamente',
    })
  } catch (error: any) {
    console.error('Error verifying payment:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * GET /api/payments/trip/:tripId
 * Obtiene la información de pago de un viaje
 */
router.get('/trip/:tripId', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id
    const { tripId } = req.params

    if (!userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Usuario no autenticado',
      })
    }

    const trip = await prisma.trip.findFirst({
      where: {
        id: tripId,
        OR: [
          { passengerId: userId },
          { driverId: userId },
        ],
      },
      include: {
        payments: {
          where: {
            method: 'STELLAR',
            status: PaymentStatus.PENDING,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!trip) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Viaje no encontrado',
      })
    }

    // Extraer XDR de las notas si existe
    let transactionXdr: string | null = null
    if (trip.notes) {
      const xdrMatch = trip.notes.match(/Transacción XDR: (.+)/)
      if (xdrMatch && xdrMatch[1] !== 'N/A') {
        transactionXdr = xdrMatch[1]
      }
    }

    res.json({
      trip: {
        id: trip.id,
        tripNumber: trip.tripNumber,
        totalPrice: trip.totalPrice,
        currency: trip.currency,
        paymentQrCode: trip.paymentQrCode,
        paymentAddress: trip.paymentAddress,
        paymentExpiresAt: trip.paymentExpiresAt,
        status: trip.status,
        completedAt: trip.completedAt,
        transactionXdr, // Incluir XDR para Freighter
      },
      payment: trip.payments[0] || null,
    })
  } catch (error: any) {
    console.error('Error getting payment info:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

export default router

