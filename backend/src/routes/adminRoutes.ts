/**
 * Rutas de administración
 * Solo accesibles para usuarios con rol ADMIN
 */

import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { requireRole } from '../middleware/requireRole'
import { UserRole } from '@prisma/client'
import { getDashboardStats } from '../services/adminStatsService'
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  changeUserRole,
  toggleUserStatus,
  addUserRole,
  removeUserRole,
  getUserRoles,
  setUserRoles,
  CreateUserData,
  UpdateUserData,
  ListUsersOptions
} from '../services/userService'
import {
  listTrips,
  getTripById,
  updateTripStatus,
  assignDriver,
  cancelTrip,
  ListTripsOptions
} from '../services/tripService'
import {
  getAvailableDrivers,
  getAvailableVehiclesByDriver,
  getPendingVehicles,
  getAllVehicles,
  approveVehicle,
  rejectVehicle,
  getVehicleById
} from '../services/vehicleService'
import { TripStatus } from '@prisma/client'

const router = Router()

// Todas las rutas de admin requieren autenticación y rol ADMIN
router.use(authenticate)
router.use(requireRole(UserRole.ADMIN))

/**
 * GET /api/admin/stats
 * Obtiene las estadísticas del dashboard de administración
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getDashboardStats()
    res.json(stats)
  } catch (error: any) {
    console.error('Error al obtener estadísticas:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al obtener estadísticas del dashboard'
    })
  }
})

/**
 * GET /api/admin/users
 * Lista usuarios con paginación y filtros
 */
router.get('/users', async (req, res) => {
  try {
    const options: ListUsersOptions = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      role: req.query.role as UserRole | undefined,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      search: req.query.search as string | undefined
    }

    const result = await listUsers(options)
    res.json(result)
  } catch (error: any) {
    console.error('Error al listar usuarios:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al listar usuarios'
    })
  }
})

/**
 * GET /api/admin/users/:id
 * Obtiene un usuario por ID
 */
router.get('/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id)

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      })
    }

    res.json(user)
  } catch (error: any) {
    console.error('Error al obtener usuario:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al obtener usuario'
    })
  }
})

/**
 * POST /api/admin/users
 * Crea un nuevo usuario
 */
router.post('/users', async (req, res) => {
  try {
    const { email, name, phone, password, role, preferredCurrency, avatar } = req.body

    if (!email || !name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Email y nombre son requeridos'
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

    const userData: CreateUserData = {
      email,
      name,
      phone,
      password,
      role: role || 'PASSENGER',
      preferredCurrency: preferredCurrency || 'CLP',
      avatar
    }

    const user = await createUser(userData)
    res.status(201).json(user)
  } catch (error: any) {
    console.error('Error al crear usuario:', error)
    
    if (error.message === 'El email ya está registrado') {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al crear usuario'
    })
  }
})

/**
 * PUT /api/admin/users/:id
 * Actualiza un usuario
 */
router.put('/users/:id', async (req, res) => {
  try {
    const { name, phone, role, preferredCurrency, isActive, isVerified, isEmailVerified, avatar, password } = req.body

    const updateData: UpdateUserData = {}
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (role !== undefined) updateData.role = role
    if (preferredCurrency !== undefined) updateData.preferredCurrency = preferredCurrency
    if (isActive !== undefined) updateData.isActive = isActive
    if (isVerified !== undefined) updateData.isVerified = isVerified
    if (isEmailVerified !== undefined) updateData.isEmailVerified = isEmailVerified
    if (avatar !== undefined) updateData.avatar = avatar
    if (password !== undefined) updateData.password = password

    const user = await updateUser(req.params.id, updateData)
    res.json(user)
  } catch (error: any) {
    console.error('Error al actualizar usuario:', error)
    
    if (error.message?.includes('administrador principal')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      })
    }
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al actualizar usuario'
    })
  }
})

/**
 * DELETE /api/admin/users/:id
 * Elimina (desactiva) un usuario
 */
router.delete('/users/:id', async (req, res) => {
  try {
    await deleteUser(req.params.id)
    res.json({ message: 'Usuario eliminado exitosamente' })
  } catch (error: any) {
    console.error('Error al eliminar usuario:', error)
    
    if (error.message?.includes('administrador principal')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      })
    }
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al eliminar usuario'
    })
  }
})

