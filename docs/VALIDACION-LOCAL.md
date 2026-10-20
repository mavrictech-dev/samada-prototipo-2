# Validación local — 20 de octubre de 2026

Entorno: Node.js 24, Next.js 16.4.2, PostgreSQL 17 y Mailpit locales. Aplicación compilada y trabajador independiente. Los datos comerciales de la instalación se conservaron; las pruebas usan marcas, cuentas y SKU temporales en borrador.

## Resultados

- `npm run build`: correcto, comprobación TypeScript incluida.
- `npm run lint`: correcto.
- `npm audit --omit=dev --audit-level=moderate`: 0 vulnerabilidades de ejecución reportadas en esta revisión. No equivale a una auditoría de seguridad del sistema.
- `docker compose config --quiet`: correcto. La imagen final de despliegue no se ha construido ni publicado como parte de esta validación.
- `npm run test:integration`: 10 aprobadas, 0 fallidas; última ejecución aproximadamente 60 segundos, importación de 1.500 productos aproximadamente 47 segundos en este equipo.

## Pruebas integrales

1. Escrituras anónimas rechazadas, acceso administrativo protegido y antigua escritura global deshabilitada.
2. Inicio de sesión real y generación de plantilla XLSX/CSV con referencias actuales.
3. Orden de 250 ml, 500 ml y 1 L; rechazo de relaciones incompatibles.
4. Vista previa y procesamiento de 1.500 SKU, preservación de ceros, ejecución única y borradores ausentes de la proyección pública.
5. Actualización parcial con stock cero, conservación del precio, conflicto de versión y duplicados internos rechazados.
6. Asociación de imagen principal y galería por SKU, WebP real, acceso privado, asignación manual del pendiente y reintento sin duplicados.
7. Registro, correo de verificación, aprobación, rol con alcance por marca, denegación de escalada, recuperación, token de un solo uso, revocación, suspensión y protección del último superadministrador.
8. Escritura desde un origen no autorizado rechazada aun con sesión válida.
9. Lectura Excel conserva SKU de texto y marca códigos numéricos y fórmulas como errores; CSV con punto y coma y encabezados duplicados.
10. Edición y eliminación de roles/permisos, referencias protegidas y archivo del usuario desde las API.

## Navegador

Recorrido con Chromium en 1440 × 1000 y 390 × 844: login, los once módulos del panel, datos iniciales reales, formulario de tamaños con foco y cierre por Escape, navegación móvil, cambios repetidos de marca/búsqueda/orden, página de Turn.js, vista de pedido y tema oscuro. Sin errores de JavaScript registrados ni desbordamiento horizontal detectado. Capturas privadas en `data/qa/`.

Las pruebas de navegador están en `tests/browser.mjs`; requieren Playwright instalado o su ruta mediante `PLAYWRIGHT_MODULE` y, si procede, `CHROMIUM_PATH`.

## Pendientes del entorno de producción

Configurar dominio HTTPS, remitente SMTP real, almacenamiento y respaldos. Verificar construcción de contenedores, restauración de PostgreSQL/archivos y aceptación del negocio en el servidor de destino. El envío externo de correos, S3 y el despliegue remoto no se probaron. Los tiempos locales no son una garantía de rendimiento para otros servidores o lotes de imágenes.
