# CONTEXTO COMPLETO — DUPPLA APP (panel de gestión interno)
> Documento de handoff para cualquier instancia de Claude (o de otra IA) que trabaje sobre este proyecto — incluyendo la de Ángel, cofundador de Duppla junto con Jerónimo. Escrito para que una IA lo lea antes de tocar código.
>
> **Última actualización:** agosto 2026, tras una sesión larga de trabajo con Claude Code que agregó ~25 funcionalidades y arregló varios bugs reales (ver secciones 9 y 11).

---

## 0. CÓMO USAR ESTE DOCUMENTO
1. Este archivo es contexto funcional y arquitectónico, **no** un reflejo línea por línea del código. Ante cualquier duda, la fuente de verdad es el `index.html` real del repo — léelo antes de asumir nada de aquí.
2. El **único** `index.html` válido es el que vive en la carpeta de este repo clonado. Nunca trabajar sobre copias sueltas (Descargas, escritorio, etc.) — causaron sobrescrituras del código bueno en el pasado. Si por alguna razón tienes el proyecto en más de una carpeta, verifica con `git remote -v` y `git log -3` cuál es la real antes de editar.
3. Validar SIEMPRE la sintaxis del `<script type="module">` con `node --check` antes de commitear (extraer el contenido del script a un `.mjs` temporal y correr `node --check` sobre eso — el archivo completo es HTML, no JS puro).
4. Antes de commitear, revisar `git diff --stat`: un fix normal cambia decenas de líneas, no miles. Un diff con miles de borrados es señal de que se está sobrescribiendo el archivo bueno con uno viejo — **frenar**.
5. Este proyecto NO usa build tools (no React, no Vite, ignora el `README.md` genérico que quedó de un scaffold viejo). Es un solo `index.html` de ~9000 líneas con HTML+CSS+JS vanilla en un `<script type="module">`. Los cambios se hacen directo sobre ese archivo.

---

## 1. QUÉ ES ESTO
App interna de gestión para **DUPPLA**, negocio de suplementos deportivos (retail + distribución mayorista) cofundado por **Jerónimo "Jero" Arroyave Llano** y **Ángel Certuche Garay**, con sede en Medellín/Guarne, Colombia. Ambos socios usan la misma app, cada uno con su propio login, y tienen stock físico separado (ver sección 8).

Comunicación interna: español colombiano informal, directo. El tuteo/voseo de marca de Duppla (marketing al cliente) es un tema aparte — no aplica a esta app interna.

---

## 2. STACK TÉCNICO
| Componente | Detalle |
|---|---|
| Frontend | HTML + JavaScript vanilla, **un solo archivo** `index.html` (~9000 líneas) |
| Backend | Firebase Firestore (NoSQL, tiempo real vía `onSnapshot`) |
| Auth | Firebase Auth (email/password) |
| Hosting | Vercel — `duppla-app.vercel.app` |
| Repo | GitHub `jeronimollano1808/duppla-app`, branch `main` |
| Deploy | Push a `main` → Vercel auto-despliega en ~2 min. **No hay ambiente de staging** — todo push a main es producción. |
| Fuente / color de marca (app) | Inter (Google Fonts) / verde lima `#C8E05A` |
| Formato moneda | Peso colombiano sin decimales: `$110.000` |

### Firebase config (proyecto: dupplafitness)
El config de Firebase (`apiKey`, `authDomain`, `projectId`, etc.) está **embebido directamente en `index.html`** — es la config pública del SDK cliente, no un secreto (la seguridad real la dan las reglas de Firestore + Firebase Auth, no ocultar esa config). Cualquiera que clone el repo ya tiene todo lo necesario para correr la app apuntando al mismo proyecto Firebase compartido — **no hace falta pedir ni copiar credenciales de Firebase por separado.**

### 🔐 Sobre tokens y credenciales — IMPORTANTE para cualquier IA que trabaje aquí
- **Nunca** guardar tokens de GitHub, contraseñas de Firebase Auth, ni ningún secreto en texto plano en este documento ni en el código.
- La autenticación con GitHub para hacer `git push` se hace **localmente en la máquina de cada persona** (`gh auth login` o el flujo de credenciales de git del sistema operativo) — cada quien (Jero, Ángel) autentica la suya. Una IA nunca debe manejar ni pedir el token de otra persona.
- Login a la app en vivo (Firebase Auth) es un usuario/contraseña normal — cada socio tiene el suyo, no se comparten.

