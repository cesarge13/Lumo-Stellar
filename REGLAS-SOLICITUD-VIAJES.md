# 📋 Reglas de Solicitud de Viajes - Lumo

Este documento contiene todas las reglas, validaciones y restricciones para solicitar un viaje en el sistema Lumo.

---

## 🔐 **Reglas de Autenticación y Autorización**

### Usuario Requerido
- ✅ El usuario **DEBE** estar autenticado
- ✅ El usuario **DEBE** tener rol `PASSENGER` o `ADMIN`
- ❌ Los usuarios con otros roles (DRIVER, HOST, etc.) **NO PUEDEN** crear viajes

**Ubicación:** `backend/src/routes/tripRoutes.ts` (líneas 20-39)

---

## 📍 **Reglas de Ubicación (Origen y Destino)**

### Campos Requeridos
- ✅ **Origen (`originAddress`)**: REQUERIDO
- ✅ **Destino (`destinationAddress`)**: REQUERIDO
- ✅ **Coordenadas de origen**: REQUERIDAS
  - `originLatitude`: número válido
  - `originLongitude`: número válido
- ✅ **Coordenadas de destino**: REQUERIDAS
  - `destinationLatitude`: número válido
  - `destinationLongitude`: número válido

### Validaciones
- ❌ No se puede crear un viaje sin origen
- ❌ No se puede crear un viaje sin destino
- ❌ Las coordenadas deben ser números válidos (no strings, no null, no undefined)

**Ubicación:** 
- Frontend: `frontend/src/pages/passenger/RequestTrip.tsx` (líneas 267-270)
- Backend: `backend/src/routes/tripRoutes.ts` (líneas 69-86)

---

## 🗺️ **Reglas de Ruta**

### Información Requerida
- ✅ **Distancia (`distance`)**: REQUERIDA (número)
- ✅ **Duración (`duration`)**: REQUERIDA (número, en segundos)
- ✅ **Texto de distancia (`distanceText`)**: REQUERIDO (ej: "15.2 km")
- ✅ **Texto de duración (`durationText`)**: REQUERIDO (ej: "25 min")
- ✅ **Información de ruta (`routeInfo`)**: REQUERIDA antes de enviar

### Validaciones Frontend
- ❌ No se puede enviar el formulario sin calcular la ruta primero
- ✅ La ruta se calcula automáticamente al seleccionar origen y destino

**Ubicación:** 
- Frontend: `frontend/src/pages/passenger/RequestTrip.tsx` (líneas 272-275)
- Backend: `backend/src/routes/tripRoutes.ts` (líneas 88-93)

---

## 👥 **Reglas de Pasajeros**

### Restricciones
- ✅ **Mínimo**: 1 pasajero
- ✅ **Máximo**: 7 pasajeros
- ✅ **Valor por defecto**: 1 pasajero

### Validaciones
- Si se envía un valor menor a 1, se ajusta automáticamente a 1
- Si se envía un valor mayor a 7, se ajusta automáticamente a 7
- El campo acepta valores entre 1 y 7 (inclusive)

**Ubicación:**
- Frontend: `frontend/src/pages/passenger/RequestTrip.tsx` (líneas 346, 592)
- Backend: `backend/src/routes/tripRoutes.ts` (línea 96)
- Schema: `backend/prisma/schema.prisma` (línea 321: `@default(1)`)

---

## 🚗 **Reglas de Tipo de Vehículo**

### Opciones Disponibles
- ✅ **Cualquier vehículo (`ANY`)**: Opción por defecto
- ✅ **Sedan (`SEDAN`)**: Con 35% de descuento
- ✅ **Camioneta de Lujo (`LUXURY`)**: Para 7 pasajeros
- ✅ **SUV (`SUV`)**
- ✅ **Van (`VAN`)**

### Validaciones
- ✅ El tipo de vehículo es **OPCIONAL**
- ✅ Si no se especifica, se usa `ANY`
- ✅ El descuento del Sedan se aplica automáticamente al precio por kilómetro

**Ubicación:**
- Frontend: `frontend/src/pages/passenger/RequestTrip.tsx` (líneas 348, 498-532)
- Schema: `backend/prisma/schema.prisma` (línea 324: `VehicleType?`)

