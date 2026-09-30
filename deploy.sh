#!/bin/bash
set -e

echo "=========================================="
echo "   SAMADA COMMERCE - DESPLIEGUE EN VPS   "
echo "=========================================="

# 1. Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "[!] Docker no está instalado. Instalando Docker y Docker Compose..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
    echo "[✓] Docker instalado exitosamente."
fi

# 2. Crear directorio de datos persistentes
echo "[1/4] Preparando almacenamiento persistente para el CMS..."
mkdir -p ./data
chmod 777 ./data

# 3. Construir y levantar contenedores
echo "[2/4] Construyendo imagen y levantando servicios con Docker Compose..."
docker compose down || true
docker compose up -d --build --remove-orphans

# 4. Limpieza de imágenes antiguas para optimizar disco en Contabo
echo "[3/4] Limpiando capas obsoletas de Docker..."
docker image prune -f

# Conectar automáticamente a la red de Caddy si existe
CADDY_NET=$(docker inspect grenco-caddy-1 --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null || true)
if [ -n "$CADDY_NET" ]; then
    docker network connect "$CADDY_NET" samada_app 2>/dev/null || true
fi

# 5. Estado final
echo "[4/4] Verificando estado de los contenedores..."
sleep 3
docker compose ps

echo "=========================================="
echo " [✓] ¡DESPLIEGUE COMPLETADO CON ÉXITO!"
echo ""
echo " Dominios configurados:"
echo " • Catálogo:   https://samadaperu.com"
echo " • Dashboard:  https://gestion.samadaperu.com"
echo "=========================================="
