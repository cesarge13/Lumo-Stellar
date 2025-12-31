# 💳 Implementación de Pagos Stellar con Freighter

Este documento describe la implementación del sistema de pagos Stellar usando Freighter para completar viajes en Lumo.

---

## 🔄 Flujo de Pago

1. **Conductor completa el viaje** → El sistema genera un código QR de pago Stellar
2. **Pasajero ve el QR** → Se muestra en la página de detalles del viaje
3. **Pasajero escanea con Freighter** → Abre Freighter y realiza el pago
4. **Pasajero ingresa Transaction ID** → Verifica el pago en Stellar Network
5. **Sistema verifica el pago** → Confirma la transacción y marca el viaje como COMPLETED

---

## 📋 Cambios Realizados

### Backend

#### 1. Schema de Prisma (`backend/prisma/schema.prisma`)
- ✅ Agregado campo `stellarAddress` al modelo `User`
- ✅ Agregado campos al modelo `Trip`:
  - `paymentQrCode`: Código QR del pago (base64)
  - `paymentAddress`: Dirección Stellar del conductor
  - `paymentExpiresAt`: Fecha de expiración del QR
  - `stellarTransactionId`: ID de la transacción verificada
- ✅ Agregado `STELLAR` al enum `PaymentMethod`

#### 2. Servicio Stellar (`backend/src/services/stellarService.ts`)
- ✅ `generateStellarPaymentQR()`: Genera código QR usando formato SEP-0007
- ✅ `verifyStellarTransaction()`: Verifica transacciones usando Horizon API
- ✅ `convertCLPToXLM()`: Convierte CLP a XLM (temporal, necesita API real)

#### 3. Servicio de Conductor (`backend/src/services/driverService.ts`)
- ✅ Modificado `completeTrip()` para:
  - Verificar que el conductor tenga `stellarAddress` configurada
  - Generar código QR de pago
  - Crear registro de pago pendiente
  - NO marcar como COMPLETED hasta verificar el pago
  - Enviar notificación al pasajero

#### 4. Rutas de Pago (`backend/src/routes/paymentRoutes.ts`)
- ✅ `POST /api/payments/:paymentId/verify`: Verifica un pago Stellar
- ✅ `GET /api/payments/trip/:tripId`: Obtiene información de pago de un viaje

#### 5. Index (`backend/src/index.ts`)
- ✅ Agregada ruta `/api/payments`

### Frontend

#### 1. Tipos (`frontend/src/types/index.ts`)
- ✅ Agregados campos a `Trip`:
  - `paymentQrCode`
  - `paymentAddress`
  - `paymentExpiresAt`
  - `stellarTransactionId`

#### 2. API Client (`frontend/src/services/api.ts`)
- ✅ `getTripPaymentInfo()`: Obtiene información de pago
- ✅ `verifyStellarPayment()`: Verifica un pago Stellar

#### 3. Componente de Pago (`frontend/src/components/payments/StellarPaymentQR.tsx`)
- ✅ Muestra código QR de pago
- ✅ Permite copiar dirección Stellar
- ✅ Botón para abrir Freighter
- ✅ Campo para ingresar Transaction ID
- ✅ Verificación de pago

#### 4. Trip Details (`frontend/src/pages/passenger/TripDetails.tsx`)
- ✅ Muestra componente de pago cuando:
  - El viaje tiene `completedAt`
  - Tiene `paymentQrCode`
  - El status NO es `COMPLETED`
- ✅ Carga información de pago automáticamente

---

## 🚀 Pasos para Completar la Implementación

### 1. Generar Cliente de Prisma

```bash
cd backend
npx prisma generate
```

### 2. Crear Migración

```bash
cd backend
npx prisma migrate dev --name add_stellar_payment_fields
```

### 3. Configurar Dirección Stellar del Conductor

Los conductores necesitan configurar su dirección Stellar en su perfil. Agregar campo en Settings o Profile:

```typescript
// Ejemplo en Settings.tsx
<Input
  label="Dirección Stellar"
  value={stellarAddress}
  onChange={(e) => setStellarAddress(e.target.value)}
  placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
/>
```

### 4. Instalar Freighter SDK (Opcional)

Para integración más profunda con Freighter, puedes instalar:

```bash
cd frontend
yarn add @stellar/freighter-api
```

### 5. Configurar Rate de Conversión CLP → XLM

En producción, reemplazar la función `convertCLPToXLM()` con una llamada a una API de conversión real:

```typescript
// Ejemplo usando una API de conversión
async function convertCLPToXLM(clpAmount: number): Promise<string> {
  const response = await fetch('https://api.exchange.com/convert?from=CLP&to=XLM&amount=' + clpAmount)
  const data = await response.json()
  return data.amount.toFixed(7)
}
```

---

## 📱 Uso del Sistema

### Para el Conductor

1. Completar el viaje normalmente desde TripTracking
2. El sistema genera automáticamente el QR de pago
3. El pasajero recibe una notificación para pagar

### Para el Pasajero

1. Recibe notificación cuando el viaje es completado
2. Ve el código QR en la página de detalles del viaje
3. Opción A: Escanea el QR con Freighter (móvil)
4. Opción B: Copia la dirección y paga manualmente
5. Después de pagar, ingresa el Transaction ID
6. El sistema verifica el pago y completa el viaje

---

## 🔧 Configuración Requerida

### Variables de Entorno

```env
# Backend (opcional, para Horizon personalizado)
STELLAR_HORIZON_URL=https://horizon.stellar.org
STELLAR_NETWORK=testnet  # o mainnet
```

### Perfil del Conductor

Cada conductor debe tener configurada su dirección Stellar en su perfil de usuario.

---

## 📝 Notas Importantes

1. **Conversión CLP → XLM**: Actualmente usa un rate fijo (0.1). En producción, usar una API de conversión real.

2. **Expiración del QR**: Los códigos QR expiran después de 30 minutos por defecto.

3. **Verificación de Pago**: El sistema verifica que:
   - La transacción fue exitosa
   - El destino es la dirección del conductor
   - El monto es correcto (permite 1% de diferencia por fees)

4. **Estado del Viaje**: 
   - `IN_PROGRESS` → Conductor completa → `completedAt` se establece pero status sigue `IN_PROGRESS`
   - Pago verificado → Status cambia a `COMPLETED`

5. **Freighter**: El componente intenta abrir Freighter, pero también permite verificación manual con Transaction ID.

---

## 🐛 Solución de Problemas

### Error: "El conductor no tiene una dirección Stellar configurada"
- **Solución**: El conductor debe configurar su dirección Stellar en su perfil

### Error: "No se pudo verificar la transacción"
- **Causa**: Transaction ID inválido o transacción no encontrada
- **Solución**: Verificar que el Transaction ID sea correcto y que la transacción esté confirmada en Stellar

### El QR no se muestra
- **Causa**: El viaje no tiene `completedAt` o `paymentQrCode`
- **Solución**: Verificar que el conductor haya completado el viaje correctamente

---

## 📚 Referencias

- [Stellar Protocol](https://www.stellar.org/)
- [Freighter Wallet](https://freighter.app/)
- [SEP-0007: URI Scheme](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0007.md)
- [Horizon API](https://developers.stellar.org/api)

---

**Última actualización:** 2025-12-29

