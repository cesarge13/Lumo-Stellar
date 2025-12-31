/**
 * Página para conectar wallet móvil después de escanear el QR
 * Se abre cuando el usuario escanea el código QR de conexión
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Wallet, CheckCircle, AlertCircle, Loader2, QrCode } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import StellarLogo from '@/components/layout/StellarLogo'

export default function MobileWalletConnect() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  
  const token = searchParams.get('token')
  const userId = searchParams.get('userId')
  
  const [stellarAddress, setStellarAddress] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Verificar que tenemos token y userId
    if (!token || !userId) {
      setError(t('wallet.invalidConnectionLink') || 'Enlace de conexión inválido')
    }
  }, [token, userId, t])

  const handleConnect = async () => {
    if (!token) {
      setError(t('wallet.invalidToken') || 'Token inválido')
      return
    }

    if (!stellarAddress || stellarAddress.trim() === '') {
      setError(t('wallet.stellarAddressRequired') || 'Dirección Stellar requerida')
      return
    }

    // Validar formato de dirección Stellar
    if (!stellarAddress.startsWith('G') || stellarAddress.length !== 56) {
      setError(t('wallet.invalidStellarAddress') || 'Dirección Stellar inválida. Debe empezar con G y tener 56 caracteres.')
      return
    }

    try {
      setIsConnecting(true)
      setError(null)

      const result = await api.verifyMobileConnection(token, stellarAddress.trim())

      if (result.success) {
        setIsConnected(true)
        toast.success(t('wallet.connectedSuccessfully') || 'Wallet conectada exitosamente')
        
        // Actualizar usuario en el contexto
        if (setUser && result.user) {
          setUser(result.user)
        }

        // Redirigir después de 2 segundos
        setTimeout(() => {
          navigate('/settings')
        }, 2000)
      }
    } catch (error: any) {
      console.error('Error connecting wallet:', error)
      setError(error.message || t('wallet.connectionError') || 'Error al conectar wallet')
      toast.error(error.message || t('wallet.connectionError') || 'Error al conectar wallet')
    } finally {
      setIsConnecting(false)
    }
  }

  if (isConnected) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-md">
        <Card className="border-green-500 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <div>
                <h3 className="text-lg font-semibold text-green-600 mb-2">
                  {t('wallet.connectedSuccessfully') || 'Wallet conectada exitosamente'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('wallet.redirecting') || 'Redirigiendo...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StellarLogo size={20} />
            <Wallet className="h-5 w-5" />
            {t('wallet.connectMobileWallet') || 'Conectar Wallet Móvil'}
          </CardTitle>
          <CardDescription>
            {t('wallet.enterStellarAddress') || 'Ingresa tu dirección Stellar para conectar tu wallet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('wallet.error') || 'Error'}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!token && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('wallet.invalidLink') || 'Enlace inválido'}</AlertTitle>
              <AlertDescription>
                {t('wallet.invalidConnectionLink') || 'Este enlace de conexión no es válido o ha expirado.'}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="stellarAddress">
              {t('wallet.stellarAddress') || 'Dirección Stellar'}
            </Label>
            <Input
              id="stellarAddress"
              type="text"
              placeholder="G..."
              value={stellarAddress}
              onChange={(e) => setStellarAddress(e.target.value)}
              disabled={isConnecting || !token}
              className="font-mono"
              maxLength={56}
            />
            <p className="text-xs text-muted-foreground">
              {t('wallet.stellarAddressHint') || 'Tu dirección Stellar pública (empieza con G, 56 caracteres)'}
            </p>
          </div>

          <Alert>
            <QrCode className="h-4 w-4" />
            <AlertTitle>{t('wallet.howToFindAddress') || '¿Cómo encontrar tu dirección?'}</AlertTitle>
            <AlertDescription className="mt-2 text-sm">
              <ol className="list-decimal list-inside space-y-1">
                <li>{t('wallet.openFreighterMobile') || 'Abre Freighter en tu teléfono'}</li>
                <li>{t('wallet.goToAccount') || 'Ve a tu cuenta'}</li>
                <li>{t('wallet.copyAddress') || 'Copia tu dirección pública (empieza con G)'}</li>
                <li>{t('wallet.pasteHere') || 'Pégala aquí'}</li>
              </ol>
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleConnect}
            disabled={isConnecting || !token || !stellarAddress.trim()}
            className="w-full"
            size="lg"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {t('wallet.connecting') || 'Conectando...'}
              </>
            ) : (
              <>
                <Wallet className="h-5 w-5 mr-2" />
                {t('wallet.connect') || 'Conectar Wallet'}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

