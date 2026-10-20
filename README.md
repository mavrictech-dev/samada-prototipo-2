# Samada Commerce

Catálogo B2B y CMS con Next.js, TypeScript, Tailwind, Turn.js, PostgreSQL y Better Auth. Los cambios se guardan en el servidor y los permisos se validan en cada operación.

## Puesta en marcha local

Requiere Node.js 24 y Docker Desktop en ejecución. Desde esta carpeta:

```powershell
npm ci
npm run local:configure
npm run services
npm run db:migrate
npm run admin:create -- --email admin@samada.local
npm run build
npm run start
```

En otra terminal, mantener el procesador de importaciones activo:

```powershell
npm run worker
```

- Catálogo: http://localhost:3000
- Acceso y panel: http://localhost:3000/login y /admin
- Correos de prueba: http://localhost:8026

La contraseña inicial aleatoria se escribe únicamente en `data/ACCESO-LOCAL.txt`. Cambiarla desde Mi cuenta después del primer acceso. `.env` y `data/` son privados y están excluidos de Git. `admin:create` es una operación inicial; no sobrescribe el archivo de acceso existente. Para desarrollar usar `npm run dev` en lugar de build/start.

## Catálogo y organización

- CRUD de productos, marcas, categorías, subcategorías y tamaños. Cada marca habilita sus propias combinaciones.
- Tamaños numéricos de volumen, masa y unidades, o etiquetas de texto. El orden por tamaño convierte L/ml y kg/g antes de comparar.
- Orden general por marca/categoría/tamaño, marca/tamaño/categoría, tamaño, nombre o posición manual.
- Páginas automáticas por marca/categoría y páginas con selección y orden manual. Los productos publicados sin página asignada conservan una sección en el catálogo.
- Búsqueda por nombre/SKU/marca, filtros combinables y tabla de pedido paginada. Turn.js utiliza copias de las páginas para evitar modificar nodos de React al filtrar.
- Logos WebP y variante para modo oscuro. Imágenes de productos convertidas en el servidor.

## Importar Excel y CSV

En **Importar catálogo**, descargar la plantilla actual. Incluye instrucciones, campos obligatorios, ejemplos y referencias con los códigos y relaciones vigentes. La hoja `Productos` empieza vacía; las referencias no crean categorías ni marcas automáticamente.

Al crear son obligatorios `sku`, `nombre`, `marca_codigo`, `categoria_codigo`, `tamano_codigo` y `precio_mayorista`. Cada tamaño vendible tiene un SKU; `codigo_grupo` reúne variantes. Mantener los SKU como texto para conservar ceros iniciales.

Elegir crear, actualizar o ambos. Revisar el resumen antes de confirmar. En actualizaciones las celdas vacías conservan valores; `0` y `NO` los modifican. `__BORRAR__` elimina campos opcionales indicados en la plantilla. Fórmulas y códigos numéricos de Excel se rechazan en la revisión. CSV admite UTF-8 con coma o punto y coma.

Límites: 10.000 filas y 20 MB por archivo. El trabajador procesa filas en segundo plano, registra conflictos y conserva el progreso. Las filas completadas no se repiten. Los pendientes tienen reporte CSV y revisión para reintento; los errores del archivo deben corregirse en una nueva carga. Las ediciones posteriores a la vista previa producen conflictos para revisión.

## Organizar imágenes

En **Imágenes por SKU**, seleccionar carpeta o varios archivos: `SKU.jpg`, `SKU.png`, `SKU.webp` o `SKU.avif`. Para galerías: `SKU__01.jpg` a `SKU__99.jpg`; el archivo sin sufijo es principal. También se puede especificar `imagen_archivo` en la plantilla. La asociación es exacta y se revisa antes de aplicar; un archivo sin coincidencia puede asignarse manualmente.

Máximo 20 MB por imagen, 40 millones de píxeles y 10.000 archivos por lote. Se generan WebP y miniatura, se conserva el original privado y el reemplazo requiere confirmación y permiso. Un lote parcial puede revisarse y reintentarse sin duplicar filas completadas. Los archivos se guardan en `data/media`; configurar S3 compatible para almacenamiento externo.

## Acceso y seguridad

Registro con verificación por correo y aprobación administrativa, inicio/cierre de sesión, recuperación de contraseña, cambio de contraseña y revocación de sesiones. La recuperación caduca a los 30 minutos y su uso revoca sesiones anteriores. En local los mensajes llegan a Mailpit.

Gestión de usuarios, invitaciones, aprobación, suspensión y archivo; roles, asignaciones por marca y permisos. Eliminar un usuario lo archiva para conservar auditoría. Un permiso personalizado representa una capacidad existente del servidor. Los permisos se comprueban por rol y marca, sin combinar el alcance de un rol con capacidades de otro. Superadministrador está protegido y no se permite desactivar el último acceso de recuperación.

Roles iniciales: Superadministrador, Administrador, Gestor de catálogo, Operador de carga y Consulta. Pueden personalizarse salvo el rol protegido. La auditoría registra operaciones del CMS e importaciones. Las ediciones comprueban versiones para detectar conflictos.

## Datos, migración y despliegue

Despliegue continuo: [guía de GitHub Actions y Contabo](docs/DESPLIEGUE-CONTINUO.md). Cada push a main valida compilación, importaciones y contenedores; el despliegue requiere configurar el acceso SSH del repositorio y el entorno de producción en el VPS.

`db:migrate` prepara el esquema PostgreSQL y las tablas de autenticación. La primera vez importa `data/cms-state.json` si existe; en caso contrario usa datos demostrativos de `lib/seed.ts`. Guarda copia del origen en `data/backups`, conserva identificadores y convierte imágenes base64 a WebP. La marca `migration-v1` evita repetir la importación. No migra automáticamente el antiguo localStorage de otros navegadores.

Para desplegar configurar `.env` con dominio HTTPS real, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, secreto de autenticación, PostgreSQL, SMTP y almacenamiento. No usar Mailpit para correo real. `docker-compose.yml` incluye base, migración, aplicación y trabajador; publica la aplicación en localhost:3001 para colocar un proxy HTTPS delante. Revisar las URLs de autenticación y propiedad de `data/` para UID 1001 en Linux. El correo externo y la publicación en un servidor no se realizan con la configuración local.

Respaldar PostgreSQL y `data/media` (o el bucket); los JSON en `data/backups` respaldan el origen de migración, no la base actual. Nunca publicar `.env`, `data/` ni el archivo de acceso. Turn.js y jQuery se mantienen desde la biblioteca suministrada en `public/vendor`.

## Validación

```powershell
npm run lint
npm run build
npm run test:integration
```

Las pruebas requieren aplicación, trabajador, PostgreSQL y Mailpit locales activos, y el acceso inicial en `data/ACCESO-LOCAL.txt`. Crean borradores con prefijos únicos y limpian sus registros. Cubren 1.500 productos, duplicados, conflictos, WebP, pendientes, registro, recuperación, roles, alcance por marca y protección del API. No ejecutar contra producción.