### Deploy (flujo con Claude Code / git)
1. Editar `index.html` en la carpeta del repo clonado.
2. Validar: `node --check` sobre el contenido del script.
3. `git add index.html && git commit -m "..." && git push` → Vercel auto-despliega.
4. Verificar en `duppla-app.vercel.app` con **Cmd+Shift+R** (salta caché).
5. Por convención de esta sesión: cada feature/fix va en su **propio commit** (no todo junto en uno gigante), aunque se hayan pedido varios cambios en la misma conversación. Si varios cambios quedan entrelazados en las mismas funciones y no se pueden separar limpio por líneas, se documentan juntos en un commit y se explica por qué en el mensaje.

---

## 3. ESTRUCTURA DE DATOS (Firestore)
```js
let DATA = {
  ventas:[], inventario:[], gastos:[],
  proveedores:[], pedidos:[], metas:[],
  notificaciones:[], combos:[],
  consumos:[], distribuidores:[],
  cierres:[], tiendasConsignacion:[], consignaciones:[],
  gastosRecurrentes:[],  // plantillas de gasto fijo mensual (nuevo, ver sección 9)
  papelera:[]            // registros eliminados, recuperables 7 días (nuevo, ver sección 9)
};
```

### `ventas`
| Campo | Notas |
|---|---|
| `fecha` | string `YYYY-MM-DD` — **usar siempre `fechaLocal()`/`today()` para generarla, nunca `.toISOString()`** (ver bug crítico, sección 11) |
| `canal` | `'web'\|'directo'\|'distribuidor'` |
| `producto` | nombre legible |
| `prodId` | id en inventario; null si manual |
| `esManual` | bool — producto fuera de catálogo |
| `esMultiple` | bool — venta con varios productos |
| `productosVenta` | array si esMultiple: `[{prodId,nombre,cant,precio,tipoPrecio,costoUnit,ubicacionStock,loteConsumo,esManual}]`. `esManual:true` en una línea = producto fuera de catálogo dentro de una venta mixta (ver sección 9, Ventas). |
| `esCombo` | bool, `productosCombo` = detalle |
| `esDeConsignacion` | bool — venta generada desde consignación. `consignacionIds` (array) — entregas de consignación consumidas por esta venta (FIFO, puede ser más de una). |
| `cant`, `precio`, `total` | number |
| `costoUnit` | costo histórico al momento de la venta (FIFO si aplica) |
| `loteConsumo` | de qué lotes exactos salió |
| `cliente` | string libre (no hay tabla de clientes formal, se agrupa por este texto) |
| `tipoPrecio` | `'publico'\|'distribuidor'\|'especial'\|'varios'` |
| `metodoPago` | `'efectivo'\|'transferencia'\|'mixto'` + `mixtoEfectivo`/`mixtoTransferencia` |
| `pagado`, `saldo` | number — **saldo es fuente de verdad**, usar `saldoReal(v)` = `Math.round(v.saldo||0)` |
| `estadoPago` | `'pagado'\|'parcial'\|'pendiente'` — no confiar ciegamente, verificar saldo |
| `abonos` | array `[{valor,fecha,metodoPago,nota}]` |
| `distribuidorId` | string\|null |
| `ubicacionStock` | `'jero'\|'angel'` |

**Ingreso reconocido:** usar SIEMPRE `ingresoVenta(v) = Math.max(Number(v.total||0), Number(v.pagado||0))` para agregaciones de ingreso (dashboard, ventas, metas, canales, clientes, distribuidores, consignación, cierres) — si el cliente paga de más, el sobrante cuenta como ingreso real. **Nunca** usar `ingresoVenta` para cálculos de costo/margen por producto — esos siguen usando `total` (`calcularMargenVenta`).

