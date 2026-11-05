# Validación de la migración Workspace — 5 de noviembre de 2026

Implementados: Nodemailer con Gmail SMTP OAuth y MIME para Gmail API, biblioteca oficial google-auth-library, autorización local con state/PKCE/identidad, renovación de tokens, verificación sin correo, validación por transporte y acceso inicial recuperable. No se requiere una clave de aplicación ni Resend.

Resultados locales:

- Compilación Next.js y TypeScript correctas.
- Lint correcto.
- 9 pruebas de correo y autorización con Google simulado: remitente, scopes, composición MIME, renovación solicitada, revocación, cuota, respuesta ambigua sin reenvío, callback seguro, cuenta equivocada, caducidad y Google denegado.
- 3 pruebas de configuración/worker: conserva claves de base y sesión, elimina parámetros SMTP obsoletos al seleccionar Google, mantiene archivos ajenos, rechaza producción incompleta y detecta heartbeat ausente.
- 1 prueba de alta inicial con PostgreSQL local y correo simulado: cuenta única, fallo de envío persistente, reintento explícito y exclusión de envíos concurrentes.
- 10 pruebas integrales existentes correctas con aplicación compilada, PostgreSQL, Mailpit y worker locales, incluida importación de 1.500 SKU y recuperación real mediante Mailpit.
- mail:verify correcto con smtp-local, sin enviar mensajes.
- Sintaxis Bash, YAML del workflow y docker compose config correctos. El workflow lee tokens solo del entorno privado del servidor; no los transfiere desde GitHub.
- npm audit --omit=dev: 0 vulnerabilidades de ejecución reportadas en esta comprobación.

No verificado aún: consentimiento OAuth de la cuenta Workspace, políticas administrativas, envío/recepción real con Google y publicación en el VPS. Las pruebas de Google usan credenciales ficticias e interfaces simuladas; no demuestran acceso al buzón real.

Ruta operativa actual: configurar OAuth privadamente en el VPS tras la autorización correspondiente y establecer MAIL_CONFIGURED_ON_VPS=true. El correo administrador y SSH conservan su tratamiento previo autorizado. La solicitud de autorización adicional para transferir tokens Google desde GitHub sigue separada; esa transferencia no forma parte del workflow implementado.

Comandos e instrucciones: CONFIGURAR-CORREO-SAMADA.md. Ningún token de Google ni contraseña se incluye en el repositorio.
