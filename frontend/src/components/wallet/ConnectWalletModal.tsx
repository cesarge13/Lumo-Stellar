/**
 * Modal para conectar wallet Freighter
 * Permite conectar con extensión del navegador o wallet móvil
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Wallet, Smartphone, Monitor, CheckCircle, AlertCircle, Loader2, ExternalLink, QrCode } from 'lucide-react'
import StellarLogo from '@/components/layout/StellarLogo'
import { toast } from 'sonner'
import {
  getFreighterConnectionStatus,
  connectFreighter,
  isFreighterAvailable,
} from '@/services/freighterService'
import { MobileConnectionQR } from './MobileConnectionQR'

interface ConnectWalletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConnected?: (publicKey: string) => void
}

export function ConnectWalletModal({
  open,
  onOpenChange,
  onConnected,
}: ConnectWalletModalProps) {
  const { t } = useTranslation()
  const [connectionStatus, setConnectionStatus] = useState<{
    isAvailable: boolean
    isConnected: boolean
    publicKey: string | null
    network: 'testnet' | 'mainnet' | null
  } | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionMethod, setConnectionMethod] = useState<'extension' | 'mobile' | null>(null)
  const [showMobileQR, setShowMobileQR] = useState(false)

  useEffect(() => {
    if (open) {
      checkStatus()
      // Resetear estado cuando se abre el modal
      setShowMobileQR(false)
    }
  }, [open])

  const checkStatus = async () => {
    const status = await getFreighterConnectionStatus()
    setConnectionStatus(status)
  }

  const handleConnectExtension = async () => {
    try {
      setIsConnecting(true)
      setConnectionMethod('extension')

      // Verificar si Freighter está disponible
      const available = await isFreighterAvailable()
      if (!available) {
        toast.error(t('wallet.freighterNotInstalled') || 'Freighter no está instalado')
        window.open('https://freighter.app/', '_blank')
        return
      }

      // Conectar con Freighter
      const account = await connectFreighter()
      
      // Actualizar estado
      await checkStatus()
      
      toast.success(t('wallet.connected') || 'Wallet conectada exitosamente')
      
      if (onConnected && account.publicKey) {
        onConnected(account.publicKey)
      }

      // Cerrar modal después de conectar
      setTimeout(() => {
        onOpenChange(false)
      }, 1000)
    } catch (error: any) {
      console.error('Error connecting wallet:', error)
      toast.error(error.message || t('wallet.connectionError') || 'Error al conectar wallet')
    } finally {
      setIsConnecting(false)
      setConnectionMethod(null)
    }
  }

  const handleConnectMobile = () => {
    // Mostrar componente de QR de conexión móvil
    console.log('🔍 Mostrando QR móvil...')
    setShowMobileQR(true)
  }

  if (connectionStatus?.isConnected && connectionStatus.publicKey) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              {t('wallet.alreadyConnected') || 'Wallet Conectada'}
            </DialogTitle>
            <DialogDescription>
              {t('wallet.alreadyConnectedDescription') || 'Tu wallet Freighter ya está conectada'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-green-600 mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">{t('wallet.connected') || 'Conectado'}</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground break-all">
                {connectionStatus.publicKey}
              </p>
              {connectionStatus.network && (
                <p className="text-xs text-muted-foreground mt-2">
                  {t('wallet.network') || 'Red'}: <span className="font-medium">{connectionStatus.network.toUpperCase()}</span>
                </p>
              )}
            </div>
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              {t('common.close') || 'Cerrar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Si se muestra el QR móvil, mostrar ese componente
  if (showMobileQR) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              {t('wallet.connectMobile') || 'Conectar con Freighter Móvil'}
            </DialogTitle>
            <DialogDescription>
              {t('wallet.scanQRWithMobile') || 'Escanea el código QR con tu teléfono'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <MobileConnectionQR
              onConnected={(stellarAddress) => {
                if (onConnected) {
                  onConnected(stellarAddress)
                }
                setShowMobileQR(false)
                onOpenChange(false)
              }}
            />
            <Button
              onClick={() => setShowMobileQR(false)}
              variant="outline"
              className="w-full"
            >
              {t('common.back') || 'Volver'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StellarLogo size={20} />
            <Wallet className="h-5 w-5" />
            {t('wallet.connectWallet') || 'Conectar Wallet'}
          </DialogTitle>
          <DialogDescription>
            {t('wallet.connectWalletDescription') || 'Conecta tu wallet Freighter para realizar pagos'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Método 1: Extensión del navegador - Botón principal */}
          <div className="space-y-2">
            <Button
              onClick={handleConnectExtension}
              disabled={isConnecting}
              className="w-full h-auto p-4 flex flex-col items-start gap-2"
              size="lg"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Monitor className="h-5 w-5" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">
                    {t('wallet.connectExtension') || 'Conectar con Extensión'}
                  </div>
                  <div className="text-xs opacity-90">
                    {t('wallet.connectExtensionDescription') || 'Se abrirá el pop-up de Freighter para aprobar la conexión'}
                  </div>
                </div>
                {isConnecting && connectionMethod === 'extension' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
            </Button>

            {/* Método 2: Wallet móvil - Botón principal */}
            <Button
              onClick={() => {
                console.log('🔍 Click en botón móvil QR')
                handleConnectMobile()
              }}
              disabled={isConnecting}
              className="w-full h-auto p-4 flex flex-col items-start gap-2 border-2 border-blue-500/50 hover:border-blue-500 bg-blue-500/5 hover:bg-blue-500/10"
              size="lg"
              variant="outline"
            >
              <div className="flex items-center gap-3 w-full">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <QrCode className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-blue-600 dark:text-blue-400">
                    📱 {t('wallet.connectMobile') || 'Conectar con Freighter Móvil'}
                  </div>
                  <div className="text-xs opacity-90 mt-1">
                    {t('wallet.scanQRToConnect') || 'Escanea un código QR con tu teléfono para conectar tu wallet'}
                  </div>
                </div>
                <Smartphone className="h-5 w-5 text-blue-500" />
              </div>
            </Button>
          </div>

          {/* Información sobre Freighter */}
          {!connectionStatus?.isAvailable && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('wallet.freighterNotInstalled') || 'Freighter no está instalado'}</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-2">
                  {t('wallet.freighterNotInstalledDescription') || 'Necesitas instalar Freighter para conectar tu wallet'}
                </p>
                <Button
                  onClick={() => window.open('https://freighter.app/', '_blank')}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {t('wallet.installFreighter') || 'Instalar Freighter'}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Estado de conexión */}
          {connectionStatus?.isAvailable && !connectionStatus.isConnected && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('wallet.notConnected') || 'No conectado'}</AlertTitle>
              <AlertDescription>
                {t('wallet.notConnectedDescription') || 'Haz clic en "Conectar con Extensión" para comenzar'}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

