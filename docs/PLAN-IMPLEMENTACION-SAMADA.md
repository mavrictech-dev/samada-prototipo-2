# Plan de implementación — Samada Commerce

Fecha del plan: 19 de octubre de 2026. Implementación local: 20 de octubre de 2026. Las secciones de propuesta conservan el contexto de diseño; el estado real y las diferencias se detallan a continuación.

## Estado de implementación local

Implementados: PostgreSQL, autenticación y recuperación por correo, aprobación de usuarios, roles y permisos con alcance por marca, clasificación y tamaños dinámicos, distribución de páginas, plantilla Excel/CSV, revisión y procesamiento persistente de productos e imágenes WebP. La API anterior de reemplazo global está deshabilitada. Turn.js utiliza nodos aislados y paginación completa.

Decisiones finales: consultas y migración SQL mediante `pg` en lugar de Prisma; selección explícita del delimitador CSV; búsqueda y filtros en el cliente sobre la proyección publicada; grupos de variantes mediante `codigo_grupo`. Los catálogos son páginas de la instalación, sin una entidad multicatálogo separada. Las nuevas relaciones se crean desde el CMS antes de importar. La recuperación e invitación se envían con SMTP; en local llegan a Mailpit. Los originales se conservan, sin borrado automático por retención ni interfaz de reversión de imágenes.

Validación realizada con PostgreSQL y correo locales: carga de 1.500 SKU sin duplicados, actualización parcial, conflictos, WebP, recuperación, restricciones por marca y reintento de pendientes. También se comprobó el navegador en escritorio y móvil y el filtrado repetido con Turn.js. La publicación en infraestructura del negocio, configuración SMTP/S3 real, restauración operativa de respaldos y aceptación con datos comerciales siguen siendo tareas del despliegue. Consultar README para ejecución y límites actuales.

## 1. Resultado esperado

Administrar un catálogo de más de 1.000 productos sin ingresar cada ficha manualmente: definir marcas, sus categorías y tamaños, descargar una plantilla, importar productos, cargar una carpeta de imágenes y publicar una distribución ordenada. El CMS tendrá acceso con login, registro, recuperación de contraseña, usuarios, roles y permisos administrables.

Se conserva la aplicación Next.js, TypeScript, Tailwind y la revista Turn.js. La base persistente, los permisos y los trabajos masivos se implementan en servidor.

### Objetivos verificables

- Importar un archivo de 1.500 productos válidos y comprobar que todos los SKU aparezcan una sola vez.
- Actualizar precios o stock de un conjunto de SKU sin borrar los otros campos ni productos ausentes del archivo.
- Asignar automáticamente imágenes con nombre SKU y reportar cada archivo no reconocido o ambiguo.
- Aplicar orden por marca, categoría, tamaño o posición manual de manera reproducible.
- Denegar en servidor toda escritura sin sesión y toda operación sin permiso, aunque se llame directamente a la API.

### Historias principales

- Como administrador, quiero invitar usuarios y asignar roles para distribuir responsabilidades.
- Como responsable del catálogo, quiero configurar tamaños y categorías por marca sin modificar código.
- Como operador, quiero descargar un Excel con campos y listas válidas para preparar cientos de productos.
- Como operador, quiero revisar errores por fila y reintentar únicamente los registros pendientes.
- Como responsable de imágenes, quiero cargar una carpeta y revisar coincidencias por SKU antes de aplicarlas.
- Como distribuidor, quiero filtrar y ordenar por marca, categoría y tamaño y encontrar todas las presentaciones.

## 2. Estado observado y punto de partida

Revisión de los archivos locales del proyecto; no se auditó un servidor desplegado.

- `lib/types.ts`: marcas, categorías y subcategorías existentes; el tamaño está contenido en `presentation` como texto libre.
- `components/cms-provider.tsx`: mantiene todo el estado en memoria/localStorage y lo sincroniza mediante GET/POST a `/api/cms`.
- `app/api/cms/route.ts`: lee y sobrescribe `data/cms-state.json`; no verifica sesión ni permiso y no valida el cuerpo contra un esquema.
- `middleware.ts`: enruta el dominio público y el de gestión, pero excluye las API; el subdominio no constituye autenticación.
- `components/turn-book.tsx`: toma un destacado y hasta seis productos adicionales por página configurada. Esa limitación debe sustituirse por paginación para que un catálogo extenso no omita productos.
- El almacenamiento de imágenes de producto en el estado del navegador debe pasar a archivos independientes con referencias en base de datos.
- El README describe una etapa anterior del prototipo; se actualizará junto con la migración.

