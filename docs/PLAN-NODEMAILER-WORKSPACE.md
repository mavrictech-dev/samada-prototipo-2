# Plan de migración de correo: Nodemailer + Google Workspace

Fecha: 5 de noviembre de 2026. Estado actualizado: integración local implementada. Están disponibles los transportes SMTP OAuth y Gmail API, autorización local con PKCE, verificación, configuración por modo y alta inicial recuperable. El workflow ya no depende de Resend ni transfiere tokens de Google desde GitHub; espera configuración privada en el VPS. El consentimiento real, la entrega con Workspace y la publicación siguen pendientes de las credenciales y políticas de la cuenta. Consultar CONFIGURAR-CORREO-SAMADA.md para los comandos actuales.

## Decisión y restricciones

Conservar Nodemailer, que ya está instalado y se usa en `server/mail.ts`, y reemplazar la dependencia de Resend por autenticación OAuth 2.0 de una cuenta de Google Workspace. No usar la contraseña normal del correo ni contraseñas de aplicación.

El responsable solo tiene acceso al buzón, sin administración de Workspace. Por eso no se elige el relay por IP ni una cuenta de servicio con delegación de dominio. Se requiere consentimiento del usuario mediante OAuth y permiso para crear o usar un cliente de Google Cloud. Tener acceso al buzón no garantiza esos permisos; el primer paso será comprobarlos.