/**
 * PATCH /api/admin/users/:id/role
 * Cambia el rol de un usuario
 */
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body

    if (!role) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Rol es requerido'
      })
    }

    if (!Object.values(UserRole).includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Rol inválido'
      })
    }

    const user = await changeUserRole(req.params.id, role)
    res.json(user)
  } catch (error: any) {
    console.error('Error al cambiar rol:', error)
    
    if (error.message?.includes('administrador principal')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      })
    }
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al cambiar rol'
    })
  }
})

/**
 * PATCH /api/admin/users/:id/status
 * Activa o desactiva un usuario
 */
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'isActive debe ser un booleano'
      })
    }

    const user = await toggleUserStatus(req.params.id, isActive)
    res.json(user)
  } catch (error: any) {
    console.error('Error al cambiar estado:', error)
    
    if (error.message?.includes('administrador principal')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      })
    }
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Usuario no encontrado'
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al cambiar estado'
    })
  }
})

/**
 * GET /api/admin/users/:id/roles
 * Obtiene todos los roles de un usuario (principal + adicionales)
 */
router.get('/users/:id/roles', async (req, res) => {
  try {
    const roles = await getUserRoles(req.params.id)
    res.json({ roles })
  } catch (error: any) {
    console.error('Error al obtener roles:', error)
    
    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Error al obtener roles'
    })
  }
})

/**
 * POST /api/admin/users/:id/roles
 * Agrega un rol adicional a un usuario
 */
router.post('/users/:id/roles', async (req, res) => {
  try {
    const { role } = req.body

    if (!role) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Rol es requerido'
      })
    }

    if (!Object.values(UserRole).includes(role)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Rol inválido'
      })
    }

    await addUserRole(req.params.id, role)
    const roles = await getUserRoles(req.params.id)
    res.json({ message: 'Rol agregado exitosamente', roles })
  } catch (error: any) {
    console.error('Error al agregar rol:', error)
    
    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Error al agregar rol'
    })
  }
})

/**
 * DELETE /api/admin/users/:id/roles/:role
 * Remueve un rol adicional de un usuario
 */
router.delete('/users/:id/roles/:role', async (req, res) => {
  try {
    const { role } = req.params

    if (!Object.values(UserRole).includes(role as UserRole)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Rol inválido'
      })
    }

    await removeUserRole(req.params.id, role as UserRole)
    const roles = await getUserRoles(req.params.id)
    res.json({ message: 'Rol removido exitosamente', roles })
  } catch (error: any) {
    console.error('Error al remover rol:', error)
    
    if (error.message === 'Usuario no encontrado' || error.message.includes('No se puede remover el rol principal')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Error al remover rol'
    })
  }
})

/**
 * PUT /api/admin/users/:id/roles
 * Establece todos los roles de un usuario (reemplaza los roles adicionales)
 */
