/**
 * Componente para pago automático con Freighter
 * Muestra un botón "PAGAR VIAJE" que procesa el pago automáticamente
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Wallet, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'
import StellarLogo from '@/components/layout/StellarLogo'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { 
  getFreighterConnectionStatus, 
  connectFreighter, 
  signAndSubmitTransaction,
  getNetwork 
} from '@/services/freighterService'
import { useCurrency } from '@/hooks/useCurrency'

interface AutoPayButtonProps {
  tripId: string
  paymentId: string
  transactionXdr?: string
  driverAddress: string
  amount: number
  currency: string
  onPaymentSuccess?: () => void
}

export function AutoPayButton({
  tripId,
  paymentId,
  transactionXdr,
  driverAddress,
  amount,
  currency,
  onPaymentSuccess,
}: AutoPayButtonProps) {
  const { t } = useTranslation()
  const { formatConvertedAmount } = useCurrency()
  const [isPaying, setIsPaying] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<{
    isAvailable: boolean
    isConnected: boolean
    publicKey: string | null
    network: 'testnet' | 'mainnet' | null
  } | null>(null)
  const [formattedAmount, setFormattedAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkConnection()
    formatConvertedAmount(amount, currency).then(setFormattedAmount)
  }, [amount, currency, formatConvertedAmount])

  const checkConnection = async () => {
    const status = await getFreighterConnectionStatus()
    setConnectionStatus(status)
  }

  const handleConnect = async () => {
    try {
      await connectFreighter()
      await checkConnection()
      toast.success(t('wallet.connected') || 'Wallet conectada exitosamente')
    } catch (error: any) {
      toast.error(error.message || t('wallet.connectionError') || 'Error al conectar wallet')
      setError(error.message)
    }
  }

  const handlePay = async () => {
    if (!connectionStatus?.isConnected) {
      await handleConnect()
      return
    }

    if (!transactionXdr) {
      toast.error(t('payment.transactionNotAvailable') || 'Transacción no disponible')
      setError(t('payment.transactionNotAvailable') || 'Transacción no disponible')
      return
    }

    try {
      setIsPaying(true)
      setError(null)

      // Obtener la red actual
      const network = await getNetwork()

      // Firmar y enviar la transacción
      const result = await signAndSubmitTransaction(transactionXdr, network)

      if (result.success) {
        // Verificar el pago en el backend
        const verification = await api.verifyStellarPayment(paymentId, result.transactionId)

        if (verification.verified) {
          setIsPaid(true)
          toast.success(t('payment.success') || 'Pago realizado exitosamente')
          
          if (onPaymentSuccess) {
            onPaymentSuccess()
          }

          // Recargar después de 2 segundos
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        } else {
          throw new Error(verification.message || t('payment.verificationFailed') || 'No se pudo verificar el pago')
        }
      } else {
        throw new Error(t('payment.transactionFailed') || 'La transacción no fue exitosa')
      }
    } catch (error: any) {
      console.error('Error processing payment:', error)
      setError(error.message || t('payment.error') || 'Error al procesar el pago')
      toast.error(error.message || t('payment.error') || 'Error al procesar el pago')
    } finally {
      setIsPaying(false)
    }
  }

  if (isPaid) {
    return (
      <Card className="border-green-500 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <div>
              <h3 className="text-lg font-semibold text-green-600">
                {t('payment.paid') || 'Pago completado'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('payment.paidDescription') || 'El pago ha sido procesado exitosamente'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!connectionStatus?.isAvailable) {
    return (
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            {t('wallet.freighterNotInstalled') || 'Freighter no está instalado'}
          </CardTitle>
          <CardDescription>
            {t('wallet.freighterNotInstalledDescription') || 'Necesitas instalar Freighter para realizar pagos automáticos'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => window.open('https://freighter.app/', '_blank')}
            variant="outline"
            className="w-full"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {t('wallet.installFreighter') || 'Instalar Freighter'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StellarLogo size={20} />
          <Wallet className="h-5 w-5" />
          {t('payment.payTrip') || 'Pagar Viaje'}
        </CardTitle>
        <CardDescription>
          {t('payment.payTripDescription') || 'Realiza el pago automáticamente usando tu wallet Freighter'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Monto */}
        <div className="p-4 bg-muted rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {t('payment.amount') || 'Monto a pagar'}
            </span>
            <span className="text-2xl font-bold">
              {formattedAmount || `${amount} ${currency}`}
            </span>
          </div>
        </div>

        {/* Estado de conexión */}
        {connectionStatus && !connectionStatus.isConnected && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('wallet.notConnected') || 'Wallet no conectada'}</AlertTitle>
            <AlertDescription>
              {t('wallet.notConnectedDescription') || 'Conecta tu wallet Freighter para realizar el pago'}
            </AlertDescription>
          </Alert>
        )}

        {connectionStatus && connectionStatus.isConnected && (
          <div className="space-y-2">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>{t('wallet.connected') || 'Wallet conectada'}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                {connectionStatus.publicKey?.slice(0, 8)}...{connectionStatus.publicKey?.slice(-8)}
              </p>
            </div>
            {driverAddress && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">
                  {t('payment.payToDriver') || 'Pagar a conductor'}
                </div>
                <p className="text-sm font-mono text-blue-600">
                  {driverAddress.slice(0, 8)}...{driverAddress.slice(-8)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('payment.error') || 'Error'}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Botón de pago */}
        <Button
          onClick={handlePay}
          disabled={isPaying || !transactionXdr || (connectionStatus && !connectionStatus.isConnected)}
          className="w-full"
          size="lg"
        >
          {isPaying ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              {t('payment.processing') || 'Procesando pago...'}
            </>
          ) : connectionStatus && !connectionStatus.isConnected ? (
            <>
              <Wallet className="h-5 w-5 mr-2" />
              {t('wallet.connectAndPay') || 'Conectar y Pagar'}
            </>
          ) : (
            <>
              <Wallet className="h-5 w-5 mr-2" />
              {t('payment.payTrip') || 'PAGAR VIAJE'}
            </>
          )}
        </Button>

        {connectionStatus && !connectionStatus.isConnected && (
          <Button
            onClick={handleConnect}
            variant="outline"
            className="w-full"
          >
            <Wallet className="h-4 w-4 mr-2" />
            {t('wallet.connectFreighter') || 'Conectar Freighter'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

