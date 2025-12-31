/**
 * Servicio para manejar notificaciones push
 * Permite recibir notificaciones incluso cuando el usuario está fuera del navegador
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

/**
 * Solicita permisos para notificaciones y registra el Service Worker
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('Este navegador no soporta notificaciones')
    return false
  }

  if (Notification.permission === 'granted') {
    return true
  }

  if (Notification.permission === 'denied') {
    console.warn('Permisos de notificación denegados')
    return false
  }

  const permission = await Notification.requestPermission()
  return permission === 'granted'
}

/**
 * Registra el Service Worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Este navegador no soporta Service Workers')
    return null
  }

  // En desarrollo, solo registrar si realmente se necesita (notificaciones push)
  // En producción, siempre registrar
  if (import.meta.env.DEV) {
    // En desarrollo, solo registrar si hay VAPID key configurada
    if (!VAPID_PUBLIC_KEY) {
      return null
    }
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    })
    
    console.log('Service Worker registrado:', registration)
    
    // Limpiar service workers antiguos
    registration.update()
    
    return registration
  } catch (error) {
    // No es crítico si falla el registro del SW
    console.warn('Error registrando Service Worker (no crítico):', error)
    return null
  }
}

/**
 * Obtiene el token de suscripción para notificaciones push
 */
export async function getPushSubscription(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  try {
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      if (!VAPID_PUBLIC_KEY) {
        console.warn('VAPID_PUBLIC_KEY no configurada')
        return null
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as unknown as ArrayBuffer
      })
    }

    return subscription
  } catch (error) {
    console.error('Error obteniendo suscripción push:', error)
    return null
  }
}

/**
 * Convierte una clave VAPID de base64 URL a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * Inicializa el sistema de notificaciones push
 */
export async function initializePushNotifications(): Promise<{
  permission: boolean
  subscription: PushSubscription | null
}> {
  // 1. Solicitar permisos
  const permission = await requestNotificationPermission()
  if (!permission) {
    return { permission: false, subscription: null }
  }

  // 2. Registrar Service Worker
  const registration = await registerServiceWorker()
  if (!registration) {
    return { permission: true, subscription: null }
  }

  // 3. Obtener suscripción push
  const subscription = await getPushSubscription(registration)

  return { permission: true, subscription }
}

/**
 * Envía el token de suscripción al backend
 */
export async function sendSubscriptionToBackend(
  subscription: PushSubscription,
  userId: string
): Promise<boolean> {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        userId,
        subscription: subscription.toJSON()
      })
    })

    return response.ok
  } catch (error) {
    console.error('Error enviando suscripción al backend:', error)
    return false
  }
}

