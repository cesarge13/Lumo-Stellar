# Lumo-Stellar

**LUMO usa Stellar para pagos rápidos, seguros y globales, eliminando intermediarios y ofreciendo una experiencia moderna para pasajeros y conductores.**

---

# Lumo - Aplicación de Producción

Este es el proyecto de producción para LUMO, una plataforma de transporte con pagos Stellar.

## 🏗️ Estructura del Proyecto

```
lumo/
├── backend/          # API Backend
├── frontend/         # Aplicación Frontend
├── docker/           # Configuración Docker
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── nginx/        # Configuración Nginx
└── .env             # Variables de entorno (crear desde .env.example)
```

## 🚀 Inicio Rápido

### 1. Configurar Variables de Entorno

```bash
cp .env.example .env
# Editar .env con tus valores reales
```

### 2. Construir y Ejecutar con Docker

```bash
# Construir y levantar servicios
yarn docker:up

# Ver logs
yarn docker:logs

# Detener servicios
yarn docker:down
```

### 3. Inicializar Base de Datos

```bash
# Generar cliente Prisma
cd backend
yarn prisma:generate

# Ejecutar migraciones
yarn prisma:migrate deploy

# (Opcional) Poblar con datos iniciales
yarn prisma:seed
```

## 🔧 Configuración

### Bases de Datos Separadas

Este proyecto usa bases de datos completamente separadas del proyecto operations:

- **PostgreSQL**: Base de datos `lumo` (usuario: `lumo`)
- **MinIO**: Bucket `lumo-documents` (usuario: `lumoadmin`)

### Dominio

- **Producción**: Configurar en variables de entorno
- **API**: Configurar en variables de entorno (`VITE_API_URL`)

### SSL/HTTPS

Para configurar SSL con Let's Encrypt:

```bash
cd docker
# Ejecutar script de inicialización de SSL
./init-letsencrypt.sh
```

## 📝 Scripts Disponibles

```bash
# Desarrollo
yarn dev:backend      # Ejecutar backend en modo desarrollo
yarn dev:frontend     # Ejecutar frontend en modo desarrollo

# Construcción
yarn build:backend    # Construir backend
yarn build:frontend   # Construir frontend

# Docker
yarn docker:up        # Levantar servicios
yarn docker:down      # Detener servicios
yarn docker:logs      # Ver logs
```

## 🔐 Seguridad

**IMPORTANTE**: Antes de desplegar a producción:

1. Cambiar todas las contraseñas en `.env`
2. Generar un `JWT_SECRET` seguro y único
3. Configurar SSL/HTTPS con Let's Encrypt
4. Revisar configuraciones de CORS
5. Configurar backups de base de datos

## 📚 Documentación Adicional

- Ver documentación en `backend/README.md` para más detalles del backend
- Ver documentación en `frontend/README.md` para más detalles del frontend

## 🔄 Características

Este proyecto está configurado para producción con:

- Bases de datos separadas (PostgreSQL y MinIO)
- Integración con Stellar para pagos
- Configuración de producción optimizada
- Arquitectura escalable con Docker
















