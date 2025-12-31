/**
 * Componente para mostrar el código QR de pago Stellar y manejar el pago con Freighter
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QrCode, Copy, CheckCircle, Loader2, AlertCircle, Wallet } from 'lucide-react'
import StellarLogo from '@/components/layout/StellarLogo'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { useCurrency } from '@/hooks/useCurrency'
import {
  isConnected,
  requestAccess,
  getAddress,
  signTransaction,
} from '@stellar/freighter-api'

interface StellarPaymentQRProps {
  paymentQR: string
  paymentAddress: string
  amount: number
  currency: string
  paymentId: string
  transactionXdr?: string // XDR de la transacción para Freighter
  onPaymentVerified?: () => void
}

export function StellarPaymentQR({
  paymentQR,
  paymentAddress,
  amount,
  currency,
  paymentId,
  transactionXdr,
  onPaymentVerified,
}: StellarPaymentQRProps) {
  const { t } = useTranslation()
  const { formatConvertedAmount } = useCurrency()
  const [transactionId, setTransactionId] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [formattedAmount, setFormattedAmount] = useState('')
  const [isFreighterAvailable, setIsFreighterAvailable] = useState(false)
  const [isPaying, setIsPaying] = useState(false)
  const [freighterPublicKey, setFreighterPublicKey] = useState<string | null>(null)

  useEffect(() => {
    // Formatear el monto
    formatConvertedAmount(amount, currency).then(setFormattedAmount)
    
    // Verificar si Freighter está disponible
    checkFreighterAvailability()
  }, [amount, currency, formatConvertedAmount])

  const checkFreighterAvailability = async () => {
    try {
      const connectionStatus = await isConnected()
      setIsFreighterAvailable(connectionStatus.isConnected)
      
      if (connectionStatus.isConnected) {
        try {
          const addressResult = await getAddress()
          if (!addressResult.error && addressResult.address) {
            setFreighterPublicKey(addressResult.address)
          }
        } catch (error) {
          console.log('Freighter disponible pero no conectado')
        }
      }
    } catch (error) {
      console.log('Freighter no disponible:', error)
      setIsFreighterAvailable(false)
    }
  }

  const handleConnectFreighter = async () => {
    try {
      // Verificar si ya está conectado
      const connectionStatus = await isConnected()
      
      if (!connectionStatus.isConnected) {
        // Solicitar permiso (esto mostrará el pop-up nativo)
        const accessResult = await requestAccess()
        if (accessResult.error) {
          throw new Error(accessResult.error)
        }
        if (accessResult.address) {
          setFreighterPublicKey(accessResult.address)
          setIsFreighterAvailable(true)
          toast.success(t('payment.freighterConnected') || 'Freighter conectado exitosamente')
          return
        }
      }
      
      const addressResult = await getAddress()
      if (addressResult.error) {
        throw new Error(addressResult.error)
      }
      if (addressResult.address) {
        setFreighterPublicKey(addressResult.address)
        setIsFreighterAvailable(true)
        toast.success(t('payment.freighterConnected') || 'Freighter conectado exitosamente')
      }
    } catch (error: any) {
      console.error('Error conectando Freighter:', error)
      toast.error(error.message || t('payment.freighterConnectionError') || 'Error al conectar Freighter')
    }
  }

  const handlePayWithFreighter = async () => {
    if (!transactionXdr) {
      toast.error(t('payment.transactionNotAvailable') || 'Transacción no disponible. Por favor, escanea el código QR.')
      return
    }

    if (!freighterPublicKey) {
      await handleConnectFreighter()
      return
    }

    try {
      setIsPaying(true)
      
      // Firmar y enviar la transacción usando Freighter
      const signResult = await signTransaction(transactionXdr, {
        networkPassphrase: 'Test SDF Network ; September 2015', // TODO: Usar network correcto según configuración
        address: freighterPublicKey,
      })
      
      if (signResult.error) {
        throw new Error(signResult.error)
      }
      
      const signedTransaction = signResult.signedTxXdr

      // Enviar la transacción firmada a Horizon
      const response = await fetch('https://horizon-testnet.stellar.org/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx: signedTransaction,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Error al enviar la transacción')
      }

      const result = await response.json()
      const txId = result.hash

      // Verificar el pago automáticamente
      setTransactionId(txId)
      await handleVerifyPayment(txId)
      
      toast.success(t('payment.transactionSent') || 'Transacción enviada exitosamente')
    } catch (error: any) {
      console.error('Error pagando con Freighter:', error)
      toast.error(error.message || t('payment.freighterPaymentError') || 'Error al procesar el pago con Freighter')
    } finally {
      setIsPaying(false)
    }
  }

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(paymentAddress)
    toast.success(t('payment.addressCopied') || 'Dirección copiada al portapapeles')
  }

  const handleScanQR = () => {
    // El QR ya está visible en la pantalla
    // El usuario debe abrir Freighter y escanear el código QR mostrado
    toast.info(t('payment.scanQRWithFreighter') || 'Abre Freighter y escanea el código QR mostrado arriba')
  }

  const handleVerifyPayment = async (txId?: string) => {
    const txIdToVerify = txId || transactionId.trim()
    
    if (!txIdToVerify) {
      toast.error(t('payment.transactionIdRequired') || 'Ingresa el ID de la transacción')
      return
    }

    try {
      setIsVerifying(true)
      const result = await api.verifyStellarPayment(paymentId, txIdToVerify)

      if (result.verified) {
        setIsPaid(true)
        toast.success(t('payment.verified') || 'Pago verificado exitosamente')
        if (onPaymentVerified) {
          onPaymentVerified()
        }
        // Recargar la página después de 2 segundos
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        toast.error(result.message || t('payment.verificationFailed') || 'No se pudo verificar el pago')
      }
    } catch (error: any) {
      console.error('Error verifying payment:', error)
      toast.error(error.message || t('payment.verificationError') || 'Error al verificar el pago')
    } finally {
      setIsVerifying(false)
    }
  }

  if (isPaid) {
    return (
      <Card className="border-green-500">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <div>
              <h3 className="text-lg font-semibold text-green-600">
                {t('payment.paid') || 'Pago completado'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t('payment.paidDescription') || 'El pago ha sido verificado exitosamente'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StellarLogo size={20} />
          <QrCode className="h-5 w-5" />
          {t('payment.payWithStellar') || 'Pagar con Stellar (Freighter)'}
        </CardTitle>
        <CardDescription>
          {t('payment.scanQRDescription') || 'Escanea el código QR con Freighter para realizar el pago'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Monto a pagar */}
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

        {/* Código QR */}
        <div className="flex flex-col items-center gap-4">
          <div className="text-center space-y-2">
            <p className="text-sm font-medium">
              {t('payment.driverWalletAddress') || 'Dirección de Wallet del Conductor'}
            </p>
            <p className="text-xs text-muted-foreground font-mono break-all px-2">
              {paymentAddress}
            </p>
          </div>
          <div className="p-4 border-2 border-primary rounded-lg bg-white">
            <img
              src={paymentQR}
              alt={`QR Code para pagar a ${paymentAddress}`}
              className="w-64 h-64"
            />
          </div>
          <p className="text-xs text-muted-foreground text-center px-4">
            {t('payment.scanQRWithFreighterMobile') || 'Escanea este código QR con Freighter móvil para realizar el pago a la wallet del conductor'}
          </p>
          {/* Botón para pagar con Freighter directamente */}
          {isFreighterAvailable && transactionXdr ? (
            <Button
              onClick={handlePayWithFreighter}
              disabled={isPaying}
              className="w-full"
              size="lg"
            >
              {isPaying ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  {t('payment.processing') || 'Procesando pago...'}
                </>
              ) : (
                <>
                  <Wallet className="h-5 w-5 mr-2" />
                  {freighterPublicKey 
                    ? (t('payment.payWithFreighter') || 'Pagar con Freighter')
                    : (t('payment.connectFreighter') || 'Conectar Freighter')}
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleScanQR}
                className="w-full"
                size="lg"
              >
                <QrCode className="h-5 w-5 mr-2" />
                {t('payment.scanQRPayment') || 'Escanear QR de Pago'}
              </Button>
              {!isFreighterAvailable && (
                <Button
                  onClick={handleConnectFreighter}
                  variant="outline"
                  className="w-full"
                  size="lg"
                >
                  <Wallet className="h-5 w-5 mr-2" />
                  {t('payment.connectFreighter') || 'Conectar Freighter'}
                </Button>
              )}
            </>
          )}
          <p className="text-sm text-muted-foreground text-center">
            {isFreighterAvailable && transactionXdr
              ? (t('payment.payDirectlyWithFreighter') || 'Paga directamente con Freighter desde tu navegador')
              : (t('payment.scanWithFreighter') || 'Abre Freighter y escanea el código QR para realizar el pago')}
          </p>
        </div>

        {/* Dirección Stellar del Conductor */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            {t('payment.driverStellarAddress') || 'Dirección Stellar del Conductor (Freighter)'}
          </Label>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Input
                value={paymentAddress}
                readOnly
                className="font-mono text-sm bg-transparent border-0 p-0 h-auto flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyAddress}
                className="shrink-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('payment.thisIsDriverWallet') || 'Esta es la dirección de la wallet Freighter del conductor. El pago se enviará directamente a esta dirección.'}
            </p>
          </div>
        </div>


        {/* Verificación manual */}
        <div className="pt-4 border-t space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>{t('payment.alreadyPaid') || '¿Ya realizaste el pago?'}</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transactionId">
              {t('payment.transactionId') || 'ID de Transacción Stellar'}
            </Label>
            <Input
              id="transactionId"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="ej: abc123def456..."
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t('payment.transactionIdHelp') || 'Ingresa el ID de la transacción después de pagar con Freighter'}
            </p>
          </div>
          <Button
            onClick={() => handleVerifyPayment()}
            disabled={isVerifying || !transactionId.trim()}
            className="w-full"
          >
            {isVerifying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('payment.verifying') || 'Verificando...'}
              </>
            ) : (
              t('payment.verifyPayment') || 'Verificar Pago'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

