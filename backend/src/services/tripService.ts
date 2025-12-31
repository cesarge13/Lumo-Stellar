/**
 * Servicio de gestión de viajes
 * Funcionalidades para administradores y pasajeros
 */

import { PrismaClient, TripStatus } from '@prisma/client'

const prisma = new PrismaClient()

export interface CreateTripData {
  originAddress: string
  originLatitude: number
  originLongitude: number
  destinationAddress: string
  destinationLatitude: number
  destinationLongitude: number
  originPlaceId?: string
  destinationPlaceId?: string
  passengers?: number
  isRoundTrip?: boolean
  returnScheduledAt?: Date
  preferredVehicleType?: string
  scheduledAt?: Date
  distance: number
  duration: number
  distanceText: string
  durationText: string
  basePrice: number
  distancePrice: number
  timePrice: number
  totalPrice: number
  currency?: string
  routePolyline?: string
  routeBounds?: any
}

export interface ListTripsOptions {
  page?: number
  limit?: number
  status?: TripStatus | TripStatus[]
  passengerId?: string
  driverId?: string
  search?: string
  startDate?: Date
  endDate?: Date
}

export interface ListTripsResult {
  trips: any[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Lista viajes con paginación y filtros
 */
export async function listTrips(options: ListTripsOptions = {}): Promise<ListTripsResult> {
  const page = options.page || 1
  const limit = options.limit || 20
  const skip = (page - 1) * limit

  const where: any = {}

  // Filtro por estado
  if (options.status) {
    if (Array.isArray(options.status)) {
      where.status = { in: options.status }
    } else {
      where.status = options.status
    }
  }

  // Filtro por pasajero
  if (options.passengerId) {
    where.passengerId = options.passengerId
  }

  // Filtro por conductor
  if (options.driverId) {
    where.driverId = options.driverId
  }

  // Filtro por fecha
  if (options.startDate || options.endDate) {
    where.createdAt = {}
    if (options.startDate) {
      where.createdAt.gte = options.startDate
    }
    if (options.endDate) {
      where.createdAt.lte = options.endDate
    }
  }

  // Búsqueda
  if (options.search) {
    where.OR = [
      { tripNumber: { contains: options.search, mode: 'insensitive' } },
      { originAddress: { contains: options.search, mode: 'insensitive' } },
      { destinationAddress: { contains: options.search, mode: 'insensitive' } },
      { passenger: { name: { contains: options.search, mode: 'insensitive' } } },
      { passenger: { email: { contains: options.search, mode: 'insensitive' } } },
      { driver: { name: { contains: options.search, mode: 'insensitive' } } },
      { driver: { email: { contains: options.search, mode: 'insensitive' } } },
    ]
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
            email: true,
            phone: true,
            avatar: true,
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
            licensePlate: true,
            color: true,
            type: true,
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
 * Obtiene un viaje por ID
 */
export async function getTripById(tripId: string) {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      passenger: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          preferredCurrency: true,
          country: true,
        },
      },
      driver: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true,
          country: true,
          stellarAddress: true,
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
      originPlace: {
        select: {
          id: true,
          country: true,
          formattedAddress: true,
        },
      },
      destinationPlace: {
        select: {
          id: true,
          country: true,
          formattedAddress: true,
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

  return trip
}

/**
 * Actualiza el estado de un viaje
 */
export async function updateTripStatus(tripId: string, status: TripStatus) {
  const updateData: any = { status }

  // Si se completa, establecer fecha de completado
  if (status === 'COMPLETED') {
    updateData.completedAt = new Date()
  }

  // Si se inicia, establecer fecha de inicio
  if (status === 'IN_PROGRESS') {
    updateData.startedAt = new Date()
  }

  const trip = await prisma.trip.update({
    where: { id: tripId },
    data: updateData,
    include: {
      passenger: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      driver: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  })

  return trip
}

/**
 * Asigna un conductor a un viaje
 */
export async function assignDriver(tripId: string, driverId: string, vehicleId?: string, allowReassign: boolean = false) {
  // Importar función para calcular deadline
  const { calculateAcceptanceDeadline } = await import('./driverService')
  
  // Obtener el viaje con información de lugares y conductor
  const trip = await prisma.trip.findUnique({
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
      driver: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!trip) {
    throw new Error('Viaje no encontrado')
  }

  // Si ya hay un conductor asignado y no se permite reasignar, verificar
  if (trip.driverId && trip.driverId !== driverId && !allowReassign) {
    throw new Error('El viaje ya tiene un conductor asignado. Usa la opción de cambiar conductor para reasignarlo.')
  }

  // Si hay un conductor anterior y se está reasignando, liberar el vehículo anterior
  if (trip.driverId && trip.driverId !== driverId && trip.vehicleId) {
    await prisma.vehicle.update({
      where: { id: trip.vehicleId },
      data: { isAvailable: true },
    })
  }

  // Obtener el conductor para verificar su país y rol
  const driver = await prisma.user.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      country: true,
      role: true,
      isActive: true,
      userRoles: {
        select: {
          role: true,
        },
      },
    },
  })

  if (!driver || !driver.isActive) {
    throw new Error('Conductor no encontrado o inactivo')
  }

  // Verificar que el usuario tiene rol DRIVER
  const hasDriverRole = driver.role === 'DRIVER' || 
                        driver.userRoles?.some(ur => ur.role === 'DRIVER')
  
  if (!hasDriverRole) {
    throw new Error('El usuario no tiene rol de conductor')
  }

  // Obtener el país del viaje (prioridad: originPlace > destinationPlace)
  const tripCountry = trip.originPlace?.country || trip.destinationPlace?.country

  // Validar que el conductor y el viaje estén en el mismo país
  if (tripCountry && driver.country && tripCountry !== driver.country) {
    throw new Error(`El conductor está en ${driver.country} pero el viaje está en ${tripCountry}. Los conductores solo pueden aceptar viajes en su mismo país.`)
  }

  const updateData: any = {
    driverId,
    driverRequestedAt: new Date(),
    acceptanceDeadline: calculateAcceptanceDeadline(5), // 5 minutos para aceptar
    // Si se está reasignando, resetear el estado de aceptación
    driverAcceptedAt: allowReassign ? null : undefined,
    driverRejectedAt: null,
    // No cambiar el status a CONFIRMED hasta que el conductor acepte
  }

  // Si el viaje ya estaba confirmado y se está reasignando, volver a PENDING
  if (allowReassign && trip.status === 'CONFIRMED') {
    updateData.status = 'PENDING'
  }

  if (vehicleId) {
    updateData.vehicleId = vehicleId
    // Marcar el vehículo como no disponible
    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { isAvailable: false },
    })
  }

  const updatedTrip = await prisma.trip.update({
    where: { id: tripId },
    data: updateData,
    include: {
      passenger: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      driver: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          make: true,
          model: true,
          licensePlate: true,
        },
      },
    },
  })

  return updatedTrip
}