La prioridad P0 es proteger la escritura y retirar el reemplazo global del JSON. Añadir solamente una pantalla de login dejaría expuestas las mismas operaciones.

## 3. Modelo del catálogo

### Marca y clasificación

Se propone reutilizar categorías comunes y configurar cuáles admite cada marca:

`Marca → MarcaCategoría → Categoría → Subcategoría`

Ejemplo demostrativo: Botánica habilita Cuidado capilar y Cuidado corporal; Skinlab habilita Cuidado facial. La categoría Cuidado capilar puede estar habilitada en varias marcas sin duplicarla.

- CRUD de marcas, categorías y subcategorías: código, nombre, estado y orden.
- Relación marca–categoría: habilitar/deshabilitar, orden y nombre de presentación opcional por marca.
- Subcategorías asociadas a una categoría. Una relación marca–subcategoría permite restringir el surtido dentro de las categorías habilitadas.
- Un SKU pertenece a una marca, una categoría y, opcionalmente, una subcategoría válida para esa combinación.
- Las entidades usadas no se eliminan dejando referencias rotas: se archivan o se reasignan desde una operación explícita.
- Los cambios de categoría padre verifican los productos afectados antes de aplicarse.

### Tamaños y presentaciones

CRUD de tamaños: código, etiqueta, tipo, valor, unidad, valor normalizado, posición manual y estado.

| Tipo | Ejemplos | Orden |
|---|---|---|
| Volumen | 250 ml, 500 ml, 1 L | Valor normalizado en ml |
| Masa | 50 g, 250 g, 1 kg | Valor normalizado en g |
| Cantidad | 1 unidad, pack 6 | Valor numérico |
| Talla/texto | S, M, L, Única | Posición manual |

Los tamaños se habilitan por marca; el formulario solo ofrece las opciones permitidas. No se comparan gramos y mililitros como si fueran equivalentes: se agrupan por tipo y luego por valor. Para productos sin medida se usa un tamaño configurado `SIN-TAMANO`.

Cada presentación vendible ocupa una fila y tiene un SKU único. Por ejemplo, shampoo de 250 ml y de 500 ml son dos SKU con precio, stock e imagen propios; `codigo_grupo` permite mostrarlos como variantes de una misma familia. `presentacion` conserva un texto comercial como “Botella” o “Caja x 12”.

Supuesto inicial: SKU único en todo Samada. Si los proveedores repiten códigos, se conservará un SKU interno único y se añadirá un código de proveedor por marca; no se permitirán asignaciones de imagen ambiguas.

### Distribución y orden

- Configurar orden de marcas, categorías, subcategorías y tamaños.
- Elegir una regla de catálogo: marca → categoría → subcategoría → tamaño, o tamaño antes de categoría cuando corresponda.
- Orden ascendente/descendente para medidas; posición manual para tallas.
- Reordenar productos dentro de una selección mediante arrastre y controles accesibles.
- Orden estable: posición/regla y, ante empate, SKU.
- Página automática por reglas o página curada por selección manual. Ambas usan un límite de productos por hoja y generan todas las hojas necesarias.
- Vista previa antes de publicar. Los filtros mantienen el orden seleccionado.
- La tabla, el buscador y la revista consultan la misma información publicada.

## 4. Acceso: login, registro y recuperación

### Pantallas y flujos P0

- `/login`: correo, contraseña, mostrar/ocultar contraseña, sesión y cierre de sesión.
- `/register`: nombre, correo, contraseña y confirmación. Por defecto, registro de personal por invitación; si se habilita solicitud abierta, la cuenta queda pendiente sin permisos hasta aprobación.
- Verificación de correo y reenvío del enlace.
- `/forgot-password`: solicitar recuperación con respuesta genérica, exista o no el correo.
- `/reset-password`: enlace de un solo uso y duración limitada; guardar contraseña nueva e invalidar las sesiones anteriores.
- Mi perfil: nombre, cambio de contraseña y cierre de otras sesiones.
- Estados: invitado, pendiente de verificación, pendiente de aprobación, activo, suspendido y archivado.

Propuesta de implementación: Better Auth para identidad y sesiones, más autorización del negocio en base de datos. Login, registro y recuperación usan sus flujos existentes; los roles dinámicos del CMS se resuelven en servidor y no dependen de una lista fija en el frontend.

### CRUD de usuarios

