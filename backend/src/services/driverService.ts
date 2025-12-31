/**
 * Servicio para gestión de conductores
 * Maneja la lógica de recepción, aceptación y rechazo de viajes
 */

import { PrismaClient, TripStatus, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

// Tiempo límite para aceptar un viaje (en minutos)
const ACCEPTANCE_DEADLINE_MINUTES = 5

/**
 * Obtiene viajes disponibles para un conductor
 * Viajes que:
 * - Están en estado PENDING
 * - No tienen conductor asignado
 * - O están asignados a este conductor pero aún no aceptados
 * - No han expirado el tiempo límite de aceptación
 */
export async function getAvailableTrips(driverId: string, options: {
  page?: number
  limit?: number
  vehicleType?: string
  maxDistance?: number
} = {}) {
  const page = options.page || 1
  const limit = options.limit || 20
  const skip = (page - 1) * limit

  const now = new Date()
  // Tiempo límite para considerar un viaje como "inmediato" (10 minutos)
  const IMMEDIATE_TRIP_THRESHOLD = 10 * 60 * 1000 // 10 minutos en milisegundos
  const immediateTripDeadline = new Date(now.getTime() + IMMEDIATE_TRIP_THRESHOLD)

  const where: any = {
    OR: [
      // Viajes sin conductor asignado (inmediatos o programados)
      {
        driverId: null,
        status: 'PENDING',
        AND: [
          {
            OR: [
              // Viajes inmediatos (sin fecha programada)
              { scheduledAt: null },
              // Viajes programados en los próximos 10 minutos (inmediatos)
              {
                scheduledAt: {
                  gte: now,
                  lte: immediateTripDeadline,
                },
              },
              // Viajes programados más adelante
              { scheduledAt: { gt: immediateTripDeadline } },
            ],
          },
        ],
      },
      // Viajes asignados a este conductor pero aún no aceptados
      {
        driverId,
        status: 'PENDING',
        driverAcceptedAt: null,
        driverRejectedAt: null,
        AND: [
          {
            OR: [
              { acceptanceDeadline: null },
              { acceptanceDeadline: { gt: now } },
            ],
          },
          {
            OR: [
              // Viajes inmediatos (sin fecha programada)
              { scheduledAt: null },
              // Viajes programados en los próximos 10 minutos (inmediatos)
              {
                scheduledAt: {
                  gte: now,
                  lte: immediateTripDeadline,
                },
              },
              // Viajes programados más adelante
              { scheduledAt: { gt: immediateTripDeadline } },
            ],
          },
        ],
      },
    ],
  }

  // Filtro por tipo de vehículo
  if (options.vehicleType && options.vehicleType !== 'ANY') {
    where.preferredVehicleType = options.vehicleType
  }

  // Filtro por distancia máxima (si el conductor tiene vehículos)
  // Esto se puede implementar más adelante con geolocalización

  const [allTrips, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      include: {
        passenger: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        originPlace: {
          select: {
            id: true,
            name: true,
            formattedAddress: true,
            latitude: true,
            longitude: true,
          },
        },
        destinationPlace: {
          select: {
            id: true,
            name: true,
            formattedAddress: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    }),
    prisma.trip.count({ where }),
  ])

  // Ordenar viajes: primero inmediatos, luego programados
  const sortedTrips = allTrips.sort((a, b) => {
    // Viajes sin fecha programada (inmediatos) primero
    if (!a.scheduledAt && b.scheduledAt) return -1
    if (a.scheduledAt && !b.scheduledAt) return 1
    
    // Si ambos tienen fecha, verificar si son inmediatos (próximos 10 min)
    const aIsImmediate = a.scheduledAt && 
      new Date(a.scheduledAt).getTime() <= immediateTripDeadline.getTime()
    const bIsImmediate = b.scheduledAt && 
      new Date(b.scheduledAt).getTime() <= immediateTripDeadline.getTime()
    
    // Viajes inmediatos antes que programados
    if (aIsImmediate && !bIsImmediate) return -1
    if (!aIsImmediate && bIsImmediate) return 1
    
    // Si ambos son del mismo tipo, ordenar por fecha
    if (a.scheduledAt && b.scheduledAt) {
      return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    }
    
    // Si ambos son inmediatos sin fecha, ordenar por creación (más recientes primero)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Aplicar paginación después del ordenamiento
  const trips = sortedTrips.slice(skip, skip + limit)

  return {
    trips,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

/**
 * Obtiene los viajes asignados a un conductor
 */
export async function getDriverTrips(driverId: string, options: {
  page?: number
  limit?: number
  status?: TripStatus | TripStatus[]
} = {}) {
  const page = options.page || 1
  const limit = options.limit || 20
  const skip = (page - 1) * limit

  const where: any = {
    driverId,
  }

  if (options.status) {
    if (Array.isArray(options.status)) {
      where.status = { in: options.status }
    } else {
      where.status = options.status
    }
  }

  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        passenger: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            licensePlate: true,
            type: true,
          },
        },
        originPlace: {
          select: {
            id: true,
            name: true,
            formattedAddress: true,
            latitude: true,
            longitude: true,
          },
        },
        destinationPlace: {
          select: {
            id: true,
            name: true,
            formattedAddress: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    }),
    prisma.trip.count({ where }),
  ])

  return {
    trips,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

/**
 * Obtiene detalles de un viaje para un conductor
 */
export async function getTripDetailsForDriver(tripId: string, driverId: string) {
  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      OR: [
        { driverId: null },
        { driverId },
      ],
    },
    include: {
      passenger: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          make: true,
          model: true,
          licensePlate: true,
          type: true,
        },
      },
      originPlace: {
        select: {
          id: true,
          name: true,
          formattedAddress: true,
          latitude: true,
          longitude: true,
        },
      },
      destinationPlace: {
        select: {
          id: true,
          name: true,
          formattedAddress: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  })

  if (!trip) {
    throw new Error('Viaje no encontrado o no disponible')
  }

  return trip
}

/**
 * Acepta un viaje
 * Usa el sistema de alertas para evitar race conditions
 * Si viene de una alerta, usa acceptTripFromAlert, sino usa el método tradicional
 */
export async function acceptTrip(tripId: string, driverId: string, vehicleId?: string, alertId?: string) {
  // Si viene de una alerta, usar el método de alertas (más seguro)
  if (alertId) {
    const { acceptTripFromAlert } = await import('./driverAlertService')
    return acceptTripFromAlert(alertId, driverId, vehicleId)
  }

  // Método tradicional (para compatibilidad)
  const now = new Date()

  // Verificar que el conductor existe y es activo
  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      role: true,
      isActive: true,
      country: true,
      vehicles: {
        where: { isAvailable: true },
        select: { id: true },
      },
    },
  })

  if (!driver || !driver.isActive) {
    throw new Error('Conductor no válido o inactivo')
  }

  // Verificar que el usuario tiene rol DRIVER (puede estar en role o en userRoles)
  // Obtener roles adicionales si es necesario
  let hasDriverRole = driver.role === UserRole.DRIVER
  
  if (!hasDriverRole) {
    const userRoles = await (prisma as any).userRoleAssignment.findMany({
      where: { userId: driverId, role: UserRole.DRIVER },
    })
    hasDriverRole = userRoles.length > 0
  }
  
  if (!hasDriverRole) {
    throw new Error('El usuario no tiene rol de conductor')
  }

  // Usar transacción para atomicidad
  return await prisma.$transaction(async (tx) => {
    // Verificar que el viaje existe y está disponible (con lock)
    const trip = await tx.trip.findUnique({
      where: { id: tripId },
      include: {
        originPlace: {
          select: {
            country: true,
          },
        },
        destinationPlace: {
          select: {
            country: true,
          },
        },
      },
    })

    if (!trip) {
      throw new Error('Viaje no encontrado')
    }

    if (trip.status !== TripStatus.PENDING) {
      throw new Error('El viaje ya no está disponible')
    }

    // Verificar que no fue aceptado por otro conductor
    if (trip.driverId && trip.driverId !== driverId) {
      throw new Error('El viaje ya fue aceptado por otro conductor')
    }

    // Verificar tiempo límite
    if (trip.acceptanceDeadline && trip.acceptanceDeadline < now) {
      throw new Error('El tiempo límite para aceptar este viaje ha expirado')
    }

    // Validar que el conductor y el viaje estén en el mismo país
    const tripCountry = trip.originPlace?.country || trip.destinationPlace?.country
    if (tripCountry && driver.country && tripCountry !== driver.country) {
      throw new Error(`No puedes aceptar este viaje. Estás en ${driver.country} pero el viaje está en ${tripCountry}. Solo puedes aceptar viajes en tu mismo país.`)
    }

    // Verificar que el conductor no tenga otro viaje activo EN ESTE MOMENTO
    // Solo considerar viajes que están realmente en curso (no programados para el futuro)
    const activeTrip = await tx.trip.findFirst({
      where: {
        driverId,
        status: {
          in: [TripStatus.CONFIRMED, TripStatus.IN_PROGRESS],
        },
        OR: [
          // Viaje sin fecha programada (inmediato)
          { scheduledAt: null },
          // Viaje programado que ya comenzó o está por comenzar (dentro de los próximos 30 minutos)
          {
            scheduledAt: {
              lte: new Date(Date.now() + 30 * 60 * 1000), // 30 minutos de margen
            },
          },
        ],
      },
    })

    if (activeTrip) {
      throw new Error('Ya tienes un viaje activo. Completa el viaje actual antes de aceptar otro.')
    }

    // Verificar conflictos de tiempo con viajes programados
    // Calcular el tiempo de inicio y fin del nuevo viaje
    const newTripStart = trip.scheduledAt || now
    const newTripDuration = trip.duration * 1000 // convertir minutos a milisegundos
    const newTripEnd = new Date(newTripStart.getTime() + newTripDuration)
    
    // Si es viaje de ida y vuelta, considerar también el tiempo de vuelta
    let newTripFinalEnd = newTripEnd
    if (trip.isRoundTrip && trip.returnScheduledAt) {
      const returnDuration = trip.duration * 1000
      newTripFinalEnd = new Date(new Date(trip.returnScheduledAt).getTime() + returnDuration)
    }

    // Buscar viajes programados que puedan tener conflictos
    const conflictingTrips = await tx.trip.findMany({
      where: {
        driverId,
        status: {
          in: [TripStatus.PENDING, TripStatus.CONFIRMED],
        },
        id: {
          not: tripId, // Excluir el viaje actual
        },
        OR: [
          // Viaje programado que comienza antes de que termine el nuevo viaje
          {
            scheduledAt: {
              not: null,
              lte: newTripFinalEnd,
            },
          },
          // Viaje de ida y vuelta que puede tener conflicto
          {
            returnScheduledAt: {
              not: null,
              lte: newTripFinalEnd,
            },
          },
        ],
      },
    })

    // Verificar conflictos detallados
    for (const existingTrip of conflictingTrips) {
      const existingStart = existingTrip.scheduledAt || now
      const existingDuration = existingTrip.duration * 1000
      const existingEnd = new Date(existingStart.getTime() + existingDuration)
      
      // Si es viaje de ida y vuelta, considerar también el tiempo de vuelta
      let existingFinalEnd = existingEnd
      if (existingTrip.isRoundTrip && existingTrip.returnScheduledAt) {
        const returnDuration = existingTrip.duration * 1000
        existingFinalEnd = new Date(new Date(existingTrip.returnScheduledAt).getTime() + returnDuration)
      }

      // Verificar si hay solapamiento
      // Hay conflicto si:
      // 1. El viaje existente comienza antes de que termine el nuevo viaje
      // 2. Y el viaje existente termina después de que comience el nuevo viaje
      const hasOverlap = existingStart < newTripFinalEnd && existingFinalEnd > newTripStart

      if (hasOverlap) {
        // Calcular tiempo mínimo necesario entre servicios (30 minutos de margen)
        const MIN_BUFFER_MINUTES = 30
        const minTimeBetween = MIN_BUFFER_MINUTES * 60 * 1000
        
        // Verificar si hay suficiente tiempo entre servicios
        const timeBetween = Math.abs(newTripStart.getTime() - existingFinalEnd.getTime())
        const timeBetweenReverse = Math.abs(existingStart.getTime() - newTripFinalEnd.getTime())
        
        if (timeBetween < minTimeBetween && timeBetweenReverse < minTimeBetween) {
          const existingTripNumber = existingTrip.tripNumber
          const existingScheduledAt = existingTrip.scheduledAt 
            ? new Date(existingTrip.scheduledAt).toLocaleString('es-CL', { timeZone: 'America/Santiago' })
            : 'inmediato'
          
          throw new Error(
            `Tienes un conflicto de horario con el viaje ${existingTripNumber} programado para ${existingScheduledAt}. ` +
            `Necesitas al menos ${MIN_BUFFER_MINUTES} minutos entre servicios.`
          )
        }
      }
    }

    // Si se especifica un vehículo, verificar que pertenece al conductor
    if (vehicleId) {
      const vehicle = await tx.vehicle.findFirst({
        where: {
          id: vehicleId,
          userId: driverId,
          isAvailable: true,
        },
      })

      if (!vehicle) {
        throw new Error('Vehículo no válido o no disponible')
      }
    }

    // Generar PIN y QR para iniciar el viaje
    const { generateStartPin, generateStartQrCode } = await import('../utils/tripSecurity')
    const startPin = generateStartPin()
    const startPinExpiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000) // Expira en 2 horas
    const startQrCode = await generateStartQrCode(tripId, startPin)

    // Verificar atomicidad: solo actualizar si el viaje sigue disponible
    const tripCheck = await tx.trip.findUnique({
      where: { id: tripId },
    })

    if (!tripCheck || tripCheck.status !== TripStatus.PENDING) {
      throw new Error('El viaje ya no está disponible')
    }

    if (tripCheck.driverId && tripCheck.driverId !== driverId) {
      throw new Error('El viaje ya fue aceptado por otro conductor')
    }

    // Actualizar el viaje
    const updatedTrip = await tx.trip.update({
      where: { id: tripId },
      data: {
        driverId,
        vehicleId: vehicleId || undefined,
        status: TripStatus.CONFIRMED,
        driverAcceptedAt: now,
        driverRequestedAt: trip.driverRequestedAt || now,
        ...(startPin && { startPin }),
        ...(startPinExpiresAt && { startPinExpiresAt }),
        ...(startQrCode && { startQrCode }),
      } as any,
      include: {
        passenger: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            licensePlate: true,
            type: true,
          },
        },
      },
    })

    // Si se asignó un vehículo, marcarlo como no disponible
    if (vehicleId) {
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { isAvailable: false },
      })
    }


    // Crear notificaciones
    setImmediate(async () => {
      try {
        const { createNotification } = await import('./notificationService')
        const { NotificationType, NotificationPriority } = await import('@prisma/client')

        // Notificar al pasajero con PIN y QR
        if (updatedTrip?.passengerId) {
          await createNotification({
            userId: updatedTrip.passengerId,
            type: NotificationType.TRIP_ACCEPTED,
            title: 'Viaje aceptado',
            message: `El conductor ha aceptado tu viaje ${trip.tripNumber}. PIN de inicio: ${startPin}`,
            priority: NotificationPriority.HIGH,
            data: {
              tripId: tripId,
              tripNumber: trip.tripNumber,
              startPin,
              startQrCode,
            },
            actionUrl: `/passenger/trips/${tripId}`,
            actionLabel: 'Ver viaje',
          }).catch(() => null)
        }
      } catch (error) {
        console.error('Error creando notificaciones:', error)
      }
    })

    return updatedTrip!
  })
}

