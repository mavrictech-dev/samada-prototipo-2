# Samada Commerce

Catálogo B2B de demostración para distribuidores, migrado a Next.js, TypeScript y Tailwind CSS. Conserva la experiencia editorial con Turn.js y suma búsqueda rápida, filtros, pedido mayorista y un CMS local.

## Ejecutar

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` para el catálogo y `http://localhost:3000/admin` para el panel.

## Funciones incluidas

- Buscador global por nombre, SKU, marca y subcategoría (`Ctrl/⌘ + K` o `/`).
- Filtros por categoría, marca y disponibilidad.
- Vista de revista Turn.js y tabla de pedido rápido.
- Precios de distribuidor, compra mínima, unidades por caja y stock.
- Pedido acumulado y mensaje de cotización por sede.
- CMS de productos: crear, editar, ocultar y eliminar.
- CMS de páginas: crear páginas, publicar, elegir tema, asignar productos y definir su orden.
- Configuración de sedes y números de WhatsApp.
- Persistencia en `localStorage` para demostrar cambios sin base de datos.

## Alcance del prototipo

El contenido, precios, stock, productos, sedes y teléfonos son datos demostrativos. El botón de WhatsApp copia el mensaje si la sede no tiene un número real configurado. Los datos del CMS se guardan únicamente en el navegador actual; para producción debe conectarse a una base de datos y autenticación.

Turn.js 4.1.0 y jQuery 1.7 se conservan desde la biblioteca suministrada y están en `public/vendor`. Antes de publicar comercialmente, valida la licencia de Turn.js y planifica sustituir jQuery 1.7 o aislarlo por su antigüedad.