- Crear/invitar, listar con filtros y paginación, ver detalle y editar datos.
- Asignar uno o varios roles y, si se configura, restringir acceso por marca.
- Aprobar, suspender/reactivar, archivar/eliminar según referencias y revocar sesiones.
- Reenviar invitación o recuperación sin mostrar contraseñas al administrador.
- Conservar la atribución histórica de importaciones, publicaciones y cambios de permisos.
- Proteger al último superadministrador activo y evitar que alguien amplíe sus propios privilegios.

### CRUD de roles y permisos

- Roles: crear, consultar, duplicar, editar nombre/descripción, asignar permisos y archivar/eliminar cuando no haya usuarios dependientes.
- Permisos: catálogo de claves recurso/acción, descripción, estado y asignación a roles. CRUD de definiciones personalizadas sobre recursos y acciones admitidos por el servidor.
- Las claves internas esenciales se protegen; cambiar una etiqueta no cambia su clave técnica.
- Crear un permiso con un nombre nuevo no crea una operación del backend: solo se pueden conceder acciones que el servidor reconozca y compruebe.
- Evaluación centralizada: sesión válida + usuario activo + permiso + alcance de marca. Denegación por defecto.
- Los permisos efectivos de varios roles se unen; el alcance de marca queda definido por cada asignación de rol. No se introducen reglas de denegación contradictorias en esta primera versión.
- Un administrador solo puede delegar permisos y alcances que tenga autorizados. Los cambios se auditan y surten efecto en la siguiente operación protegida.

| Módulo | Permisos iniciales |
|---|---|
| Productos | leer, crear, editar, archivar, eliminar, exportar, publicar |
| Marcas/clasificación/tamaños | leer, crear, editar, archivar, eliminar |
| Organización | leer, editar orden, previsualizar, publicar |
| Importaciones | descargar plantilla, cargar, validar, ejecutar, cancelar, consultar historial |
| Imágenes | cargar, procesar, vincular, reemplazar, eliminar |
| Usuarios | leer, invitar, crear, editar, suspender, eliminar, asignar roles, revocar sesiones |
| Roles | leer, crear, editar, eliminar, asignar permisos |
| Permisos | leer, crear definición, editar, eliminar definición |
| Ajustes y auditoría | leer ajustes, editar ajustes, consultar auditoría |

Roles de partida editables: Superadministrador, Administrador, Gestor de catálogo, Operador de carga y Consulta. Superadministrador administra seguridad; Gestor prepara y publica catálogo; Operador importa borradores y carga imágenes; Consulta tiene lectura. La matriz exacta quedará visible en el CMS y se probará por endpoint.

### Protección transversal

Cookies de sesión HttpOnly y Secure en producción, expiración y revocación; límites de intentos; validación de origen/CSRF según el mecanismo de sesión; validación de entrada y autorización en cada lectura privada, escritura y trabajo de fondo. Credenciales y secretos solo en servidor. Correo transaccional configurado para invitaciones, verificación y recuperación.

El catálogo público tendrá una API de solo lectura de datos publicados. Los endpoints de gestión no aceptarán el JSON global enviado por el navegador. El worker volverá a verificar usuario/permisos al comenzar y antes de aplicar lotes.

## 5. Plantilla Excel y CSV

Botón del CMS: **Importaciones → Descargar plantilla**. Generará un `.xlsx` actualizado con los códigos vigentes y una versión `.csv` con los mismos encabezados. La plantilla tiene una versión de esquema reconocida por el importador.

Se entrega ahora un borrador estático para revisar los campos. El generador conectado a datos reales y el importador forman parte de la implementación pendiente.

Hojas del Excel: `Instrucciones`, `Productos`, `Ejemplos`, `Campos`, `Marcas`, `Categorias`, `Subcategorias`, `Tamanos`, `MarcaCategoria`, `MarcaSubcategoria` y `MarcaTamano`. Solo `Productos` se importa como productos; `Ejemplos` es ilustrativa. Las hojas de referencia muestran relaciones y códigos válidos. Para crear taxonomías desde el mismo archivo habrá una etapa separada de propuesta y revisión con permiso propio.

Una fila representa un SKU/presentación. No se insertan fotos dentro del Excel.

