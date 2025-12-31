/**
 * Botón para instalar la PWA
 * Muestra un botón cuando la app puede ser instalada
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPWAButton() {
  const { t } = useTranslation()
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Verificar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Verificar si está en iOS (no soporta beforeinstallprompt)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    if (isIOS) {
      // En iOS, el usuario debe usar el menú "Compartir" > "Añadir a pantalla de inicio"
      return
    }

    // Escuchar el evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('beforeinstallprompt event recibido')
      // Prevenir el banner automático del navegador
      // Esto es intencional: queremos mostrar nuestro diálogo personalizado
      e.preventDefault()
      // Guardar el evento para usarlo después
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      console.log('DeferredPrompt guardado, mostrando diálogo en 1 segundo...')
      // Mostrar nuestro diálogo personalizado después de un pequeño delay
      // para dar tiempo a que la página cargue completamente
      setTimeout(() => {
        console.log('Mostrando diálogo de instalación PWA')
        setShowInstallPrompt(true)
      }, 1000) // Esperar 1 segundo antes de mostrar el diálogo
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Escuchar cuando se instala
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Si no hay deferredPrompt, puede ser iOS o el navegador no soporta PWA
      console.warn('No se puede instalar: el navegador no soporta la instalación de PWA o ya está instalada')
      setShowInstallPrompt(false)
      return
    }

    try {
      console.log('Llamando a deferredPrompt.prompt()...')
      // Mostrar el prompt de instalación nativo del navegador
      await deferredPrompt.prompt()
      console.log('Prompt mostrado, esperando respuesta del usuario...')

      // Esperar la respuesta del usuario
      const { outcome } = await deferredPrompt.userChoice
      console.log('Usuario eligió:', outcome)

      if (outcome === 'accepted') {
        console.log('✅ Usuario aceptó instalar la PWA')
        // El evento appinstalled se disparará automáticamente
      } else {
        console.log('❌ Usuario rechazó instalar la PWA')
        // Guardar en localStorage para no mostrar de nuevo por un tiempo
        localStorage.setItem('pwa-install-dismissed', Date.now().toString())
      }
    } catch (error) {
      console.error('❌ Error al mostrar el prompt de instalación:', error)
      // Si hay un error, cerrar el diálogo
      setShowInstallPrompt(false)
    } finally {
      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    // Guardar en localStorage para no mostrar de nuevo por un tiempo
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  // No mostrar si ya está instalada o si el usuario la rechazó recientemente
  if (isInstalled) {
    return null
  }

  const dismissedTime = localStorage.getItem('pwa-install-dismissed')
  if (dismissedTime) {
    const dismissed = parseInt(dismissedTime)
    const daysSinceDismissed = (Date.now() - dismissed) / (1000 * 60 * 60 * 24)
    if (daysSinceDismissed < 7) {
      // No mostrar por 7 días si fue rechazada
      return null
    }
  }

  if (!showInstallPrompt || !deferredPrompt) {
    return null
  }

  return (
    <Dialog open={showInstallPrompt} onOpenChange={setShowInstallPrompt}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pwa.installTitle') || 'Instalar Lumo'}</DialogTitle>
          <DialogDescription>
            {t('pwa.installDescription') || 
              'Instala Lumo en tu dispositivo para acceder rápidamente y recibir notificaciones incluso cuando estés fuera del navegador.'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>{t('pwa.benefit1') || 'Acceso rápido desde la pantalla de inicio'}</li>
            <li>{t('pwa.benefit2') || 'Funciona sin conexión'}</li>
            <li>{t('pwa.benefit3') || 'Notificaciones push incluso fuera del navegador'}</li>
            <li>{t('pwa.benefit4') || 'Experiencia como app nativa'}</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleDismiss}>
            <X className="h-4 w-4 mr-2" />
            {t('common.later') || 'Ahora no'}
          </Button>
          <Button onClick={handleInstallClick}>
            <Download className="h-4 w-4 mr-2" />
            {t('pwa.install') || 'Instalar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

