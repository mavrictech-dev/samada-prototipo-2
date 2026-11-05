# Corrección de tema y diagnóstico de publicación — 5 de noviembre de 2026

La captura del dominio corresponde al CMS anterior: el servidor publica el bundle con el texto `Sincronizado en servidor`, y devuelve 404 en `/login` y `/api/health`. La rama main contiene el CMS con autenticación y las rutas nuevas. La última ejecución de Actions pasó validación, pero omitió el despliegue; los secretos disponibles al diagnosticar eran ADMIN_EMAIL y SSH_PASSWORD, sin SMTP_PASSWORD.

El problema de contraste mostrado combina superficies oscuras con el fondo claro del área de trabajo. En el CMS actual se fijaron variables de superficie y texto dentro de `.cms-shell` y `.auth-layout`, con valores completos para cada modo, y se aplicó el fondo al área de trabajo y main. Los textos secundarios tienen contraste suficiente para tabla y encabezados.

El tema se aplica antes de pintar el contenido, conserva la preferencia, sincroniza botones y cambios entre pestañas, respeta el sistema si no hay una preferencia explícita y tolera que localStorage no esté disponible. No se sustituye la paleta editorial de las páginas de revista.

`tests/theme-browser.mjs` verifica contraste mínimo 4,5:1 en títulos, descripción, cabecera, producto y SKU; fondo real del panel; campos y título del formulario; login; móvil; persistencia tras recarga y funcionamiento con almacenamiento bloqueado. Capturas privadas en data/qa. Ejecutar con Playwright instalado o PLAYWRIGHT_MODULE y CHROMIUM_PATH. Requiere app y base locales, más el archivo privado de acceso de pruebas.

La corrección de código no implica una publicación. Para confirmar la versión del servidor se debe recibir 200 en `/api/health` con la revisión de main, y `/login` debe mostrar el acceso nuevo. La clave Resend pendiente y la verificación del dominio de correo se documentan en CONFIGURAR-CORREO-SAMADA.md. No se modificó ni se publicó el CMS antiguo para evitar mantener dos implementaciones divergentes.