| Campo | Nuevo producto | Regla |
|---|---|---|
| `sku` | Obligatorio | Texto único; conservar ceros iniciales |
| `nombre` | Obligatorio | Nombre comercial |
| `marca_codigo` | Obligatorio | Código de marca habilitada |
| `categoria_codigo` | Obligatorio | Categoría habilitada para esa marca |
| `subcategoria_codigo` | Opcional | Debe pertenecer a categoría y marca |
| `tamano_codigo` | Obligatorio | Tamaño habilitado para la marca; admite SIN-TAMANO |
| `codigo_grupo` | Opcional | Agrupa variantes; no reemplaza al SKU |
| `presentacion` | Opcional | Texto comercial adicional |
| `precio_mayorista` | Obligatorio | Decimal no negativo; sin símbolo monetario |
| `precio_sugerido` | Opcional | Decimal no negativo |
| `stock` | Opcional | Entero no negativo; por defecto 0 |
| `pedido_minimo` | Opcional | Entero >= 1; por defecto 1 |
| `unidades_caja` | Opcional | Entero >= 1; por defecto 1 |
| `descripcion` | Opcional | Texto |
| `uso` | Opcional | Texto |
| `publicado` | Opcional | SI/NO; por defecto NO |
| `destacado` | Opcional | SI/NO; por defecto NO |
| `orden` | Opcional | Entero no negativo; vacío usa orden automático |
| `moneda` | Opcional | PEN por defecto; lista de monedas configuradas |
| `imagen_archivo` | Opcional | Nombre de archivo exacto; vacío permite buscar por SKU |

### Reglas de importación

1. Seleccionar `.xlsx` o `.csv` y modo: crear, actualizar o crear/actualizar por SKU.
2. Detectar encabezados y mostrar su correspondencia; solo importar `Productos` en Excel.
3. CSV: UTF-8, detección de coma/punto y coma con confirmación del formato, comillas y decimales según formato elegido. La plantilla entregada usa punto decimal y coma delimitadora.
4. Validar tipos, columnas, SKU repetidos, relaciones marca/categoría/tamaño, precios y unidades. No evaluar fórmulas ni macros; rechazar celdas de fórmula en campos importables con un mensaje que solicite pegar valores.
5. Mostrar nuevos, actualizados, sin cambios, advertencias y errores por fila/campo. Ofrecer reporte descargable corregible.
6. Por defecto exigir archivo válido; permitir procesar solo filas válidas únicamente mediante selección explícita.
7. Aplicar desde staging, por lotes transaccionales, con progreso persistente. Si falla un lote, se reintenta sin duplicar los ya completados.
8. Historial con usuario, archivo, modo, fecha, conteos, estado y detalle de errores. Cerrar la pestaña no cancela el procesamiento.

**Actualización parcial:** SKU es obligatorio; se pueden enviar solo SKU y las columnas a cambiar. Columna ausente o celda vacía conserva el valor previo. `0` y `NO` son valores expresos. Para vaciar un campo opcional se admite la acción explícita `__BORRAR__` únicamente en campos permitidos. En modo mixto, un SKU nuevo sí debe cumplir todos los obligatorios de creación. Nunca se elimina un producto por no aparecer en el archivo.

Las relaciones nuevas se presentan para aprobación antes de crear; no se genera una marca por cada error tipográfico. Exportaciones y reportes neutralizan textos que una hoja de cálculo pueda interpretar como fórmulas.

## 6. Motor de imágenes por SKU

Flujo: **Imágenes → Cargar carpeta o archivos → Previsualizar coincidencias → Procesar → Aplicar**. Selección de carpeta cuando el navegador lo permita; selección múltiple como alternativa. La aplicación recibe archivos seleccionados, no accede a una ruta escrita del equipo.

Regla principal: `SAM-0001.jpg` → SKU `SAM-0001` → WebP principal. Se conserva el nombre lógico SKU.webp; el objeto almacenado usa una ruta versionada para evitar caché antigua. Galería opcional: `SAM-0001__01.jpg`, `SAM-0001__02.png`.

