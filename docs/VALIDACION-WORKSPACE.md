# Validación de la migración Workspace — 5 de noviembre de 2026

Implementados: Nodemailer con Gmail SMTP OAuth y MIME para Gmail API, biblioteca oficial google-auth-library, autorización local con state/PKCE/identidad, renovación de tokens, verificación sin correo, validación por transporte y acceso inicial recuperable. No se requiere una clave de aplicación ni Resend.

Resultados locales:

- Compilación Next.js y TypeScript correctas.
- Lint correcto.
- 9 pruebas de correo y autorización con Google simulado: remitente, scopes, composición MIME, renovación solicitada, revocación, cuota, respuesta ambigua sin reenvío, callback seguro, cuenta equivocada, caducidad y Google denegado.
- 4 pruebas de configuración/worker: conserva claves de base y sesión, elimina parámetros SMTP obsoletos al seleccionar Google, mantiene archivos ajenos, rechaza producción incompleta, comprueba la selección de secretos GitHub/configuración directa y detecta heartbeat ausente.
- 1 prueba de alta inicial con PostgreSQL local y correo simulado: cuenta única, fallo de envío persistente, reintento explícito y exclusión de envíos concurrentes.
- 10 pruebas integrales existentes correctas con aplicación compilada, PostgreSQL, Mailpit y worker locales, incluida importación de 1.500 SKU y recuperación real mediante Mailpit.
- mail:verify correcto con smtp-local, sin enviar mensajes.
- Sintaxis Bash, YAML del workflow y docker compose config correctos. Actualización autorizada: el workflow provisiona OAuth desde secretos privados GitHub cuando están completos; admite como alternativa la configuración directa del VPS.
- npm audit --omit=dev: 0 vulnerabilidades de ejecución reportadas en esta comprobación.

No verificado aún: consentimiento OAuth de la cuenta Workspace, políticas administrativas, envío/recepción real con Google y publicación en el VPS. Las pruebas de Google usan credenciales ficticias e interfaces simuladas; no demuestran acceso al buzón real.

El responsable autorizó explícitamente el destino de secretos privados GitHub y .env del VPS para OAuth el 5 de noviembre de 2026. La provisión está implementada, sin tokens reales disponibles al verificar la configuración. Los secretos encontrados siguen siendo ADMIN_EMAIL y SSH_PASSWORD. La configuración directa del VPS continúa disponible; no se puede afirmar entrega ni despliegue reales hasta generar y configurar las credenciales.

Comandos e instrucciones: CONFIGURAR-CORREO-SAMADA.md. Ningún token de Google ni contraseña se incluye en el repositorio.
