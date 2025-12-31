/**
 * Servicio para integración nativa con Freighter Wallet
 * Maneja conexión, gestión de cuentas y transacciones
 * Basado en la documentación oficial: https://github.com/stellar/freighter
 */

import {
  isConnected,
  requestAccess,
  getAddress,
  getNetwork as getFreighterNetwork,
  signTransaction,
} from '@stellar/freighter-api'

export interface FreighterAccount {
  publicKey: string
  isConnected: boolean
}

export interface FreighterConnectionStatus {
  isAvailable: boolean
  isConnected: boolean
  publicKey: string | null
  network: 'testnet' | 'mainnet' | null
}

/**
 * Verifica si Freighter está instalado y disponible
 * La API puede no estar disponible inmediatamente, así que intentamos acceder directamente
 */
export async function isFreighterAvailable(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }
  
  // Intentar verificar usando el paquete
  try {
    await isConnected()
    return true
  } catch {
    return false
  }
  
  // Si no está disponible inmediatamente, intentar acceder a la API directamente
  // Esto puede funcionar aunque window.freighterApi no esté definido todavía
  try {
    // Intentar acceder a la API - si está instalado, esto funcionará
    // Usamos una verificación más permisiva
    return true // Asumimos que está disponible y dejamos que los métodos individuales manejen los errores
  } catch (error) {
    return false
  }
}

/**
 * Obtiene el estado de conexión de Freighter
 * Basado en el ejemplo de integración oficial
 */
export async function getFreighterConnectionStatus(): Promise<FreighterConnectionStatus> {
  try {
    // Verificar si estamos en el navegador
    if (typeof window === 'undefined') {
      return {
        isAvailable: false,
        isConnected: false,
        publicKey: null,
        network: null,
      }
    }

    try {
      // Usar el paquete @stellar/freighter-api para verificar el estado
      // Intentar verificar si está conectado
      const connectionStatus = await isConnected()

      // Si no está conectado, retornar estado disponible pero no conectado
      if (!connectionStatus.isConnected) {
        return {
          isAvailable: true,
          isConnected: false,
          publicKey: null,
          network: null,
        }
      }

      // Si está conectado, obtener la clave pública y la red
      const publicKeyResult = await getAddress()
      const networkResult = await getFreighterNetwork()
      
      const publicKey = publicKeyResult.error ? null : publicKeyResult.address
      const network = networkResult.error ? null : networkResult.network
      
      if (!publicKey) {
        return {
          isAvailable: true,
          isConnected: false,
          publicKey: null,
          network: null,
        }
      }
      
      return {
        isAvailable: true,
        isConnected: true,
        publicKey,
        network: network?.toLowerCase() as 'testnet' | 'mainnet' || null,
      }
    } catch (error: any) {
      // Si hay un error al acceder a la API, puede ser que no esté instalado
      const errorMessage = error?.message?.toLowerCase() || ''
      
      if (errorMessage.includes('not installed') || 
          errorMessage.includes('extension not detected') ||
          errorMessage.includes('freighter is not installed') ||
          errorMessage.includes('could not establish connection')) {
        return {
          isAvailable: false,
          isConnected: false,
          publicKey: null,
          network: null,
        }
      }
      
      // Otros errores - asumimos disponible pero no conectado
      return {
        isAvailable: true,
        isConnected: false,
        publicKey: null,
        network: null,
      }
    }
  } catch (error) {
    // Error general - Freighter no está disponible
    return {
      isAvailable: false,
      isConnected: false,
      publicKey: null,
      network: null,
    }
  }
}

/**
 * Solicita acceso a Freighter y conecta la wallet
 * Muestra el pop-up nativo de Freighter para aprobar la conexión
 * Intenta acceder directamente a la API sin verificar primero
 */