/**
 * Cancela un viaje
 * Puede ser cancelado por pasajero, conductor o admin
 * Maneja pagos pendientes, liberación de vehículos y notificaciones
 */
export async function cancelTrip(
  tripId: string,
  cancelledBy: string,
  reason?: string,
  cancelledByRole?: 'PASSENGER' | 'DRIVER' | 'ADMIN'
) {
  // Obtener el viaje completo con relaciones
  const existingTrip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: {
      passenger: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      driver: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      vehicle: {
        select: {
          id: true,
          isAvailable: true,
        },
      },
      payments: {
        where: {
          status: {
            in: ['PENDING', 'PROCESSING'],
          },
        },
      },
    },
  })

  if (!existingTrip) {
    throw new Error('Viaje no encontrado')
  }

  // Validar que el viaje no esté ya cancelado o completado
  if (existingTrip.status === 'CANCELLED') {
    throw new Error('El viaje ya está cancelado')
  }

  if (existingTrip.status === 'COMPLETED') {
    throw new Error('No se puede cancelar un viaje completado')
  }

  // Validar permisos según el rol
  if (cancelledByRole === 'PASSENGER' && existingTrip.passengerId !== cancelledBy) {
    throw new Error('No tienes permiso para cancelar este viaje')
  }

  if (cancelledByRole === 'DRIVER' && existingTrip.driverId !== cancelledBy) {
    throw new Error('No tienes permiso para cancelar este viaje')
  }

  // Usar transacción para atomicidad
  return await prisma.$transaction(async (tx) => {
    // Actualizar el viaje
    const cancelReason = reason
      ? `Cancelado por ${cancelledByRole || 'sistema'}: ${reason}`
      : `Cancelado por ${cancelledByRole || 'sistema'}`

    const updateData: any = {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelledBy: cancelledBy,
      cancellationReason: reason || null,
      notes: existingTrip.notes
        ? `${existingTrip.notes}\n${cancelReason}`.trim()
        : cancelReason,
    }

    const trip = await tx.trip.update({
      where: { id: tripId },
      data: updateData,
      include: {
        passenger: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            make: true,
            model: true,
            licensePlate: true,
          },
        },
      },
    })

    // Liberar vehículo si estaba asignado
    if (existingTrip.vehicleId && existingTrip.vehicle) {
      await tx.vehicle.update({
        where: { id: existingTrip.vehicleId },
        data: { isAvailable: true },
      })
    }

    // Cancelar pagos pendientes
    if (existingTrip.payments.length > 0) {
      await tx.payment.updateMany({
        where: {
          tripId: tripId,
          status: {
            in: ['PENDING', 'PROCESSING'],
          },
        },
        data: {
          status: 'CANCELLED',
          failureReason: 'Viaje cancelado',
          processedAt: new Date(),
        },
      })
    }

    // Cancelar alertas de conductores pendientes
    await tx.driverAlert.updateMany({
      where: {
        tripId: tripId,
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED',
      },
    })

    // Crear notificaciones en background
    setImmediate(async () => {
      try {
        const { createNotification } = await import('./notificationService')
        const { NotificationType, NotificationPriority } = await import('@prisma/client')

        const notifications = []

        // Notificar al pasajero (si no fue él quien canceló)
        if (existingTrip.passengerId && cancelledByRole !== 'PASSENGER') {
          notifications.push({
            userId: existingTrip.passengerId,
            type: NotificationType.TRIP_CANCELLED,
            title: 'Viaje cancelado',
            message: cancelledByRole === 'DRIVER'
              ? `El conductor ha cancelado tu viaje ${existingTrip.tripNumber}${reason ? `: ${reason}` : ''}`
              : `Tu viaje ${existingTrip.tripNumber} ha sido cancelado${reason ? `: ${reason}` : ''}`,
            priority: NotificationPriority.HIGH,
            data: {
              tripId: tripId,
              tripNumber: existingTrip.tripNumber,
              cancelledBy: cancelledByRole,
              reason,
            },
            actionUrl: `/passenger/trips/${tripId}`,
            actionLabel: 'Ver detalles',
          })
        }

        // Notificar al conductor (si no fue él quien canceló y estaba asignado)
        if (existingTrip.driverId && cancelledByRole !== 'DRIVER') {
          notifications.push({
            userId: existingTrip.driverId,
            type: NotificationType.TRIP_CANCELLED,
            title: 'Viaje cancelado',
            message: cancelledByRole === 'PASSENGER'
              ? `El pasajero ha cancelado el viaje ${existingTrip.tripNumber}${reason ? `: ${reason}` : ''}`
              : `El viaje ${existingTrip.tripNumber} ha sido cancelado${reason ? `: ${reason}` : ''}`,
            priority: NotificationPriority.HIGH,
            data: {
              tripId: tripId,
              tripNumber: existingTrip.tripNumber,
              cancelledBy: cancelledByRole,
              reason,
            },
            actionUrl: `/driver/trips/${tripId}`,
            actionLabel: 'Ver detalles',
          })
        }

        // Crear notificaciones
        await Promise.all(
          notifications.map(n => createNotification(n).catch(() => null))
        )
      } catch (error) {
        console.error('Error creando notificaciones de cancelación:', error)
      }
    })

    return trip
  })
}

