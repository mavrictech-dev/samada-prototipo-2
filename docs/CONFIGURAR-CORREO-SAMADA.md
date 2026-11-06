# Estado actual: publicación sin correo

El responsable autorizó publicar con `MAIL_TRANSPORT=disabled`. El login y las cuentas se almacenan en PostgreSQL del VPS. Registro público, recuperación y verificación por correo quedan bloqueados; las rutas responden 503 y la interfaz explica la indisponibilidad. El CMS permite crear cuentas con contraseña inicial y conserva los permisos y roles.

No se necesita entrar a GoDaddy para publicar la web. Para emitir correo propio con un remitente de Samada sí se necesita al responsable del DNS: SPF, DKIM y DMARC; el PTR se configura en Contabo. El diagnóstico del VPS confirmó salida TCP/25 a Gmail y Outlook, ausencia de los nuevos registros y PTR todavía de Contabo. No se ha instalado ni activado un servidor de correo.

Nodemailer admite SMTP autenticado con TLS (`MAIL_TRANSPORT=smtp`); las credenciales se configuran de forma privada en el VPS cuando exista un SMTP utilizable. La ruta OAuth descrita debajo queda como alternativa anterior, no es necesaria ni se usa en esta publicación.

---

# Correo de Samada con Nodemailer y Google Workspace

Implementación: 5 de noviembre de 2026. Resend ya no es un requisito del código ni del flujo de despliegue. No necesitas una contraseña de aplicación. La conexión real requiere un cliente OAuth y el consentimiento del buzón; una política de Workspace puede exigir aprobación de su administrador.

## Transporte

- `gmail-api` (predeterminado para la autorización): Nodemailer compone el MIME y Gmail API envía con permiso `gmail.send`. No permite leer el buzón.
- `gmail-oauth-smtp`: Nodemailer envía por smtp.gmail.com:465 con OAuth. Google exige `https://mail.google.com/`, que concede acceso amplio al buzón; el comando requiere confirmarlo expresamente.
- `smtp-local`: Mailpit para desarrollo y CI. Producción lo rechaza.
- `smtp`: SMTP autenticado genérico con TLS; no se configura automáticamente un proveedor.

El remitente debe coincidir con el buzón autorizado. No se permite enviar como acceso@samadaperu.com desde un buzón de otro dominio sin una integración adicional de alias. El nombre visible puede ser Samada. La cuenta administradora del CMS y el remitente son independientes.

## 1. Preparar Google Cloud

1. Abrir Google Cloud con una cuenta autorizada para crear o utilizar un proyecto. No es necesario configurar un relay de Workspace, pero tener un buzón no garantiza permiso para crear proyectos o consentir aplicaciones.
2. Habilitar Gmail API para el proyecto cuando se use `gmail-api`.
3. Configurar la pantalla de consentimiento en Google Auth Platform. Declarar `openid`, `email` y el permiso del transporte elegido.
4. Crear un cliente OAuth de tipo **Web application** y registrar exactamente este callback:
   `http://127.0.0.1:43821/oauth/google/callback`.
5. Descargar el JSON del cliente a una carpeta privada fuera del repositorio y de public/. No pegarlo en el chat.
6. Revisar estado de publicación/verificación. Los tokens de una aplicación externa en Testing con permisos Gmail pueden caducar a los siete días. No usar esa modalidad como configuración duradera sin resolver la política de Google.

Si aparecen `admin_policy_enforced`, aplicación bloqueada o acceso denegado, solicitar aprobación al administrador del dominio. No sirve sustituirlo por la contraseña normal. No cambiar de alcance o transporte para evitar un bloqueo administrativo.

## 2. Autorizar localmente

Desde la carpeta samada-commerce, con dependencias instaladas:

```powershell
npm run mail:authorize -- --client-config "C:\ruta\privada\cliente-google.json" --user "tu-buzon@tu-dominio.com" --transport gmail-api
```

El comando muestra el enlace de Google. Abrirlo, elegir el buzón esperado y consentir el permiso. El servidor de callback escucha solo en 127.0.0.1 durante tres minutos; valida state, PKCE, identidad verificada y el alcance. El navegador no recibe el refresh token.

El resultado queda en `data/mail/google-oauth.env`, excluido de Git y Docker. No se imprime ningún token ni se transfiere a GitHub o al VPS. Si el archivo existe se rechaza la sobrescritura. Para reautorizar usar `--output data/mail/google-oauth-nuevo.env`. Conservar esos archivos como credenciales privadas; los permisos POSIX 0600 se aplican donde el sistema los soporte, y en Windows deben custodiarse además con permisos de usuario.

Si se elige SMTP expresamente:

```powershell
npm run mail:authorize -- --client-config "C:\ruta\privada\cliente-google.json" --user "tu-buzon@tu-dominio.com" --transport gmail-oauth-smtp --accept-full-mail-scope
```

No usar un token de gmail.send para SMTP. El comando verifica la correspondencia del alcance y transporte.

## 3. Verificar sin enviar

```powershell
npm run mail:verify -- --env-file data/mail/google-oauth.env
```

Verifica renovación del access token, cuenta y permisos. Para SMTP también verifica conexión y autenticación. La ruta API no hace una operación de envío durante esta comprobación; por tanto aún debe probarse la entrega.

Para solicitar explícitamente un único correo de prueba:

```powershell
npm run mail:verify -- --env-file data/mail/google-oauth.env --send-to destinatario-autorizado@dominio.com
```