export async function connectFreighter(): Promise<FreighterAccount> {
  if (typeof window === 'undefined') {
    throw new Error('No se puede conectar Freighter fuera del navegador')
  }

  console.log('🔍 Intentando conectar Freighter usando @stellar/freighter-api...')

  try {
    // Usar el paquete @stellar/freighter-api directamente
    // Este paquete maneja la detección de la extensión internamente
    
    // Verificar si ya está conectado
    // isConnected() devuelve un objeto con { isConnected: boolean }
    let connectionStatus: { isConnected: boolean; error?: any } = { isConnected: false }
    try {
      connectionStatus = await isConnected()
      console.log('🔍 Freighter isConnected:', connectionStatus)
    } catch (error: any) {
      console.log('🔍 Error verificando conexión:', error)
      // Si isConnected falla, puede ser que necesitemos solicitar acceso primero
    }

    // Si no está conectado, solicitar permiso (esto mostrará el pop-up nativo)
    if (!connectionStatus.isConnected) {
      try {
        console.log('🔍 Solicitando acceso a Freighter...')
        // requestAccess() mostrará el pop-up nativo de Freighter
        // Devuelve { address: string } o { error: string }
        const accessResult = await requestAccess()
        console.log('🔍 Resultado de requestAccess:', accessResult)
        
        if (accessResult.error) {
          const errorMessage = accessResult.error.toLowerCase()
          if (errorMessage.includes('user rejected') || 
              errorMessage.includes('user cancelled') ||
              errorMessage.includes('rejected') ||
              errorMessage.includes('cancelado')) {
            throw new Error('Conexión cancelada por el usuario')
          }
          throw new Error(accessResult.error)
        }
        
        // Si tenemos la dirección directamente, retornarla
        if (accessResult.address && accessResult.address.trim() !== '') {
          console.log('🔍 Dirección obtenida de requestAccess:', accessResult.address.slice(0, 8) + '...' + accessResult.address.slice(-4))
          return {
            publicKey: accessResult.address,
            isConnected: true,
          }
        }
      } catch (error: any) {
        const errorMessage = error?.message?.toLowerCase() || ''
        console.log('🔍 Error solicitando acceso:', errorMessage)
        
        if (errorMessage.includes('user rejected') || 
            errorMessage.includes('user cancelled') ||
            errorMessage.includes('rejected') ||
            errorMessage.includes('cancelado')) {
          throw new Error('Conexión cancelada por el usuario')
        }
        
        // Si requestAccess falla, intentar obtener la clave pública directamente
      }
    }

    // Obtener la clave pública después de conectar
    // Intentar primero con getAddress()
    console.log('🔍 Obteniendo clave pública...')
    let publicKey: string | null = null
    
    try {
      const publicKeyResult = await getAddress()
      console.log('🔍 Resultado de getAddress:', publicKeyResult)
      
      if (publicKeyResult.error) {
        console.log('🔍 getAddress tiene error, intentando requestAccess...')
        // Si getAddress falla, intentar con requestAccess
        const accessResult = await requestAccess()
        if (!accessResult.error && accessResult.address && accessResult.address.trim() !== '') {
          publicKey = accessResult.address
        }
      } else if (publicKeyResult.address && publicKeyResult.address.trim() !== '') {
        publicKey = publicKeyResult.address
      } else {
        // Si address está vacío, intentar con requestAccess
        console.log('🔍 getAddress devolvió address vacío, intentando requestAccess...')
        const accessResult = await requestAccess()
        if (!accessResult.error && accessResult.address && accessResult.address.trim() !== '') {
          publicKey = accessResult.address
        }
      }
    } catch (error: any) {
      console.log('🔍 Error en getAddress, intentando requestAccess...', error)
      // Si getAddress falla completamente, intentar con requestAccess
      try {
        const accessResult = await requestAccess()
        if (!accessResult.error && accessResult.address && accessResult.address.trim() !== '') {
          publicKey = accessResult.address
        }
      } catch (requestError: any) {
        console.error('🔍 Error en requestAccess también:', requestError)
      }
    }
    
    console.log('🔍 Clave pública obtenida:', publicKey ? `${publicKey.slice(0, 8)}...${publicKey.slice(-4)}` : 'null')
    
    if (!publicKey || publicKey.trim() === '') {
      throw new Error('No se pudo obtener la clave pública de Freighter. Asegúrate de que tu cuenta de Freighter tenga una dirección configurada.')
    }
    
    return {
      publicKey,
      isConnected: true,
    }
  } catch (error: any) {
    const errorMessage = error?.message?.toLowerCase() || ''
    console.error('🔍 Error completo:', error)
    
    // Si el error indica que no está instalado
    if (errorMessage.includes('not installed') || 
        errorMessage.includes('extension not detected') ||
        errorMessage.includes('no está instalada') ||
        errorMessage.includes('freighter wallet no está instalada') ||
        errorMessage.includes('freighter is not installed') ||
        errorMessage.includes('could not establish connection')) {
      throw new Error('Freighter Wallet no está instalada. Por favor, instala la extensión de Freighter desde https://freighter.app/')
    }
    
    // Si el usuario canceló
    if (errorMessage.includes('user rejected') || 
        errorMessage.includes('user cancelled') ||
        errorMessage.includes('rejected') ||
        errorMessage.includes('cancelado')) {
      throw new Error('Conexión cancelada por el usuario')
    }
    
    // Re-lanzar el error original para debugging
    throw error
  }
}