/**
 * Genera un número único de viaje
 */
async function generateTripNumber(): Promise<string> {
  const prefix = 'TRIP'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  const tripNumber = `${prefix}-${timestamp}-${random}`
  
  // Verificar que no exista
  const existing = await prisma.trip.findUnique({
    where: { tripNumber }
  })
  
  if (existing) {
    // Si existe, generar otro
    return generateTripNumber()
  }
  
  return tripNumber
}

/**
 * Crea un nuevo viaje
 */
export async function createTrip(
  passengerId: string,
  data: CreateTripData
) {
  // Generar número de viaje único
  const tripNumber = await generateTripNumber()

  // Buscar o crear lugares (Place) si se proporcionan placeIds
  let originPlaceId: string | undefined
  let destinationPlaceId: string | undefined

  if (data.originPlaceId) {
    const originPlace = await prisma.place.upsert({
      where: { placeId: data.originPlaceId },
      update: {
        lastFetched: new Date(),
      },
      create: {
        placeId: data.originPlaceId,
        formattedAddress: data.originAddress,
        latitude: data.originLatitude,
        longitude: data.originLongitude,
      },
    })
    originPlaceId = originPlace.id
  }

  if (data.destinationPlaceId) {
    const destinationPlace = await prisma.place.upsert({
      where: { placeId: data.destinationPlaceId },
      update: {
        lastFetched: new Date(),
      },
      create: {
        placeId: data.destinationPlaceId,
        formattedAddress: data.destinationAddress,
        latitude: data.destinationLatitude,
        longitude: data.destinationLongitude,
      },
    })
    destinationPlaceId = destinationPlace.id
  }

  // Crear el viaje
  const trip = await prisma.trip.create({
    data: {
      tripNumber,
      passengerId,
      originAddress: data.originAddress,
      originLatitude: data.originLatitude,
      originLongitude: data.originLongitude,
      destinationAddress: data.destinationAddress,
      destinationLatitude: data.destinationLatitude,
      destinationLongitude: data.destinationLongitude,
      originPlaceId,
      destinationPlaceId,
      passengers: data.passengers || 1,
      isRoundTrip: data.isRoundTrip || false,
      returnScheduledAt: data.returnScheduledAt,
      preferredVehicleType: data.preferredVehicleType as any,
      scheduledAt: data.scheduledAt,
      distance: data.distance,
      duration: data.duration,
      distanceText: data.distanceText,
      durationText: data.durationText,
      basePrice: data.basePrice,
      distancePrice: data.distancePrice,
      timePrice: data.timePrice,
      totalPrice: data.totalPrice,
      currency: data.currency || 'CLP',
      routePolyline: data.routePolyline,
      routeBounds: data.routeBounds,
      status: 'PENDING',
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
    },
  })

  // Enviar alertas a conductores disponibles (en background, no bloquea la respuesta)
  setImmediate(async () => {
    try {
      const { getAvailableDriversForTrip, broadcastTripToDrivers } = await import('./driverAlertService')
      const { createNotification } = await import('./notificationService')
      const { NotificationType, NotificationPriority } = await import('@prisma/client')

      // Obtener conductores disponibles
      const availableDrivers = await getAvailableDriversForTrip(trip.id, {
        preferredVehicleType: data.preferredVehicleType,
      })

      if (availableDrivers.length > 0) {
        const driverIds = availableDrivers.map(d => d.id)
        
        // Crear alertas para conductores (timeout de 1 minuto)
        await broadcastTripToDrivers(trip.id, driverIds)

        // Crear notificaciones para los conductores
        const notifications = driverIds.map(driverId => ({
          userId: driverId,
          type: NotificationType.TRIP_AVAILABLE,
          title: 'Nuevo viaje disponible',
          message: `Viaje ${trip.tripNumber}: ${data.originAddress} → ${data.destinationAddress}`,
          priority: NotificationPriority.HIGH,
          data: {
            tripId: trip.id,
            tripNumber: trip.tripNumber,
          },
          actionUrl: `/driver/trips/available`,
          actionLabel: 'Ver viaje',
        }))

        await Promise.all(notifications.map(n => createNotification(n).catch(() => null)))
      }

      // Crear notificación para el pasajero
      await createNotification({
        userId: passengerId,
        type: NotificationType.TRIP_CREATED,
        title: 'Viaje creado exitosamente',
        message: `Tu viaje ${trip.tripNumber} ha sido creado y está buscando conductor`,
        priority: NotificationPriority.NORMAL,
        data: {
          tripId: trip.id,
          tripNumber: trip.tripNumber,
        },
        actionUrl: `/passenger/trips/${trip.id}`,
        actionLabel: 'Ver viaje',
      }).catch(() => null)
    } catch (error) {
      console.error('Error enviando alertas de viaje:', error)
      // No fallar la creación del viaje si hay error en las alertas
    }
  })

  return trip
}