### `inventario`
| Campo | Notas |
|---|---|
| `nombre`, `marca` | marca es texto libre con datalist |
| `stock` | **SIEMPRE fuente de verdad del total** |
| `stockJero`, `stockAngel` | desglose por ubicación — informativo, nunca bloquea ventas. `construirUpdateStockUbicacion()` autocorrige desincronización. Al editar reduciendo el stock total, si el faltante deja a Jero en negativo, el resto se descuenta de Ángel (fix aplicado — antes se truncaba a 0 sin tocar Ángel, desincronizando el total). |
| `costo` | precio de compra (o promedio ponderado si tiene lotes) |
| `pventa`, `pdist`, `pesp` | precios público 🔵, distribuidor 🟠, especial 🟢 |
| `stockMinimo` | alerta stock bajo |
| `lotes` | array FIFO: `[{id, cantidad, cantidadDisponible, costoUnitario, fecha, proveedor}]` |
| `duracionDias` | **nuevo** — cuántos días dura UNA unidad tomándola a diario (ej: 30). 0/vacío = no aplica. Alimenta el recordatorio de recompra (ver sección 9, Clientes). |

### `distribuidores`
`nombre`, `tipo` (`'gimnasio'|'persona'|'tienda'`), `telefono`, `ciudad`, `notas`. Historial calculado en vivo filtrando `DATA.ventas` por `distribuidorId`.

### `proveedores`
`nombre`, `pais`, `contacto`, `email`, `wa`, `notas`. **Ahora también** (nuevo): la página Proveedores muestra total comprado histórico, saldo pendiente (cuentas por pagar, ver `pedidos`) e historial de pedidos expandible, calculado en vivo filtrando `DATA.pedidos` por `proveedorId` — mismo patrón que Distribuidores con Ventas. Botón de recordatorio de pago por WhatsApp si hay saldo pendiente (reutiliza `modal-recordatorio`).

### `pedidos`
`proveedorId`, `proveedorNombre`, `fecha`, `productosPedido` (`[{prodId,nombre,cant,costo}]`), `prods` (texto libre), `total`, `flete`, `notas`, `estado` (`'pendiente'|'transito'|'recibido'|'cancelado'`).

**Nuevo — pago y cuentas por pagar:** `pagado`, `saldo` (igual patrón que ventas). Al crear un pedido, se pregunta si se pagó completo / abonó parte / quedó a crédito (los pedidos a proveedor se pagan por anticipado normalmente). El pedido **genera automáticamente un gasto** (categoría "Importación") por el valor `pagado` (no por el `total` — si queda saldo, es cuenta por pagar). Si queda saldo, aparece en Pedidos con botón "💰 Abonar" (`abrirAbonoPedido`/`guardarAbonoPedido`), que crea un gasto adicional marcado `esAbonoPedido:true` al pagar el resto (para no confundirlo con el gasto original al editar el pedido — `guardarPedido` busca el gasto vinculado con `!g.esAbonoPedido`).

**Editar pedidos:** ahora se puede (`editarPedido`), reutilizando el mismo modal de crear. Si el pedido ya generó su gasto de Importación, se sincroniza el valor al editar. Si el pedido ya está "Recibido", se avisa que los lotes/stock ya procesados no se tocan (no hay reversión automática de `procesarRecepcionPedido`).

Al marcar `estado='recibido'`: `procesarRecepcionPedido()` crea lotes FIFO automáticamente. Guard de idempotencia (no reprocesa si ya estaba recibido).

### `metas`
`mes` (`YYYY-MM`), `ventasMeta`, `gastoMax`, `diaInicio` (día de CORTE del ciclo — Duppla usa **3**), `notas`.

### `gastos`
`fecha`, `cat` (`importacion|marketing|logistica|plataformas|operativo|otro`), `desc`, `valor`. Campos opcionales de trazabilidad: `pedidoId` (si nació de un pedido), `esAbonoPedido` (si es un abono posterior), `gastoRecurrenteId` (si nació de una plantilla recurrente).

### `gastosRecurrentes` (nuevo)
Plantillas de gasto fijo mensual (arriendo, nómina, suscripciones): `desc`, `valor`, `cat`, `activo` (bool, se puede pausar sin borrar), `ultimoMesGenerado` (string `YYYY-MM`, evita duplicar). `generarGastosRecurrentesDelCiclo()` revisa las plantillas activas y crea el gasto del ciclo actual (día 4) para las que no lo tengan — se dispara cuando cambia la colección, con un guard anti-condición-de-carrera (`generandoRecurrentes`) para no duplicar si hay varias plantillas pendientes a la vez.