/**
 * Desconecta Freighter
 */
export async function disconnectFreighter(): Promise<void> {
  try {
    // Freighter no tiene un método de desconexión directo,
    // pero podemos limpiar el estado local
    // El usuario puede desconectar manualmente desde Freighter
  } catch (error) {
    console.error('Error desconectando Freighter:', error)
  }
}

/**
 * Obtiene la clave pública de la cuenta conectada
 */
export async function getPublicKey(): Promise<string> {
  try {
    const result = await getAddress()
    if (result.error) {
      throw new Error(result.error)
    }
    return result.address
  } catch (error: any) {
    throw new Error(error.message || 'Error al obtener la clave pública')
  }
}

/**
 * Obtiene la red actual de Freighter
 */
export async function getNetwork(): Promise<'testnet' | 'mainnet'> {
  try {
    const result = await getFreighterNetwork()
    if (result.error) {
      throw new Error(result.error)
    }
    return result.network.toLowerCase() as 'testnet' | 'mainnet'
  } catch (error: any) {
    throw new Error(error.message || 'Error al obtener la red')
  }
}

/**
 * Firma y envía una transacción usando Freighter
 */
export async function signAndSubmitTransaction(
  transactionXdr: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{
  transactionId: string
  success: boolean
}> {
  try {
    // Verificar que Freighter esté conectado
    const status = await getFreighterConnectionStatus()
    if (!status.isConnected || !status.publicKey) {
      throw new Error('Freighter no está conectado. Por favor, conecta tu wallet primero.')
    }

    // Firmar la transacción usando el paquete @stellar/freighter-api
    // signTransaction devuelve { signedTransaction: string } o { error: string }
    const signResult = await signTransaction(transactionXdr, {
      networkPassphrase: network === 'testnet' 
        ? 'Test SDF Network ; September 2015'
        : 'Public Global Stellar Network ; September 2015',
      address: status.publicKey,
    })
    
    if (signResult.error) {
      throw new Error(signResult.error)
    }
    
    const signedTransaction = signResult.signedTxXdr

    // Determinar el endpoint de Horizon según la red
    const horizonUrl = network === 'testnet' 
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org'

    // Enviar la transacción firmada a Horizon
    const response = await fetch(`${horizonUrl}/transactions`, {
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
      throw new Error(error.detail || error.extras?.result_codes?.transaction || 'Error al enviar la transacción')
    }

    const result = await response.json()
    
    return {
      transactionId: result.hash,
      success: result.successful === true,
    }
  } catch (error: any) {
    throw new Error(error.message || 'Error al procesar la transacción')
  }
}

/**
 * Verifica el saldo de una cuenta Stellar
 */
export async function getAccountBalance(
  publicKey: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{
  balance: string
  asset: string
}> {
  try {
    const horizonUrl = network === 'testnet' 
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org'

    const response = await fetch(`${horizonUrl}/accounts/${publicKey}`)
    
    if (!response.ok) {
      throw new Error('Error al obtener el saldo de la cuenta')
    }

    const account = await response.json()
    const nativeBalance = account.balances.find((b: any) => b.asset_type === 'native')
    
    return {
      balance: nativeBalance?.balance || '0',
      asset: 'XLM',
    }
  } catch (error: any) {
    throw new Error(error.message || 'Error al obtener el saldo')
  }
}