La ruta solicitada es **Nodemailer → SMTP de Gmail → destinatario**, con OAuth 2.0. SMTP de Gmail exige el alcance `https://mail.google.com/`, que concede acceso amplio al buzón. Google indica que las aplicaciones que solo necesitan enviar deben considerar Gmail API con permisos más específicos. No se solicitará ese alcance amplio sin explicar y validar su uso. [Google: SMTP OAuth](https://developers.google.com/workspace/gmail/imap/xoauth2-protocol).

Si ese alcance no resulta apropiado o no puede autorizarse, la alternativa será **Nodemailer para componer el mensaje → Gmail API con `gmail.send`**, conservando la función `sendMail`. No es un mecanismo para eludir las políticas de Workspace; cualquier bloqueo organizacional requiere intervención del administrador. [Permisos de Gmail](https://developers.google.com/workspace/gmail/api/auth/scopes), [control de aplicaciones en Workspace](https://knowledge.workspace.google.com/admin/apps/control-which-apps-access-google-workspace-data).

## 1. Viabilidad antes de modificar producción

1. Comprobar que el usuario puede abrir Google Cloud y crear o usar un proyecto con permisos para un cliente OAuth.
2. Registrar el cliente y comprobar que Workspace permite el consentimiento de esa cuenta. Una prohibición de claves de aplicación no demuestra por sí sola si OAuth está permitido o bloqueado.
3. Elegir el alcance y transporte definitivos tras revisar el acceso que se autoriza: SMTP OAuth o Gmail API de solo envío. Si Google devuelve `admin_policy_enforced` o una aplicación bloqueada, documentar el client ID y los permisos para solicitar aprobación al administrador; detener la activación del correo.
4. Validar el estado de publicación de la pantalla de consentimiento. Una aplicación externa en Testing con permisos Gmail puede recibir refresh tokens que caducan en siete días; no es una configuración duradera de producción. No asumir que una aplicación comercial está exenta de verificación por tener un único buzón conectado.

Salida: transporte elegido, consentimiento viable y requisitos de Google documentados. No prometer un despliegue automático hasta resolver este punto. [Caducidad de tokens](https://developers.google.com/identity/protocols/oauth2), [verificación y excepciones](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).

## 2. Cuenta remitente y OAuth

- Separar la cuenta que administra el CMS de la cuenta que envía. Pueden coincidir inicialmente, pero se configurarán con variables distintas.
- Usar como remitente la cuenta de Workspace autorizada, con el nombre visible Samada. No enviar como `acceso@samadaperu.com` desde un buzón de otro dominio sin haber configurado y validado ese alias en Google.
- Crear un cliente OAuth adecuado y un callback de instalación local, por ejemplo `http://localhost:43821/oauth/google/callback`. Registrar exactamente la URI en Google. El consentimiento inicial puede obtenerse localmente antes de desplegar el CMS, evitando depender de una ruta que aún no existe en producción.
- Añadir un comando `mail:authorize` con la biblioteca oficial `google-auth-library`: estado aleatorio de un solo uso, callback ligado a loopback, vida corta, sin exposición de códigos o tokens en logs, intercambio del código y solicitud de acceso offline. Usar PKCE cuando corresponda al tipo de cliente.
- El resultado se escribirá en un archivo privado excluido de Git. Guardar el refresh token; no usar un access token temporal como configuración permanente. Verificar que la cuenta autorizada coincide con el remitente esperado.

La conexión del buzón se usará para correo del sistema; no incorporará inicio de sesión con Google para todos los usuarios del CMS. [Flujo OAuth del servidor](https://developers.google.com/identity/protocols/oauth2/web-server).

## 3. Adaptación de `server/mail.ts`

Mantener `sendMail(to, subject, text)` para no alterar las llamadas de Better Auth de registro, verificación, recuperación e invitaciones.

Para la ruta SMTP:

```text
host = smtp.gmail.com
port = 465
secure = true
auth.type = OAuth2
auth.user = cuenta remitente autorizada
auth.clientId = GOOGLE_OAUTH_CLIENT_ID
auth.clientSecret = GOOGLE_OAUTH_CLIENT_SECRET
auth.refreshToken = GOOGLE_OAUTH_REFRESH_TOKEN
```

Nodemailer puede renovar los access tokens de Gmail usando el refresh token. Crear un transportador reutilizable por proceso, con límites de tiempo de conexión, saludo y socket. Mantener validación TLS y desactivar logs de protocolo y contenido. No guardar tokens en el frontend ni en variables `NEXT_PUBLIC_*`. [Nodemailer OAuth 2.0](https://nodemailer.com/smtp/oauth2).

Si se selecciona Gmail API, Nodemailer compondrá el MIME con stream transport; el servidor enviará el resultado en base64url mediante `users.messages.send`, usando OAuth con `gmail.send`. No intentar usar un token con `gmail.send` para autenticar SMTP: los permisos son diferentes. Mantener una sola ruta activa por instalación, sin cambiar proveedores silenciosamente ante errores.

Añadir `mail:verify`: en SMTP comprobar conexión y autenticación, y en la ruta API comprobar renovación del token sin enviar mensajes. Un envío de prueba separado requerirá un destinatario explícito. La conexión correcta no prueba entrega a bandeja de entrada.

## 4. Configuración y secretos

| Variable | Uso | Tratamiento |
|---|---|---|
| MAIL_TRANSPORT | gmail-oauth-smtp, gmail-api o smtp-local | Configuración |
| MAIL_FROM | Nombre Samada y buzón autorizado | Configuración privada |
| GOOGLE_MAIL_USER | Buzón de envío | Secreto/configuración privada |
| GOOGLE_OAUTH_CLIENT_ID | Cliente Google autorizado | Configuración privada |
| GOOGLE_OAUTH_CLIENT_SECRET | Credencial del cliente, si aplica | Secreto |
| GOOGLE_OAUTH_REFRESH_TOKEN | Acceso offline concedido | Secreto |
| ADMIN_EMAIL | Administrador inicial del CMS | Secreto ya separado |

Mantener SMTP local con Mailpit para desarrollo y CI; no necesita Google ni acceso a cuentas reales. Eliminar la exigencia de `SMTP_PASSWORD` en el modo OAuth. No eliminar otros modos SMTP legítimos si siguen siendo necesarios para pruebas.

La autorización anterior de transferir una clave Resend no se interpretará como autorización para transferir tokens de Google, que conceden acceso al buzón. Antes de provisionarlos, presentar el alcance concreto y confirmar el almacenamiento elegido: secretos del repositorio y `.env` privado del VPS, o configuración directa por una persona autorizada. En este plan no se solicitan ni transfieren tokens.

## 5. Migración del despliegue

| Archivo | Cambio previsto |
|---|---|
| `server/mail.ts` | Selección explícita de transporte y autenticación OAuth |
| `scripts/mail-authorize.ts` | Consentimiento inicial local y almacenamiento privado |
| `scripts/mail-verify.ts` | Comprobación sin correo y prueba de envío explícita |
| `scripts/bootstrap-production.mjs` | Quitar valores fijos Resend; aplicar solo la configuración seleccionada |
| `scripts/validate-production.mjs` | Validar campos por transporte; OAuth no requiere SMTP_PASSWORD |
| `.github/workflows/deploy.yml` | Sustituir condición y variables Resend por secretos OAuth del modo seleccionado |
| `deploy.sh` | Provisionar variables aprobadas, verificar correo antes del alta inicial y migración |
| `.env.example`, `docs/production.env.example` | Ejemplos sin credenciales reales |
| `scripts/ensure-admin.ts` | Alta inicial recuperable y separación entre crear cuenta y enviar acceso |
| `docs/CONFIGURAR-CORREO-SAMADA.md` | Sustituir los pasos de Resend por la guía definitiva Google |
| `tests/deployment.test.mjs` | Matriz de configuración por transporte y persistencia de claves |

Conservar `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, archivos y datos existentes. La actualización del correo no debe volver a generar las claves de la base ni cerrar sesiones por cambiar el secreto de autenticación.

El bootstrap actual solo modifica `.env` creados por su generador. Mantener esa protección y dar instrucciones concretas para archivos ajenos, sin reemplazarlos. Evitar que un `.env` conservado deje accidentalmente activo el remitente Resend mientras la validación anuncia Google.

La comprobación del flujo debe distinguir: configuración completa, autenticación correcta, aplicación saludable y correo aceptado. `/api/health` continuará comprobando la aplicación/base; la revocación de un token Gmail no debe causar reinicios constantes del catálogo público.

## 6. Alta inicial y recuperación ante fallos

No asumir que aceptar una solicitud de recuperación garantiza que se haya entregado el correo. El alta del superadministrador debe registrarse una sola vez y el envío poder repetirse de forma explícita sin crear otra cuenta ni elevar usuarios preexistentes.

Antes de publicar: comprobar el token y preparar el acceso. Después de activar la aplicación y confirmar HTTPS y la revisión, enviar o reenviar el enlace al administrador autorizado. Si el primer envío falla, conservar la cuenta y ofrecer un comando de recuperación idempotente. El enlace enviado antes de un despliegue todavía bloqueado no debe ser el único camino para entrar.

Clasificar errores: credencial revocada/`invalid_grant` requiere nueva autorización; fallos temporales o cuotas pueden reintentarse con límite y espera. No repetir automáticamente un mensaje cuando el servidor pudo aceptarlo y solo faltó la respuesta; registrar ese estado para revisión. No registrar contraseñas, tokens ni URLs completas de recuperación.

## 7. Pruebas y aceptación

1. Configuración OAuth válida sin `SMTP_PASSWORD`; errores claros ante client ID, secreto o refresh token ausentes.
2. Renovación de access token simulado y token revocado: mensaje de reconexión sin datos sensibles.
3. Verificación del remitente y bloqueo de una dirección no autorizada.
4. `.env` conserva las claves de base/sesión al cambiar el correo; logs y artefactos no contienen tokens.
5. CI con Mailpit mantiene las diez pruebas integrales actuales, sin acceder a Google.
6. Consentimiento real y un envío controlado al destinatario autorizado; revisar aceptación y recepción del mensaje.
7. Registro y recuperación reales; enlace de un solo uso, expiración y cierre de sesiones según Better Auth.
8. Reejecutar alta inicial tras un fallo SMTP no crea duplicados ni cambia permisos de una cuenta existente.
9. Despliegue en main: pruebas correctas, job deploy ejecutado, `/api/health` con revisión actual y login nuevo en el dominio.
10. Revisar el modo oscuro ya corregido sobre el dominio publicado, no solo en localhost.

## Secuencia y estimación

1. Validación de Google Cloud y consentimiento: depende del acceso real y políticas del dominio.
2. Transporte, autorización local y manejo de errores: aproximadamente un día de implementación.
3. Ajustes de secretos, bootstrap y alta inicial: medio día.
4. Pruebas, guía operativa y publicación: medio día.

Estimación de trabajo de código: dos a tres días, condicionada a un consentimiento OAuth viable. Una aprobación de Workspace o revisión de Google no tiene un plazo controlable desde este proyecto.

No se considera completada la migración por un push. Termina cuando el correo real funciona y el dominio responde con la revisión nueva. Si las políticas del dominio bloquean OAuth, el impedimento se entrega al administrador; no se sustituye por la contraseña normal del usuario.
