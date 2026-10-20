# GitHub Actions → Contabo

Repositorio: https://github.com/mavrictech-dev/samada-prototipo-2

Los cambios en `main` y la ejecución manual lanzan validación; los pull requests también se validan. La validación instala Node 24, comprueba lint/TypeScript, prepara PostgreSQL y Mailpit efímeros, ejecuta las diez pruebas integrales (incluidos 1.500 SKU) y construye la imagen Linux. No usa la base ni el correo de producción.

Con validación correcta, acceso SSH y el secreto SMTP_PASSWORD de Resend configurados, se despliega exactamente el commit probado. Las ejecuciones de producción se serializan y no se cancelan durante una migración. Si faltan credenciales, la validación puede pasar y el despliegue se omite con una explicación en el resumen de Actions. Eso no significa que se haya publicado la aplicación.

## 1. Configuración del repositorio

En **Settings → Secrets and variables → Actions → Secrets**, crear uno de estos secretos:

- `SSH_PASSWORD`: contraseña SSH del usuario de despliegue; mantiene compatibilidad con la instalación anterior.
- `SSH_PRIVATE_KEY`: clave privada del usuario de despliegue; alternativa a contraseña.

Si la clave lleva contraseña, añadir `SSH_PASSPHRASE`. Para comprobar la identidad del servidor, añadir `SSH_FINGERPRINT` con la huella SHA256 de su clave de host, obtenida por un canal de confianza. Ninguna contraseña ni clave va en archivos del repositorio.

Variables opcionales en **Variables**:

| Variable | Valor por defecto | Uso |
|---|---|---|
| SSH_HOST | 37.60.234.60 | VPS existente |
| SSH_USER | root | Usuario existente; necesita Docker y propiedad de datos |
| SSH_PORT | 22 | Puerto SSH |
| CADDY_NETWORK | detección de grenco-caddy-1 | Red Docker del proxy compartido |
| PUBLIC_HEALTH_URL | vacío | Recomendado: https://samadaperu.com/api/health |

Sin `PUBLIC_HEALTH_URL`, la comprobación HTTP verifica localhost:3001 y la salud de contenedores, no el dominio público. Con la variable configurada, también se exige que el dominio devuelva la revisión desplegada.

## 2. Preparación única del VPS

Instalar Git, Docker Engine con Compose, curl y flock. El directorio de trabajo es `/var/www/samada`. Si ya existe, conservar `data/`, `.env` y los volúmenes. No volver a clonar encima ni borrar el directorio existente.

En una instalación vacía:

```bash
git clone https://github.com/mavrictech-dev/samada-prototipo-2.git /var/www/samada
cd /var/www/samada
cp docs/production.env.example .env
chmod 600 .env
```

Editar `.env` directamente en el servidor con valores reales. Generar contraseñas y secretos con `openssl rand -hex 32`. Usar contraseñas de PostgreSQL URL-seguras de al menos 24 caracteres. El archivo de ejemplo no es una configuración ejecutable. Nunca copiar el acceso, la base ni el SMTP local de desarrollo.

Si falta el archivo, el despliegue crea un `.env` privado con claves aleatorias de PostgreSQL y sesión. Tras la autorización del responsable se configuró Resend: el secreto `SMTP_PASSWORD` del repositorio se aplica al correo del archivo generado por Samada. Las claves de base/sesión se conservan. Un `.env` ajeno a este generador se conserva íntegramente y requiere configuración manual. Si falta el correo, la validación se detiene antes de compilar o migrar. Consultar [configuración de correo](CONFIGURAR-CORREO-SAMADA.md).

- `BETTER_AUTH_URL=https://gestion.samadaperu.com`.
- `TRUSTED_ORIGINS` debe incluir los orígenes HTTPS permitidos, sin rutas.
- Configurar SMTP accesible desde Docker y un remitente real verificado.
- Compose establece la conexión interna PostgreSQL; mantener estable `POSTGRES_PASSWORD` tras crear el volumen. Cambiar el archivo no rota una contraseña existente en PostgreSQL.
- Almacenamiento persistente en `data/media`, o las variables S3 del README.

Si el repositorio ya está clonado, `origin` debe ser exactamente el enlace indicado arriba. Un checkout con archivos versionados modificados puede impedir el cambio de versión; resolverlo conservando los cambios antes de reintentar. El workflow no hace `git reset --hard`.

## 3. Proxy, datos y primer administrador

Caddy en el host puede apuntar a `127.0.0.1:3001`. Caddy en Docker debe compartir una red con la aplicación y apuntar a `samada_app:3000`. `deploy.sh` obtiene el identificador actual con Compose y conecta el alias a `CADDY_NETWORK`, o detecta la primera red de `grenco-caddy-1`. Revisar la red cuando ese proxy tenga varias. El Caddyfile del proyecto usa el mismo alias.

El script construye imágenes antes de sustituir la aplicación, valida el entorno, prepara permisos UID 1001, espera PostgreSQL, respalda la base, aplica migraciones y comprueba salud de aplicación y worker. No ejecuta `docker compose down` ni elimina volúmenes. El cambio final puede tener una breve interrupción; no es un despliegue azul/verde.

La primera migración importa `data/cms-state.json` si existe; de otro modo usa el catálogo de muestra. Los datos de la base local no se suben por Git. La cuenta administrativa local tampoco se transfiere. El secreto privado `ADMIN_EMAIL` identifica al primer administrador: después de migrar se crea esa cuenta y se solicita un enlace de recuperación por correo. Si ya existe un superadministrador activo, no se alteran cuentas ni se reenvían invitaciones. Una cuenta previa sin rol no se eleva automáticamente. Como alternativa de instalación manual, una persona autorizada puede crear la cuenta real:

```bash
cd /var/www/samada
docker compose --project-name samada run --rm --no-deps migrate npm run admin:create -- --email administrador@tu-dominio.com
```

La contraseña temporal queda en `data/ACCESO-LOCAL.txt` del servidor. Cambiarla desde Mi cuenta y custodiar ese archivo. El comando no altera una cuenta existente.

## 4. Ejecutar y comprobar

Después de preparar servidor y secretos, hacer push a `main`, o ir a **Actions → Samada CI y despliegue continuo → Run workflow → main**. Guardar un secreto no inicia por sí solo una ejecución.

Comprobar que **validate**, **configuration** y **deploy** terminaron correctamente; `deploy` omitido indica que falta el acceso SSH. Comprobar login, plantilla y una importación de muestra en el servidor. El worker tiene heartbeat con comprobación de base; la aplicación publica `/api/health` sin datos privados.

Para diagnóstico:

```bash
docker compose --project-name samada ps
docker compose --project-name samada logs --tail=80 app worker
curl --fail http://127.0.0.1:3001/api/health
```

## 5. Respaldos y recuperación

Cada despliegue deja un `data/backups/pre-deploy-*.dump` con formato PostgreSQL custom y verifica que su índice sea legible. Eso no sustituye una restauración ensayada. Respaldar además archivos/imágenes y configuración privada fuera del servidor. No se elimina automáticamente ningún respaldo.

Si falla la compilación o prevalidación, no se reemplaza la versión actual. Si falla una migración, revisar su transacción antes de continuar. Un fallo posterior a una migración no ejecuta una reversión automática del esquema. Para volver a un commit compatible, seleccionar ese commit en el servidor y ejecutar `bash deploy.sh`; coordinar una restauración aparte si el esquema anterior no es compatible.

Referencias: [GitHub Actions y secretos](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [orden de arranque en Docker Compose](https://docs.docker.com/compose/how-tos/startup-order).