router.put('/users/:id/roles', async (req, res) => {
  try {
    const { roles } = req.body

    if (!Array.isArray(roles)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'roles debe ser un array'
      })
    }

    // Validar que todos los roles sean válidos
    const invalidRoles = roles.filter(r => !Object.values(UserRole).includes(r))
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Roles inválidos: ${invalidRoles.join(', ')}`
      })
    }

    await setUserRoles(req.params.id, roles as UserRole[])
    const updatedRoles = await getUserRoles(req.params.id)
    res.json({ message: 'Roles actualizados exitosamente', roles: updatedRoles })
  } catch (error: any) {
    console.error('Error al establecer roles:', error)
    
    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Error al establecer roles'
    })
  }
})

/**
 * GET /api/admin/trips
 * Lista viajes con paginación y filtros
 */
router.get('/trips', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const status = req.query.status as string | undefined
    const passengerId = req.query.passengerId as string | undefined
    const driverId = req.query.driverId as string | undefined
    const search = req.query.search as string | undefined
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined

    const options: ListTripsOptions = {
      page,
      limit,
      passengerId,
      driverId,
      search,
      startDate,
      endDate,
    }

    // Parsear status (puede ser uno o varios separados por coma)
    if (status) {
      const statuses = status.split(',').map(s => s.trim()) as TripStatus[]
      options.status = statuses.length === 1 ? statuses[0] : statuses
    }

    const result = await listTrips(options)
    res.json(result)
  } catch (error: any) {
    console.error('Error listing trips:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * GET /api/admin/trips/:id
 * Obtiene un viaje por ID
 */
router.get('/trips/:id', async (req, res) => {
  try {
    const trip = await getTripById(req.params.id)

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
 * PATCH /api/admin/trips/:id/status
 * Actualiza el estado de un viaje
 */
router.patch('/trips/:id/status', async (req, res) => {
  try {
    const { status } = req.body

    if (!status || !Object.values(TripStatus).includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Estado de viaje inválido',
      })
    }

    const trip = await updateTripStatus(req.params.id, status as TripStatus)
    res.json(trip)
  } catch (error: any) {
    console.error('Error updating trip status:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * PATCH /api/admin/trips/:id/assign-driver
 * Asigna o cambia un conductor a un viaje
 * Query param: allowReassign=true para permitir cambiar conductor existente
 */
router.patch('/trips/:id/assign-driver', async (req, res) => {
  try {
    const { driverId, vehicleId } = req.body
    const allowReassign = req.query.allowReassign === 'true'

    if (!driverId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'driverId es requerido',
      })
    }

    const trip = await assignDriver(req.params.id, driverId, vehicleId, allowReassign)
    res.json(trip)
  } catch (error: any) {
    console.error('Error assigning driver:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * PATCH /api/admin/trips/:id/cancel
 * Cancela un viaje
 */
router.patch('/trips/:id/cancel', async (req, res) => {
  try {
    const adminId = req.user!.id
    const { reason } = req.body

    const trip = await cancelTrip(req.params.id, adminId, reason, 'ADMIN')
    res.json(trip)
  } catch (error: any) {
    console.error('Error cancelling trip:', error)
    const statusCode = error.message.includes('no encontrado') ? 404
      : error.message.includes('cancelado') || error.message.includes('completado') ? 400
      : 500
    res.status(statusCode).json({
      error: statusCode === 404 ? 'Not Found' : 'Bad Request',
      message: error.message,
    })
  }
})

/**
 * GET /api/admin/drivers
 * Obtiene lista de conductores disponibles
 * Query params: country - filtrar por país del viaje
 */
router.get('/drivers', async (req, res) => {
  try {
    const tripCountry = req.query.country as string | undefined
    const drivers = await getAvailableDrivers(tripCountry)
    res.json(drivers)
  } catch (error: any) {
    console.error('Error getting drivers:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * GET /api/admin/drivers/:driverId/vehicles
 * Obtiene vehículos disponibles de un conductor
 */
router.get('/drivers/:driverId/vehicles', async (req, res) => {
  try {
    const vehicles = await getAvailableVehiclesByDriver(req.params.driverId)
    res.json(vehicles)
  } catch (error: any) {
    console.error('Error getting driver vehicles:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * GET /api/admin/vehicles/pending
 * Obtiene vehículos pendientes de aprobación
 */
router.get('/vehicles/pending', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const result = await getPendingVehicles(page, limit)
    res.json(result)
  } catch (error: any) {
    console.error('Error getting pending vehicles:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * GET /api/admin/vehicles
 * Lista todos los vehículos con filtros
 */
router.get('/vehicles', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const approvalStatus = req.query.approvalStatus as any
    const driverId = req.query.driverId as string
    const type = req.query.type as any

    const result = await getAllVehicles(page, limit, {
      approvalStatus,
      driverId,
      type,
    })
    res.json(result)
  } catch (error: any) {
    console.error('Error getting vehicles:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    })
  }
})

/**
 * GET /api/admin/vehicles/:id
 * Obtiene un vehículo específico
 */
router.get('/vehicles/:id', async (req, res) => {
  try {
    const vehicle = await getVehicleById(req.params.id)
    res.json(vehicle)
  } catch (error: any) {
    console.error('Error getting vehicle:', error)
    if (error.message === 'Vehículo no encontrado') {
      res.status(404).json({ error: error.message })
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      })
    }
  }
})

/**
 * POST /api/admin/vehicles/:id/approve
 * Aprueba un vehículo
 */
router.post('/vehicles/:id/approve', async (req, res) => {
  try {
    const vehicle = await approveVehicle(req.params.id, req.user!.id)
    res.json(vehicle)
  } catch (error: any) {
    console.error('Error approving vehicle:', error)
    if (error.message === 'Vehículo no encontrado') {
      res.status(404).json({ error: error.message })
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      })
    }
  }
})

/**
 * POST /api/admin/vehicles/:id/reject
 * Rechaza un vehículo
 */
router.post('/vehicles/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body
    const vehicle = await rejectVehicle(req.params.id, req.user!.id, reason)
    res.json(vehicle)
  } catch (error: any) {
    console.error('Error rejecting vehicle:', error)
    if (error.message === 'Vehículo no encontrado') {
      res.status(404).json({ error: error.message })
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message,
      })
    }
  }
})

export default router