/**
 * Rechaza un viaje
 */
export async function rejectTrip(tripId: string, driverId: string, reason?: string) {
  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      OR: [
        { driverId: null },
        { driverId },
      ],
      status: TripStatus.PENDING,
    },
  })

  if (!trip) {
    throw new Error('Viaje no encontrado o no disponible para rechazar')
  }

  // Si el viaje ya estaba asignado a este conductor, marcar como rechazado
  if (trip.driverId === driverId) {
    await prisma.trip.update({
      where: { id: tripId },
      data: {
        driverRejectedAt: new Date(),
        driverId: null, // Liberar el viaje para otros conductores
        notes: reason ? `${trip.notes || ''}\n[Rechazado por conductor: ${reason}]`.trim() : trip.notes,
      },
    })
  }

  return { success: true }
}

/**
 * Calcula el tiempo límite de aceptación
 */
export function calculateAcceptanceDeadline(minutes: number = ACCEPTANCE_DEADLINE_MINUTES): Date {
  const deadline = new Date()
  deadline.setMinutes(deadline.getMinutes() + minutes)
  return deadline
}

/**
 * Inicia un viaje
 * Requiere verificación GPS (conductor cerca del origen) y PIN o QR
 */
export async function startTrip(
  tripId: string,
  driverId: string,
  options: {
    pin?: string
    qrCode?: string
    driverLatitude?: number
    driverLongitude?: number
  }
) {
  const {
    validateStartPin,
    validateStartQrCode,
    isDriverNearOrigin,
  } = await import('../utils/tripSecurity')

  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      driverId,
      status: TripStatus.CONFIRMED,
    },
  })

  if (!trip) {
    throw new Error('Viaje no encontrado o no está confirmado')
  }

  const tripStartPin = (trip as any).startPin
  const tripStartPinExpiresAt = (trip as any).startPinExpiresAt
  const now = new Date()

  if (!tripStartPin) {
    throw new Error('El viaje no tiene PIN de inicio generado')
  }

  // Verificar que el PIN no haya expirado por tiempo (2 horas desde generación)
  if (tripStartPinExpiresAt && tripStartPinExpiresAt < now) {
    throw new Error('El PIN de inicio ha expirado. Contacta al pasajero para obtener uno nuevo.')
  }

  // Verificar que la hora de inicio del viaje haya llegado (si está programado)
  // Si el viaje está programado, el PIN solo es válido desde la hora de inicio en adelante
  if (trip.scheduledAt) {
    const scheduledTime = new Date(trip.scheduledAt)
    // Permitir 15 minutos de margen antes de la hora programada
    const marginMinutes = 15
    const earliestValidTime = new Date(scheduledTime.getTime() - marginMinutes * 60 * 1000)
    
    if (now < earliestValidTime) {
      const timeUntilStart = Math.ceil((scheduledTime.getTime() - now.getTime()) / (60 * 1000))
      throw new Error(
        `El PIN de inicio solo será válido a partir de la hora programada del viaje. ` +
        `El viaje está programado para ${scheduledTime.toLocaleString('es-CL')} ` +
        `(en ${timeUntilStart} minutos).`
      )
    }
  }

  // Verificar PIN o QR
  let pinValid = false
  if (options.pin) {
    pinValid = validateStartPin(options.pin, tripStartPin)
  } else if (options.qrCode) {
    pinValid = validateStartQrCode(options.qrCode, tripId, tripStartPin)
  } else {
    throw new Error('Debes proporcionar un PIN o escanear el código QR')
  }

  if (!pinValid) {
    throw new Error('PIN o código QR inválido')
  }

  // Verificar GPS si se proporciona
  if (options.driverLatitude !== undefined && options.driverLongitude !== undefined) {
    const isNear = isDriverNearOrigin(
      options.driverLatitude,
      options.driverLongitude,
      trip.originLatitude,
      trip.originLongitude,
      100 // 100 metros de tolerancia
    )

    if (!isNear) {
      const { calculateDistance: calcDist } = await import('../utils/tripSecurity')
      const distance = calcDist(
        options.driverLatitude,
        options.driverLongitude,
        trip.originLatitude,
        trip.originLongitude
      )
      throw new Error(
        `Debes estar cerca del origen para iniciar el viaje. Distancia actual: ${Math.round(distance)}m (máximo: 100m)`
      )
    }
  }

  // Actualizar el viaje
  const updatedTrip = await prisma.trip.update({
    where: { id: tripId },
    data: {
      status: TripStatus.IN_PROGRESS,
      startedAt: new Date(),
    },
    include: {
      passenger: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          make: true,
          model: true,
          licensePlate: true,
          type: true,
        },
      },
    },
  })

  // Crear notificaciones
  setImmediate(async () => {
    try {
      const { createNotification } = await import('./notificationService')
      const { NotificationType, NotificationPriority } = await import('@prisma/client')

      // Notificar al pasajero
      if (updatedTrip.passengerId) {
        await createNotification({
          userId: updatedTrip.passengerId,
          type: NotificationType.TRIP_IN_PROGRESS,
          title: 'Viaje iniciado',
          message: `El conductor ha iniciado tu viaje ${trip.tripNumber}`,
          priority: NotificationPriority.HIGH,
          data: {
            tripId: tripId,
            tripNumber: trip.tripNumber,
          },
          actionUrl: `/passenger/trips/${tripId}`,
          actionLabel: 'Ver viaje',
        }).catch(() => null)
      }
    } catch (error) {
      console.error('Error creando notificaciones:', error)
    }
  })

  return updatedTrip
}

