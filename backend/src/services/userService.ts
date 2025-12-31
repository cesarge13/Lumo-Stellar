/**
 * Servicio para manejo de usuarios
 */

import { PrismaClient, User, UserRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export interface CreateUserData {
  email: string
  name: string
  phone?: string
  password?: string // Opcional para OAuth
  role?: UserRole
  preferredCurrency?: string
  country?: string
  avatar?: string
}

export interface LoginData {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  user: Omit<User, 'password'>
}

/**
 * Crea un nuevo usuario
 */
export async function createUser(data: CreateUserData): Promise<Omit<User, 'password'>> {
  // Verificar que el email no exista
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email }
  })

  if (existingUser) {
    throw new Error('El email ya está registrado')
  }

  // Hashear contraseña solo si se proporciona
  const hashedPassword = data.password
    ? await bcrypt.hash(data.password, 10)
    : null

  // Crear usuario
  const userRole = data.role || 'PASSENGER'
  const user = await prisma.user.create({
    data: {
      email: data.email,
      name: data.name,
      phone: data.phone,
      password: hashedPassword,
      avatar: data.avatar,
      role: userRole,
      preferredCurrency: (data.preferredCurrency as any) || 'CLP',
      country: data.country || 'CL',
      isActive: true,
      isEmailVerified: false, // Se verifica después
      // Crear también el rol en la tabla de asignaciones
      userRoles: {
        create: {
          role: userRole
        }
      }
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      preferredCurrency: true,
      country: true,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      isRootAdmin: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        select: {
          role: true
        }
      }
    }
  })

  // Incluir roles calculados
  const allRoles = user.userRoles 
    ? [user.role, ...user.userRoles.map(ur => ur.role)]
    : [user.role]
  const uniqueRoles = Array.from(new Set(allRoles))

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    preferredCurrency: user.preferredCurrency,
    country: user.country,
    isActive: user.isActive,
    isVerified: user.isVerified,
    isEmailVerified: user.isEmailVerified,
    isRootAdmin: user.isRootAdmin,
    avatar: user.avatar,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: uniqueRoles,
    userRoles: user.userRoles
  } as any
}

/**
 * Autentica un usuario y genera tokens
 */
export async function login(data: LoginData): Promise<AuthTokens> {
  // Buscar usuario con sus roles
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    include: {
      userRoles: {
        select: {
          role: true
        }
      }
    }
  })

  if (!user || !user.isActive) {
    throw new Error('Credenciales inválidas')
  }

  // Verificar que tenga contraseña (no es cuenta solo OAuth)
  if (!user.password) {
    throw new Error('Este usuario no tiene contraseña. Use OAuth para iniciar sesión.')
  }

  // Verificar contraseña
  const isValidPassword = await bcrypt.compare(data.password, user.password)
  if (!isValidPassword) {
    throw new Error('Credenciales inválidas')
  }

  // Generar tokens
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET no está configurado')
  }

  // Usar activeRole si está definido, sino usar el rol principal
  const effectiveRole = user.activeRole || user.role

  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: effectiveRole },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  )

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    jwtSecret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' } as jwt.SignOptions
  )

  // Guardar refresh token en la base de datos
  await prisma.token.create({
    data: {
      userId: user.id,
      token: refreshToken,
      type: 'REFRESH_TOKEN',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 días
    }
  })

  // Retornar usuario sin contraseña
  const { password, ...userWithoutPassword } = user

  // Obtener todos los roles del usuario (principal + adicionales)
  const allRoles = user.userRoles 
    ? [user.role, ...user.userRoles.map(ur => ur.role)]
    : [user.role]
  const uniqueRoles = Array.from(new Set(allRoles))

  // Asegurar que preferredCurrency y country estén incluidos
  const userResponse = {
    ...userWithoutPassword,
    preferredCurrency: user.preferredCurrency || 'CLP',
    country: user.country || 'CL',
    activeRole: effectiveRole,
    userRoles: user.userRoles || []
  }

  return {
    accessToken,
    refreshToken,
    user: userResponse
  }
}