### `consignaciones`
`tiendaId`, `tiendaNombre`, `prodId`, `prodNombre`, `cantidadInicial`, `cantidadActual`, `costoUnit`, `precioSugerido` (precio distribuidor, editable, precargado de `prod.pdist`), `fecha`, `historialMovimientos: [{tipo:'venta'|'devolucion'|'reposicion', cantidad, fecha, ...}]`.

- **Cada "dejar producto" agrega a una entrega existente si coincide tienda+producto+precio** (nuevo — antes SIEMPRE creaba un documento separado, incluso repitiendo mismo producto/tienda/precio, lo que llenaba la lista de filas redundantes). Si el precio difiere, sí crea una entrega nueva (para no perder el costo FIFO por tanda cuando el costo/precio realmente cambió). Al fusionar, el costo queda como promedio ponderado entre lo que ya había disponible y lo nuevo.
- Al dejar: descuenta stock Duppla (FIFO), NO genera venta/ingreso.
- **Reportar venta:** trabaja a nivel producto+tienda, sumando todas las entregas activas y consumiendo FIFO entre ellas (la más antigua primero), generando UNA venta con costo promedio ponderado. Ahora pregunta el **estado de pago** (completo/parcial/crédito, igual que Pedidos) — antes se asumía siempre pago completo, por lo que una venta de consignación a crédito nunca aparecía en Deudores. Al quedar saldo, sí aparece en Deudores y admite abonos normales.
- **Editar una entrega individual** (`abrirEditarConsignacion`/`guardarEditarConsignacion`): corrige fecha, cantidad inicial, cantidad actual, costo, precio de una entrega específica. Si la cantidad inicial cambia, se ajusta el stock de Duppla por la diferencia (con vista previa antes de guardar). Botones "usar actual" junto a costo/precio para traer el valor vigente del producto en Inventario sin escribirlo a mano (solo se muestran cuando el campo ya no coincide con el valor actual).
- **Eliminar una entrega individual**: pasa por la Papelera (ver sección 9) — si le quedaba cantidad sin vender, esa cantidad se devuelve al inventario de Duppla al confirmarse el borrado; lo ya vendido (registrado como venta real) no se toca.
- En el render, las entregas del mismo producto se agrupan en una sola fila resumen, y cada entrega individual se lista debajo con su propio botón editar/eliminar.

### `tiendasConsignacion`
`nombre`, `telefono`, `ciudad`, `notas`.

### `cierres`
Snapshots mensuales inmutables: `mes`, `ingresos`, `gastos`, `margen`, `numVentas`, `inventarioValorizado`, `fechaCierre`.

### `consumos`
Retiros internos de Ángel y Jero — **NO cuenta en ingresos/utilidad**. `quien` (`'jero'|'angel'`), `prodId`, `nombre`, `cant`, `costoPorUnidad`, `total`, `fecha`.

### `papelera` (nuevo)
`coleccion` (nombre de la colección original), `datos` (copia completa del documento borrado, incluyendo su `id` original), `createdAt`. Se purga sola a los 7 días (`limpiarPapeleraVieja()`, con guard anti-condición-de-carrera `limpiandoPapelera`).

---