- Validar la estructura admitida del SKU: letras, números, guion, punto y guion bajo; preservar ceros iniciales. Coincidencia por nombre base sin extensión; política de mayúsculas única para productos e imágenes.
- No cambiar guiones o eliminar caracteres internos para forzar coincidencias. No usar similitud de nombres para asignar automáticamente.
- Si hay imagen explícita en Excel, buscarla de manera exacta dentro del lote y validar que no se asigne a otro SKU por accidente.
- Dos candidatos principales para un SKU, un archivo sin producto o un SKU ambiguo van a pendientes; no se sobrescriben silenciosamente.
- Resumen: coincidentes, nuevos, reemplazos, duplicados, sin SKU, sin producto e inválidos; asignación manual y descarga del reporte.
- Procesamiento de servidor con Sharp: validar contenido real y dimensiones, orientar, redimensionar sin ampliar innecesariamente, preservar transparencia y producir WebP y miniatura. El original se conserva privado según retención configurada.
- Concurrencia limitada, cargas por archivos/lotes, reintentos e identificadores idempotentes. Fallar en un archivo no elimina los demás.
- Almacenamiento de archivos independiente del JSON y del navegador; base de datos conserva SKU, objeto, checksum, tamaño, dimensiones y estado.
- Registrar quién cargó y vinculó cada imagen. Reemplazos explícitos y reversibles mientras se conserve la versión anterior.

## 7. Arquitectura propuesta

| Capa | Decisión propuesta |
|---|---|
| Interfaz | Conservar Next.js + TypeScript + Tailwind; componentes actuales adaptados |
| API | Operaciones por recurso y validación de esquemas en servidor |
| Datos | PostgreSQL con `pg` y migración SQL; precios DECIMAL, SKU e índices únicos |
| Identidad | Better Auth; correo transaccional mediante proveedor/SMTP configurado |
| Autorización | Tablas propias de roles/permisos/asignaciones/alcances y comprobación centralizada |
| Excel/CSV | ExcelJS para plantilla XLSX y lectura; parser CSV con formato explícito |
| Trabajos | Worker Node separado; cola persistente en PostgreSQL con pg-boss |
| Imágenes | Sharp y almacenamiento S3 compatible; originales privados y derivados publicados |
| Búsqueda | Índices PostgreSQL por SKU, marca, clasificación y tamaño; búsqueda textual normalizada |
| Operación | Contenedores app/worker/base de datos, copias de seguridad y recuperación probada |

No se necesita un servidor de búsqueda separado para este volumen inicial. Se medirán búsquedas antes de añadir infraestructura. pg_trgm es una opción si se requiere coincidencia parcial o tolerancia a errores.

Entidades principales: Brand, Category, Subcategory, BrandCategory, BrandSubcategory, Size, BrandSize, ProductGroup, Product, ProductImage, Catalog, CatalogSection, CatalogItem, User, Account, Session, Verification, Invitation, Role, Permission, UserRole, RolePermission, ImportJob, ImportRow, MediaJob, AuditLog. Asignaciones con alcance por marca almacenan esa restricción junto al rol.

Controles de concurrencia: versiones de registros para ediciones, validación de revisión antes de aplicar importaciones y transacciones. La API pública entrega solo proyecciones publicadas; no incluye usuarios, borradores, trabajos ni auditoría.

### Migración

1. Exportar y respaldar el JSON autoritativo del servidor y sus imágenes antes de cambiar almacenamiento; no usar automáticamente el último navegador como fuente de verdad.
2. Validar duplicados/referencias; mapear entidades existentes a claves estables y presentar conflictos.
3. Extraer imágenes base64 a archivos, conservando asociaciones.
4. Interpretar presentaciones conocidas para proponer tamaños; valores ambiguos requieren revisión, sin conversiones silenciosas.
5. Importar a staging y comparar conteos/SKU/precios/stock/imágenes/páginas con el origen.
6. Realizar cambio final con ventana de escritura controlada y copia de reversión. Desactivar la sincronización global y la antigua escritura `/api/cms`.
7. Crear el primer superadministrador por proceso de instalación seguro, sin credenciales fijas en el repositorio.

## 8. Backlog y secuencia de entrega

| Fase | Trabajo | Condición de salida |
|---|---|---|
| 0 — Respaldo y contención | Respaldar datos; proteger escritura actual; validar límites de acceso | Una llamada anónima de escritura se rechaza; respaldo verificable |
| 1 — Base y seguridad | PostgreSQL, migraciones, identidad, registro, correo, sesiones, usuarios, roles y permisos | Flujos completos y pruebas de autorización por endpoint |
| 2 — Catálogo dinámico | Relaciones por marca, CRUD de tamaños, variantes, reglas de orden | Crear dos presentaciones y ordenarlas por medida real |
| 3 — Excel y CSV | Plantilla dinámica, staging, validación, vista previa, worker, historial | Importar y actualizar 1.500 SKU sin duplicados |
| 4 — Imágenes | Carpeta/múltiples archivos, coincidencias, Sharp, almacenamiento, reportes | Asociar lote por SKU y aislar duplicados/sin coincidencia |
| 5 — Distribución pública | Paginación completa, filtros por tamaño, publicación y optimización de Turn.js | Todos los productos publicados son alcanzables y conservan orden |
| 6 — Entrega | Pruebas integrales, migración final, restauración, guía de operación | Recorrido completo validado con muestra del negocio |