/**
 * Refresca un access token usando un refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  // Verificar que el token existe y es válido
  const tokenRecord = await prisma.token.findUnique({
    where: { token: refreshToken },
    include: { user: true }
  })

  if (!tokenRecord || !tokenRecord.isActive || !tokenRecord.user.isActive) {
    throw new Error('Token inválido')
  }

  // Verificar expiración
  if (tokenRecord.expiresAt && tokenRecord.expiresAt < new Date()) {
    await prisma.token.update({
      where: { id: tokenRecord.id },
      data: { isActive: false }
    })
    throw new Error('Token expirado')
  }

  // Generar nuevo access token
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET no está configurado')
  }

  const accessToken = jwt.sign(
    { userId: tokenRecord.userId, email: tokenRecord.user.email, role: tokenRecord.user.role },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  )

  return accessToken
}

/**
 * Obtiene un usuario por ID
 */
export async function getUserById(userId: string): Promise<Omit<User, 'password'> | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      activeRole: true,
      preferredCurrency: true,
      country: true,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      isRootAdmin: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        select: {
          role: true
        }
      }
    }
  })

  if (!user) return null

  // Incluir roles calculados
  const allRoles = user.userRoles 
    ? [user.role, ...user.userRoles.map(ur => ur.role)]
    : [user.role]
  const uniqueRoles = Array.from(new Set(allRoles))

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    activeRole: user.activeRole || user.role,
    preferredCurrency: user.preferredCurrency,
    country: user.country,
    isActive: user.isActive,
    isVerified: user.isVerified,
    isEmailVerified: user.isEmailVerified,
    isRootAdmin: user.isRootAdmin,
    avatar: user.avatar,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: uniqueRoles,
    userRoles: user.userRoles
  } as any
}

/**
 * Revoca un token (logout)
 */
export async function revokeToken(token: string): Promise<void> {
  await prisma.token.updateMany({
    where: { token, isActive: true },
    data: { isActive: false }
  })
}

export interface UpdateUserData {
  name?: string
  phone?: string
  role?: UserRole
  preferredCurrency?: string
  country?: string
  isActive?: boolean
  isVerified?: boolean
  isEmailVerified?: boolean
  avatar?: string
  password?: string
  stellarAddress?: string
}

export interface ListUsersOptions {
  page?: number
  limit?: number
  role?: UserRole
  isActive?: boolean
  search?: string
}

export interface ListUsersResult {
  users: Omit<User, 'password'>[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Lista usuarios con paginación y filtros
 */
export async function listUsers(options: ListUsersOptions = {}): Promise<ListUsersResult> {
  const page = options.page || 1
  const limit = options.limit || 20
  const skip = (page - 1) * limit

  const where: any = {}

  if (options.role) {
    where.role = options.role
  }

  if (options.isActive !== undefined) {
    where.isActive = options.isActive
  }

  if (options.search) {
    where.OR = [
      { email: { contains: options.search, mode: 'insensitive' } },
      { name: { contains: options.search, mode: 'insensitive' } },
      { phone: { contains: options.search, mode: 'insensitive' } }
    ]
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        activeRole: true,
        preferredCurrency: true,
        country: true,
        isActive: true,
        isVerified: true,
        isEmailVerified: true,
        isRootAdmin: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: true
          }
        }
      }
    }),
    prisma.user.count({ where })
  ])

  // Transformar usuarios para incluir roles calculados
  const usersWithRoles = users.map(user => {
    const allRoles = user.userRoles 
      ? [user.role, ...user.userRoles.map(ur => ur.role)]
      : [user.role]
    const uniqueRoles = Array.from(new Set(allRoles))
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      activeRole: user.activeRole,
      preferredCurrency: user.preferredCurrency,
      country: user.country,
      isActive: user.isActive,
      isVerified: user.isVerified,
      isEmailVerified: user.isEmailVerified,
      isRootAdmin: user.isRootAdmin,
      avatar: user.avatar,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: uniqueRoles,
      userRoles: user.userRoles
    }
  })

  return {
    users: usersWithRoles,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }
}

/**
 * Actualiza un usuario
 */