---

## 💰 **Reglas de Precio**

### Campos Requeridos
- ✅ **Precio total (`totalPrice`)**: REQUERIDO
- ✅ **Precio base (`basePrice`)**: Opcional (default: 0)
- ✅ **Precio por distancia (`distancePrice`)**: Opcional (default: 0)
- ✅ **Precio por tiempo (`timePrice`)**: Opcional (default: 0)
- ✅ **Moneda (`currency`)**: Opcional (default: "CLP")

### Cálculo de Precios
- ✅ Los precios se calculan automáticamente usando el servicio de pricing del backend
- ✅ El cálculo considera:
  - Distancia del viaje
  - País del viaje (prioridad: origen > destino > usuario)
  - Tipo de vehículo preferido (si aplica descuento)

### Viajes de Ida y Vuelta
- ✅ Si `isRoundTrip = true`, todos los precios se **DUPLICAN**:
  - `basePrice * 2`
  - `distancePrice * 2`
  - `timePrice * 2`
  - `totalPrice * 2`

**Ubicación:**
- Frontend: `frontend/src/pages/passenger/RequestTrip.tsx` (líneas 290-303)
- Backend: `backend/src/routes/tripRoutes.ts` (líneas 88-93, 124-128)

---

## 📅 **Reglas de Fechas y Horarios**

### Fecha Programada (`scheduledAt`)
- ✅ **OPCIONAL**: El viaje puede ser inmediato o programado
- ✅ Si se proporciona, debe ser una fecha/hora válida
- ✅ **SIN RESTRICCIONES**: Se puede seleccionar cualquier fecha/hora (pasada, presente o futura)
- ✅ Formato: ISO 8601 string (ej: "2025-12-29T14:10:00")

### Fecha de Vuelta (`returnScheduledAt`)
- ✅ **REQUERIDA** si `isRoundTrip = true`
- ✅ **OPCIONAL** si `isRoundTrip = false`
- ✅ Debe ser posterior a la fecha de ida (validación lógica)
- ✅ Formato: ISO 8601 string

### Validaciones
- ❌ Si es viaje de ida y vuelta (`isRoundTrip = true`) y no se proporciona `returnScheduledAt`, se rechaza la solicitud
- ✅ Las fechas se validan antes de enviar al backend
- ✅ Si una fecha es inválida, se registra un warning pero no se envía

**Ubicación:**
- Frontend: `frontend/src/pages/passenger/RequestTrip.tsx` (líneas 280-285, 305-333)
- Backend: `backend/src/routes/tripRoutes.ts` (líneas 99-104, 117, 119)
- Schema: `backend/prisma/schema.prisma` (líneas 323, 332)

---

## 🔄 **Reglas de Ida y Vuelta**

### Validaciones
- ✅ Si `isRoundTrip = true`:
  - ✅ `returnScheduledAt` es **REQUERIDO**
  - ✅ Los precios se duplican automáticamente
- ✅ Si `isRoundTrip = false`:
  - ✅ `returnScheduledAt` se ignora (si se proporciona)
  - ✅ Los precios se calculan para un solo trayecto

**Ubicación:**
- Frontend: `frontend/src/pages/passenger/RequestTrip.tsx` (líneas 280-285, 298-302)
- Backend: `backend/src/routes/tripRoutes.ts` (líneas 99-104)

---

## 🌍 **Reglas de País**

### Determinación del País
El país del viaje se determina con la siguiente prioridad:
1. **País del origen** (`origin.country`)
2. **País del destino** (`destination.country`) - si origen no tiene país
3. **País del usuario** (`user.country`) - si origen y destino no tienen país
4. **Chile (CL)** - valor por defecto

### Uso del País
- ✅ Se usa para calcular precios según la tabla de precios del país
- ✅ Se usa para determinar la moneda del viaje

**Ubicación:**
- Frontend: `frontend/src/pages/passenger/RequestTrip.tsx` (línea 288)
- Backend: Servicios de pricing

---

## 📊 **Reglas de Estado del Viaje**

### Estado Inicial
- ✅ Todos los viajes se crean con estado `PENDING`
- ✅ El estado se actualiza automáticamente según el flujo:
  - `PENDING` → `ACCEPTED` → `IN_PROGRESS` → `COMPLETED`
  - O `PENDING` → `CANCELLED` / `REJECTED`

