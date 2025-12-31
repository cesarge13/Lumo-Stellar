/**
 * Componente para mostrar QR de conexión móvil
 * Permite conectar Freighter móvil escaneando un código QR
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { QrCode, RefreshCw, AlertCircle, Loader2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/services/api'
import StellarLogo from '@/components/layout/StellarLogo'

interface MobileConnectionQRProps {
  onConnected?: (stellarAddress: string) => void
}

export function MobileConnectionQR({ onConnected }: MobileConnectionQRProps) {
  const { t } = useTranslation()
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [connectionUrl, setConnectionUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<string>('')

  useEffect(() => {
    generateQR()
  }, [])

  useEffect(() => {
    if (expiresAt) {
      const interval = setInterval(() => {
        const now = new Date()
        const diff = expiresAt.getTime() - now.getTime()
        
        if (diff <= 0) {
          setTimeRemaining('Expirado')
          clearInterval(interval)
          return
        }

        const minutes = Math.floor(diff / 60000)
        const seconds = Math.floor((diff % 60000) / 1000)
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [expiresAt])

  const generateQR = async () => {
    try {
      setIsGenerating(true)
      const data = await api.generateConnectionQR()
      setQrCode(data.qrCode)
      setConnectionUrl(data.connectionUrl)
      setExpiresAt(new Date(data.expiresAt))
      toast.success(t('wallet.qrGenerated') || 'Código QR generado exitosamente')
    } catch (error: any) {
      console.error('Error generating QR:', error)
      toast.error(error.message || t('wallet.qrGenerationError') || 'Error al generar código QR')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyConnectionUrl = () => {
    if (connectionUrl) {
      navigator.clipboard.writeText(connectionUrl)
      toast.success(t('common.copied') || 'URL copiada al portapapeles')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StellarLogo size={20} />
          <QrCode className="h-5 w-5" />
          {t('wallet.connectMobile') || 'Conectar con Freighter Móvil'}
        </CardTitle>
        <CardDescription>
          {t('wallet.scanQRWithMobile') || 'Escanea este código QR con tu teléfono para conectar tu wallet Freighter móvil'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">
              {t('wallet.generatingQR') || 'Generando código QR...'}
            </p>
          </div>
        ) : qrCode ? (
          <>
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white rounded-lg">
                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              </div>
              
              {timeRemaining && (
                <div className="text-sm text-muted-foreground">
                  {t('wallet.expiresIn') || 'Expira en'}: <span className="font-medium">{timeRemaining}</span>
                </div>
              )}

              {connectionUrl && (
                <div className="w-full space-y-2">
                  <p className="text-xs text-muted-foreground text-center">
                    {t('wallet.orCopyUrl') || 'O copia esta URL y ábrela en tu móvil'}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={connectionUrl}
                      readOnly
                      className="flex-1 px-3 py-2 text-xs bg-muted rounded-md border"
                    />
                    <Button
                      onClick={copyConnectionUrl}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('wallet.howToConnect') || 'Cómo conectar'}</AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>{t('wallet.step1') || 'Abre Freighter en tu teléfono'}</li>
                  <li>{t('wallet.step2') || 'Escanea este código QR o abre la URL copiada'}</li>
                  <li>{t('wallet.step3') || 'Ingresa tu dirección Stellar cuando se solicite'}</li>
                  <li>{t('wallet.step4') || 'Confirma la conexión'}</li>
                </ol>
              </AlertDescription>
            </Alert>

            <Button
              onClick={generateQR}
              variant="outline"
              className="w-full"
              disabled={isGenerating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              {t('wallet.generateNewQR') || 'Generar nuevo código QR'}
            </Button>
          </>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('wallet.error') || 'Error'}</AlertTitle>
            <AlertDescription>
              {t('wallet.qrGenerationFailed') || 'No se pudo generar el código QR. Intenta nuevamente.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