Estimación de planificación: aproximadamente 4–6 semanas de trabajo de una persona dedicada, condicionada al servidor, correo, datos de muestra y revisión del negocio. No es un compromiso de fecha ni cotización. La estimación se ajusta tras la fase 0.

P0: fases 0–6 y todos los requisitos expresos. P1 posterior: MFA para administradores, deshacer masivo con detección de conflictos, galerías avanzadas, plantillas guardadas de mapeo y programación de importaciones. No se promete reversión global automática de una importación ya aplicada en la primera entrega; sí trazabilidad y recuperación controlada.

El registro de compradores/distribuidores y sus cuentas comerciales, pagos, facturación, conexión ERP y extracción por IA de fichas no forman parte de este plan inicial de administración de catálogo.

## 9. Pruebas de aceptación

- Login válido/incorrecto; verificación; aprobación; suspensión; logout; sesión vencida; recuperación válida, vencida y reutilizada.
- El usuario pendiente no obtiene acceso al CMS. Alterar un rol en el cliente no concede permisos.
- CRUD de usuarios/roles/permisos, protección del último superadmin, delegación limitada y revocación efectiva.
- Usuario con acceso a una marca no puede leer/escribir datos privados ni importar imágenes de otra.
- SKU `000123` conserva ceros en Excel, CSV, base de datos y nombre de imagen.
- `250 ml < 500 ml < 1 L`; `250 g` no se intercala como si fueran ml; tallas siguen su orden manual.
- Categoría incompatible con marca y subcategoría incompatible se rechazan en API e importador.
- Archivo de 1.500 filas; duplicados internos; actualización parcial; archivo vacío; separadores; precios inválidos; fórmulas; versión de plantilla incompatible.
- Cargar dos veces el mismo trabajo y reanudar tras interrupción no duplica productos ni imágenes.
- Edición concurrente después de la vista previa genera conflicto revisable, no sobreescritura silenciosa.
- Imagen inexistente, archivo corrupto, nombre ambiguo y dos imágenes principales aparecen en pendientes.
- Reemplazo de imagen respeta permisos y actualiza su versión publicada sin caché antigua.
- Revista con más de siete productos por sección muestra todas las hojas; filtros repetidos no generan `removeChild`.
- El catálogo público no hace POST de estado al navegar y no expone datos de usuarios ni borradores.
- Copia de seguridad restaurada en un entorno separado y comparación de conteos/asociaciones.

Objetivos de rendimiento propuestos para medir en staging: búsqueda con 1.500 SKU en menos de 500 ms p95 de servidor, excluyendo red del cliente; listados paginados de 50 elementos; proceso masivo sin bloquear la navegación. Tiempo de conversión de imágenes se medirá con archivos reales y recursos del servidor, sin prometer un plazo fijo por lote.

## 10. Supuestos y decisiones pendientes

Supuestos aplicados: marca admite varias categorías; categorías reutilizables; un tamaño por SKU; moneda inicial PEN; productos nuevos en borrador; registro con verificación y aprobación, además de invitación administrativa; actualización de stock reemplaza el valor absoluto, no suma inventario.

Antes de producción el negocio debe confirmar: unicidad global de SKU, reglas reales de presentación/orden, política de registro abierto o invitación, matriz de permisos y personas responsables. Infraestructura debe aportar: acceso al entorno de destino, base de datos, almacenamiento, remitente de correo y configuración DNS correspondiente. Las credenciales se configurarán como secretos del entorno.

## 11. Referencias verificadas

Las herramientas siguientes son propuestas; se fijarán versiones compatibles y revisadas durante implementación.

- [Better Auth: email, registro y recuperación](https://better-auth.com/docs/authentication/email-password).
- [Better Auth: administración de usuarios y control de acceso](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/admin.mdx). Los roles dinámicos del negocio requieren el modelo adicional descrito en este plan.
- [ExcelJS: repositorio oficial](https://github.com/exceljs/exceljs).
- [Sharp: salida WebP](https://sharp.pixelplumbing.com/api-output/).
- [pg-boss: trabajos en PostgreSQL](https://github.com/timgit/pg-boss).
- [PostgreSQL: pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html).