**Ubicación:**
- Backend: `backend/src/services/tripService.ts` (línea 551)
- Schema: `backend/prisma/schema.prisma` (línea 342)

---

## 🔢 **Reglas de Número de Viaje**

### Generación
- ✅ Cada viaje recibe un número único (`tripNumber`)
- ✅ El número se genera automáticamente
- ✅ Debe ser único en la base de datos

**Ubicación:**
- Backend: `backend/src/services/tripService.ts` (línea 484)

---

## 📝 **Campos Opcionales**

Los siguientes campos son **OPCIONALES** y no bloquean la creación del viaje:

- ✅ `originPlaceId`: ID del lugar de Google Maps (origen)
- ✅ `destinationPlaceId`: ID del lugar de Google Maps (destino)
- ✅ `scheduledAt`: Fecha/hora programada (si no se proporciona, es viaje inmediato)
- ✅ `returnScheduledAt`: Fecha/hora de vuelta (solo si es ida y vuelta)
- ✅ `preferredVehicleType`: Tipo de vehículo preferido
- ✅ `routePolyline`: Polilínea de la ruta (para mostrar en mapa)
- ✅ `routeBounds`: Límites geográficos de la ruta
- ✅ `notes`: Notas adicionales del pasajero

---

## ⚠️ **Errores Comunes y Soluciones**

### Error: "Debes seleccionar origen y destino"
- **Causa**: No se han seleccionado ambos lugares
- **Solución**: Seleccionar origen y destino desde el autocompletado de Google Maps

### Error: "Debes calcular la ruta primero"
- **Causa**: La ruta no se ha calculado automáticamente
- **Solución**: Esperar a que se calcule la ruta (debe aparecer el mapa y la información de distancia/duración)

### Error: "La fecha de vuelta es requerida para viajes de ida y vuelta"
- **Causa**: Se marcó "Ida y vuelta" pero no se proporcionó fecha de vuelta
- **Solución**: Proporcionar fecha y hora de vuelta o desmarcar "Ida y vuelta"

### Error: "Solo los pasajeros pueden crear viajes"
- **Causa**: El usuario no tiene rol PASSENGER o ADMIN
- **Solución**: Usar una cuenta con rol de pasajero

### Error: "Coordenadas inválidas"
- **Causa**: Las coordenadas no son números válidos
- **Solución**: Seleccionar lugares válidos desde Google Maps

### Error: "Distancia, duración y precio son requeridos"
- **Causa**: Falta información de la ruta
- **Solución**: Asegurarse de que la ruta se haya calculado correctamente

---

## 📍 **Ubicaciones de Código**

### Frontend
- **Componente principal**: `frontend/src/pages/passenger/RequestTrip.tsx`
- **Validaciones frontend**: Líneas 264-285, 305-333
- **Botón de envío**: Líneas 667-680

### Backend
- **Rutas**: `backend/src/routes/tripRoutes.ts`
- **Validaciones backend**: Líneas 18-104
- **Servicio**: `backend/src/services/tripService.ts`
- **Función createTrip**: Líneas 479-623

### Base de Datos
- **Schema**: `backend/prisma/schema.prisma`
- **Modelo Trip**: Líneas 301-369

---

## 🔄 **Flujo de Solicitud de Viaje**

1. ✅ Usuario autenticado con rol PASSENGER o ADMIN
2. ✅ Selecciona origen (requerido)
3. ✅ Selecciona destino (requerido)
4. ✅ Sistema calcula ruta automáticamente
5. ✅ Opcional: Selecciona tipo de vehículo
6. ✅ Opcional: Ajusta número de pasajeros (1-7)
7. ✅ Opcional: Marca "Ida y vuelta" y proporciona fecha de vuelta
8. ✅ Opcional: Programa fecha/hora de ida
9. ✅ Sistema calcula precios automáticamente
10. ✅ Usuario hace clic en "Solicitar Viaje"
11. ✅ Sistema valida todos los campos
12. ✅ Sistema crea el viaje con estado PENDING
13. ✅ Sistema envía alertas a conductores disponibles

---

**Última actualización:** 2025-12-29

