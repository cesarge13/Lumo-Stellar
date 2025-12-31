import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { getCountryCodeForMaps } from '@/services/locationService'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MapPin, Calendar, Users, Route, DollarSign, Loader2, ArrowLeftRight, Car } from 'lucide-react'
import {
  initializeGoogleMaps,
  searchPlaces,
  getPlaceDetails,
  calculateRoute,
  type PlacePrediction,
} from '@/services/googleMaps'
import { useCurrency } from '@/hooks/useCurrency'
import RouteMap from '@/components/maps/RouteMap'
import { VehicleType } from '@/types'

interface Location {
  address: string
  latitude: number
  longitude: number
  placeId?: string
  country?: string // Código de país (ej: 'MX', 'CL')
}

export default function RequestTrip() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { formatConverted } = useCurrency()
  const { user } = useAuth()
  const [origin, setOrigin] = useState<Location | null>(null)
  const [destination, setDestination] = useState<Location | null>(null)
  const [originSearch, setOriginSearch] = useState('')
  const [destinationSearch, setDestinationSearch] = useState('')
  const [originPredictions, setOriginPredictions] = useState<PlacePrediction[]>([])
  const [destinationPredictions, setDestinationPredictions] = useState<PlacePrediction[]>([])
  const [showOriginPredictions, setShowOriginPredictions] = useState(false)
  const [showDestinationPredictions, setShowDestinationPredictions] = useState(false)
  const [passengers, setPassengers] = useState(1)
  const [isRoundTrip, setIsRoundTrip] = useState(false)
  const [returnScheduledAt, setReturnScheduledAt] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [preferredVehicleType, setPreferredVehicleType] = useState<VehicleType | 'ANY'>('ANY')
  const [isLoading, setIsLoading] = useState(false)
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false)
  const [routeInfo, setRouteInfo] = useState<{
    distance: number
    duration: number
    distanceText: string
    durationText: string
    price: number
    polyline?: string
    bounds?: {
      northeast: { lat: number; lng: number }
      southwest: { lat: number; lng: number }
    }
  } | null>(null)
  const [formattedPrice, setFormattedPrice] = useState<string>('')
  const originInputRef = useRef<HTMLInputElement>(null)
  const destinationInputRef = useRef<HTMLInputElement>(null)
  const originDropdownRef = useRef<HTMLDivElement>(null)
  const destinationDropdownRef = useRef<HTMLDivElement>(null)

  // Combinar fecha y hora en scheduledAt cuando cambien
  useEffect(() => {
    if (scheduledDate && scheduledTime) {
      // Combinar fecha y hora en formato ISO
      const combined = `${scheduledDate}T${scheduledTime}`
      setScheduledAt(combined)
    } else {
      // Si falta fecha o hora, dejar scheduledAt vacío (es opcional)
      setScheduledAt('')
    }
  }, [scheduledDate, scheduledTime])

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (originDropdownRef.current && !originDropdownRef.current.contains(event.target as Node) && 
          originInputRef.current && !originInputRef.current.contains(event.target as Node)) {
        setShowOriginPredictions(false)
      }
      if (destinationDropdownRef.current && !destinationDropdownRef.current.contains(event.target as Node) &&
          destinationInputRef.current && !destinationInputRef.current.contains(event.target as Node)) {
        setShowDestinationPredictions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Inicializar Google Maps al montar
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (apiKey) {
      initializeGoogleMaps(apiKey)
        .then(() => {
          console.log('Google Maps inicializado correctamente')
        })
        .catch((error) => {
          console.error('Error inicializando Google Maps:', error)
          toast.error('Error al cargar Google Maps. Verifica tu API key.')
        })
    } else {
      console.warn('VITE_GOOGLE_MAPS_API_KEY no está configurada')
      toast.warning('Google Maps no está configurado. Algunas funcionalidades no estarán disponibles.')
    }
  }, [])

  // Obtener código de país del usuario para las búsquedas
  const userCountryCode = user?.country ? getCountryCodeForMaps(user.country) : 'cl'

  // Buscar lugares cuando el usuario escribe
  useEffect(() => {
    if (originSearch.length > 2) {
      const timeoutId = setTimeout(async () => {
        try {
          const predictions = await searchPlaces(originSearch, userCountryCode)
          setOriginPredictions(predictions)
          setShowOriginPredictions(true)
        } catch (error) {
          console.error('Error buscando lugares:', error)
        }
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setOriginPredictions([])
      setShowOriginPredictions(false)
    }
  }, [originSearch, userCountryCode])

  useEffect(() => {
    if (destinationSearch.length > 2) {
      const timeoutId = setTimeout(async () => {
        try {
          const predictions = await searchPlaces(destinationSearch, userCountryCode)
          setDestinationPredictions(predictions)
          setShowDestinationPredictions(true)
        } catch (error) {
          console.error('Error buscando lugares:', error)
        }
      }, 300)
      return () => clearTimeout(timeoutId)
    } else {
      setDestinationPredictions([])
      setShowDestinationPredictions(false)
    }
  }, [destinationSearch, userCountryCode])

  // Calcular ruta cuando se seleccionan origen y destino
  useEffect(() => {
    if (origin && destination) {
      calculateRouteAndPrice()
    } else {
      setRouteInfo(null)
      setFormattedPrice('')
    }
  }, [origin, destination, isRoundTrip, preferredVehicleType])

  const calculateRouteAndPrice = async () => {
    if (!origin || !destination) {
      console.log('⚠️ No se puede calcular ruta: falta origen o destino')
      setRouteInfo(null)
      return
    }

    setIsCalculatingRoute(true)
    try {
      // Obtener país del origen o destino (prioridad: origen)
      const tripCountry = origin.country || destination.country || user?.country || 'CL'
      
      console.log('🔄 Calculando ruta...', {
        origen: origin.address,
        destino: destination.address,
        país: tripCountry
      })
      
      const route = await calculateRoute(
        { lat: origin.latitude, lng: origin.longitude },
        { lat: destination.latitude, lng: destination.longitude },
        'DRIVING',
        preferredVehicleType !== 'ANY' ? String(preferredVehicleType) : undefined,
        tripCountry
      )

      if (route) {
        console.log('✅ Ruta calculada exitosamente:', {
          distancia: route.distanceText,
          duración: route.durationText,
          precio: route.price
        })
        
        const oneWayPrice = route.price
        const finalPrice = isRoundTrip ? oneWayPrice * 2 : oneWayPrice
        
        setRouteInfo({
          distance: route.distance,
          duration: route.duration,
          distanceText: route.distanceText,
          durationText: route.durationText,
          price: finalPrice,
          polyline: route.polyline,
          bounds: route.bounds,
        })

        // Formatear precio en la moneda del usuario
        const formatted = await formatConverted(finalPrice, 'CLP')
        setFormattedPrice(formatted)
      } else {
        console.error('❌ calculateRoute devolvió null')
        toast.error(t('passenger.routeError') || 'No se pudo calcular la ruta. Verifica que Google Maps esté configurado correctamente.')
        setRouteInfo(null)
      }
    } catch (error: any) {
      console.error('❌ Error calculando ruta:', error)
      const errorMessage = error?.message || t('passenger.routeError') || 'Error al calcular la ruta'
      toast.error(`${errorMessage}. Verifica la consola para más detalles.`)
      setRouteInfo(null)
    } finally {
      setIsCalculatingRoute(false)
    }
  }

  const handleSelectOrigin = async (prediction: PlacePrediction) => {
    try {
      const details = await getPlaceDetails(prediction.placeId)
      if (details) {
        setOrigin({
          placeId: details.placeId,
          address: details.formattedAddress,
          latitude: details.location.lat,
          longitude: details.location.lng,
          country: details.country,
        })
        setOriginSearch(details.formattedAddress)
        setShowOriginPredictions(false)
      }
    } catch (error) {
      console.error('Error obteniendo detalles del lugar:', error)
      toast.error(t('passenger.placeError') || 'Error al obtener detalles del lugar')
    }
  }

  const handleSelectDestination = async (prediction: PlacePrediction) => {
    try {
      const details = await getPlaceDetails(prediction.placeId)
      if (details) {
        setDestination({
          placeId: details.placeId,
          address: details.formattedAddress,
          latitude: details.location.lat,
          longitude: details.location.lng,
          country: details.country,
        })
        setDestinationSearch(details.formattedAddress)
        setShowDestinationPredictions(false)
      }
    } catch (error) {
      console.error('Error obteniendo detalles del lugar:', error)
      toast.error(t('passenger.placeError') || 'Error al obtener detalles del lugar')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!origin || !destination) {
      toast.error(t('passenger.selectBothLocations') || 'Debes seleccionar origen y destino')
      return
    }

    if (!routeInfo) {
      toast.error(t('passenger.calculateRouteFirst') || 'Debes calcular la ruta primero')
      return
    }

    setIsLoading(true)

    try {
      // Validar ida y vuelta
      if (isRoundTrip && !returnScheduledAt) {
        toast.error(t('passenger.returnDateRequired') || 'Debes especificar la fecha y hora de vuelta')
        setIsLoading(false)
        return
      }

      // Obtener país del viaje (prioridad: origen > destino > usuario)
      const tripCountry = origin.country || destination.country || user?.country || 'CL'
      
      // Calcular precios usando el servicio de pricing del backend
      const oneWayDistance = routeInfo.distance
      const oneWayPricing = await api.calculatePrice(
        oneWayDistance,
        tripCountry,
        preferredVehicleType !== 'ANY' ? preferredVehicleType : undefined
      )
      
      // Si es ida y vuelta, duplicar precios
      const basePrice = isRoundTrip ? oneWayPricing.basePrice * 2 : oneWayPricing.basePrice
      const distancePrice = isRoundTrip ? oneWayPricing.distancePrice * 2 : oneWayPricing.distancePrice
      const timePrice = isRoundTrip ? oneWayPricing.timePrice * 2 : oneWayPricing.timePrice
      const totalPrice = isRoundTrip ? oneWayPricing.totalPrice * 2 : oneWayPricing.totalPrice
      const currency = oneWayPricing.currency

      // Validar y formatear fecha programada
      let formattedScheduledAt: string | undefined = undefined
      if (scheduledAt && scheduledAt.trim() !== '') {
        try {
          const date = new Date(scheduledAt)
          if (!isNaN(date.getTime())) {
            formattedScheduledAt = date.toISOString()
          } else {
            console.warn('Fecha programada inválida:', scheduledAt)
          }
        } catch (error) {
          console.error('Error formateando fecha programada:', error)
        }
      }

      // Validar y formatear fecha de vuelta
      let formattedReturnScheduledAt: string | undefined = undefined
      if (isRoundTrip && returnScheduledAt && returnScheduledAt.trim() !== '') {
        try {
          const date = new Date(returnScheduledAt)
          if (!isNaN(date.getTime())) {
            formattedReturnScheduledAt = date.toISOString()
          } else {
            console.warn('Fecha de vuelta inválida:', returnScheduledAt)
          }
        } catch (error) {
          console.error('Error formateando fecha de vuelta:', error)
        }
      }

      const tripData = {
        originAddress: origin.address,
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
        destinationAddress: destination.address,
        destinationLatitude: destination.latitude,
        destinationLongitude: destination.longitude,
        originPlaceId: origin.placeId,
        destinationPlaceId: destination.placeId,
        scheduledAt: formattedScheduledAt,
        returnScheduledAt: formattedReturnScheduledAt,
        passengers: Math.min(Math.max(passengers, 1), 7), // Limitar entre 1 y 7
        isRoundTrip,
        preferredVehicleType: preferredVehicleType !== 'ANY' ? preferredVehicleType : undefined,
        distance: routeInfo.distance,
        duration: Math.round(routeInfo.duration),
        distanceText: routeInfo.distanceText,
        durationText: routeInfo.durationText,
        basePrice,
        distancePrice,
        timePrice,
        totalPrice,
        currency,
        routePolyline: routeInfo.polyline,
        routeBounds: routeInfo.bounds,
      }

      const trip = await api.createTrip(tripData)
      toast.success(t('passenger.tripRequested') || 'Viaje solicitado correctamente')
      navigate(`/passenger/trips/${trip.id}`)
    } catch (error: any) {
      toast.error(error.message || t('passenger.requestError') || 'Error al solicitar viaje')
      console.error('Error creating trip:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('passenger.requestTrip') || 'Solicitar Viaje'}</h1>
        <p className="text-muted-foreground">
          {t('passenger.requestTripDescription') || 'Solicita un viaje indicando origen y destino'}
        </p>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>{t('passenger.tripDetails') || 'Detalles del Viaje'}</CardTitle>
            <CardDescription>
              {t('passenger.enterTripInfo') || 'Ingresa la información de tu viaje'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Origen */}
              <div className="space-y-2">
                <Label htmlFor="origin">{t('passenger.origin') || 'Origen'}</Label>
                <div className="relative">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Input
                      ref={originInputRef}
                      id="origin"
                      placeholder={t('passenger.originPlaceholder') || '¿Desde dónde?'}
                      value={originSearch}
                      onChange={(e) => setOriginSearch(e.target.value)}
                      onFocus={() => originSearch.length > 2 && setShowOriginPredictions(true)}
                      className="pl-10"
                      required
                    />
                  </div>
                  {showOriginPredictions && originPredictions.length > 0 && (
                    <div ref={originDropdownRef} className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {originPredictions.map((prediction) => (
                        <button
                          key={prediction.placeId}
                    type="button"
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-start gap-2"
                          onClick={() => handleSelectOrigin(prediction)}
                        >
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{prediction.mainText}</p>
                            <p className="text-xs text-muted-foreground truncate">{prediction.secondaryText}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {origin && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {origin.address}
                  </p>
                )}
              </div>

              {/* Destino */}
              <div className="space-y-2">
                <Label htmlFor="destination">{t('passenger.destination') || 'Destino'}</Label>
                <div className="relative">
                  <div className="relative flex-1">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Input
                      ref={destinationInputRef}
                      id="destination"
                      placeholder={t('passenger.destinationPlaceholder') || '¿Hacia dónde?'}
                      value={destinationSearch}
                      onChange={(e) => setDestinationSearch(e.target.value)}
                      onFocus={() => destinationSearch.length > 2 && setShowDestinationPredictions(true)}
                      className="pl-10"
                      required
                    />
                  </div>
                  {showDestinationPredictions && destinationPredictions.length > 0 && (
                    <div ref={destinationDropdownRef} className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {destinationPredictions.map((prediction) => (
                        <button
                          key={prediction.placeId}
                    type="button"
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-start gap-2"
                          onClick={() => handleSelectDestination(prediction)}
                        >
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{prediction.mainText}</p>
                            <p className="text-xs text-muted-foreground truncate">{prediction.secondaryText}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {destination && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {destination.address}
                  </p>
                )}
              </div>

              {/* Información de ruta */}
              {isCalculatingRoute && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">{t('passenger.calculatingRoute') || 'Calculando ruta...'}</span>
                </div>
              )}

              {!routeInfo && !isCalculatingRoute && origin && destination && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    ⚠️ No se pudo calcular la ruta. Verifica:
                  </p>
                  <ul className="text-xs text-yellow-700 dark:text-yellow-300 mt-2 ml-4 list-disc">
                    <li>Que Google Maps esté configurado correctamente</li>
                    <li>Que las direcciones sean válidas</li>
                    <li>Revisa la consola del navegador para más detalles</li>
                  </ul>
                </div>
              )}

              {routeInfo && !isCalculatingRoute && origin && destination && (
                <>
                  {/* Mapa de la ruta */}
                  <div className="w-full">
                    <RouteMap
                      origin={{
                        lat: origin.latitude,
                        lng: origin.longitude,
                        address: origin.address,
                      }}
                      destination={{
                        lat: destination.latitude,
                        lng: destination.longitude,
                        address: destination.address,
                      }}
                      polyline={routeInfo.polyline}
                      bounds={routeInfo.bounds}
                      height="300px"
                    />
                  </div>

                  {/* Información de la ruta */}
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Route className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('passenger.routeInfo') || 'Información de Ruta'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t('passenger.distance') || 'Distancia'}: </span>
                        <span className="font-medium">{routeInfo.distanceText}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t('passenger.duration') || 'Duración'}: </span>
                        <span className="font-medium">{routeInfo.durationText}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          <span className="text-2xl font-bold">{formattedPrice || `${routeInfo.price.toLocaleString()} CLP`}</span>
                        </div>
                        {isRoundTrip && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('passenger.roundTripPrice') || 'Precio incluye ida y vuelta'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Tipo de vehículo */}
              <div className="space-y-2">
                <Label htmlFor="vehicleType" className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  {t('passenger.vehicleType') || 'Tipo de Vehículo'} (opcional)
                </Label>
                <Select
                  value={preferredVehicleType}
                  onValueChange={(value) => setPreferredVehicleType(value as VehicleType | 'ANY')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('passenger.selectVehicleType') || 'Selecciona un tipo de vehículo'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANY">{t('passenger.anyVehicle') || 'Cualquier vehículo'}</SelectItem>
                    <SelectItem value={VehicleType.SEDAN}>
                      {t('passenger.vehicleTypeSedan') || 'Sedan'} - {t('passenger.sedanDiscount') || '35% descuento'}
                    </SelectItem>
                    <SelectItem value={VehicleType.LUXURY}>
                      {t('passenger.vehicleTypeLuxury') || 'Camioneta de Lujo'} (7 pasajeros)
                    </SelectItem>
                    <SelectItem value={VehicleType.SUV}>
                      {t('passenger.vehicleTypeSUV') || 'SUV'}
                    </SelectItem>
                    <SelectItem value={VehicleType.VAN}>
                      {t('passenger.vehicleTypeVAN') || 'Van'}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {preferredVehicleType === VehicleType.SEDAN && (
                  <p className="text-xs text-green-600 font-medium">
                    {t('passenger.sedanDiscountApplied') || '✓ Se aplicará un 35% de descuento en el precio por kilómetro'}
                  </p>
                )}
              </div>

              {/* Pasajeros */}
              <div className="space-y-2">
                <Label htmlFor="passengers" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t('passenger.passengers') || 'Pasajeros'} (máximo 7)
                </Label>
                <Input
                  id="passengers"
                  type="number"
                  min="1"
                  max="7"
                  value={passengers}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1
                    setPassengers(Math.min(Math.max(value, 1), 7))
                  }}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('passenger.maxPassengers') || 'Máximo 7 pasajeros por viaje'}
                </p>
              </div>

              {/* Ida y vuelta */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isRoundTrip"
                    checked={isRoundTrip}
                    onChange={(e) => setIsRoundTrip(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="isRoundTrip" className="flex items-center gap-2 cursor-pointer">
                    <ArrowLeftRight className="h-4 w-4" />
                    {t('passenger.roundTrip') || 'Ida y vuelta'}
                  </Label>
                </div>
                {isRoundTrip && (
                  <p className="text-sm text-muted-foreground ml-6">
                    {t('passenger.roundTripDescription') || 'El precio se duplicará para incluir el viaje de vuelta'}
                  </p>
                )}
              </div>

              {/* Fecha programada (opcional) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('passenger.scheduledAt') || 'Fecha y hora de ida (opcional)'}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="scheduledDate" className="text-xs text-muted-foreground mb-1 block">
                      Fecha
                    </Label>
                    <input
                      id="scheduledDate"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="scheduledTime" className="text-xs text-muted-foreground mb-1 block">
                      Hora
                    </Label>
                    <input
                      id="scheduledTime"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      step="1"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>
                {scheduledAt && (
                  <p className="text-xs text-muted-foreground">
                    Programado para: {new Date(scheduledAt).toLocaleString('es-CL', {
                      dateStyle: 'long',
                      timeStyle: 'short'
                    })}
                  </p>
                )}
              </div>

              {/* Fecha de vuelta (si es ida y vuelta) */}
              {isRoundTrip && (
                <div className="space-y-2">
                  <Label htmlFor="returnScheduledAt" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t('passenger.returnScheduledAt') || 'Fecha y hora de vuelta'} *
                  </Label>
                  <Input
                    id="returnScheduledAt"
                    type="datetime-local"
                    value={returnScheduledAt}
                    onChange={(e) => setReturnScheduledAt(e.target.value)}
                    min={scheduledAt || new Date().toISOString().slice(0, 16)}
                    required={isRoundTrip}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('passenger.returnDateHelp') || 'La fecha de vuelta debe ser posterior a la fecha de ida'}
                  </p>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/passenger')}
                  className="flex-1"
                >
                  {t('common.cancel') || 'Cancelar'}
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading || !origin || !destination || !routeInfo}
                  className="flex-1"
                  onClick={() => {
                    // Debug: mostrar qué falta
                    if (!origin) {
                      console.log('❌ Falta origen')
                    }
                    if (!destination) {
                      console.log('❌ Falta destino')
                    }
                    if (!routeInfo) {
                      console.log('❌ Falta routeInfo')
                    }
                    if (isLoading) {
                      console.log('⏳ Ya está cargando')
                    }
                    if (origin && destination && routeInfo && !isLoading) {
                      console.log('✅ Todo listo para enviar')
                    }
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('common.loading') || 'Cargando...'}
                    </>
                  ) : (
                    t('passenger.requestTrip') || 'Solicitar Viaje'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
