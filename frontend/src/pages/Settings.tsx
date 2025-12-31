import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Settings as SettingsIcon, Save, ArrowLeft, MapPin, RefreshCw, Wallet, CheckCircle, AlertCircle, ExternalLink, Loader2, LogOut } from 'lucide-react'
import { Currency } from '@/types'
import { api } from '@/services/api'
import { getCountryName, detectUserLocation } from '@/services/locationService'
import { 
  getFreighterConnectionStatus, 
  connectFreighter
} from '@/services/freighterService'
import StellarLogo from '@/components/layout/StellarLogo'

export default function Settings() {
  const { t } = useTranslation()
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [isDetectingCountry, setIsDetectingCountry] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    preferredCurrency: Currency.CLP,
    stellarAddress: '',
  })
  const [freighterStatus, setFreighterStatus] = useState<{
    isAvailable: boolean
    isConnected: boolean
    publicKey: string | null
    network: 'testnet' | 'mainnet' | null
  }>({
    isAvailable: false,
    isConnected: false,
    publicKey: null,
    network: null,
  })
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    // Asegurar que stellarAddress sea siempre una cadena
    const stellarAddr = typeof user.stellarAddress === 'string' 
      ? user.stellarAddress 
      : (user.stellarAddress ? String(user.stellarAddress) : '')

    setFormData({
      name: user.name,
      phone: user.phone || '',
      preferredCurrency: (user.preferredCurrency || Currency.CLP) as Currency,
      stellarAddress: stellarAddr,
    })

    // Verificar estado de Freighter
    checkFreighterStatus()
  }, [user, navigate])

  // Actualizar formData cuando cambia user.stellarAddress y verificar estado de Freighter
  useEffect(() => {
    if (user) {
      const stellarAddr = typeof user.stellarAddress === 'string' 
        ? user.stellarAddress 
        : (user.stellarAddress ? String(user.stellarAddress) : '')
      
      // Solo actualizar si es diferente para evitar loops
      if (stellarAddr !== formData.stellarAddress) {
        setFormData(prev => ({ ...prev, stellarAddress: stellarAddr }))
      }
      
      // Si el usuario tiene stellarAddress, mostrar como conectado inmediatamente
      if (stellarAddr) {
        setFreighterStatus(prev => ({
          ...prev,
          isConnected: true,
          publicKey: stellarAddr,
          isAvailable: prev?.isAvailable ?? true,
        }))
        
        // Verificar estado completo de Freighter en segundo plano
        checkFreighterStatus().catch(() => {
          // Si falla la verificación, mantener el estado conectado basado en stellarAddress
        })
      } else {
        // Si no tiene stellarAddress, verificar estado real de Freighter
        checkFreighterStatus()
      }
    }
  }, [user?.stellarAddress])

  const checkFreighterStatus = async () => {
    try {
      const status = await getFreighterConnectionStatus()
      
      // Si el usuario ha desconectado manualmente (no tiene stellarAddress en su perfil),
      // NO mostrar como conectado aunque Freighter esté conectado en la extensión
      const userStellarAddress = user?.stellarAddress 
        ? (typeof user.stellarAddress === 'string' ? user.stellarAddress : String(user.stellarAddress))
        : ''
      
      if (!userStellarAddress) {
        // Usuario desconectado manualmente - mostrar como desconectado
        setFreighterStatus({
          isAvailable: status.isAvailable,
          isConnected: false,
          publicKey: null,
          network: null,
        })
        return
      }
      
      // Usuario tiene dirección Stellar - mostrar como conectado
      // Si Freighter está conectado y la dirección coincide, usar el estado de Freighter
      // Si no coincide o Freighter no está conectado, mostrar como conectado basado en stellarAddress
      if (status.isConnected && status.publicKey === userStellarAddress) {
        // Estado coincide - usar estado completo de Freighter
        setFreighterStatus(status)
      } else {
        // Mostrar como conectado basado en stellarAddress del usuario
        setFreighterStatus({
          isAvailable: status.isAvailable,
          isConnected: true,
          publicKey: userStellarAddress,
          network: status.network,
        })
      }
    } catch (error) {
      console.error('Error checking Freighter status:', error)
      // Si hay error pero el usuario tiene stellarAddress, mantener como conectado
      const userStellarAddress = user?.stellarAddress 
        ? (typeof user.stellarAddress === 'string' ? user.stellarAddress : String(user.stellarAddress))
        : ''
      
      if (userStellarAddress) {
        setFreighterStatus({
          isAvailable: true,
          isConnected: true,
          publicKey: userStellarAddress,
          network: null,
        })
      } else {
        setFreighterStatus({
          isAvailable: false,
          isConnected: false,
          publicKey: null,
          network: null,
        })
      }
    }
  }

  const handleConnectFreighter = async () => {
    try {
      setIsConnecting(true)
      
      // Conectar con Freighter - esto mostrará el pop-up nativo
      const account = await connectFreighter()
      
      // Actualizar dirección Stellar automáticamente
      if (account.publicKey) {
        // Guardar en el perfil del usuario primero
        try {
          const updatedUser = await api.updateProfile({ stellarAddress: account.publicKey })
          // Actualizar el usuario en el contexto inmediatamente
          if (updatedUser) {
            setUser(updatedUser)
          }
        } catch (profileError) {
          console.error('Error updating profile:', profileError)
          throw profileError
        }
        
        // Actualizar estado local después de actualizar el perfil
        setFormData(prev => ({ ...prev, stellarAddress: account.publicKey }))
        
        // Actualizar estado de Freighter inmediatamente con la información de la conexión
        setFreighterStatus({
          isAvailable: true,
          isConnected: true,
          publicKey: account.publicKey,
          network: null, // Se puede obtener después si es necesario
        })
      }
      
      toast.success(t('wallet.connected') || 'Wallet conectada exitosamente')
      
      // NO llamar a checkFreighterStatus aquí porque puede sobrescribir el estado
      // El useEffect que depende de user?.stellarAddress se encargará de mantener el estado
    } catch (error: any) {
      console.error('Error connecting Freighter:', error)
      toast.error(error.message || t('wallet.connectionError') || 'Error al conectar wallet')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnectFreighter = async () => {
    try {
      setIsConnecting(true)
      
      // Limpiar dirección Stellar del perfil
      try {
        const updatedUser = await api.updateProfile({ stellarAddress: '' })
        // Actualizar el usuario en el contexto
        if (updatedUser) {
          setUser(updatedUser)
        }
      } catch (profileError) {
        console.error('Error updating profile:', profileError)
        throw profileError
      }
      
      // Limpiar estado local del formulario
      setFormData(prev => ({ ...prev, stellarAddress: '' }))
      
      // Forzar estado de Freighter a desconectado (NO verificar después)
      setFreighterStatus({
        isAvailable: true,
        isConnected: false,
        publicKey: null,
        network: null,
      })
      
      // NO llamar a checkFreighterStatus() aquí porque volvería a detectar la conexión
      // La extensión de Freighter puede seguir conectada, pero nosotros la desconectamos del perfil
      
      toast.success(t('wallet.disconnected') || 'Wallet desconectada exitosamente')
    } catch (error: any) {
      console.error('Error disconnecting Freighter:', error)
      toast.error(error.message || t('wallet.disconnectionError') || 'Error al desconectar wallet')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) return

    try {
      setIsSaving(true)
      
      const updatedUser = await api.updateProfile({
        name: formData.name,
        phone: formData.phone || undefined,
        preferredCurrency: formData.preferredCurrency,
        // stellarAddress se actualiza automáticamente al conectar Freighter, no se edita manualmente
      })

      // Actualizar el usuario en el contexto
      setUser(updatedUser)
      
      // Actualizar localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser))

      toast.success(t('settings.saved') || 'Configuración guardada correctamente')
    } catch (error: any) {
      console.error('Error saving settings:', error)
      toast.error(error.message || t('settings.saveError') || 'Error al guardar configuración')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDetectCountry = async () => {
    if (!user) return
    
    try {
      setIsDetectingCountry(true)
      toast.info('Detectando tu ubicación...')
      
      const location = await detectUserLocation()
      
      // Actualizar el país en el backend
      const updatedUser = await api.updateProfile({ country: location.countryCode })
      
      // Actualizar el usuario en el contexto
      setUser(updatedUser)
      
      // Actualizar localStorage
      localStorage.setItem('user', JSON.stringify(updatedUser))
      
      toast.success(`País detectado: ${getCountryName(location.countryCode)} (${location.countryCode})`)
    } catch (error: any) {
      console.error('Error detectando país:', error)
      toast.error(error.message || 'Error al detectar el país')
    } finally {
      setIsDetectingCountry(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('common.back') || 'Volver'}
      </Button>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="h-8 w-8" />
          <h1 className="text-3xl font-bold">{t('navigation.settings') || 'Configuración'}</h1>
        </div>
        <p className="text-muted-foreground">
          {t('settings.description') || 'Gestiona tu información personal y preferencias'}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Información Personal */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.personalInfo') || 'Información Personal'}</CardTitle>
              <CardDescription>
                {t('settings.personalInfoDescription') || 'Actualiza tu información personal'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">{t('auth.name') || 'Nombre'}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('auth.namePlaceholder') || 'Tu nombre'}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">{t('admin.phone') || 'Teléfono'}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+56 9 1234 5678"
                />
              </div>
              <div>
                <Label htmlFor="email">{t('auth.email') || 'Email'}</Label>
                <Input
                  id="email"
                  type="email"
                  value={user.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t('settings.emailCannotChange') || 'El email no se puede cambiar'}
                </p>
              </div>
              {user.country && (
                <div>
                  <Label htmlFor="country">{t('settings.country') || 'País'}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="country"
                      value={getCountryName(user.country)}
                      disabled
                      className="bg-muted"
                    />
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">
                      {t('settings.countryDescription') || 'País detectado automáticamente según tu ubicación'}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDetectCountry}
                      disabled={isDetectingCountry}
                      className="h-7 text-xs"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${isDetectingCountry ? 'animate-spin' : ''}`} />
                      {isDetectingCountry ? 'Detectando...' : 'Re-detectar'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Billetera Stellar / Freighter */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <StellarLogo size={20} />
                <Wallet className="h-5 w-5" />
                {t('settings.stellarWallet') || 'Billetera Stellar'}
              </CardTitle>
              <CardDescription>
                {t('settings.stellarWalletDescription') || 'Conecta Freighter o configura tu dirección Stellar manualmente'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Estado de Freighter */}
              <div className="space-y-3">
                  {!freighterStatus.isAvailable && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-yellow-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>{t('wallet.freighterNotInstalled') || 'Freighter no está instalado'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('wallet.freighterNotInstalledDescription') || 'Instala Freighter para gestionar tu wallet de forma segura'}
                      </p>
                      <Button
                        onClick={() => window.open('https://freighter.app/', '_blank')}
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t('wallet.installFreighter') || 'Instalar Freighter'}
                      </Button>
                    </div>
                  )}

                  {freighterStatus.isAvailable && !freighterStatus.isConnected && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <AlertCircle className="h-4 w-4" />
                        <span>{t('wallet.notConnected') || 'Freighter no está conectado'}</span>
                      </div>
                      <Button
                        onClick={handleConnectFreighter}
                        disabled={isConnecting}
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {t('wallet.connecting') || 'Conectando...'}
                          </>
                        ) : (
                          <>
                            <Wallet className="h-4 w-4 mr-2" />
                            {t('wallet.connectFreighter') || 'Conectar Freighter'}
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {freighterStatus.isAvailable && freighterStatus.isConnected && (
                    <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span>{t('wallet.connected') || 'Freighter conectado'}</span>
                        </div>
                        {freighterStatus.network && (
                          <Badge variant="outline" className="text-xs">
                            {freighterStatus.network.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-mono text-muted-foreground break-all">
                        {freighterStatus.publicKey}
                      </p>
                      <Button
                        onClick={handleDisconnectFreighter}
                        disabled={isConnecting}
                        variant="outline"
                        size="sm"
                        className="w-full border-red-500/20 text-red-600 hover:bg-red-500/10 hover:text-red-700"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        {t('wallet.disconnect') || 'Desconectar Wallet'}
                      </Button>
                    </div>
                  )}
                </div>
            </CardContent>
          </Card>

          {/* Preferencias */}
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.preferences') || 'Preferencias'}</CardTitle>
              <CardDescription>
                {t('settings.preferencesDescription') || 'Configura tus preferencias de la aplicación'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="currency">{t('admin.preferredCurrency') || 'Moneda Preferida'}</Label>
                <Select
                  value={formData.preferredCurrency}
                  onValueChange={(value) => setFormData({ ...formData, preferredCurrency: value as Currency })}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      Currency.CLP,
                      Currency.MXN,
                      Currency.USD,
                      Currency.ARS,
                      Currency.COP,
                      Currency.BRL,
                      Currency.BOB,
                      Currency.PEN,
                      Currency.CAD,
                    ].map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency} - {t(`currency.${currency}`) || currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('admin.currencyDescription') || 'Selecciona la moneda para ver precios y cotizaciones'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Botones de acción */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(-1)}
            >
              {t('common.cancel') || 'Cancelar'}
            </Button>
            <Button type="submit" disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? (t('common.saving') || 'Guardando...') : (t('common.save') || 'Guardar')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