/**
 * Renueva el PIN de inicio de un viaje
 * Solo puede ser llamado por el pasajero del viaje
 */
export async function renewStartPin(tripId: string, passengerId: string) {
  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      passengerId,
      status: TripStatus.CONFIRMED,
    },
  })

  if (!trip) {
    throw new Error('Viaje no encontrado, no está confirmado o no tienes permiso para renovar el PIN')
  }

  if (!trip.driverId) {
    throw new Error('El viaje aún no tiene conductor asignado')
  }

  // Generar nuevo PIN y QR
  const { generateStartPin, generateStartQrCode } = await import('../utils/tripSecurity')
  const now = new Date()
  const startPin = generateStartPin()
  // El PIN expira en 2 horas o hasta 1 hora después de la hora programada (lo que sea mayor)
  let startPinExpiresAt: Date
  if (trip.scheduledAt) {
    const scheduledTime = new Date(trip.scheduledAt)
    const expiresAfterScheduled = new Date(scheduledTime.getTime() + 60 * 60 * 1000) // 1 hora después de la hora programada
    const expiresAfterNow = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 horas desde ahora
    startPinExpiresAt = expiresAfterScheduled > expiresAfterNow ? expiresAfterScheduled : expiresAfterNow
  } else {
    startPinExpiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 horas
  }
  const startQrCode = await generateStartQrCode(tripId, startPin)

  // Actualizar el viaje con el nuevo PIN
  const updatedTrip = await prisma.trip.update({
    where: { id: tripId },
    data: {
      startPin,
      startPinExpiresAt,
      startQrCode,
    } as any,
    include: {
      driver: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
    },
  })

  // Notificar al conductor sobre el nuevo PIN
  setImmediate(async () => {
    try {
      const { createNotification } = await import('./notificationService')
      const { NotificationType, NotificationPriority } = await import('@prisma/client')

      if (updatedTrip.driverId) {
        await createNotification({
          userId: updatedTrip.driverId,
          type: NotificationType.TRIP_AVAILABLE,
          title: 'PIN de inicio renovado',
          message: `El pasajero ha renovado el PIN de inicio para el viaje ${trip.tripNumber}. Nuevo PIN: ${startPin}`,
          priority: NotificationPriority.HIGH,
          data: {
            tripId: tripId,
            tripNumber: trip.tripNumber,
            newPin: startPin,
          },
          actionUrl: `/driver/trips/${tripId}`,
          actionLabel: 'Ver viaje',
        }).catch(() => null)
      }
    } catch (error) {
      console.error('Error creando notificación de PIN renovado:', error)
    }
  })

  return {
    startPin,
    startPinExpiresAt,
    startQrCode,
  }
}

