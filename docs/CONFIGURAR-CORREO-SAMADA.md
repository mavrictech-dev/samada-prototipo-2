# Correo transaccional de Samada

Configuración autorizada por el responsable el 20 de octubre de 2026: usar Resend para enviar verificaciones de cuenta y recuperación de contraseña con el remitente `Samada <acceso@samadaperu.com>`. La aplicación soporta SMTP; falta crear la cuenta del proveedor, verificar el dominio y guardar la clave de envío.

## Preparación de la cuenta y DNS

1. Crear o abrir una cuenta en https://resend.com.
2. En Domains, añadir `samadaperu.com`.
3. Copiar exactamente los registros de envío que Resend indique a la zona DNS del dominio en GoDaddy. No inventar sus valores ni activar recepción de correo para este caso.
4. Esperar que Resend muestre el dominio como Verified.
5. En API Keys, crear una clave dedicada al envío de Samada con el menor alcance disponible.

El diagnóstico público del 20 de octubre de 2026 encontró nameservers `ns59.domaincontrol.com` y `ns60.domaincontrol.com`. Antes de cambiar registros, comprobar que la zona activa sigue siendo esa. No sustituir registros de la web ni registros de correo existentes.

## Configuración propuesta

| Campo | Valor |
|---|---|
| SMTP_HOST | smtp.resend.com |
| SMTP_PORT | 465 |
| SMTP_SECURE | true |
| SMTP_USER | resend |
| SMTP_PASSWORD | clave API dedicada, privada |
| MAIL_FROM | Samada <acceso@samadaperu.com> |

Resend requiere una clave API y un dominio verificado. El puerto 465 usa TLS implícito.

## Guardar la clave y desplegar

Crear el secreto `SMTP_PASSWORD` en https://github.com/mavrictech-dev/samada-prototipo-2/settings/secrets/actions y pegar la clave API de envío de Resend. `ADMIN_EMAIL` guarda de forma privada el correo autorizado para el primer administrador. Después ejecutar **Actions → Samada CI y despliegue continuo → Run workflow → main**. El sistema crea esa cuenta únicamente si aún no hay un superadministrador activo y solicita el correo para establecer su contraseña.

Destino autorizado: desde ese secreto, mediante la conexión SSH del despliegue, al archivo privado `/var/www/samada/.env` del VPS Contabo `37.60.234.60`. El generador crea claves de base y sesión si falta el archivo y aplica el SMTP autorizado a archivos generados por Samada, conservando esas claves entre despliegues. No modifica archivos de entorno preexistentes ajenos a su generador. La aplicación usa la clave para autenticar los correos de registro y recuperación con Resend.

No publicar claves en Git, registros o en el chat. La preparación y validación no envían correos de prueba. La comprobación de entrega requiere una operación real de registro o recuperación después de verificar el dominio.

Fuentes: [SMTP de Resend](https://resend.com/docs/send-with-smtp), [verificación de dominios](https://resend.com/docs/dashboard/domains/introduction).
