/**
 * Página de seguimiento de viaje para el conductor
 * Muestra el mapa con la ruta y permite completar el viaje
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, MapPin, Clock, CheckCircle, Navigation, AlertCircle, Map as MapIcon, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { TripTrackingMap } from '@/components/maps/TripTrackingMap'
import { useCurrency } from '@/hooks/useCurrency'
import { generateTripSummaryMessage, openWhatsApp } from '@/utils/whatsapp'
import { StellarPaymentQR } from '@/components/payments/StellarPaymentQR'
import type { Trip } from '@/types'
import { TripStatus } from '@/types'

export default function DriverTripTracking() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { formatConvertedAmount } = useCurrency()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCompleting, setIsCompleting] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [formattedPrice, setFormattedPrice] = useState<string>('')
  const [paymentInfo, setPaymentInfo] = useState<{
    paymentId: string
    paymentQR: string
    paymentAddress: string
    transactionXdr?: string
  } | null>(null)

  useEffect(() => {
    if (!user || !id) {
      navigate('/driver/dashboard')
      return
    }

    loadTrip()
    getCurrentLocation()

    // Actualizar ubicación cada 10 segundos
    const locationInterval = setInterval(() => {
      getCurrentLocation()
    }, 10000)

    // Actualizar viaje cada 30 segundos
    const tripInterval = setInterval(() => {
      loadTrip()
    }, 30000)

    return () => {
      clearInterval(locationInterval)
      clearInterval(tripInterval)
    }
  }, [user, id, navigate])

  const loadTrip = async () => {
    if (!id) return

    try {
      const data = await api.getDriverTrip(id)
      setTrip(data)

      if (data) {
        const formatted = await formatConvertedAmount(data.totalPrice, data.currency)
        setFormattedPrice(formatted)
        
        // Si el viaje está completado pero tiene QR de pago, cargar información de pago
        if (data?.completedAt && data?.paymentQrCode) {
          try {
            const paymentData = await api.getTripPaymentInfo(id)
            if (paymentData.payment) {
              setPaymentInfo({
                paymentId: paymentData.payment.id,
                paymentQR: data.paymentQrCode || '',
                paymentAddress: data.paymentAddress || '',
                transactionXdr: paymentData.trip.transactionXdr,
              })
            } else {
              setPaymentInfo({
                paymentId: 'pending',
                paymentQR: data.paymentQrCode || '',
                paymentAddress: data.paymentAddress || '',
                transactionXdr: paymentData.trip.transactionXdr,
              })
            }
          } catch (error) {
            console.error('Error loading payment info:', error)
            if (data.paymentQrCode && data.paymentAddress) {
              setPaymentInfo({
                paymentId: 'pending',
                paymentQR: data.paymentQrCode,
                paymentAddress: data.paymentAddress,
                transactionXdr: undefined,
              })
            }
          }
        } else {
          setPaymentInfo(null)
        }
      }
    } catch (error) {
      console.error('Error loading trip:', error)
      toast.error(t('driver.loadError') || 'Error al cargar el viaje')
    } finally {
      setIsLoading(false)
    }
  }

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocalización no disponible')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
        setLocationError(null)
      },
      (error) => {
        // Solo mostrar error si es crítico, no para permisos denegados
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError('Permisos de ubicación denegados. Puedes continuar sin GPS.')
        } else if (error.code === error.TIMEOUT) {
          setLocationError('Tiempo de espera agotado para obtener ubicación.')
        } else {
          setLocationError('No se pudo obtener tu ubicación. Puedes continuar sin GPS.')
        }
        // No hacer console.error para evitar ruido en la consola
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      }
    )
  }

  const handleCompleteTrip = async () => {
    if (!trip || !id) return

    try {
      setIsCompleting(true)

      const options: any = {}
      if (currentLocation) {
        options.driverLatitude = currentLocation.lat
        options.driverLongitude = currentLocation.lon
      }

      const completedTrip = await api.completeTrip(id, options)
      toast.success(t('driver.tripCompleted') || 'Viaje completado correctamente')
      
      // Actualizar el trip local con los datos completos
      if (completedTrip) {
        setTrip(completedTrip)
        
        // Cargar información de pago si hay QR
        if (completedTrip.paymentQrCode) {
          try {
            const paymentData = await api.getTripPaymentInfo(id)
            if (paymentData.payment) {
              setPaymentInfo({
                paymentId: paymentData.payment.id,
                paymentQR: completedTrip.paymentQrCode || '',
                paymentAddress: completedTrip.paymentAddress || '',
                transactionXdr: paymentData.trip.transactionXdr,
              })
            } else {
              setPaymentInfo({
                paymentId: 'pending',
                paymentQR: completedTrip.paymentQrCode || '',
                paymentAddress: completedTrip.paymentAddress || '',
                transactionXdr: paymentData.trip.transactionXdr,
              })
            }
          } catch (error) {
            console.error('Error loading payment info:', error)
            if (completedTrip.paymentQrCode && completedTrip.paymentAddress) {
              setPaymentInfo({
                paymentId: 'pending',
                paymentQR: completedTrip.paymentQrCode,
                paymentAddress: completedTrip.paymentAddress,
                transactionXdr: undefined,
              })
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error completing trip:', error)
      toast.error(error.message || t('driver.completeError') || 'Error al completar viaje')
    } finally {
      setIsCompleting(false)
    }
  }

  if (isLoading || !trip) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>{t('common.loading') || 'Cargando...'}</p>
        </div>
      </div>
    )
  }

  const canComplete = trip.status === TripStatus.IN_PROGRESS

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Button
        variant="ghost"
        onClick={() => navigate(`/driver/trips/${id}`)}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('common.back') || 'Volver'}
      </Button>

      <div className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-2">{trip.tripNumber}</h1>
            <p className="text-muted-foreground">
              {t('driver.tripTracking') || 'Seguimiento de viaje'}
            </p>
          </div>
          <Badge variant={canComplete ? 'default' : 'secondary'}>
            {trip.status === TripStatus.IN_PROGRESS
              ? t('trip.status.inProgress') || 'En Progreso'
              : t('trip.status.confirmed') || 'Confirmado'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Mapa - Ocupa 2 columnas */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('driver.route') || 'Ruta'}</CardTitle>
              <CardDescription>
                {t('driver.routeDescription') || 'Sigue la ruta hacia el destino'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TripTrackingMap
                trip={trip}
                showCurrentLocation={!!currentLocation}
                currentLatitude={currentLocation?.lat}
                currentLongitude={currentLocation?.lon}
                height="500px"
              />
              {locationError && (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span>{locationError}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Información del viaje */}
        <div className="space-y-6">
          {/* Detalles del viaje */}
          <Card>
            <CardHeader>
              <CardTitle>{t('driver.tripDetails') || 'Detalles del Viaje'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{t('driver.origin') || 'Origen'}</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{trip.originAddress}</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">{t('driver.destination') || 'Destino'}</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{trip.destinationAddress}</p>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('driver.distance') || 'Distancia'}</span>
                  <span className="font-medium">{trip.distanceText}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('driver.duration') || 'Duración'}</span>
                  <span className="font-medium">{trip.durationText}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('driver.price') || 'Precio'}</span>
                  <span className="font-semibold text-primary">{formattedPrice}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Información del pasajero */}
          {trip.passenger && (
            <Card>
              <CardHeader>
                <CardTitle>{t('driver.passenger') || 'Pasajero'}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{trip.passenger.name}</p>
                {trip.passenger.phone && (
                  <p className="text-sm text-muted-foreground mt-1">{trip.passenger.phone}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Botón completar viaje */}
          {canComplete && (
            <Card className="border-primary/50 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  {t('driver.completeTrip') || 'Completar Viaje'}
                </CardTitle>
                <CardDescription>
                  {t('driver.completeTripDescription') || 'Marca el viaje como completado cuando llegues al destino'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleCompleteTrip}
                  disabled={isCompleting}
                  className="w-full"
                  size="lg"
                >
                  {isCompleting
                    ? t('common.loading') || 'Completando...'
                    : t('driver.completeTrip') || 'Completar Viaje'}
                </Button>
                {currentLocation && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {t('driver.locationEnabled') || 'Ubicación GPS activa'}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* QR de Pago Stellar - Mostrar al conductor después de completar el viaje */}
          {trip.completedAt && trip.paymentQrCode && trip.status !== 'COMPLETED' && paymentInfo && (
            <Card className="border-primary bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  {t('driver.paymentQR') || 'Código QR para Recibir Pago'}
                </CardTitle>
                <CardDescription>
                  {t('driver.paymentQRDescription') || 'Muestra este código QR al pasajero para que pueda realizar el pago con Freighter'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <StellarPaymentQR
                  paymentQR={paymentInfo.paymentQR}
                  paymentAddress={paymentInfo.paymentAddress}
                  amount={trip.totalPrice}
                  currency={trip.currency}
                  paymentId={paymentInfo.paymentId}
                  transactionXdr={paymentInfo.transactionXdr}
                  onPaymentVerified={() => {
                    // Recargar el viaje después del pago
                    loadTrip()
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Botón enviar resumen por WhatsApp (solo cuando el viaje está completado) */}
          {trip.status === TripStatus.COMPLETED && trip.passenger?.phone && (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                  {t('driver.sendTripSummary') || 'Enviar Resumen por WhatsApp'}
                </CardTitle>
                <CardDescription>
                  {t('driver.sendTripSummaryDescription') || 'Envía un mensaje al pasajero con los detalles del viaje completado'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => {
                    if (!trip.passenger?.phone) {
                      toast.error(t('driver.passengerNoWhatsApp') || 'El pasajero no tiene número de WhatsApp registrado')
                      return
                    }

                    const message = generateTripSummaryMessage({
                      tripNumber: trip.tripNumber,
                      originAddress: trip.originAddress,
                      destinationAddress: trip.destinationAddress,
                      distanceText: trip.distanceText,
                      durationText: trip.durationText,
                      totalPrice: trip.totalPrice,
                      currency: trip.currency,
                      passengers: trip.passengers,
                      driverName: user?.name,
                      vehicleInfo: trip.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model} - ${trip.vehicle.licensePlate}` : undefined,
                    })

                    try {
                      openWhatsApp(trip.passenger.phone, message)
                      toast.success(t('driver.whatsappOpened') || 'WhatsApp abierto con el mensaje')
                    } catch (error: any) {
                      toast.error(error.message || t('driver.whatsappError') || 'Error al abrir WhatsApp')
                    }
                  }}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  {t('driver.sendWhatsApp') || 'Enviar por WhatsApp'}
                </Button>
                {!trip.passenger.phone && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {t('driver.passengerNoWhatsApp') || 'El pasajero no tiene número de WhatsApp registrado'}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

