#!/bin/bash

# Script para iniciar PostgreSQL en desarrollo

set -e

echo "🐳 Iniciando PostgreSQL para desarrollo..."

cd "$(dirname "$0")/../docker"

# Verificar si Docker está corriendo
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker no está corriendo. Por favor:"
    echo "   1. Abre Docker Desktop"
    echo "   2. Espera a que inicie completamente"
    echo "   3. Ejecuta este script nuevamente"
    exit 1
fi

# Iniciar PostgreSQL
echo "📦 Levantando contenedor PostgreSQL..."
docker-compose -f docker-compose.dev.yml up -d

# Esperar a que PostgreSQL esté listo
echo "⏳ Esperando a que PostgreSQL esté listo..."
sleep 5

# Verificar que está corriendo
if docker ps | grep -q lumo-postgres-dev; then
    echo "✅ PostgreSQL está corriendo!"
    echo ""
    echo "📋 Información de conexión:"
    echo "   Host: localhost"
    echo "   Puerto: 5432"
    echo "   Usuario: lumo"
    echo "   Contraseña: changeme"
    echo "   Base de datos: lumo"
    echo ""
    echo "🔧 Próximos pasos:"
    echo "   1. cd backend"
    echo "   2. yarn prisma:generate"
    echo "   3. yarn prisma:migrate dev"
else
    echo "❌ Error al iniciar PostgreSQL"
    exit 1
fi

