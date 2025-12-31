/**
 * Rutas de autenticación
 */

import { Router } from 'express'
import { createUser, login, requestPasswordReset, resetPassword, updateUser, getUserById, changeActiveRole } from '../services/userService'
import { CreateUserData, LoginData, UpdateUserData } from '../services/userService'
import { authenticate } from '../middleware/auth'
import { UserRole } from '@prisma/client'

const router = Router()

/**
 * POST /api/auth/register
 * Registra un nuevo usuario
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body

    // Validar campos requeridos
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Nombre, email y contraseña son requeridos'
      })
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email inválido'
      })
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'La contraseña debe tener al menos 6 caracteres'
      })
    }

    // Validar formato de WhatsApp si se proporciona
    if (phone && !phone.startsWith('+')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El número de teléfono/WhatsApp debe incluir el prefijo internacional (ej: +56912345678)'
      })
    }

    // Crear usuario
    const userData: CreateUserData = {
      name,
      email,
      password,
      phone
    }

    const user = await createUser(userData)

    // Generar token (similar a login)
    const loginData: LoginData = { email, password }
    const authTokens = await login(loginData)

    res.status(201).json({
      user: authTokens.user,
      token: authTokens.accessToken
    })
  } catch (error: any) {
    console.error('Error en registro:', error)
    
    if (error.message === 'El email ya está registrado') {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Error al registrar usuario'
    })
  }
})

/**
 * POST /api/auth/login
 * Autentica un usuario y devuelve tokens
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    // Validar campos requeridos
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email y contraseña son requeridos'
      })
    }

    // Autenticar usuario
    const loginData: LoginData = { email, password }
    const authTokens = await login(loginData)

    res.json({
      user: authTokens.user,
      token: authTokens.accessToken
    })
  } catch (error: any) {
    console.error('Error en login:', error)
    
    if (error.message === 'Credenciales inválidas' || 
        error.message.includes('no tiene contraseña')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: error.message
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Error al autenticar usuario'
    })
  }
})

/**
 * POST /api/auth/forgot-password
 * Solicita recuperación de contraseña
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email es requerido'
      })
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email inválido'
      })
    }

    await requestPasswordReset(email)

    // Siempre retornamos éxito por seguridad (no revelamos si el email existe)
    res.json({
      message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña'
    })
  } catch (error: any) {
    console.error('Error en forgot-password:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al procesar la solicitud'
    })
  }
})

/**
 * POST /api/auth/reset-password
 * Resetea la contraseña de un usuario
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body

    if (!email || !newPassword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email y nueva contraseña son requeridos'
      })
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email inválido'
      })
    }

    // Validar longitud de contraseña
    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'La contraseña debe tener al menos 6 caracteres'
      })
    }

    await resetPassword(email, newPassword)

    res.json({
      message: 'Contraseña actualizada exitosamente'
    })
  } catch (error: any) {
    console.error('Error en reset-password:', error)
    
    if (error.message === 'Usuario no encontrado' || error.message === 'Usuario inactivo') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al resetear contraseña'
    })
  }
})

/**
 * GET /api/auth/me
 * Obtiene la información del usuario autenticado
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id
    const user = await getUserById(userId)

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      })
    }

    res.json({ user })
  } catch (error: any) {
    console.error('Error getting user:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
})

/**
 * PUT /api/auth/me
 * Actualiza la información del usuario autenticado
 */
/**
 * PATCH /api/auth/me/active-role
 * Cambia el rol activo del usuario actual
 */
router.patch('/me/active-role', authenticate, async (req, res) => {
  try {
    const { role } = req.body

    if (!role) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'El rol es requerido'
      })
    }

    // Validar que el rol sea válido
    if (!Object.values(UserRole).includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Rol inválido'
      })
    }

    // Cambiar el rol activo
    const updatedUser = await changeActiveRole(req.user!.id, role as UserRole)

    // Obtener todos los roles del usuario
    const allRoles = [
      updatedUser.role,
      ...(updatedUser.userRoles || []).map((ur: { role: UserRole }) => ur.role)
    ]
    const uniqueRoles = Array.from(new Set(allRoles)) as UserRole[]

    res.json({
      user: {
        ...updatedUser,
        roles: uniqueRoles,
        activeRole: updatedUser.activeRole || updatedUser.role
      }
    })
  } catch (error: any) {
    console.error('Error cambiando rol activo:', error)
    res.status(400).json({
      error: 'Bad Request',
      message: error.message || 'Error al cambiar el rol activo'
    })
  }
})

router.put('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user!.id
    const { name, phone, preferredCurrency, country, avatar, stellarAddress } = req.body

    const updateData: UpdateUserData = {}
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (preferredCurrency !== undefined) updateData.preferredCurrency = preferredCurrency
    if (country !== undefined) updateData.country = country
    if (avatar !== undefined) updateData.avatar = avatar
    if (stellarAddress !== undefined) updateData.stellarAddress = stellarAddress || null

    const user = await updateUser(userId, updateData)

    res.json({ user })
  } catch (error: any) {
    console.error('Error updating user:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    })
  }
})

export default router