El resultado confirma aceptación del proveedor, no llegada a bandeja. No hay reintentos automáticos de mensajes ante respuestas ambiguas, para reducir duplicados. Credenciales revocadas producen un mensaje de reconexión sin mostrar tokens.

## 4. Guardar credenciales en GitHub y configurar el VPS

El responsable autorizó el 5 de noviembre de 2026 almacenar las credenciales OAuth, incluido el refresh token, en los secretos privados de `mavrictech-dev/samada-prototipo-2`, transferirlas por SSH al archivo privado `/var/www/samada/.env` del VPS `37.60.234.60` y usarlas para los correos del sistema y su enlace de acceso. El modo predeterminado es Gmail API de solo envío.

Después de autorizar el buzón localmente, crear estos cuatro secretos en Settings → Secrets and variables → Actions → Secrets:

| Secreto | Valor del archivo privado generado |
|---|---|
| GOOGLE_MAIL_USER | Buzón autorizado |
| GOOGLE_OAUTH_CLIENT_ID | Identificador del cliente OAuth |
| GOOGLE_OAUTH_CLIENT_SECRET | Secreto del cliente OAuth |
| GOOGLE_OAUTH_REFRESH_TOKEN | Refresh token del consentimiento offline |

Copiar los valores, sin las comillas del archivo .env. No pegarlos en el chat, en el código ni en registros. El secreto MAIL_FROM es opcional; al omitirlo se usa Samada con el buzón autorizado. Conservar ADMIN_EMAIL y el acceso SSH existentes. MAIL_TRANSPORT es una variable de repositorio opcional y por defecto vale gmail-api.

El workflow usa la configuración GitHub solo si los cuatro secretos están completos y son coherentes. La envía exclusivamente al paso SSH y al generador privado del VPS. El generador conserva las claves de base y sesión y retira los campos SMTP obsoletos al aplicar Google. Si el .env existente no pertenece al generador de Samada, lo conserva y detiene el despliegue: debe configurarse manualmente, no se sobrescribe.

Como alternativa, una persona autorizada puede configurar directamente el archivo del VPS sin guardar tokens en GitHub.

Campos del archivo privado:

```dotenv
MAIL_TRANSPORT=gmail-api
GOOGLE_MAIL_USER=BUZON_AUTORIZADO
GOOGLE_OAUTH_CLIENT_ID=CLIENTE
GOOGLE_OAUTH_CLIENT_SECRET=SECRETO
GOOGLE_OAUTH_REFRESH_TOKEN=TOKEN_OFFLINE
# MAIL_FROM opcional; se deduce Samada <GOOGLE_MAIL_USER>.
```

Sustituir los marcadores con los valores del archivo local autorizado. Conservar todas las variables de PostgreSQL, autenticación y demás configuración del servidor. No subir el archivo a Git, no mostrarlo en los logs y no reusar los tokens como variables NEXT_PUBLIC.

El generador del despliegue conserva los archivos de entorno ajenos a su marcador. Si se aplica configuración Google a un archivo administrado por Samada, conserva las claves de base/sesión y retira los campos SMTP antiguos. La validación obliga a elegir transporte: no continúa con Resend silenciosamente.

## 5. Publicación y acceso inicial

En GitHub conservar los secretos de SSH y ADMIN_EMAIL ya autorizados. **No se requiere SMTP_PASSWORD**. Con los cuatro secretos Google completos se usa la provisión autorizada desde GitHub. Para la alternativa de configuración directa, omitir los cuatro secretos Google y establecer `MAIL_CONFIGURED_ON_VPS=true` solo después de verificar el correo en el servidor. Una configuración parcial de secretos Google bloquea la provisión, aunque exista esa variable; no hay cambio silencioso de ruta.

Ejecutar el workflow de main. El script valida configuración, construye, ejecuta mail:verify antes de migrar, respalda PostgreSQL y crea el administrador inicial sin enviar correo. Después de activar y comprobar la aplicación solicita el enlace de acceso una sola vez.

Si el proveedor rechazó o no confirmó ese envío, no se repite automáticamente en cada deploy. Una persona autorizada debe revisar el estado y solicitar expresamente:

```bash
docker compose --project-name samada run --rm --no-deps migrate npm run admin:send-access -- --initial --retry
```

Un intento concurrente no vuelve a reclamar una invitación en envío durante diez minutos. No se crean cuentas duplicadas, no se elevan usuarios preexistentes y una invitación ya aceptada por el proveedor no se repite por este comando. Si el enlace caducó, usar el flujo normal Olvidé mi contraseña.

## Operación y pruebas

- `npm run test:mail`: Google simulado, MIME, permisos, token revocado, errores y callback seguro.
- `node --test tests/deployment.test.mjs`: configuración por transporte, preservación de claves y protección de archivos.
- `npm run test:initial-admin`: base local, cuentas temporales y envío simulado; no ejecutar en producción.
- `npm run test:integration`: aplicación, worker, PostgreSQL y Mailpit locales, incluidos 1.500 productos y recuperación.
- `npm run build` y `npm run lint`.

Las pruebas automatizadas no sustituyen el consentimiento de Google ni la prueba de recepción real. Si un refresh token se revoca, debe repetirse la autorización y actualizar la configuración privada. La salud del catálogo público no depende de contactar a Google en cada petición.

Fuentes: [Nodemailer OAuth](https://nodemailer.com/smtp/oauth2), [Stream transport](https://nodemailer.com/transports/stream), [Google OAuth de servidor](https://developers.google.com/identity/protocols/oauth2/web-server), [permisos Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes), [políticas Workspace](https://knowledge.workspace.google.com/admin/apps/control-which-apps-access-google-workspace-data).