/**
 * Completa un viaje
 * El conductor debe estar cerca del destino para completar
 * Genera automáticamente el QR de pago Stellar usando la dirección del conductor
 */
export async function completeTrip(
  tripId: string,
  driverId: string,
  options?: {
    driverLatitude?: number
    driverLongitude?: number
  }
) {
  const { isDriverNearOrigin, calculateDistance } = await import('../utils/tripSecurity')

  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      driverId,
      status: TripStatus.IN_PROGRESS,
    },
  })

  if (!trip) {
    throw new Error('Viaje no encontrado o no está en progreso')
  }

  // Verificar GPS si se proporciona (deshabilitado para pruebas)
  // TODO: Habilitar validación GPS en producción
  // if (options?.driverLatitude !== undefined && options?.driverLongitude !== undefined) {
  //   const isNear = isDriverNearOrigin(
  //     options.driverLatitude,
  //     options.driverLongitude,
  //     trip.destinationLatitude,
  //     trip.destinationLongitude,
  //     100 // 100 metros de tolerancia
  //   )

  //   if (!isNear) {
  //     const distance = calculateDistance(
  //       options.driverLatitude,
  //       options.driverLongitude,
  //       trip.destinationLatitude,
  //       trip.destinationLongitude
  //     )
  //     throw new Error(
  //       `Debes estar cerca del destino para completar el viaje. Distancia actual: ${Math.round(distance)}m (máximo: 100m)`
  //     )
  //   }
  // }

  // Obtener información del conductor para generar QR de pago
  // IMPORTANTE: Usar la dirección Stellar real del conductor conectada con Freighter
  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: { 
      stellarAddress: true,
      name: true,
      email: true,
    } as any,
  }) as any

  if (!driver?.stellarAddress) {
    throw new Error('El conductor no tiene una dirección Stellar configurada. Debe conectar su billetera Freighter en su perfil para recibir pagos.')
  }

  // Validar que la dirección Stellar tenga el formato correcto (debe empezar con G y tener 56 caracteres)
  if (!driver.stellarAddress.startsWith('G') || driver.stellarAddress.length !== 56) {
    throw new Error('La dirección Stellar del conductor no es válida. Debe ser una dirección Stellar válida que empiece con G y tenga 56 caracteres.')
  }

  console.log(`✅ Generando QR de pago para conductor ${driver.name} (${driver.email})`)
  console.log(`📍 Dirección Stellar del conductor: ${driver.stellarAddress}`)

  // Generar código QR de pago Stellar
  const { generateStellarPaymentQR, convertCLPToXLM } = await import('./stellarService')
  
  // Convertir precio CLP a XLM (en producción, usar API de conversión)
  const xlmAmount = convertCLPToXLM(trip.totalPrice, 0.1) // TODO: Obtener rate real
  
  // Generar QR con transacción construida correctamente
  const paymentQR = await generateStellarPaymentQR({
    destination: driver.stellarAddress,
    amount: xlmAmount,
    memo: `Viaje ${trip.tripNumber}`,
    asset: 'XLM',
    networkPassphrase: process.env.STELLAR_NETWORK === 'mainnet' 
      ? 'Public Global Stellar Network ; September 2015'
      : 'Test SDF Network ; September 2015', // Testnet por defecto
  })

  // Crear registro de pago pendiente
  const payment = await prisma.payment.create({
    data: {
      userId: trip.passengerId || undefined,
      tripId: trip.id,
      amount: trip.totalPrice,
      currency: trip.currency,
      fee: 0,
      netAmount: trip.totalPrice,
      method: 'STELLAR' as any,
      status: 'PENDING',
      paymentMethodDetails: {
        stellarAddress: driver.stellarAddress,
        xlmAmount,
        paymentUrl: paymentQR.paymentUrl,
      },
    },
  })

  // Actualizar el viaje con información de pago (NO marcar como COMPLETED aún)
  const updatedTrip = await prisma.trip.update({
    where: { id: tripId },
    data: {
      completedAt: new Date(), // Marcar como completado por el conductor
      paymentQrCode: paymentQR.qrCode,
      paymentAddress: paymentQR.paymentAddress,
      paymentExpiresAt: paymentQR.expiresAt,
      // NO cambiar status a COMPLETED hasta que se verifique el pago
    } as any,
    include: {
      passenger: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          make: true,
          model: true,
          licensePlate: true,
          type: true,
        },
      },
    },
  })

  // Si se asignó un vehículo, marcarlo como disponible
  if (updatedTrip.vehicleId) {
    await prisma.vehicle.update({
      where: { id: updatedTrip.vehicleId },
      data: { isAvailable: true },
    })
  }

  // Crear notificaciones
  setImmediate(async () => {
    try {
      const { createNotification } = await import('./notificationService')
      const { NotificationType, NotificationPriority } = await import('@prisma/client')

      // Notificar al pasajero que debe realizar el pago
      if (updatedTrip.passengerId) {
        await createNotification({
          userId: updatedTrip.passengerId,
          type: NotificationType.PAYMENT_PENDING,
          title: 'Viaje completado - Pago pendiente',
          message: `Tu viaje ${trip.tripNumber} ha sido completado. Escanea el código QR para realizar el pago con Freighter.`,
          priority: NotificationPriority.HIGH,
          data: {
            tripId: tripId,
            tripNumber: trip.tripNumber,
            paymentId: payment.id,
          },
          actionUrl: `/passenger/trips/${tripId}`,
          actionLabel: 'Pagar ahora',
        }).catch(() => null)
      }
    } catch (error) {
      console.error('Error creando notificaciones:', error)
    }
  })

  // Retornar información adicional del pago
  return {
    ...updatedTrip,
    paymentId: payment.id,
    paymentQR: paymentQR.qrCode,
    paymentAddress: paymentQR.paymentAddress,
  } as any
}