## 4. MENÚ Y NAVEGACIÓN
```js
const MENU = [
  { id:'dashboard',      label:'Dashboard',      ico:'📊', group:'Principal' },
  { id:'ventas',         label:'Ventas',          ico:'🛒', group:'Negocio' },
  { id:'inventario',     label:'Inventario',      ico:'📦', group:'Negocio' },
  { id:'clientes',       label:'Clientes',        ico:'👥', group:'Negocio' },
  { id:'distribuidores', label:'Distribuidores',  ico:'🏋️', group:'Negocio' },
  { id:'gastos',         label:'Gastos',          ico:'💸', group:'Negocio' },
  { id:'proveedores',    label:'Proveedores',     ico:'🚚', group:'Operaciones' },
  { id:'pedidos',        label:'Pedidos',         ico:'📋', group:'Operaciones' },
  { id:'metas',          label:'Metas',           ico:'🎯', group:'Operaciones' },
  { id:'combos',         label:'Combos',          ico:'🎁', group:'Operaciones' },
  { id:'deudores',       label:'Deudores',        ico:'💳', group:'Negocio' },
  { id:'consignacion',   label:'Consignación',    ico:'🏪', group:'Negocio' },
  { id:'papelera',       label:'Papelera',        ico:'🗑️', group:'Operaciones' }, // nuevo
];
```
Badges dinámicos en el menú: **Deudores** (rojo, # en mora ≥8 días) y **Clientes** (azul, # con recompra próxima) — se actualizan en `buildNav()` cada vez que cambian ventas o inventario.

---

## 5. CONSTANTES Y HELPERS GLOBALES CLAVE
```js
// 646. FIX CRÍTICO — leer antes de tocar cualquier fecha (ver sección 11)
function fechaLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
const today = () => fechaLocal(new Date());
// NUNCA usar new Date().toISOString().slice(0,10) ni .slice(0,7) para fechas
// locales — toISOString() convierte a UTC y en Colombia (UTC-5) de noche
// (desde ~7pm) esto corre la fecha al día siguiente (o al mes siguiente si
// es fin de mes). Todo cálculo de "fecha de hoy" o "mes actual" debe pasar
// por fechaLocal(), nunca por toISOString().

function saldoReal(v) { return Math.round(Number(v?.saldo||0)); }
// Fuente única de verdad para saldo. Nunca v.saldo===0 ni v.saldo>0 directo.

function ingresoVenta(v) { return Math.max(Number(v?.total||0), Number(v?.pagado||0)); }
// Fuente única de verdad para INGRESO reconocido (ver sección 3). Nunca usar
// en cálculos de costo/margen por producto.

function calcularMargenVenta(v) { ... }
// Fuente única de verdad del margen. total - costoTotal (usa v.total, NO
// ingresoVenta). Con fallback al costo actual del inventario.

function calcularDeudores() { ... }
// Agrupa ventas con saldo>0 por cliente, calcula días de mora
// (UMBRAL_MORA_DIAS=8). Única fuente para Deudores, el badge del menú, el
// banner del Dashboard y el aviso automático diario (chequearAlertaMoraDiaria,
// dedupe por localStorage 'duppla_alerta_mora_fecha').

function calcularRecompras() { ... }
// Para cada cliente+producto (la compra MÁS RECIENTE si repite), si el
// producto tiene duracionDias configurada, calcula cuándo se le debe estar
// acabando: empieza a consumir al día siguiente de la compra, dura
// cant×duracionDias días. UMBRAL_RECOMPRA_DIAS=5. Alimenta el badge de
// Clientes, el banner del Dashboard y la sección "Recompras próximas"
// dentro de Clientes (con recordatorio de WhatsApp).

function calcularRangoMeta(mesStr, diaInicio) { ... }
// Rango { inicio, fin } del ciclo. Tres regímenes según el mes respecto a
// la transición de convención (ver sección 6).

function consumirLotesFIFO(prod, cantidad) { ... }
function construirUpdateStockUbicacion(prod, cantDescontar, ubicacion) { ... }
// Sin cambios de fondo — ver CONTEXTO original si hace falta el detalle.

async function restaurarStockVenta(venta) { ... }
async function restaurarStockConsignacion(item) { ... }
// Restauran stock al eliminar (papelera) — restaurarStockVenta cubre venta
// simple/múltiple/combo (antes solo cubría venta simple, dejando el stock
// mal en múltiples/combos al borrar). restaurarStockConsignacion devuelve
// SOLO cantidadActual (lo no vendido) al borrar una entrega. Ambas parchan
// también DATA.inventario en memoria (mismo patrón que
// procesarRecepcionPedido) para no depender del round-trip de onSnapshot
// cuando se necesita el stock ya actualizado en la MISMA función (ej: editar
// una venta múltiple valida stock disponible justo después de restaurar).
```

---

## 6. CICLO DE MES (sin cambios de convención, pero con el fix de zona horaria de la sección 11)
El "mes" de Duppla NO es el mes calendario, tiene tres regímenes según la fecha respecto a `DUPPLA_MES_TRANSICION = '2026-06'` (ver comentarios en `calcularRangoMeta`, sección 5). Esto **no cambió** esta sesión — lo que cambió es que el cálculo de "qué día es hoy" para decidir en qué ciclo caemos ahora usa `fechaLocal()` en vez de `.toISOString()`, porque el bug de zona horaria (sección 11) hacía que de noche, cerca de fin de mes, la app calculara mal el ciclo activo.

**Página Ventas tiene su propio filtro de ciclo** (`ventasPeriodo`: 'mes'/'mes_anterior'/'todo', botones arriba de la tabla) — por defecto muestra solo el ciclo actual ("la hoja arranca en 0 cada mes"), sin afectar Clientes/Distribuidores/Deudores/Metas/Proveedores, que siguen leyendo todo el historial sin filtrar.

---

## 7. SISTEMA DE LOTES FIFO — sin cambios de fondo
Ver CONTEXTO original si hace falta el detalle de `consumirLotesFIFO`/lotes. Sigue igual.

---

## 8. STOCK POR UBICACIÓN (JERO/ÁNGEL) — sin cambios de fondo, un fix
Mismo diseño de siempre (`stock` total es fuente de verdad, Jero/Ángel es desglose informativo). **Fix aplicado esta sesión:** al editar un producto reduciendo el stock total, si el faltante deja a Jero en negativo, el resto ahora se descuenta de Ángel — antes se truncaba Jero a 0 sin tocar Ángel, dejando `stockJero+stockAngel` desincronizado del stock total real.

---

## 9. FUNCIONALIDADES — AGREGADAS/CAMBIADAS ESTA SESIÓN
(Todo lo de la sección 9 del CONTEXTO original sigue vigente salvo lo indicado aquí.)

- **Ventas:**
  - El modal "Nueva venta" ahora permite **mezclar productos de catálogo con productos manuales** en la misma venta múltiple (antes era todo-catálogo o todo-manual, sin poder combinar). Cada línea tiene un enlace "No está en el catálogo — agregarlo manual".
  - **Editar una venta múltiple ya no está bloqueado** — antes el selector de producto y la cantidad quedaban deshabilitados. Ahora reutiliza el modal de "Nueva venta" con las líneas precargadas (`editarVentaMultiple`), permitiendo cambiar producto/cantidad/precio de cualquier línea. Al guardar, se restaura el stock de la venta original antes de descontar el nuevo (mismo nivel de precisión que la Papelera: el stock TOTAL siempre queda correcto, pero no reconstruye los lotes FIFO exactos que se habían consumido).
  - Filtro de ciclo (ver sección 6).
  - Tooltip explicando la diferencia entre "Utilidad neta" (todos los gastos, incluye pedidos completos apenas se crean) y "Ganancia bruta" (solo costo de lo ya vendido) — importante ahora que los pedidos generan gasto automático, para no confundir un mes de compras grandes con una pérdida.

- **Inventario:** nuevo campo `duracionDias` ("Duración por unidad (días)") — alimenta el recordatorio de recompra.

- **Clientes:** nueva sección "🔄 Recompras próximas" — clientes a quienes se les debe estar acabando (o ya se les acabó) un producto con `duracionDias` configurada, con botón de recordatorio de WhatsApp (mensaje pre-armado editable, mismo patrón que Deudores).

- **Distribuidores:** sin cambios de fondo esta sesión.

- **Proveedores:** ver sección 3 — ahora tiene historial de pedidos, saldo pendiente y recordatorio de pago, igual tratamiento que Distribuidores.

- **Pedidos:** ver sección 3 — editar pedidos, estado de pago (completo/parcial/crédito), gasto automático de Importación, cuentas por pagar con botón Abonar.

- **Gastos:** nueva sección "🔁 Gastos recurrentes" (ver sección 3). Fix: el selector de categoría en "Registrar gasto" no se reseteaba al abrir el modal para uno nuevo (quedaba con la categoría del último gasto editado).

- **Combos:** nueva tarjeta "🏆 Combos más rentables" (ranking por ingresos/margen, mismo componente que el Top 5 de Ventas/Dashboard).

- **Deudores:** badge en el menú lateral, banner en el Dashboard, y aviso automático (toast + notificación del navegador) una vez al día al abrir la app si hay deudores en mora.

- **Consignación:** ver sección 3 en detalle — estado de pago real, fusión de reposiciones al mismo precio, editar/eliminar entrega individual, botones "usar actual", valor de venta vs. costo mostrados por separado (antes solo se veía el de costo, sin etiqueta, y se confundía con el de venta).

- **Papelera (nueva página):** cualquier `eliminarDoc(col, id)` en toda la app ahora, en vez de borrar directo:
  1. Da 6 segundos con un banner "Deshacer" antes de confirmar el borrado.
  2. Al confirmarse (o si cierras la pestaña antes de que pase el tiempo), copia el documento a la colección `papelera` y AHÍ SÍ lo borra de la colección original.
  3. Queda visible en la página Papelera por 7 días, con botones "↩️ Restaurar" (recrea el documento con el MISMO id original vía `setDoc`, para que otras colecciones que lo referencien por id — ej. `pedidoId` en gastos — lo sigan encontrando) y "Eliminar definitivo".
  4. Pasado el plazo se purga sola.
  - Para `ventas` y `consignaciones`, el borrado también restaura el stock correspondiente ANTES de moverlo a la papelera (ver `restaurarStockVenta`/`restaurarStockConsignacion`, sección 5) — **ojo:** restaurar desde la papelera DESPUÉS no vuelve a descontar ese stock automáticamente, hay que ajustarlo a mano si se restaura un registro viejo.

- **Backup completo:** botón "⬇️ Backup completo" en el menú lateral (abajo, junto a Cerrar sesión) — descarga un JSON con TODAS las colecciones (antes solo Ventas tenía exportación CSV/PDF).

---

## 10. CONVENCIONES DE CÓDIGO
- **Comentarios numerados secuenciales** en español — van por encima de 656 ahora (el bloque de esta sesión llegó hasta ~654; súmale margen si vuelves a trabajar aquí). NUNCA reiniciar la numeración.
- Validar SIEMPRE con `node --check` antes de subir (extraer el script a un `.mjs` temporal primero).
- HTML dinámico: concatenación de strings con escape correcto de comillas en `onclick`. NO template literals anidados con comillas mixtas.
- Estado UI en **variables globales JS** — nunca en el DOM.
- Búsquedas filtran filas del DOM (`tr.style.display`) — NO re-renderizan (para no perder foco en móvil).
- `saldoReal(v)` / `ingresoVenta(v)` — fuentes únicas de verdad, usarlas siempre en vez de leer `v.saldo`/`v.total` directo para esos propósitos.
- `stock` total siempre fuente de verdad para validar ventas — Jero/Ángel solo informativo.
- `fechaLocal(d)` / `today()` — fuente única de verdad para fechas locales. Nunca `.toISOString()` para eso (ver sección 11).
- Modales reutilizados entre crear/editar (patrón usado en Pedidos, Gastos, Ventas, Consignación esta sesión): un campo oculto con el id en modo edición (`v-edit-id`, `pe-id`, `g-id`, `ec-id`...), título y texto del botón dinámicos, y la función de guardar bifurca `if(editId) updateDoc(...) else addDoc(...)`.
- Al eliminar cualquier cosa: usar `eliminarDoc(col, id)` genérico (pasa por la Papelera) — nunca `deleteDoc` directo salvo dentro de la propia lógica de la Papelera.

---

## 11. BUGS HISTÓRICOS A NO REPETIR
1. **IDs duplicados en tablas**: confirmar unicidad con `grep` antes de crear IDs.
2. **Focus perdido en buscadores**: nunca `renderX()` en `oninput`; filtrar filas del DOM.
3. **Foco incorrecto con múltiples líneas**: usar `querySelector('[data-idx="i"]')`, no índices posicionales.
4. **Saldo flotante**: siempre `saldoReal()` / `Math.round()` antes de comparar o sumar saldos.
5. **Stock Jero/Ángel desincronizado**: validar ventas solo por `prod.stock`; al reducir stock total, si Jero queda negativo, descontar el resto de Ángel (no truncar a 0 sin más).
6. **Comillas en onclick con concatenación**: usar `'\'' + variable + '\''`. Validar con `node --check`.
7. **Fallback de ubicación roto**: verificar `prod.stockJero != null` antes de decidir ubicación.
8. **Sobrescritura del archivo bueno**: trabajar solo sobre el `index.html` del repo clonado, nunca copias sueltas.
9. **`.toISOString()` para fechas locales — BUG CRÍTICO real, ya arreglado pero fácil de reintroducir.** `new Date().toISOString()` convierte a UTC. En Colombia (UTC-5), de noche (desde ~7pm) esto corre la fecha calculada al día siguiente, y si es fin de mes, al MES siguiente. Causó que "Este mes" en Ventas (y Dashboard, Metas, gastos recurrentes, proyección de reposición) mostrara vacío de noche cerca de fin de mes — los datos seguían intactos, era solo el cálculo de fecha. **Regla: cualquier fecha "de hoy" o derivada de `new Date()` para uso LOCAL (comparar contra `v.fecha`, decidir el mes/ciclo actual, etc.) debe pasar por `fechaLocal()`, nunca por `.toISOString()`.** Dates construidos explícitamente a medianoche local vía `new Date(año, mes, día)` SÍ son seguros de formatear con `.toISOString()` (no tienen componente de hora que se corra), pero usa `fechaLocal()` de todas formas por consistencia — es más fácil de auditar que recordar cuál Date es "seguro".
10. **`itemsActivos.length` ≠ número de productos distintos** (Consignación): una tienda puede tener varias entregas activas del mismo producto agrupadas en una fila — contar documentos no es contar productos. Usar `new Set(items.map(c => c.prodId)).size` cuando se necesite el conteo de productos distintos.
11. **Eliminar una venta múltiple o de combo no restauraba el stock** (solo funcionaba en ventas simples de catálogo) — ahora `restaurarStockVenta` cubre los 3 tipos. Si se agrega un tipo de venta nuevo en el futuro, hay que sumarlo ahí también.
12. **El selector de categoría en modales de creación puede quedar "pegado"** al último valor editado si el modal no resetea explícitamente el campo al abrir en modo "crear nuevo" (pasó con la categoría de Gastos) — revisar el flujo de apertura de cualquier modal reutilizado entre crear/editar.

---

## 12. PENDIENTES ACTIVOS
Ninguno heredado del documento anterior — los dos ítems pendientes de la versión previa de este documento (fix de reporte de consignación multi-entrega, e `ingresoVenta`) **ya se implementaron y desplegaron** esta sesión, junto con todo lo listado en la sección 9.

Limitaciones conocidas, no bugs, a tener presente:
- **Restaurar un registro desde la Papelera no reconstruye lotes FIFO exactos** ni vuelve a aplicar automáticamente el stock/gasto que ya se había revertido al eliminarlo — el stock TOTAL queda siempre correcto, pero un restore de algo con más de unos días puede necesitar un ajuste manual de todas formas.
- **Editar una venta múltiple** tiene la misma limitación de precisión de lotes FIFO que la Papelera (ver sección 9).
- **Ningún cliente de venta al público (no distribuidor) tiene teléfono guardado en la app** — los recordatorios de WhatsApp (cobro y recompra) requieren escribir el número a mano cada vez. Los proveedores/distribuidores sí tienen `wa`/`telefono` y se precarga solo.
- **No hay roles/permisos diferenciados entre Jero y Ángel** — ambos ven y pueden editar todo con su propio login. No hay registro de "quién hizo qué" (sin auditoría por usuario).

---

## 13. CONTEXTO DE NEGOCIO
- Tres niveles de precio: público (retail), distribuidor (mayoristas/gimnasios/tiendas en consignación), especial (clientes frecuentes).
- Jero y Ángel son los dos usuarios de la app, cada uno con su propio login y su propio stock físico (Jero/Ángel en Inventario).
- Moneda: pesos colombianos (COP), sin decimales.
- La app **no cuenta `consumos`** (retiros internos) como ingresos ni utilidad.
- Ciclo de negocio: ver sección 6 (convención del día 3, con el fix de zona horaria de la sección 11).
- Los pedidos a proveedor normalmente se pagan por anticipado — por eso generan gasto automático al crearse (ver sección 3/9).

---
*Fin del documento. Para retomar el trabajo (Jero o Ángel, con cualquier instancia de Claude): clonar el repo, abrir la carpeta con Claude Code, y este archivo se carga solo como contexto. Verificar cualquier duda contra el `index.html` real antes de asumir algo de aquí — el código es la fuente de verdad, este documento es el mapa.*
