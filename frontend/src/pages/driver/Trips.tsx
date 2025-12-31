import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MapPin, Clock, Users, ArrowLeft, Navigation, CheckCircle, Play, Map as MapIcon, AlertCircle, MessageCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrency } from '@/hooks/useCurrency'
import type { Trip } from '@/types'
import { TripStatus } from '@/types'
import { StartTripDialog } from '@/components/trips/StartTripDialog'
import { generateArrivalMessage, openWhatsApp } from '@/utils/whatsapp'
import { CancelTripDialog } from '@/components/trips/CancelTripDialog'

export default function DriverTrips() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const { formatConvertedAmount, formatAmount, format, convertSync } = useCurrency()
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [formattedPrices, setFormattedPrices] = useState<Record<string, string>>({})
  const [selectedTripPrice, setSelectedTripPrice] = useState<string>('')
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    if (id) {
      loadTripDetails(id)
    } else {
      loadTrips()
    }
  }, [user, navigate, page, statusFilter, id])

  const loadTrips = async () => {
    try {
      setIsLoading(true)
      const status = statusFilter === 'ALL' ? undefined : [statusFilter as TripStatus]
      const result = await api.getDriverTrips({
        page,
        limit: 20,
        status,
      })
      setTrips(result.trips)
      setTotalPages(result.totalPages)

      // Formatear precios de forma asíncrona
      const prices: Record<string, string> = {}
      for (const trip of result.trips) {
        const formatted = await formatConvertedAmount(trip.totalPrice, trip.currency)
        prices[trip.id] = formatted
      }
      setFormattedPrices(prices)
    } catch (error) {
      console.error('Error loading trips:', error)
      toast.error(t('driver.loadError') || 'Error al cargar viajes')
    } finally {
      setIsLoading(false)
    }
  }

  const loadTripDetails = async (tripId: string) => {
    try {
      setIsLoading(true)
      const trip = await api.getDriverTrip(tripId)
      setSelectedTrip(trip)
      
      // Formatear precio del viaje seleccionado
      const formatted = await formatConvertedAmount(trip.totalPrice, trip.currency)
      setSelectedTripPrice(formatted)
    } catch (error) {
      console.error('Error loading trip details:', error)
      toast.error(t('driver.loadError') || 'Error al cargar detalles del viaje')
      navigate('/driver/trips')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      PENDING: { label: t('trip.status.pending') || 'Pendiente', variant: 'outline' },
      CONFIRMED: { label: t('trip.status.confirmed') || 'Confirmado', variant: 'default' },
      IN_PROGRESS: { label: t('trip.status.inProgress') || 'En Progreso', variant: 'default' },
      COMPLETED: { label: t('trip.status.completed') || 'Completado', variant: 'secondary' },
      CANCELLED: { label: t('trip.status.cancelled') || 'Cancelado', variant: 'destructive' },
    }
    const statusInfo = statusMap[status] || { label: status, variant: 'outline' as const }
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }

  // Verificar si un viaje expiró
  const isTripExpired = (trip: Trip): { expired: boolean; reason: 'time' | 'noResponse' | null } => {
    const now = new Date()
    
    // Si tiene acceptanceDeadline y expiró, es por falta de respuesta
    if (trip.acceptanceDeadline && new Date(trip.acceptanceDeadline) < now) {
      return { expired: true, reason: 'noResponse' }
    }
    
    // Para viajes no programados (inmediatos), verificar si expiraron por tiempo
    // Un viaje inmediato expira después de 30 minutos sin respuesta
    if (!trip.scheduledAt && trip.status === 'PENDING') {
      const createdAt = new Date(trip.createdAt)
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)
      if (createdAt < thirtyMinutesAgo) {
        return { expired: true, reason: 'time' }
      }
    }
    
    // Para viajes programados, verificar si la fecha programada ya pasó
    if (trip.scheduledAt && trip.status === 'PENDING') {
      const scheduledTime = new Date(trip.scheduledAt)
      // Si el viaje estaba programado para hace más de 1 hora, considerarlo expirado
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      if (scheduledTime < oneHourAgo) {
        return { expired: true, reason: 'time' }
      }
    }
    
    return { expired: false, reason: null }
  }

  const getExpirationBadge = (trip: Trip) => {
    const expiration = isTripExpired(trip)
    if (!expiration.expired) return null
    
    if (expiration.reason === 'noResponse') {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          {t('trip.expiredNoResponse') || 'Expirado - Sin respuesta'}
        </Badge>
      )
    }
    
    if (expiration.reason === 'time') {
      return (
        <Badge variant="destructive" className="text-xs">
          <AlertCircle className="h-3 w-3 mr-1" />
          {t('trip.expiredTime') || 'Expirado - Tiempo agotado'}
        </Badge>
      )
    }
    
    return null
  }

  const filteredTrips = trips.filter(trip => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      trip.tripNumber.toLowerCase().includes(searchLower) ||
      trip.originAddress.toLowerCase().includes(searchLower) ||
      trip.destinationAddress.toLowerCase().includes(searchLower) ||
      trip.passenger?.name.toLowerCase().includes(searchLower)
    )
  })

  if (isLoading && !selectedTrip) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p>{t('common.loading') || 'Cargando...'}</p>
          </div>
        </div>
      </div>
    )
  }

  // Vista de detalles del viaje
  if (selectedTrip) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => {
            setSelectedTrip(null)
            navigate('/driver/trips')
          }}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back') || 'Volver'}
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">{selectedTrip.tripNumber}</CardTitle>
                <CardDescription>
                  {t('driver.tripDetails') || 'Detalles del viaje'}
                </CardDescription>
              </div>
              {getStatusBadge(selectedTrip.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Información del pasajero */}
            {selectedTrip.passenger && (
              <div>
                <h3 className="font-semibold mb-3">{t('driver.passengerInfo') || 'Información del Pasajero'}</h3>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-semibold">{selectedTrip.passenger.name}</div>
                  {selectedTrip.passenger.phone && (
                    <div className="text-sm text-muted-foreground mt-1">{selectedTrip.passenger.phone}</div>
                  )}
                  {selectedTrip.passenger.email && (
                    <div className="text-sm text-muted-foreground">{selectedTrip.passenger.email}</div>
                  )}
                </div>
              </div>
            )}

            {/* Ruta */}
            <div>
              <h3 className="font-semibold mb-3">{t('driver.route') || 'Ruta'}</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <MapPin className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-1">
                      {t('driver.origin') || 'Origen'}
                    </div>
                    <div className="font-medium">{selectedTrip.originAddress}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <Navigation className="h-5 w-5 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground mb-1">
                      {t('driver.destination') || 'Destino'}
                    </div>
                    <div className="font-medium">{selectedTrip.destinationAddress}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detalles */}
            <div>
              <h3 className="font-semibold mb-3">{t('driver.tripDetails') || 'Detalles del Viaje'}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg bg-card">
                  <div className="text-sm text-muted-foreground mb-1">
                    {t('driver.distance') || 'Distancia'}
                  </div>
                  <div className="font-semibold text-lg">{selectedTrip.distanceText}</div>
                </div>
                <div className="p-4 border rounded-lg bg-card">
                  <div className="text-sm text-muted-foreground mb-1">
                    {t('driver.duration') || 'Duración'}
                  </div>
                  <div className="font-semibold text-lg">{selectedTrip.durationText}</div>
                </div>
                <div className="p-4 border rounded-lg bg-card">
                  <div className="text-sm text-muted-foreground mb-1">
                    {t('driver.passengers') || 'Pasajeros'}
                  </div>
                  <div className="font-semibold text-lg">{selectedTrip.passengers}</div>
                </div>
                <div className="p-4 border rounded-lg bg-primary/10">
                  <div className="text-sm text-muted-foreground mb-1">
                    {t('driver.price') || 'Precio'}
                  </div>
                  <div className="font-semibold text-lg text-primary">
                    {selectedTripPrice || formatAmount(selectedTrip.totalPrice, selectedTrip.currency)}
                  </div>
                  {selectedTrip.isRoundTrip && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {t('driver.roundTrip') || 'Viaje de ida y vuelta'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Vehículo asignado */}
            {selectedTrip.vehicle && (
              <div>
                <h3 className="font-semibold mb-3">{t('driver.assignedVehicle') || 'Vehículo Asignado'}</h3>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-semibold">
                    {selectedTrip.vehicle.make} {selectedTrip.vehicle.model}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {selectedTrip.vehicle.licensePlate}
                  </div>
                </div>
              </div>
            )}

            {/* Fechas */}
            <div>
              <h3 className="font-semibold mb-3">{t('driver.dates') || 'Fechas'}</h3>
              <div className="space-y-2 text-sm">
                {selectedTrip.scheduledAt && (
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span className="text-muted-foreground">
                      {t('driver.scheduledAt') || 'Programado para'}
                    </span>
                    <span className="font-medium">{new Date(selectedTrip.scheduledAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedTrip.driverAcceptedAt && (
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span className="text-muted-foreground">
                      {t('driver.acceptedAt') || 'Aceptado'}
                    </span>
                    <span className="font-medium">{new Date(selectedTrip.driverAcceptedAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedTrip.startedAt && (
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span className="text-muted-foreground">
                      {t('driver.startedAt') || 'Iniciado'}
                    </span>
                    <span className="font-medium">{new Date(selectedTrip.startedAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedTrip.completedAt && (
                  <div className="flex justify-between p-2 bg-muted rounded">
                    <span className="text-muted-foreground">
                      {t('driver.completedAt') || 'Completado'}
                    </span>
                    <span className="font-medium">{new Date(selectedTrip.completedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Acciones */}
            <div className="pt-4 border-t space-y-2">
              {(selectedTrip.status === TripStatus.CONFIRMED || selectedTrip.status === TripStatus.IN_PROGRESS) && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate(`/driver/trips/${selectedTrip.id}/track`)}
                >
                  <MapIcon className="h-4 w-4 mr-2" />
                  {t('driver.trackTrip') || 'Ver Ruta'}
                </Button>
              )}
              {selectedTrip.status === TripStatus.CONFIRMED && selectedTrip.passenger?.phone && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    if (!selectedTrip.passenger?.phone) {
                      toast.error(t('driver.passengerNoWhatsApp') || 'El pasajero no tiene número de WhatsApp registrado')
                      return
                    }

                    const message = generateArrivalMessage({
                      tripNumber: selectedTrip.tripNumber,
                      originAddress: selectedTrip.originAddress,
                      driverName: user?.name,
                      vehicleInfo: selectedTrip.vehicle ? `${selectedTrip.vehicle.make} ${selectedTrip.vehicle.model} - ${selectedTrip.vehicle.licensePlate}` : undefined,
                    })

                    try {
                      openWhatsApp(selectedTrip.passenger.phone, message)
                      toast.success(t('driver.whatsappOpened') || 'WhatsApp abierto con el mensaje')
                    } catch (error: any) {
                      toast.error(error.message || t('driver.whatsappError') || 'Error al abrir WhatsApp')
                    }
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {t('driver.contactPassenger') || 'Contactar Pasajero'}
                </Button>
              )}
              {selectedTrip.status === TripStatus.CONFIRMED && (
                <StartTripDialog
                  trip={selectedTrip}
                  onStart={() => {
                    loadTripDetails(selectedTrip.id)
                  }}
                  trigger={
                    <Button className="w-full" size="lg">
                      <Play className="h-4 w-4 mr-2" />
                      {t('driver.startTrip') || 'Iniciar Viaje'}
                    </Button>
                  }
                />
              )}
              {(selectedTrip.status === TripStatus.PENDING || 
                selectedTrip.status === TripStatus.CONFIRMED || 
                selectedTrip.status === TripStatus.IN_PROGRESS) && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setShowCancelDialog(true)}
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('common.cancel') || 'Cancelar Viaje'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <CancelTripDialog
          open={showCancelDialog}
          onOpenChange={setShowCancelDialog}
          onConfirm={async (reason) => {
            if (!selectedTrip) return
            try {
              setIsCancelling(true)
              await api.cancelDriverTrip(selectedTrip.id, reason)
              toast.success(t('driver.tripCancelled') || 'Viaje cancelado exitosamente')
              setSelectedTrip(null)
              navigate('/driver/trips')
              loadTrips()
            } catch (error: any) {
              toast.error(error.message || t('driver.cancelError') || 'Error al cancelar el viaje')
            } finally {
              setIsCancelling(false)
            }
          }}
          tripNumber={selectedTrip.tripNumber}
          isLoading={isCancelling}
        />
      </div>
    )
  }

  // Vista de lista de viajes
  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => navigate('/driver/dashboard')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('common.back') || 'Volver'}
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('driver.myTrips') || 'Mis Viajes'}</h1>
        <p className="text-muted-foreground">
          {t('driver.myTripsDescription') || 'Gestiona todos tus viajes asignados'}
        </p>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Input
              placeholder={t('driver.searchTrips') || 'Buscar por número, dirección...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('driver.filterByStatus') || 'Filtrar por estado'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('driver.allStatuses') || 'Todos'}</SelectItem>
                <SelectItem value="PENDING">{t('trip.status.pending') || 'Pendiente'}</SelectItem>
                <SelectItem value="CONFIRMED">{t('trip.status.confirmed') || 'Confirmado'}</SelectItem>
                <SelectItem value="IN_PROGRESS">{t('trip.status.inProgress') || 'En Progreso'}</SelectItem>
                <SelectItem value="COMPLETED">{t('trip.status.completed') || 'Completado'}</SelectItem>
                <SelectItem value="CANCELLED">{t('trip.status.cancelled') || 'Cancelado'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de viajes */}
      {filteredTrips.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {t('driver.noTrips') || 'No hay viajes'}
              </h3>
              <p className="text-muted-foreground">
                {t('driver.noTripsDescription') || 'No tienes viajes asignados'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTrips.map((trip) => (
            <Card
              key={trip.id}
              className={`cursor-pointer hover:bg-accent transition-colors ${
                isTripExpired(trip).expired ? 'opacity-60 border-dashed' : ''
              }`}
              onClick={() => navigate(`/driver/trips/${trip.id}`)}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-semibold">{trip.tripNumber}</span>
                      {getStatusBadge(trip.status)}
                      {getExpirationBadge(trip)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate max-w-[200px]">{trip.originAddress}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        <span className="truncate max-w-[200px]">{trip.destinationAddress}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{trip.durationText}</span>
                      </div>
                      {trip.passenger && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{trip.passenger.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {formattedPrices[trip.id] || formatAmount(trip.totalPrice, trip.currency)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(trip.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            {t('common.previous') || 'Anterior'}
          </Button>
          <div className="flex items-center px-4">
            {t('common.page') || 'Página'} {page} {t('common.of') || 'de'} {totalPages}
          </div>
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            {t('common.next') || 'Siguiente'}
          </Button>
        </div>
      )}
    </div>
  )
}

