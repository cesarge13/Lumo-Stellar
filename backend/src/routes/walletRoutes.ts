/**
 * Rutas para conexión de wallet móvil
 * Permite conectar Freighter móvil escaneando un código QR
 */

import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import QRCode from 'qrcode'

const router = Router()
const prisma = new PrismaClient()

/**
 * POST /api/wallet/generate-connection-qr
 * Genera un código QR único para conectar wallet móvil
 */
router.post('/generate-connection-qr', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id

    // Generar token único (válido por 10 minutos)
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 10)

    // Guardar token en la base de datos (podríamos usar Redis en producción)
    // Por ahora, lo guardamos en una tabla temporal o en memoria
    // En producción, usar Redis o una tabla de tokens

    // Generar URL de conexión
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
    const connectionUrl = `${frontendUrl}/wallet/connect-mobile?token=${token}&userId=${userId}`

    // Generar QR code
    const qrCode = await QRCode.toDataURL(connectionUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
      margin: 2,
    })

    res.json({
      qrCode,
      connectionUrl,
      token,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error: any) {
    console.error('Error generating connection QR:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Error al generar código QR de conexión',
    })
  }
})

/**
 * POST /api/wallet/verify-connection/:token
 * Verifica y guarda la dirección Stellar del usuario desde móvil
 */
router.post('/verify-connection/:token', authenticate, async (req, res) => {
  try {
    const { token } = req.params
    const { stellarAddress } = req.body
    const userId = req.user!.id

    // Validar dirección Stellar
    if (!stellarAddress || typeof stellarAddress !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Dirección Stellar requerida',
      })
    }

    // Validar formato de dirección Stellar (debe empezar con G y tener 56 caracteres)
    if (!stellarAddress.startsWith('G') || stellarAddress.length !== 56) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Dirección Stellar inválida',
      })
    }

    // Actualizar dirección Stellar del usuario
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        stellarAddress,
      },
      select: {
        id: true,
        email: true,
        name: true,
        stellarAddress: true,
      },
    })

    res.json({
      success: true,
      message: 'Wallet conectada exitosamente',
      user: updatedUser,
    })
  } catch (error: any) {
    console.error('Error verifying connection:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Error al verificar conexión',
    })
  }
})

/**
 * GET /api/wallet/connection-status
 * Obtiene el estado de conexión de la wallet del usuario
 */
router.get('/connection-status', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        stellarAddress: true,
      },
    })

    res.json({
      isConnected: !!user?.stellarAddress,
      stellarAddress: user?.stellarAddress || null,
    })
  } catch (error: any) {
    console.error('Error getting connection status:', error)
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Error al obtener estado de conexión',
    })
  }
})

export default router