export async function updateUser(
  userId: string,
  data: UpdateUserData
): Promise<Omit<User, 'password'>> {
  // Verificar si es root admin
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { isRootAdmin: true }
  })

  // Proteger root admin de cambios peligrosos
  if (existingUser?.isRootAdmin) {
    if (data.role !== undefined && data.role !== 'ADMIN') {
      throw new Error('No se puede cambiar el rol del administrador principal del sistema')
    }
    if (data.isActive !== undefined && !data.isActive) {
      throw new Error('No se puede desactivar el administrador principal del sistema')
    }
  }

  const updateData: any = {}

  if (data.name !== undefined) updateData.name = data.name
  if (data.phone !== undefined) updateData.phone = data.phone
  if (data.role !== undefined) updateData.role = data.role
  if (data.preferredCurrency !== undefined) updateData.preferredCurrency = data.preferredCurrency
  if (data.country !== undefined) updateData.country = data.country
  if (data.isActive !== undefined) updateData.isActive = data.isActive
  if (data.isVerified !== undefined) updateData.isVerified = data.isVerified
  if (data.isEmailVerified !== undefined) updateData.isEmailVerified = data.isEmailVerified
  if (data.avatar !== undefined) updateData.avatar = data.avatar
  if (data.stellarAddress !== undefined) updateData.stellarAddress = data.stellarAddress || null

  // Si se proporciona una nueva contraseña, hashearla
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 10)
  }

  // Si se cambia el rol, actualizar también la tabla de roles adicionales
  if (data.role !== undefined) {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    })

    if (existingUser && existingUser.role !== data.role) {
      // Remover el nuevo rol de los roles adicionales si existe
      await prisma.userRoleAssignment.deleteMany({
        where: {
          userId,
          role: data.role
        }
      })
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      preferredCurrency: true,
      country: true,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      isRootAdmin: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        select: {
          role: true
        }
      }
    }
  })

  // Incluir roles calculados
  const allRoles = user.userRoles 
    ? [user.role, ...user.userRoles.map(ur => ur.role)]
    : [user.role]
  const uniqueRoles = Array.from(new Set(allRoles))

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    preferredCurrency: user.preferredCurrency,
    country: user.country,
    isActive: user.isActive,
    isVerified: user.isVerified,
    isEmailVerified: user.isEmailVerified,
    isRootAdmin: user.isRootAdmin,
    avatar: user.avatar,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: uniqueRoles,
    userRoles: user.userRoles
  } as any
}

/**
 * Elimina un usuario (soft delete - desactiva)
 */
export async function deleteUser(userId: string): Promise<void> {
  // Verificar si es root admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isRootAdmin: true }
  })

  if (user?.isRootAdmin) {
    throw new Error('No se puede eliminar el administrador principal del sistema')
  }

  // Verificar si el usuario tiene viajes activos o en progreso
  const activeTrips = await prisma.trip.count({
    where: {
      OR: [
        { driverId: userId },
        { passengerId: userId }
      ],
      status: {
        in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS']
      }
    }
  })

  if (activeTrips > 0) {
    throw new Error('No se puede eliminar un usuario con viajes activos o en progreso')
  }

  // Eliminar relaciones manualmente que no tienen cascade
  // 1. Eliminar vehículos del usuario
  await prisma.vehicle.deleteMany({
    where: { userId }
  })

  // 2. Limpiar referencias en viajes (poner a null)
  await prisma.trip.updateMany({
    where: { driverId: userId },
    data: { driverId: null }
  })

  await prisma.trip.updateMany({
    where: { passengerId: userId },
    data: { passengerId: null }
  })

  // 3. Limpiar referencias en interacciones
  await prisma.interaction.updateMany({
    where: { userId },
    data: { userId: null }
  })

  // Hard delete: eliminar el usuario y sus relaciones con cascade
  // Prisma manejará automáticamente las relaciones con onDelete: Cascade
  await prisma.user.delete({
    where: { id: userId }
  })
}

/**
 * Cambia el rol principal de un usuario
 * También actualiza la tabla de roles adicionales
 */
