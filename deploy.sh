#!/usr/bin/env bash
set -euo pipefail
umask 077
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
exec 9>.samada-deploy.lock
flock -n 9 || { echo "Ya hay un despliegue en curso."; exit 1; }
command -v docker >/dev/null || { echo "Instala Docker Engine y Compose en el servidor antes de desplegar."; exit 1; }
command -v curl >/dev/null || { echo "Instala curl en el servidor."; exit 1; }
docker compose version >/dev/null
test -f .env || { echo "Falta .env de producción. Consulta docs/DESPLIEGUE-CONTINUO.md."; exit 1; }
chmod 600 .env
compose=(docker compose --project-name samada)
"${compose[@]}" config --quiet
echo "[1/6] Construyendo aplicación y procesador; se mantiene la versión actual durante la compilación..."
"${compose[@]}" build app worker
"${compose[@]}" run --rm --no-deps migrate node scripts/validate-production.mjs
echo "[2/6] Preparando almacenamiento privado..."
mkdir -p data/backups data/media
if [ "$(id -u)" = 0 ]; then
  chown -R 1001:1001 "$PWD/data"
  chmod 700 data data/backups data/media
else
  test "$(stat -c %u data)" = 1001 || { echo "data debe pertenecer a UID 1001 (usuario de los contenedores)."; exit 1; }
fi
echo "[3/6] Verificando PostgreSQL y creando respaldo previo..."
"${compose[@]}" up -d --wait --wait-timeout 120 db
backup="data/backups/pre-deploy-$(date -u +%Y%m%dT%H%M%SZ).dump"
"${compose[@]}" exec -T db pg_dump -U samada -d samada -Fc > "$backup"
test -s "$backup"
"${compose[@]}" exec -T db pg_restore --list < "$backup" > /dev/null
if [ "$(id -u)" = 0 ]; then chown 1001:1001 "$backup"; fi
echo "[4/6] Aplicando migración transaccional..."
"${compose[@]}" run --rm --no-deps migrate
echo "[5/6] Activando versión y verificando aplicación y trabajador..."
export APP_REVISION
APP_REVISION=$(git rev-parse HEAD)
"${compose[@]}" up -d --no-deps --wait --wait-timeout 120 app worker
app_id=$("${compose[@]}" ps -q app)
test -n "$app_id"
network="${CADDY_NETWORK:-}"
if [ -z "$network" ] && docker inspect grenco-caddy-1 >/dev/null 2>&1; then
  network=$(docker inspect grenco-caddy-1 --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}' | head -n 1)
fi
if [ -n "$network" ]; then
  docker network inspect "$network" >/dev/null
  connected=$(docker inspect "$app_id" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{println $name}}{{end}}')
  if ! printf '%s\n' "$connected" | grep -Fxq -- "$network"; then
    docker network connect --alias samada_app "$network" "$app_id"
  fi
  echo "Aplicación conectada a la red de Caddy con alias samada_app."
fi
echo "[6/6] Comprobando respuesta HTTP..."
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 2 http://127.0.0.1:3001/api/health > /dev/null
if [ -n "${PUBLIC_HEALTH_URL:-}" ]; then
  "${compose[@]}" exec -T -e "PUBLIC_HEALTH_URL=$PUBLIC_HEALTH_URL" -e "EXPECTED_REVISION=$APP_REVISION" app node -e 'fetch(process.env.PUBLIC_HEALTH_URL,{signal:AbortSignal.timeout(15000)}).then(async r=>{const body=await r.json();if(!r.ok||body.status!=="ok"||body.revision!==process.env.EXPECTED_REVISION)process.exit(1);}).catch(()=>process.exit(1))'
fi
"${compose[@]}" ps
echo "Despliegue completado: $APP_REVISION"
echo "Respaldo previo: $backup"
