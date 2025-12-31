/**
 * Servicio para integración con Stellar Network
 * Maneja generación de códigos QR de pago y verificación de transacciones
 */

import QRCode from 'qrcode'
import * as StellarSdk from '@stellar/stellar-sdk'

export interface StellarPaymentData {
  destination: string // Dirección Stellar del conductor
  amount: string // Monto en XLM o asset
  memo?: string // Memo del viaje
  asset?: string // Asset code (default: XLM)
  assetIssuer?: string // Asset issuer (si no es XLM)
  sourceAccount?: string // Cuenta fuente (opcional, para construir transacción completa)
  networkPassphrase?: string // Network passphrase (default: Testnet)
}

export interface StellarQRData {
  qrCode: string // Base64 del QR code
  paymentUrl: string // URL para Freighter
  paymentAddress: string // Dirección Stellar
  expiresAt: Date // Fecha de expiración
  transactionXdr?: string // Transacción XDR para Freighter (opcional)
}

/**
 * Construye una transacción Stellar para pago
 * Usa el SDK de Stellar para construir la transacción correctamente
 */
export async function buildStellarTransaction(
  paymentData: StellarPaymentData,
  sourcePublicKey?: string
): Promise<{
  transactionXdr: string
  networkPassphrase: string
}> {
  const networkPassphrase = paymentData.networkPassphrase || StellarSdk.Networks.TESTNET
  const server = new StellarSdk.Server(
    networkPassphrase === StellarSdk.Networks.TESTNET
      ? 'https://horizon-testnet.stellar.org'
      : 'https://horizon.stellar.org'
  )

  // Si no hay cuenta fuente, crear una transacción sin cuenta fuente
  // (Freighter la completará con la cuenta del usuario)
  let transaction: StellarSdk.Transaction

  if (sourcePublicKey) {
    try {
      // Cargar la cuenta fuente
      const sourceAccount = await server.loadAccount(sourcePublicKey)
      
      // Construir la transacción con cuenta fuente
      const asset = paymentData.asset === 'XLM' || !paymentData.asset
        ? StellarSdk.Asset.native()
        : new StellarSdk.Asset(paymentData.asset, paymentData.assetIssuer || '')

      const transactionBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase,
      })

      // Agregar operación de pago
      transactionBuilder.addOperation(
        StellarSdk.Operation.payment({
          destination: paymentData.destination,
          asset,
          amount: paymentData.amount,
        })
      )

      // Agregar memo si existe
      if (paymentData.memo) {
        transactionBuilder.addMemo(StellarSdk.Memo.text(paymentData.memo))
      }

      transaction = transactionBuilder.setTimeout(1800).build()
    } catch (error) {
      // Si falla cargar la cuenta, crear transacción sin cuenta fuente
      console.warn('No se pudo cargar cuenta fuente, creando transacción sin cuenta:', error)
      transaction = buildTransactionWithoutSource(paymentData, networkPassphrase)
    }
  } else {
    // Crear transacción sin cuenta fuente (Freighter la completará)
    transaction = buildTransactionWithoutSource(paymentData, networkPassphrase)
  }

  // Convertir a XDR
  const transactionXdr = transaction.toXDR()

  return {
    transactionXdr,
    networkPassphrase,
  }
}

/**
 * Construye una transacción sin cuenta fuente (para que Freighter la complete)
 */
function buildTransactionWithoutSource(
  paymentData: StellarPaymentData,
  networkPassphrase: string
): StellarSdk.Transaction {
  // Crear una cuenta temporal para construir la transacción
  const tempKeypair = StellarSdk.Keypair.random()
  const tempAccount = new StellarSdk.Account(tempKeypair.publicKey(), '0')

  const asset = paymentData.asset === 'XLM' || !paymentData.asset
    ? StellarSdk.Asset.native()
    : new StellarSdk.Asset(paymentData.asset, paymentData.assetIssuer || '')

  const transactionBuilder = new StellarSdk.TransactionBuilder(tempAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })

  // Agregar operación de pago
  transactionBuilder.addOperation(
    StellarSdk.Operation.payment({
      destination: paymentData.destination,
      asset,
      amount: paymentData.amount,
    })
  )

  // Agregar memo si existe
  if (paymentData.memo) {
    transactionBuilder.addMemo(StellarSdk.Memo.text(paymentData.memo))
  }

  return transactionBuilder.setTimeout(1800).build()
}