export async function changeUserRole(userId: string, newRole: UserRole): Promise<Omit<User, 'password'>> {
  // Verificar si es root admin
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      isRootAdmin: true, 
      role: true,
      userRoles: {
        select: {
          role: true
        }
      }
    }
  })

  if (existingUser?.isRootAdmin) {
    throw new Error('No se puede cambiar el rol del administrador principal del sistema')
  }

  if (!existingUser) {
    throw new Error('Usuario no encontrado')
  }

  const oldRole = existingUser.role
  const existingAdditionalRoles = existingUser.userRoles.map(ur => ur.role)

  // Si el nuevo rol ya está en los roles adicionales, removerlo de ahí
  await prisma.userRoleAssignment.deleteMany({
    where: {
      userId,
      role: newRole
    }
  })

  // Si el rol anterior no es el mismo que el nuevo y no está ya en los adicionales, agregarlo
  if (oldRole !== newRole && !existingAdditionalRoles.includes(oldRole)) {
    await prisma.userRoleAssignment.create({
      data: {
        userId,
        role: oldRole
      }
    })
  }

  // Actualizar el rol principal
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      preferredCurrency: true,
      country: true,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      isRootAdmin: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        select: {
          role: true
        }
      }
    }
  })

  // Incluir roles calculados
  const allRoles = user.userRoles 
    ? [user.role, ...user.userRoles.map(ur => ur.role)]
    : [user.role]
  const uniqueRoles = Array.from(new Set(allRoles))

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    preferredCurrency: user.preferredCurrency,
    country: user.country,
    isActive: user.isActive,
    isVerified: user.isVerified,
    isEmailVerified: user.isEmailVerified,
    isRootAdmin: user.isRootAdmin,
    avatar: user.avatar,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: uniqueRoles,
    userRoles: user.userRoles
  } as any
}

/**
 * Activa o desactiva un usuario
 */
export async function toggleUserStatus(userId: string, isActive: boolean): Promise<Omit<User, 'password'>> {
  // Verificar si es root admin
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { isRootAdmin: true }
  })

  if (existingUser?.isRootAdmin && !isActive) {
    throw new Error('No se puede desactivar el administrador principal del sistema')
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      preferredCurrency: true,
      country: true,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      isRootAdmin: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        select: {
          role: true
        }
      }
    }
  })

  // Incluir roles calculados
  const allRoles = user.userRoles 
    ? [user.role, ...user.userRoles.map(ur => ur.role)]
    : [user.role]
  const uniqueRoles = Array.from(new Set(allRoles))

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    preferredCurrency: user.preferredCurrency,
    country: user.country,
    isActive: user.isActive,
    isVerified: user.isVerified,
    isEmailVerified: user.isEmailVerified,
    isRootAdmin: user.isRootAdmin,
    avatar: user.avatar,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: uniqueRoles,
    userRoles: user.userRoles
  } as any
}

/**
 * Solicita recuperación de contraseña
 * En producción, esto enviaría un email con un token
 * Por ahora, solo verifica que el usuario existe
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    // Por seguridad, no revelamos si el email existe o no
    return
  }

  // En producción, aquí se generaría un token y se enviaría por email
  // Por ahora, solo logueamos (en desarrollo)
  if (process.env.NODE_ENV === 'development') {
    console.log(`Password reset requested for: ${email}`)
  }
}

/**
 * Resetea la contraseña de un usuario
 * En producción, esto requeriría un token válido
 * Por ahora, permite resetear directamente (solo en desarrollo)
 */
export async function resetPassword(email: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (!user) {
    throw new Error('Usuario no encontrado')
  }

  if (!user.isActive) {
    throw new Error('Usuario inactivo')
  }

  // Hashear nueva contraseña
  const hashedPassword = await bcrypt.hash(newPassword, 10)

  // Actualizar contraseña
  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword }
  })
}

/**
 * Agrega un rol adicional a un usuario
 */
export async function addUserRole(userId: string, role: UserRole): Promise<void> {
  // Verificar que el usuario existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { 
      id: true, 
      role: true,
      userRoles: {
        select: {
          role: true
        }
      }
    }
  })

  if (!user) {
    throw new Error('Usuario no encontrado')
  }

  // Si el rol es el mismo que el rol principal, no hacer nada
  if (user.role === role) {
    return
  }

  // Si el rol ya está en los roles adicionales, no hacer nada
  const existingAdditionalRoles = user.userRoles.map(ur => ur.role)
  if (existingAdditionalRoles.includes(role)) {
    return
  }

  // Agregar rol adicional (si no existe ya)
  await prisma.userRoleAssignment.upsert({
    where: {
      userId_role: {
        userId,
        role
      }
    },
    create: {
      userId,
      role
    },
    update: {} // No hacer nada si ya existe
  })
}