/**
 * Genera un código QR para pago Stellar usando formato SEP-0007
 * Ahora también construye la transacción XDR para Freighter
 * https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md
 */
export async function generateStellarPaymentQR(
  paymentData: StellarPaymentData,
  expiresInMinutes: number = 30
): Promise<StellarQRData> {
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes)

  // Construir transacción Stellar usando el SDK
  let transactionXdr: string | undefined
  try {
    const { transactionXdr: xdr } = await buildStellarTransaction(paymentData)
    transactionXdr = xdr
  } catch (error) {
    console.error('Error construyendo transacción Stellar:', error)
    // Continuar sin XDR si falla
  }

  // Construir URL de pago Stellar (SEP-0007)
  const params = new URLSearchParams({
    destination: paymentData.destination,
    amount: paymentData.amount,
  })

  if (paymentData.memo) {
    params.append('memo', paymentData.memo)
  }

  if (paymentData.asset && paymentData.asset !== 'XLM') {
    params.append('asset_code', paymentData.asset)
    if (paymentData.assetIssuer) {
      params.append('asset_issuer', paymentData.assetIssuer)
    }
  }

  // Si tenemos XDR, agregarlo a la URL para Freighter
  if (transactionXdr) {
    params.append('xdr', transactionXdr)
  }

  const paymentUrl = `web+stellar:pay?${params.toString()}`

  // Generar QR code
  const qrCode = await QRCode.toDataURL(paymentUrl, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 300,
    margin: 2,
  })

  return {
    qrCode,
    paymentUrl,
    paymentAddress: paymentData.destination,
    expiresAt,
    transactionXdr,
  }
}

/**
 * Verifica una transacción Stellar usando Horizon API
 */
export async function verifyStellarTransaction(
  transactionId: string,
  expectedDestination: string,
  expectedAmount: string,
  horizonUrl: string = 'https://horizon.stellar.org'
): Promise<{
  verified: boolean
  transaction?: any
  error?: string
}> {
  try {
    const response = await fetch(`${horizonUrl}/transactions/${transactionId}`)
    
    if (!response.ok) {
      return {
        verified: false,
        error: `Error al verificar transacción: ${response.statusText}`,
      }
    }

    const transaction: any = await response.json()

    // Verificar que la transacción fue exitosa
    if (transaction.successful !== true) {
      return {
        verified: false,
        error: 'La transacción no fue exitosa',
      }
    }

    // Verificar el destino y monto en las operaciones
    const operations: any[] = transaction.operations || []
    const paymentOperation = operations.find(
      (op: any) =>
        op.type === 'payment' &&
        op.to === expectedDestination &&
        parseFloat(op.amount) >= parseFloat(expectedAmount) * 0.99 // Permitir 1% de diferencia por fees
    )

    if (!paymentOperation) {
      return {
        verified: false,
        error: 'No se encontró una operación de pago que coincida',
      }
    }

    return {
      verified: true,
      transaction,
    }
  } catch (error: any) {
    return {
      verified: false,
      error: error.message || 'Error al verificar la transacción',
    }
  }
}

/**
 * Convierte un monto en CLP a XLM (Stellar Lumens)
 * Nota: Esto debería usar una API de conversión de divisas en producción
 */
export function convertCLPToXLM(clpAmount: number, xlmRate: number = 0.1): string {
  // En producción, obtener el rate desde una API de conversión
  const xlmAmount = clpAmount * xlmRate
  return xlmAmount.toFixed(7) // XLM tiene 7 decimales
}