/**
 * Remueve un rol adicional de un usuario
 */
export async function removeUserRole(userId: string, role: UserRole): Promise<void> {
  // Verificar que el usuario existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  })

  if (!user) {
    throw new Error('Usuario no encontrado')
  }

  // No permitir remover el rol principal
  if (user.role === role) {
    throw new Error('No se puede remover el rol principal. Cambia el rol principal primero.')
  }

  // Remover rol adicional
  await prisma.userRoleAssignment.deleteMany({
    where: {
      userId,
      role
    }
  })
}

/**
 * Obtiene todos los roles de un usuario (principal + adicionales)
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      userRoles: {
        select: {
          role: true
        }
      }
    }
  })

  if (!user) {
    throw new Error('Usuario no encontrado')
  }

  // Combinar rol principal con roles adicionales
  const allRoles = [
    user.role,
    ...user.userRoles.map(ur => ur.role)
  ]

  // Eliminar duplicados
  return Array.from(new Set(allRoles)) as UserRole[]
}

/**
 * Establece los roles de un usuario (reemplaza todos los roles adicionales)
 */
/**
 * Cambia el rol activo del usuario actual
 * Solo permite cambiar a roles que el usuario tiene asignados
 */
export async function changeActiveRole(
  userId: string, 
  newActiveRole: UserRole
): Promise<Omit<User, 'password'> & { userRoles: { role: UserRole }[] }> {
  // Obtener el usuario con todos sus roles
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      activeRole: true,
      userRoles: {
        select: {
          role: true
        }
      }
    }
  })

  if (!user) {
    throw new Error('Usuario no encontrado')
  }

  // Obtener todos los roles del usuario (principal + adicionales)
  const allRoles = [
    user.role,
    ...user.userRoles.map(ur => ur.role)
  ]

  // Verificar que el nuevo rol activo esté en los roles del usuario
  if (!allRoles.includes(newActiveRole)) {
    throw new Error(`El usuario no tiene el rol ${newActiveRole}. Roles disponibles: ${allRoles.join(', ')}`)
  }

  // Actualizar el rol activo
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { activeRole: newActiveRole },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      activeRole: true,
      preferredCurrency: true,
      country: true,
      isActive: true,
      isVerified: true,
      isEmailVerified: true,
      isRootAdmin: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
      userRoles: {
        select: {
          role: true
        }
      }
    }
  })

  // Crear notificación sobre el cambio de rol
  try {
    const { createNotification } = await import('./notificationService')
    await createNotification({
      userId,
      type: 'ROLE_CHANGED' as any,
      title: 'Rol activo cambiado',
      message: `Tu rol activo ha sido cambiado a ${newActiveRole}`,
      priority: 'NORMAL' as any,
      channels: ['IN_APP' as any],
      data: {
        previousRole: user.activeRole || user.role,
        newRole: newActiveRole
      }
    })
  } catch (error) {
    // No fallar si la notificación no se puede crear
    console.error('Error creando notificación de cambio de rol:', error)
  }

  // Retornar usuario sin contraseña
  return updatedUser as any
}

export async function setUserRoles(userId: string, roles: UserRole[]): Promise<void> {
  // Verificar que el usuario existe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true }
  })

  if (!user) {
    throw new Error('Usuario no encontrado')
  }

  // El rol principal siempre está incluido
  const rolesToAdd = roles.filter(r => r !== user.role)

  // Eliminar todos los roles adicionales actuales
  await prisma.userRoleAssignment.deleteMany({
    where: { userId }
  })

  // Agregar los nuevos roles adicionales
  if (rolesToAdd.length > 0) {
    await prisma.userRoleAssignment.createMany({
      data: rolesToAdd.map(role => ({
        userId,
        role
      })),
      skipDuplicates: true
    })
  }
}





