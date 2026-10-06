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

## 14. SESIÓN AGOSTO 2026 (con Ángel) — INICIO, GASTOS FIJOS Y FIX DE DISTRIBUIDORES

### 14.1 Fix crítico: canal y distribuidor "pegados" entre ventas (comentarios 657–660)
`abrirModalVenta` reseteaba fecha/producto/pagado pero **no** `v-canal`, `v-cliente`, `v-nota` ni `v-dist-id`. Como el grupo de distribuidor solo se OCULTA (`display:none`) y `guardarVenta` leía el select sin mirar el canal, **toda venta hecha después de una de distribuidor quedaba vinculada a ese distribuidor**, invisiblemente. Cuatro puntos corregidos:
- `abrirModalVenta`: resetea canal a `directo`, limpia cliente, nota y el select de distribuidor (657).
- `guardarVenta`: `distribuidorId` solo se lee si `canal === 'distribuidor'` (658).
- `editarVentaMultiple`: limpia el select cuando la venta no es de distribuidor, en vez de heredarlo (659).
- `guardarEditarVenta`: al cambiar el canal en el modal de edición se limpia el `distribuidorId` viejo (660).

**Regla que sale de aquí:** en todo modal reutilizado crear/editar hay que resetear **TODOS** los campos al abrir en modo creación, incluidos los que están ocultos. Un campo oculto sigue teniendo valor y sigue siendo leído. Es el bug 12 (selector pegado en Gastos) repetido.

### 14.2 Gastos fijos y punto de equilibrio (comentarios 665–667, 669–675)
Nuevo campo **`esFijo`** (bool) en `gastos` y en `gastosRecurrentes`.
- `esGastoFijo(g)`: si `g.esFijo` es booleano, manda. Si no (gastos históricos), se deduce con `RE_GASTO_FIJO_AUTO` sobre `desc` — facebook, meta ads, shopify, interés, juanfe, asesoría, la real, arriendo, nómina, suscripción. Así el punto de equilibrio funciona hacia atrás sin re-etiquetar nada. **Meta cobra ~14 veces al mes en montos chicos**, por eso la deducción por descripción importa.
- `calcularGastosFijosRango(inicio, fin)`, `calcularMargenPctPromedio()` (90 días, extraído de `renderMetas` para que Inicio y Metas usen el mismo número), `getCicloActual(offset)`.
- **Fix (675):** el punto de equilibrio de Metas usaba `m.gastoMax` (techo de gasto presupuestado, que incluye mercancía) como si fueran gastos fijos. Con compras de proveedor de varios millones eso lo inflaba hasta volverlo inútil. Ahora usa los fijos reales del ciclo, con fallback a `gastoMax` si no hay ninguno marcado.

**Gastos fijos reales de Duppla (referencia, agosto 2026):** Pago Juanfe / Asesoría La Real $1.000.000 · Intereses mensuales $525.000 · Meta Ads ~$739.000 (suma de ~14 cobros) · Shopify ~$90.000. Total ≈ $2.354.000/mes. **No** son fijos: mercancía (Profitness, Integral Médica), 4x1000, bolsas, fletes.

### 14.3 Página Inicio (comentarios 661–664, 668)
Nueva página `inicio`, primera del MENU y **página por defecto al entrar** (antes era `dashboard`, que sigue existiendo igual para el detalle). Contiene: saludo por hora + ventana del ciclo, alertas accionables (mora / stock bajo / recompras) o estado "todo al día", botón grande de Registrar venta + Cobrar + Gasto, cuatro números del ciclo (vendido con variación vs ciclo anterior, margen bruto, gastos con cuánto es fijo, por cobrar) y la barra de punto de equilibrio.
`renderInicio` **no duplica lógica de guardado** — todos sus botones abren los modales de siempre.

### 14.4 Fix: `fmt()` no redondeaba (comentario 676)
`fmt()` hacía `toLocaleString('es-CO')` sobre el número crudo, así que cualquier valor calculado (punto de equilibrio, promedios) salía como `$5.170.673,433`. El peso colombiano no lleva decimales: ahora `fmt` redondea en la fuente. Esto arregla decimales latentes en toda la app, no solo en Inicio.

### 14.5 Cómo se probó (patrón reutilizable)
No hay ambiente de staging, así que `renderInicio` se validó con un **harness en Node**: se extraen por conteo de llaves las funciones necesarias del `<script type="module">`, se stubean `document.getElementById` y `DATA` con datos parecidos a los reales, se corre la función y se revisa el HTML resultante (sin `undefined`/`NaN`, con los textos esperados) + un screenshot con Playwright usando el CSS real de la app. Recomendado repetir este patrón antes de tocar producción.

### 14.6 Pendiente inmediato — decidido con Ángel, en orden
1. **Menú a 5 cajones** (Inicio · Negocio · Stock · Plata · Ajustes) — las 13 secciones se agrupan; el código de cada página no se toca, solo cómo se llega.
2. **Corte mensual completo** el día 3: automático, comparación contra el ciclo anterior, punto de equilibrio, top productos, top distribuidores, venta directa vs distribuidores, gastos; exportable y compartible por WhatsApp.
3. **Push real con la app cerrada.** Hoy **no existe**: la app solo usa `Notification` del navegador desde la página abierta — no hay service worker, ni manifest PWA, ni FCM. Hay que construirlo. **Jero y Ángel usan iPhone**, así que iOS exige que la PWA esté agregada a la pantalla de inicio para que el push funcione.

### 14.7 Compra de mercancía ≠ gasto (comentarios 677–679) — REGLA DE NEGOCIO
Palabras de Ángel: *"Van a haber meses en que quedamos en números negativos porque nos tocó comprar mercancía, pero no estamos perdiendo dinero: tenemos dinero en mercancía."*

`esCompraMercancia(g)` — un gasto es compra de mercancía si tiene `pedidoId`/`esAbonoPedido`, o si su categoría es `importacion`. Consecuencias:
- **No entra al punto de equilibrio.** Su costo ya está descontado dentro del margen; contarla otra vez sería contarla dos veces (era exactamente el error del `gastoMax`, ver 14.2).
- **No cuenta como pérdida.** Inicio muestra dos líneas separadas en "Resultado del ciclo":
  - **Utilidad real** = margen de lo vendido − gastos de operación (todo menos mercancía). Es el número que dice si el negocio dio plata.
  - **Caja del ciclo** = lo que entró − todo lo que salió, mercancía incluida. Puede estar en rojo sin que se haya perdido nada.
  - Cuando la caja está en rojo pero la utilidad real es positiva, la tarjeta lo dice con todas las letras y muestra el inventario valorizado a costo.

**Sobre qué es "fijo":** Ángel llama gastos fijos a asesoría (Pago Juanfe), intereses, Shopify y pauta de Meta. Que el MONTO varíe (Meta cobra ~14 veces al mes, Shopify depende del dólar) no los vuelve variables — variable, en esta app, significa *que depende de cuánto se venda*. Por eso nunca se hardcodea un valor: `calcularGastosFijosRango` suma los gastos realmente registrados en el ciclo. Fuera de los fijos quedan la mercancía, el 4x1000, las bolsas y los fletes.

### 14.8 Tres bugs de Inicio encontrados verificando EN PRODUCCIÓN (680–682)
El harness en Node validó la lógica, pero estos tres solo aparecieron abriendo la app real con los datos reales. Lección: el harness no reemplaza mirar la app desplegada.

1. **(680) Inicio se quedaba en $0 al entrar.** El listener de `onSnapshot` solo redibujaba con `if(currentPage === col || currentPage === 'dashboard')`. Como Inicio lee de casi todas las colecciones pero no se llama como ninguna, nunca entraba en la condición: se pintaba con `DATA` vacío al hacer login y ahí se quedaba hasta que navegabas a otra página y volvías. **Cualquier página futura que resuma varias colecciones hay que sumarla a esa condición a mano.**
2. **(681) La comparación vs ciclo anterior siempre daba negativo.** Comparaba el ciclo actual a medias contra el anterior COMPLETO (el día 19 de agosto contra los 31 días de julio). Marcaba −54% cuando en realidad iba −16%. Ahora recorta el ciclo anterior a los mismos días corridos y lo dice en la etiqueta ("vs mismos 19 días del ciclo anterior").
3. **(682) El aviso de stock bajo era ilegible.** Recortaba los nombres a dos palabras y con el catálogo real quedaba "WHEY 100% (1), WHEY 100% (1), WHEY 100% (1)". Ahora ordena por stock más bajo primero y muestra el nombre casi completo.

**Nota de flujo de trabajo (agosto 2026):** Jero le dio acceso de escritura a la cuenta `certuche99`. Los cambios ahora se suben desde el navegador con la extensión Claude in Chrome (subir archivos a `main` desde la web de GitHub → Vercel despliega solo). La carpeta local del escritorio de Ángel es una copia de trabajo, **no** la fuente de verdad: antes de editar, verificar con `git log -1` que coincide con lo que hay en GitHub (ver trampa 8).

### 14.9 REGLA CONTABLE: venta ≠ cobro (comentarios 727–744) — LA MÁS IMPORTANTE DE ESTA SESIÓN

**El problema.** Una venta se cuenta UNA vez, el día que sale la mercancía, por su valor total (`ingresoVenta`, 566). Si el cliente no paga todo ese día queda `saldo`, pero el ingreso ya se reconoció. Cuando después paga, eso NO es ingreso nuevo: es caja contra un saldo que ya existía.

En la hoja de Google no había dónde poner un pago suelto, así que se anotaba como una fila de venta más. Siete movimientos por **$3.216.000** estaban contados dos veces (o a punto de estarlo):

| Fecha | Concepto | Valor | Qué era |
|---|---|---|---|
| 20/05 | ABONO SANTA | $500.000 | Santa paga mercancía de marzo/abril |
| 27/05 | ABONO ANGEL | $400.000 | socio repone consumo propio |
| 03/06 | ABONO SANTA | $1.400.000 | ídem Santa |
| 03/06 | ABONO JERONIMO | $100.000 | socio repone consumo propio |
| 22/06 | ABONO SANTAMARIA | $250.000 | ídem Santa |
| 01/07 | ABONO ANGEL CERTUCHE | $350.000 | socio repone consumo propio |
| 08/07 | RESTANTE WHEY ELITE 5L | $216.000 | saldo de producto ya entregado |

Evidencia: Santa (Daniel Santamaría) recibió $2.338.000 de mercancía en marzo–abril (19/03 $278.000 · 31/03 $1.060.000 · 09/04 $1.000.000), ya contados como venta en su mes. Ángel y Jerónimo sacan producto a costo para consumo propio (hoja "consumo socios": $970.665 y $393.295) y cuando reponen la plata es reembolso, no venta.

**La solución.** Campo `tipoMov` en la colección `ventas`:
- ausente o `'venta'` → venta de producto (comportamiento de siempre)
- `'abono'` → cobro de la cuenta de un cliente
- `'reembolso'` → socio repone su consumo

`esCobro(v)` es la fuente única de verdad. **La separación ocurre en UN solo punto**: el listener de `onSnapshot` (730) parte la colección en `DATA.ventas` y `DATA.cobros`. Se hizo así a propósito: hay 56 lugares distintos leyendo `DATA.ventas` y confiar en que cada uno filtre es garantizar que algún día uno se olvide. Los cobros suman en **caja** (Inicio 731, flujo de caja del dashboard 733) y nunca en vendido, margen, metas, top de productos ni ranking de distribuidores.

**Dónde se registra un cobro ahora:** modal `modal-cobro` (735/736), botón en Deudores y en Ventas. Si la venta SÍ está en la app, lo correcto sigue siendo `Cobrar → + Abono`, que además baja el saldo del cliente — el modal lo avisa y hasta detecta el caso (738).

**Defensas para que no vuelva a pasar:**
- El importador (739–742) reconoce `ABONO|RESTANTE|SALDO|PAGO DE CUENTA|REEMBOLSO` al principio del producto, los saca del bloque de ventas y los sube como cobro, con el tipo ya sugerido.
- Detector permanente (743): cada vez que se abre Ventas se revisa si se coló un cobro registrado como venta y se ofrece arreglarlo en un clic.
- `tipoCobroSugerido` marca reembolso si el nombre es de un socio.

**Trampa que casi se cuela (744):** `eliminarDoc('ventas', id)` buscaba el snapshot solo en `DATA.ventas`. Como los cobros ya no viven ahí, el snapshot salía `null` y el registro se borraba **sin pasar por la papelera** — irrecuperable. Cualquier separación futura de una colección en memoria tiene que revisar quién busca por id en ella.

**Verificación (agosto 2026).** Tras separar cobros y cargar mayo, hoja vs app por ciclo, comparando solo ventas reales:

| Ciclo | Hoja | App | Diferencia |
|---|---|---|---|
| 4 may – 3 jun | $16.260.600 | $16.145.600 | −$115.000 (MAIDE INPEC quedó fechada 5 jun) |
| 4 jun – 3 jul | $15.879.350 | $15.867.354 | −$11.996 |
| 4 jul – 3 ago | $14.097.410 | $14.097.406 | −$4 |
| 4 ago – 3 sep | $11.790.392 | $11.791.384 | +$992 |

Y contra Juanfe: su mayo ($17.160.600) menos los dos abonos que él sí sumó ($900.000) da $16.260.600 — **exactamente** lo mismo que la hoja de ventas sin abonos. Los $1.400.000 que no cuadraban eran una sola fila: el ABONO SANTA del 3/06, que la hoja de ventas cobra y la de Juanfe deja en blanco.

### 14.10 El margen estaba inflado (comentarios 745–749)

Cuando una venta se registra a mano con un nombre que no calza con el inventario ("HYDRXYUT MUSCLETECH" vs "QUEMADOR HYDROXYCUT"), o es un combo escrito a mano, queda sin `costoUnit`. `calcularMargenVenta` devuelve `null` y **todas** las pantallas caen al mismo respaldo: costo cero. Esa venta aparece con 100% de margen.

Alcance real medido en producción: **$9.4M de $57.9M vendidos (16%)** sin costo conocido. La plata está bien; el margen y la utilidad real se ven mejores de lo que son.

- `ventasSinCosto()` las detecta; `costoSugeridoNombre` propone el costo buscando primero en inventario y luego en el catálogo de combos (sumando el costo de sus componentes).
- `abrirVentasSinCosto()` muestra el impacto y `aplicarCostosSugeridos()` lo guarda.
- **Excepción legítima:** las filas `GANANCIA X` son comisión pura sobre producto que Duppla nunca compró. Costo cero ahí es correcto — `esVentaComision` las excluye.
- **No se escribe `prodId`** al arreglar (748): esas ventas nunca descontaron stock, y ponerles `prodId` haría que al borrarlas `restaurarStockVenta` subiera el inventario por mercancía que nunca volvió. Por lo mismo el importador ahora guarda `stockDescontado` y `restaurarStockVenta` lo respeta (749).

### 14.11 El emparejador de productos emparejaba productos distintos (comentarios 750–754)

Encontrado al revisar las sugerencias de 14.10 **antes** de aplicarlas: propuso ponerle a una venta de `CREATINA PLATINUM MUSCLETECH` el costo de `CAFEINA PLATINUM MUSCLETECH` ($50.000). El producto correcto sí existe (`CREATINA PLATINUM MUSCLETECH 450g`) pero la regla vieja de números lo descartaba —uno trae 450 y el otro no— y caía en la cafeína.

La versión anterior de `productosSimilares` aceptaba con `calces >= mínimo − 1`: permitía que UNA palabra cualquiera no calzara. Con el catálogo real (66 productos) eso emparejaba **30 pares**. La mayoría son sabores del mismo producto y cuestan igual, pero no todos:

| | |
|---|---|
| `CRISP BAR` ($6.175) | `CRISP BAR CAJA.` ($74.100) |
| `OMEGA 3 (NUTRIFY 120 CÁPS)` ($89.050) | `OMEGA 3 (120 CAPSULAS VEGANO)` ($55.000) |
| `CREATINA PLATINUM MUSCLETECH` | `CAFEINA PLATINUM MUSCLETECH` |

Un costo equivocado es peor que ninguno: no se ve en ninguna pantalla, se disuelve dentro del margen. Sin costo, la venta aparece en "Ventas sin costo" y se puede arreglar.

**Reescritura (750–754):**
1. **Asimétrica.** `productosSimilares(catalogo, consulta)`. Todas las palabras de la consulta tienen que calzar; al catálogo se le permiten palabras de más (marca, presentación).
2. **Una palabra suelta, y solo al final.** Ahí es donde la hoja pega la marca (`GLICINATO DE MAGNESIO NUTRICOST` vs `GLICINATO DE MAGNESIO (180 CAPS)`). En el medio o al principio es la que dice qué es la cosa — perdonarla fue lo que unió CREATINA con CAFEINA, y `WHEY ELITE 2L VAINILLA` con `WHEY 100% 2L POTE VAINILLA`.
3. **Números como subconjunto, no como igualdad.** Los de la consulta tienen que estar en el catálogo. Así `CREATINA PLATINUM MUSCLETECH` (sin cifras) sí puede ser la de 450g, pero `WHEY ELITE 2L` nunca es la de 5L.
4. **Los gramos no son tamaño** (`numerosTamano`, 753). La hoja escribe `CREATINA IRON NUTRITION 500G` y el inventario solo `CREATINA IRON NUTRITION`. Litros y libras SÍ cuentan: ahí está la diferencia entre el tarro de 2L y el de 5L.
5. **Ante dos candidatos igual de buenos, ninguno** (`buscarProductoInventario`, 752). Antes devolvía el primero de la lista — escoger al azar entre `WHEY 100% 4L VAINILLA` y `WHEY 100% 4L CHOCOLATE`. Cobertura perfecta le gana a parcial, para que `CAJA CRISP BAR` sí encuentre `CRISP BAR CAJA.`.

**Propiedades verificadas contra el catálogo real (66 productos):** los 66 se encuentran a sí mismos, **cero** cruces de sabor, y los pares peligrosos de arriba ya no se emparejan. El test vive en el patrón de harness de 14.5.

**Regla general que sale de aquí:** cuando un emparejamiento produce un NÚMERO (un costo, un precio), el umbral tiene que ser mucho más alto que cuando produce una ETIQUETA (vincular un cliente). Un nombre mal vinculado se ve; un costo mal puesto no lo ve nadie.

### 14.12 Otros nombres y desempate por precio (comentarios 756–759)

Después de arreglar el emparejador quedaron 23 ventas sin costo. Ángel identificó una por una las que el algoritmo no podía adivinar — y no podía porque **no se deducen de las letras, hay que saberlo**:

| Como lo escribe la hoja | Qué es de verdad |
|---|---|
| GEL NORMAL INTEGRAL MEDICA | GEL VO2 SIN CAFEÍNA |
| GEL CAFEINA INTEGRAL MEDICA | GEL C30 CAFEÍNA |
| HYDRXYUT MUSCLETECH | QUEMADOR HYDROXYCUT |
| COLLAGENO SPORT INTEGRAL MEDICA | COLLAGEN SPORT |

**756. Campo `alias` en cada producto** ("Otros nombres", separados por coma, en la ficha de Inventario). `buscarProductoInventario` compara contra el nombre y contra todos los alias. El conocimiento vive en los datos, no hardcodeado en el código: cuando aparezca otro nombre raro, se agrega desde la app sin tocar nada.

**757. Desempate por precio.** El Omega 3 Integral Médica viene en dos presentaciones y la hoja escribe las dos igual. El precio las separa solo: 30 servicios (60 cápsulas) vale $97.000 / $81.000 distribuidor; 60 servicios (120 cápsulas) vale $143.500 / $116.100. `buscarProductoInventario(nombre, precioUnit)` usa el precio **solo para desempatar** entre candidatos igual de buenos — nunca para convertir un "no sé" en un "sí". Sin precio, "OMEGA 3 INTEGRAL MEDICA" sigue devolviendo null, que es lo correcto: es ambiguo.

Precios de referencia que confirmó Ángel: Omega 3 vegano $77.000; Omega 3 Nutrify (60 servicios) $137.000.

**758. `costoConocidoVenta` ahora exige que TODAS las líneas tengan costo**, no que alguna lo tenga. Antes, en una venta de varios productos, una línea sin costo se saltaba entera en `calcularMargenVenta` — su ingreso salía del margen y terminaba contada como si no hubiera dejado un peso. Es el error opuesto al de una venta de un solo producto (que se contaba con 100% de margen), pero igual de falso.

**Los combos NO se costean.** Decisión de Ángel: *"El combo no lo coloques, porque son combos que tenemos en la página web y pueden valer más o menos, dependiendo de varias cosas."* Los `COMBO …` escritos a mano se quedan sin costo a propósito y aparecen listados en "Ventas sin costo" — no son un error pendiente.

### 14.13 Escribir el costo a mano (comentario 760)

La herramienta de "Ventas sin costo" sabía señalar el hueco pero no había forma de taparlo: si el producto no está en el catálogo, la venta se quedaba ahí para siempre. Y hay ventas cuyo costo **solo lo sabe quien la compró**: encargos sueltos que Duppla no vende (un shaker, una creatina Darkness, una L-citrulina que pidió un cliente).

Ahora cada fila no reconocida trae una casilla para escribir **cuánto costó una unidad**. `lineaEditableSinCosto` decide si se puede: en una venta de varios productos solo se ofrece cuando falta **exactamente una** línea — con dos, un solo número no alcanzaría para repartirlo.

**Equivalencias que confirmó Ángel (segunda tanda):**

| Hoja | Producto | Nota |
|---|---|---|
| CRISPI BARRA PROTEINA | CRISP BAR | la unidad |
| BARRAS DE PROTEINA CAJA | CRISP BAR CAJA. | la caja de 12 |
| ASHWAGANDA 180 CAPS | ASHWAGANDHA | única presentación que venden |

**Sin costo a propósito** (no son errores pendientes): los `COMBO …` de la página web (el precio varía), y los encargos sueltos — SHAKER, CREATINA DARKNESS 200 G, L-CITRULINA — que Duppla no vende de catálogo.

**Pendiente real:** `WHEY ELITE 8LBS VAINILLA` ($404.250) se ha vendido al menos dos veces y **no existe en el inventario**. Y `STNTHA 6 - 5L` (error de dedo por SYNTHA) no se puede resolver solo porque no dice el sabor; vainilla cuesta $286.473 y chocolate $283.000.

**Hallazgo de negocio:** OLIMPO GYM compró 2 SYNTHA 6 5L a $288.000 c/u el 2 de junio. Cuestan $283.000–$286.473. Eso es vender **prácticamente a costo** — entre $1.500 y $5.000 de margen por unidad. Revisar el precio de distribuidor de ese producto.

### 14.14 Cierre de las ventas sin costo (comentario 761)

Costos que dio Ángel para los encargos sueltos: **L-citrulina $55.000**, **Creatina Darkness $95.000**, **shaker $0** (era un obsequio, se revendió a $20.000). **SYNTHA 6 5L: $286.473** — es el que resuelve el `STNTHA 6 - 5L` mal escrito de OLIMPO.

**761.** El costo manual ahora distingue el texto vacío del cero escrito: `''` y `'0'` dan el mismo número pero significan cosas distintas. Vacío es *"no lo sé"*; un 0 escrito a propósito es *"esto no me costó nada"* — un obsequio, una comisión. Sin esa distinción no había forma de cerrar una venta de costo cero y quedaba marcada como pendiente para siempre.

**WHEY ELITE 8 LBS:** presentación **descontinuada** por el proveedor. Se vendió solo a JOHAN ARANGO GO UP durante unos meses, a $404.250. Hoy la reemplaza la de 5 L. No está en inventario porque ya no se compra — falta su costo histórico para cerrar esas ventas.

### 14.15 REGLA DE NEGOCIO: el SYNTHA a OLIMPO es un gancho, no un error

La app detectó que a OLIMPO GYM se le vende SYNTHA 6 5L a **$288.000** cuando cuesta **$286.473** — margen de $1.527 por unidad, prácticamente a costo. **Es deliberado.** Palabras de Ángel:

> *"Ese producto lo estoy vendiendo a costo, pero solamente a ellos. Es como si fuera un gancho, ya que a ellos les vendo muchos más productos, entonces les dejo ese más económico para que me compren las creatinas, que sí me dejan más margen."*

**No es un precio para corregir.** Cualquier alerta futura de "margen bajo" o "vendido por debajo de costo" tiene que poder excluir este caso, o al menos no tratarlo como error. Antes de señalar un precio bajo como problema, mirar si ese cliente compra volumen en otras referencias.

### 14.16 El distribuidor se escoge de una lista, y va primero (comentarios 762–763)

Pedido de Ángel, y la raíz de dos problemas que salieron en el sondeo:

> *"Cuando se vaya a hacer la compra de un distribuidor, primero se selecciona eso, y que aparezca un selector con los nombres ya registrados para no registrarlo de una manera diferente y crear más confusión."*

**Cómo estaba:** el selector de distribuidor vivía **al final** del formulario, debajo del bloque de pago, con la etiqueta *"Opcional — para llevar historial por distribuidor"*. El nombre del cliente se escribía aparte, a mano, en un campo libre. Resultado medido en producción: **19 ventas por $5.683.304** con canal distribuidor y sin vincular a nadie, y distribuidores duplicados por escribir el nombre distinto (`SEBAS BEDOYA` / `SEBASTIAN BEDOYA`, `GREEN ROOTS` / `SERGIO GREEN ROOTS`).

**762.** El selector sube justo debajo del canal, deja de ser opcional y `guardarVenta` bloquea el guardado si el canal es distribuidor y no se escogió ninguno. Al escoger, `elegirDistribuidorVenta` **llena el nombre del cliente y lo bloquea** — el nombre de la venta y el del distribuidor ya no se pueden separar. La lista va ordenada alfabéticamente. Y hay un *"Créalo aquí"* que abre el modal de distribuidor y **vuelve a la venta** con el nuevo ya seleccionado, sin perder lo que se llevaba escrito (`volverAVentaTrasDistribuidor`).

**763.** Para venta directa el campo sigue siendo libre —siempre entra gente nueva— pero ahora trae `<datalist>` con todos los clientes y distribuidores ya registrados, y `revisarClienteParecido` avisa mientras se escribe si el nombre se parece a uno que ya existe, con un botón para usar el existente. Reutiliza `clientesSimilares` (709). Es la misma defensa que el importador, pero en el registro a mano.

**Regla que sale de aquí:** cuando dos campos tienen que decir lo mismo (el nombre del cliente y el del distribuidor), no se piden dos veces — se pide uno y el otro se deriva. Pedirlos por separado garantiza que algún día no coincidan.

### 14.17 Decisiones de Ángel en el sondeo de cierre (23 ago 2026)

Respuestas una por una, para no volver a preguntarlas:

| Tema | Decisión |
|---|---|
| 6 pagos descuadrados | Los seis pagaron completo. $779.659 recuperados en caja. |
| Ventas de distribuidor sin vincular | Creados MATEO CARDENAS, ALEJANDRO PEREA y STIVEN GALLEGO (este último, otro profesor con gimnasio propio). `CAMILO ENTRENADOR` = Camilo Gallego → renombrado a **CAMILO GALLEGO ENTRENADOR**. `J ENTRENADOR` = Juan Gabriel Entrenador. `NAGA` = Nagatomo. |
| Jerónimo Arroyave, venta del 5 may | Fue venta real hecha por el socio, la plata entró. Pasada a **canal directo** para no meter al socio en el ranking de distribuidores. |
| Pre Entreno Electrón | Costaba **$87.137**, no $103.000. Eran 5 ventas con el costo del Intenze pegado. |
| Distribuidores duplicados | Misma persona. Quedan **SEBASTIAN BEDOYA** y **GREEN ROOTS**. |
| Whey Elite 8 lbs | Costaba **$346.500**. Presentación descontinuada, solo se le vendía a Go Up. |
| Precios por distribuidor | **No** se implementan. Ángel lo maneja a ojo al facturar. |
| Amino X | Estaba con precio de distribuidor = costo. Real: costo **$91.000**, distribuidor **$98.000**, público **$130.000**. |
| Creatina MuscleTech | `CREATINA PLATINUM MUSCLETECH 450g` y `CREATINA 90 SERVICIOS MUSCLETECH NUEVO` son **la misma referencia**. Fusionadas: 14 unidades a **$97.000** (precio del último pedido, no promedio ponderado). |
| Alerta de producto estancado | **No** la quiere. |
| David Inpec / Inpec / Maide Inpec | **Tres personas distintas** del mismo lugar. No unificar. |

**Trampa encontrada al fusionar:** 10 ventas de Creatina Platinum seguían con `prodId` apuntando a **CAFEINA PLATINUM MUSCLETECH**. El arreglo de costos (14.11) corrigió `costoUnit` pero a propósito no tocó `prodId` (748). Consecuencia: el top de productos y las alertas de stock atribuían las creatinas a la cafeína, y por eso el inventario parecía tener $1.164.000 de creatina quieta que en realidad sí se había vendido. Se repuntaron las 10 — seguro porque todas tenían `stockDescontado: false` (749), así que mover el `prodId` no movió inventario.

**Lección:** corregir el costo sin corregir el producto deja el dinero bien y la información mal. Cuando una línea de venta apunta al producto equivocado hay que arreglar las dos cosas, y `stockDescontado` es lo que dice si es seguro hacerlo.

### 14.18 Márgenes del 114% y del 140% (comentario 764)

Encontrado al verificar el sondeo, no al hacerlo: mayo saltó de 38% a 42% de margen sin razón. En vez de aceptar el número, se listaron las ventas de mayo con margen sobre 55% y aparecieron **dos con margen mayor al 100%** — aritméticamente imposible:

| Venta | Ingreso | Margen que calculaba | % |
|---|---|---|---|
| SEBASTIAN BEDOYA · 11 may | $260.000 | $297.000 | 114% |
| NAGATOMO · 2 jun | $182.000 | $254.800 | 140% |

**Causa:** en 8 ventas el campo `precio` (unitario) traía el **total de la línea**. Cuando la cantidad era 2 o más, la hoja tenía escrito el total en la casilla del valor unitario. `ingresoVenta` usa `v.total`, así que **lo vendido siempre estuvo bien**; pero `calcularMargenVenta` hace `(precio − costo) × cant`, y con el unitario inflado el margen se multiplicaba.

Estuvo ahí desde la importación. No se veía porque esas mismas ventas tenían el costo de otro producto o eran manuales sin costo; al arreglar los costos (14.11 y 14.17) el error afloró.

**Arreglo de datos:** 7 ventas corregidas. El criterio fue que **el total manda** — es lo que se cobró y lo que cuadra con la hoja. Para las de varias líneas se probaron las combinaciones de líneas a dividir hasta que la suma diera el total exacto. Queda una sola descuadrada, OLIMPO 19 ago, por $999 — irrelevante.

**764. Blindaje en el importador:** `parsearFilasHoja` ya no se cree el unitario de la hoja. Si `unitario × cantidad` no da el total, lo recalcula como `total / cantidad`. 15 pruebas con los casos reales.

**Regla que sale de aquí:** cuando la hoja trae un dato redundante (unitario, cantidad y total: cualquiera de los tres se deduce de los otros dos), no se importan los tres a ciegas. Se importa el que cuadra con la contabilidad —el total— y los demás se validan contra él.

**Y la lección de método:** el número que sube sin explicación es una alarma, no un regalo. Si una corrección debía bajar el margen y lo subió, hay que perseguir la diferencia hasta entenderla. Aquí la verificación encontró más que la auditoría.

### 14.19 Qué merece notificar (comentarios 765–767)

Pedido de Ángel:

> *"No quiero que cuando lo abra me lleguen todas esas notificaciones de inventario bajo. Bórralas, no quiero que me vuelva a llegar eso, porque eso lo veo yo cuando abra la sesión nada más. De pronto me puedes hacer las notificaciones acerca de los deudores, acerca de cosas relevantes o de cuando cierra el mes, pero no del stock."*

**765. El stock deja de notificar.** Eran 4 puntos: la revisión diaria al cargar inventario y tres avisos que salían al vender (venta múltiple, venta simple y combo). `checkStockAlerts()` queda vacía a propósito, con el comentario explicando por qué — se deja la función para no romper la llamada del listener y para que quede claro que es una decisión, no un olvido. **El aviso de stock bajo sigue vivo en Inicio**, que es donde Ángel dijo que lo mira.

**766. La mora sí queda en la campana.** Antes `chequearAlertaMoraDiaria` solo mostraba un toast y una notificación del navegador — las dos se van solas. Si no estabas mirando la pantalla en ese momento, la mora no existía. Ahora además hace `pushNotif` tipo `'mora'`, así que sobrevive a cerrar la app.

**767. Aviso de cierre de ciclo.** Nuevo. La primera vez que se abre la app dentro de un ciclo nuevo, avisa que el anterior cerró con su resumen: vendido, % de margen y utilidad real. Usa `getCicloActual`, `ingresoVenta`, `calcularMargenVenta` y `esCompraMercancia` — las mismas fuentes de verdad de Inicio, sin recalcular nada aparte. Se marca en `localStorage` con la fecha de inicio del ciclo, así avisa una sola vez por ciclo y por dispositivo.

**El criterio, para lo que venga:** una notificación se gana el derecho a interrumpir solo si pide una acción que no puede esperar a que la persona se siente a mirar. Cobrar una mora sí. Revisar el mes que cerró sí. El stock bajo no — eso se mira cuando uno abre la app, y para eso está el aviso de Inicio. Antes de agregar una notificación nueva, la pregunta es *"¿esto exige que suelte lo que está haciendo?"*, no *"¿esto es información útil?"*.

**768. Trampa del aviso de cierre, encontrada al probarlo en producción.** La primera versión se disparaba con el snapshot de `ventas` y `DATA.gastos` todavía vacío. Los oyentes de Firestore llegan por separado y en cualquier orden, así que los gastos de operación daban 0 y la notificación decía que la utilidad era igual al margen: para julio anunció **$4.093.434** cuando la utilidad real es **$1.642.031**. Ahora espera a tener ventas, gastos e inventario, y se intenta desde los tres oyentes — la propia función evita avisar dos veces.

**Patrón general, ya visto dos veces en esta app** (aquí y en el bug 680 de Inicio): *cualquier cosa que resuma varias colecciones no puede confiar en el oyente de una sola.* O verifica que todas estén cargadas antes de calcular, o se ejecuta desde todas.

### 14.20 El resultado del ciclo, con la cuenta completa (comentarios 769–771)

Ángel, sobre la tarjeta anterior:

> *"Ese ítem es muy inconcluso. Que quede el vendido, la margen, por cobrar. Quiero que eso de 'salió del banco' mejor diga gastos o algo más humanizado, y en el resultado del ciclo, los mismos ítems que te digo."*

Tenía razón en las dos cosas.

**El problema de fondo.** La tarjeta mostraba dos totales sueltos —utilidad real y caja— sin enseñar de dónde salían. Un número sin su cuenta obliga a creerle a la app; y en una app de contabilidad, creer es exactamente lo que no se debe pedir.

**769-a. "Salió del banco" → "Gastos".** El nombre viejo mostraba *todo* lo que salió, mercancía incluida, lo cual contradice de frente la regla de la app: **la mercancía no es gasto, es inventario** (`esCompraMercancia`). Ahora el número grande son los gastos de operación de verdad y la mercancía va de subtítulo — visible, pero sin mezclarse en el mismo total.

**771.** Por coherencia, el detalle que abre esa tarjeta ya no se titula "Lo que salió del banco" sino **"Gastos del ciclo"**. Adentro sigue apareciendo la mercancía en su propio bloque, con el renglón que aclara que no es gasto.

**769-b. Dos cuentas, no dos totales.** El resultado se parte en dos tarjetas, porque son dos preguntas distintas y mezclarlas es la fuente de casi toda la confusión contable de un negocio pequeño:

| 📐 Lo que ganó el negocio | 🏦 Lo que pasó en el banco |
|---|---|
| Vendido | Te pagaron |
| − Costo de lo que vendiste | + Cobros de cuentas viejas |
| **= Margen bruto (%)** | − Compra de mercancía |
| − Gastos de operación | − Gastos de operación |
| **= Utilidad real** | **= Movimiento del banco** |

Los renglones usan las mismas palabras de las tarjetas de arriba —vendido, margen, gastos, por cobrar— para que la vista completa se lea como una sola cuenta y no como cuatro medidas independientes. El helper `renglon(etiqueta, valor, signo, esTotal, color)` es lo único que se agregó de estructura.

La mercancía aparece en la cuenta del banco y **no** en la del negocio: en la del negocio su costo ya está descontado dentro del margen (solo el de lo que *se vendió*), y contarla otra vez sería el mismo doble conteo del comentario 727 con otro disfraz.

**770. La caja contaba plata que no había llegado.** Bug real, no cosmético. `caja` restaba los gastos de **todo lo vendido en el ciclo**, hubiera pagado el cliente o no. Ahora suma solo lo que de verdad entró:

```js
const pagadoEnCiclo = ventasCiclo.reduce((s,v) => s + Number(v.pagado||0), 0);
let abonosEnCiclo = 0;
DATA.ventas.forEach(v => (v.abonos||[]).forEach(a => {
  if(a.fecha >= ciclo.inicio && a.fecha <= ciclo.fin) abonosEnCiclo += Number(a.valor||0);
}));
const entroAlBanco = pagadoEnCiclo + abonosEnCiclo + cobrado;
const quedoFiado   = Math.max(0, vendido - pagadoEnCiclo);
const caja = entroAlBanco - gastado;
```

Los abonos se suman **por su fecha**, no por la de la venta: un abono de agosto a una venta de julio es plata que entró en agosto. Es la misma lógica de caja del comentario 727, aplicada al ciclo.

Lo fiado no desaparece: se muestra aparte, con el texto de que esa plata todavía no ha llegado. Agosto pasa de $10.266.384 a ~$9.756.134 por los $510.250 que quedaron a crédito.

**772. Trampa del propio arreglo, encontrada al verificarlo en producción.** La primera versión de 770 sumaba `v.pagado` de las ventas del ciclo **más** los abonos fechados en el ciclo. Pero `guardarAbono` hace `nuevoPagado = (venta.pagado||0) + valor`: **cada abono ya está dentro de `pagado`**. Todo abono hecho en el mismo ciclo de su venta se contaba dos veces. Agosto mostraba **$13.333.476 recibidos contra $11.791.384 vendidos** — imposible sin cuentas viejas de por medio, que es justo lo que delató el error.

La descomposición correcta separa las dos entradas **por la fecha en que la plata llegó**:

| Entrada | Cómo se calcula | Cuándo entra |
|---|---|---|
| Pago inicial | `pagado − Σ abonos` | el día de la venta |
| Cada abono | `a.valor` | el día del abono |

Así ningún peso se cuenta dos veces y cada uno queda fechado en el ciclo real. Y lo fiado dejó de ser una resta (`vendido − recibido`, que mezclaba abonos de ventas viejas) para ser lo que siempre debió ser: **el saldo vivo de las ventas de ese ciclo**, `Σ saldoReal(v)`.

Verificado contra Firestore, ciclo por ciclo. Ningún ciclo recibe de sus propias ventas más de lo que vendió:

| Ciclo | Vendido | De contado | Abonos | Cuentas viejas | Gastado | Movimiento del banco | Fiado |
|---|---|---|---|---|---|---|---|
| Mayo | 16.145.600 | 16.145.600 | 0 | 2.400.000 | 16.839.516 | 1.706.084 | 0 |
| Junio | 15.867.354 | 11.859.104 | 1.029.000 | 600.000 | 17.956.958 | −4.468.854 | 0 |
| Julio | 14.097.406 | 9.901.064 | 6.163.450 | 216.000 | 8.877.003 | 7.403.511 | 510.992 |
| Agosto | 11.791.384 | 9.729.942 | 2.052.342 | 0 | 1.525.000 | 10.257.284 | 510.250 |

Por eso "Te pagaron" se partió en dos renglones: **"Te pagaron de contado"** y **"Abonos que entraron"**. No es cosmético — es lo que hace visible que la plata de un ciclo puede llegar en otro.

**Regla que sale de aquí, y aplica a cualquier tarjeta futura:** *lo devengado y lo cobrado son dos cuentas y se muestran separadas, cada una con sus renglones a la vista.* Un total que no se puede reconstruir mirándolo es un total que nadie va a poder defender frente a la hoja.

**Y la regla de datos, que vale para toda la app:** *`v.pagado` es acumulado, no es el pago del día de la venta.* Antes de sumar `pagado` junto a los abonos en cualquier cálculo nuevo, restarle sus abonos. Es la misma familia de error del comentario 727 (contar la venta y su cobro) con otro disfraz — y esta vez el disfraz era mío.


### 14.21 La pestaña de Gastos: una cuenta y un desglose (comentario 773)

Ángel, sobre la pantalla vieja:

> *"Acá aparecen los gastos fijos y 'salió del banco' de lo mismo, información repetida. Y luego abajo desglosa el gasto de marketing, el de los intereses y el total de gastos. Necesito que organicemos estas pestañas... que aparezca todo organizado y no doble. Y que el desglose no aparezca abajo por allá, sino que yo le dé clic a cada cosita y se desglose toda la info."*

**Lo que estaba pasando.** El ciclo de agosto tenía **dos** gastos, $1.525.000 en total. La página los mostraba así:

| Dónde | Qué decía |
|---|---|
| Tarjeta "Gastos fijos" | $1.525.000 |
| Tarjeta "Salió del banco" | $1.525.000 |
| Tarjeta "Marketing" | $1.000.000 |
| Tarjeta "Finanzas" | $525.000 |
| Tarjeta "Total gastos" | $1.525.000 |
| Tabla del fondo | las dos filas otra vez |

Seis apariciones de la misma plata. Y no era un caso raro: **siempre que no hay gastos variables ni mercancía, "gastos fijos" y "salió del banco" son el mismo número por definición** — dos tarjetas del mismo tamaño diciendo lo mismo, que es exactamente lo que hace desconfiar de un tablero.

**Ahora hay dos bloques y nada más:**

**1. 🧾 La cuenta del ciclo** — resumen, no se toca. Usa el mismo `renglon` que el resultado de Inicio (769), para que las dos pantallas se lean igual:

```
Gastos fijos              $1.525.000   se pagan igual vendas o no
Gastos variables                  $0   suben con el movimiento
──────────────────────────────────────
Total de gastos           $1.525.000
Compra de mercancía               $0   no es gasto: es plata que se vuelve inventario
──────────────────────────────────────
En total salió del banco  $1.525.000
```

Dos totales a propósito: el de **gastos** (el que manda en el punto de equilibrio) y el de **lo que salió del banco** (que suma la mercancía). Que coincidan deja de ser sospechoso porque se ven los ceros que lo explican.

**2. 📂 En qué se fue** — un renglón plegado por categoría, ordenado por monto. Se toca y ahí mismo se abren **sus** registros, con editar y borrar. La tabla suelta del fondo desapareció: los registros viven dentro de su categoría, que es donde uno los va a buscar.

La mercancía es su propio grupo al final, así **todo registro cae en algún grupo y la suma de los grupos da exactamente lo que salió del banco** — auditable de un vistazo, sin cuadrar nada a mano.

Detalles que importan: los registros van en filas flexibles y no en tabla, porque esta página se mira desde el celular y una tabla de seis columnas ahí no se lee. El estado abierto/cerrado vive en un `Set` de módulo (`gastosGruposAbiertos`), así sobrevive al re-render que dispara cada `onSnapshot`.

**Regla de diseño que sale de aquí, y aplica a toda pestaña que se reorganice después:** *un número puede aparecer dos veces solo si los dos sitios responden preguntas distintas, y el segundo sitio tiene que explicarse solo.* Cuatro tarjetas del mismo tamaño con la misma plata no son cuatro datos: son un dato y tres ruidos. Cuando un corte es útil (por categoría, por tipo), va **como desglose de un total ya mostrado** — no como una fila de tarjetas paralela compitiendo con él.


### 14.22 Distribuidores mes a mes, y fuera el inventario (comentario 774)

Pedido de Ángel, tres puntos:

> *"Una herramienta que muestre cuánto vendió cada distribuidor cada mes, con la tabla de datos y una gráfica. Quitar la sección de inventario, porque ocupa espacio y visualmente no aporta. Tiene que ser intuitiva y sin enredos."*
> Y sobre dónde ponerla: *"cuando yo le dé click donde dice distribuidores, en las ventanas, que me lleven ahí"*.

**El comparativo.** Ya existía un mes a mes (comentario 701), pero de **un** distribuidor, escondido dentro de su tarjeta y solo si la abrías. Sirve para mirar a uno; no sirve para la pregunta real, que es **comparar**: quién creció, quién se enfrió, de quién depende el mes. Eso solo se ve con todos juntos, así que el comparativo es ahora lo primero de la página.

Dos decisiones de fondo:

**1. Va una fila "Sin vincular".** Son las ventas con `canal === 'distribuidor'` y sin `distribuidorId`. Sin esa fila la tabla cuadraría consigo misma pero mentiría: su total no daría el del canal. Con ella, **la suma de la tabla ES el canal** — mismo principio de auditabilidad que los grupos de Gastos (773). Además la fila va en ámbar: es una invitación a vincularlas.

**2. La gráfica son columnas apiladas por mes, no una línea por distribuidor.** Con diez distribuidores las líneas son una maraña y en un celular no se lee ninguna. Apiladas se leen las dos cosas que importan a la vez: cuánto hizo el canal cada mes y quién lo hizo. Cada mes es clicable y cambia la ventana del detalle de abajo.

Detalles que no son decorativos:

| Decisión | Por qué |
|---|---|
| Paleta fija de 6 colores + gris para el resto | El color sigue **al distribuidor, no a su puesto**: filtrar un mes no repinta a los demás. Validada para daltonismo sobre fondo blanco (ΔE adyacente ≥ 9.1). |
| Leyenda con nombre + punto, y la tabla completa debajo | Tres de los seis colores quedan bajo 3:1 de contraste sobre blanco: la identidad **nunca** puede quedar solo en el color. |
| 2px de separación entre segmentos | Dos colores pegados se leen como una sola barra. |
| Ciclos de izquierda (viejo) a derecha (nuevo) | Una línea de tiempo se lee así, aunque el offset 0 sea el de hoy. |
| 6 meses por defecto, con "Ver todo el historial" | A los 12 meses la tabla no cabe en un celular. |
| El año solo aparece si el comparativo cruza de año | "ago" solo basta mientras no haya dos agostos. |
| `$16,1M` / `$860k` encima de cada columna (`fmtCorto`) | `$16.145.600` no cabe en una columna de 40px. |

También se quitaron de esa página las tarjetas **"Total canal dist."** y **"Vinculado"**: el comparativo ya trae las dos (la fila Total y la fila Sin vincular), y repetirlas era exactamente lo que Ángel señaló en Gastos. Quedan los dos números que el comparativo **no** responde: margen real del canal y cuántos distribuidores hay.

**Fuera el inventario.** Ángel escogió los tres sitios: el banner de stock bajo del Dashboard, el aviso de stock bajo de Inicio y la página Inventario del menú.

- El banner del Dashboard era **el bloque más grande de la página** —una ficha por producto— para decir algo que no exige actuar hoy. Las alertas que quedan (mora, recompras) sí piden una llamada. Es la misma regla de las notificaciones (14.19) aplicada a la pantalla.
- La página Inventario **sigue existiendo**: `renderPage`, el div `page-inventario` y todos los `showPage('inventario')` quedan intactos. Solo sale del menú. Se entra por un botón discreto en el pie del menú lateral, junto a Backup.

**Por qué no se borró de verdad:** ahí es donde se arregla un costo y se crea un producto, y el costo es de lo que cuelga todo el sistema de márgenes que costó una sesión entera cuadrar (14.10–14.18). Quitarlo del camino diario es higiene; quitarlo del todo sería dejar sin herramienta la única palanca que corrige los márgenes. *Sacar algo de la vista no es lo mismo que quitarle a alguien la forma de arreglarlo.*


### 14.23 Que se sienta premium (comentarios 775–779)

Pedido de Ángel: *"quiero que la plataforma se vea más premium, que tengan detalles los botones, que haya al tocar los botones animaciones básicas pero evidentes... que cuando le dé a Duppla se vea el crecimiento o decrecimiento mes a mes... que cuando le dé click a un nombre salga cuántas veces y qué nos ha comprado, como un historial; también con los distribuidores, separado por mes."*

**775. Botones con tres capas.** Reposo (borde y sombra suaves, degradado de 1px arriba: el botón se ve como un objeto), hover (sube 1px, la sombra crece) y `:active` (se hunde y suelta una onda radial desde el centro).

Dos decisiones que no son de gusto:

- **Todo el hover va dentro de `@media (hover:hover)`.** En un celular el navegador simula el hover al tocar y lo deja pegado: el botón se queda "iluminado" después de soltarlo. Separarlo hace que en móvil solo exista el `:active`, que es lo correcto.
- **`-webkit-tap-highlight-color:transparent`.** El flash gris del navegador pisaba la animación propia. Lo de "evidente" se juega entero en el `:active`, porque en un teléfono es el único estado que existe.

Las curvas son `cubic-bezier(.34,1.56,.64,1)` — rebote corto. Un botón que baja y sube linealmente se siente barato. Y todo está bajo `prefers-reduced-motion`: a quien pidió menos movimiento se le apagan las animaciones pero **no** los estados (color, sombra siguen), para que la interfaz siga respondiendo.

**776. El logo lleva a Inicio.** Es lo que todo el mundo intenta en cualquier app y aquí no hacía nada.

**777. Crecimiento mes a mes, en Inicio.** Columnas de los últimos 6 ciclos con el % de variación bajo cada una, y un titular en una frase.

**La trampa de este gráfico, y la razón por la que casi todo tablero miente el día 5:** el mes en curso no es comparable con un mes cerrado. Si hoy es 8 y comparas lo que llevas contra el mes anterior entero, siempre pareces en caída libre. Así que:

| | Se compara contra |
|---|---|
| Mes cerrado | el mes anterior **completo** |
| Mes en curso | los **mismos días corridos** del mes anterior |

Es la misma regla que ya usaba la tarjeta de Vendido (693). La barra del mes en curso va **rayada**, para que se lea de inmediato que no terminó, y el pie lo dice con palabras. En las pruebas: con 600.000 en 9 días contra un mes anterior de 1.000.000 (400.000 en sus primeros 9), el gráfico dice **+50%**; comparando contra el mes entero habría dicho −40%. Es la diferencia entre creer que vas creciendo o que te estás hundiendo.

Detalle: `delta` es `null` cuando no hay base — de 0 a algo no es "infinito por ciento", es el primer mes con ventas. Caer a cero sí da −100%.

**778. La ficha de comprador.** Una sola función, dos puertas. Un cliente y un distribuidor **no se diferencian en lo que uno quiere saber de ellos**: cuánto ha comprado, cada cuánto vuelve, qué se lleva y si debe. Se diferencian en cómo se les factura. Por eso `fichaCompradorHtml(ventas)` es única y hay dos aperturas (`abrirFichaCliente`, `abrirFichaDistribuidor`) más una tercera para las ventas sin vincular. Si mañana cambia el formato, no hay que acordarse de cambiarlo en dos lados.

La ficha trae: veces que compró y cada cuánto vuelve, total y ticket promedio, margen que deja, última compra y días sin comprar, lo que debe; **mes a mes** con barras; **qué se lleva** (producto, unidades, pedidos, valor); y **todas las compras** con su estado.

Dos cosas que parecen detalle y no lo son:

- *Cada cuánto vuelve* se mide sobre **días distintos**, no sobre número de ventas. Tres ventas el mismo día son una visita, no tres.
- En la tabla de clientes el botón es **la fila entera**, no el nombre. Pedir puntería sobre un nombre en un celular es pedir demasiado.

**779. El nombre nunca va crudo en un `onclick`.** `RAICES O'BRIEN` rompía el atributo y dejaba el botón muerto; con la comilla en el sitio justo, un nombre podría inyectar código. `escAttr` escapa el backslash **primero** (si no, se re-escapa lo ya escapado) y luego comilla, `&`, `<`, `>`; `escTxt` para lo que se pinta. Probados los dos.

**Regla que sale de aquí:** *un dato que viene de lo que el usuario escribió —un nombre de cliente, una descripción de gasto— se escapa siempre al construir HTML, aunque "nadie va a escribir eso".* En esta app los nombres los teclea una persona apurada facturando, y los apóstrofes existen.


### 14.24 Informes y meses congelados (comentarios 780–784)

De la lista de "qué le falta para ser una plataforma premium de contabilidad", Ángel escogió arrancar por las dos primeras.

**780. Un solo motor de cuentas: `estadoFinanciero(inicio, fin, opciones)`.**

Antes de escribir el estado de resultados había que decidir algo: la cuenta de "qué ganó el negocio" y "qué pasó en el banco" vivía escrita a mano dentro de `renderInicio`. Copiarla a la pantalla nueva habría creado **dos implementaciones de la misma cuenta**, y dos implementaciones de una cuenta siempre terminan dando números distintos. Es la misma familia de error del 727 (venta vs cobro) y del 772 (abonos contados dos veces), que ya costaron una sesión cada uno.

Así que la cuenta se extrajo y ahora Inicio e Informes la comparten. `renderInicio` quedó más corto y **sus números no cambiaron** — se compararon contra producción antes y después, renglón por renglón.

**781. Gastos de operación ≠ gastos financieros.** Un contador no los mezcla: la utilidad **operacional** dice si el negocio funciona; la **neta**, qué queda después de lo que cuesta la plata prestada. Para Duppla no es un detalle académico: los intereses de Nancy Garay son de los gastos más grandes del mes.

Pero en **Inicio los dos siguen sumando juntos**, a propósito. Ahí la pregunta de Ángel es "cuánto salió este mes", y los intereses salen. La separación formal vive en el informe, que es donde un contador la busca. Esta decisión es la razón de que el cambio de motor no moviera ningún número de Inicio.

**782. La página Informes.** Dos estados, por la misma razón que en Inicio: ganar y cobrar son preguntas distintas, y un negocio puede tener un año excelente y quedarse sin efectivo el mismo mes.

```
ESTADO DE RESULTADOS            FLUJO DE CAJA
  Ventas del periodo              Te pagaron de contado
− Costo de la mercancía vendida  + Abonos que entraron
= UTILIDAD BRUTA  (%)            + Cobros de cuentas viejas
− Gastos de operación (por cat.) = TOTAL QUE ENTRÓ
= UTILIDAD OPERACIONAL           − Compra de mercancía
− Gastos financieros             − Gastos de operación / financieros
= UTILIDAD NETA   (%)            = MOVIMIENTO DEL BANCO
```

Lleva un aviso que me importa: si el periodo tiene ventas sin costo registrado, el informe **lo dice en amarillo** y advierte que el margen está por encima del real. Un informe que calla lo que no sabe es peor que no tenerlo — alguien va a tomar una decisión con él.

**783. PDF y Excel.** Ángel escogió los dos y tiene sentido: el PDF es lo que se envía y se archiva, el Excel es lo que un contador realmente usa porque va a querer sumar y filtrar. El Excel lleva tres hojas: el informe, **todas las ventas** y **todos los gastos** del periodo, con la mercancía marcada aparte — un informe sin su detalle es un número que hay que creer.

Las filas salen de **una sola función** (`filasInforme`): si el PDF y el Excel se arman por separado, en tres meses dicen cosas distintas.

SheetJS se carga **solo al pedir el Excel**. Son casi 900 KB; meterlos en la carga de la app para una exportación ocasional castigaría cada apertura desde el celular, que es como se usa esto el 90% del tiempo.

**784. Un mes cerrado se congela.**

Hasta ahora "cerrar mes" guardaba una foto y nada más: al día siguiente cualquiera editaba una venta de junio y junio cambiaba, dejando el snapshot mintiendo. Con dos socios sobre la misma base, eso es una discusión sin ganador.

Ángel escogió **"bloqueado pero reabrible"**. Un mes cerrado no admite crear, editar ni borrar ventas, gastos ni abonos con fecha dentro de él. Si de verdad hay que corregir, se reabre a propósito, queda registrado **quién y cuándo**, y se vuelve a cerrar.

El criterio: *un bloqueo que se puede saltar sin darse cuenta no protege nada; uno que no se puede saltar nunca obliga a mentir en otro lado.* Reabrir tiene que ser deliberado y quedar escrito.

Tres detalles que no son obvios:

| Caso | Por qué se bloquea |
|---|---|
| Editar una venta y **cambiarle la fecha** a un mes abierto | Se revisan las dos fechas, la nueva y la original. Mover la venta cambia el mes cerrado igual que editarla dentro. |
| Registrar un **abono** | Un abono mueve DOS meses: el suyo (entra a caja) y el de la venta (le cambia el saldo). Si cualquiera está cerrado, no pasa. |
| Un mes **reabierto** | No cuenta como cerrado en ningún lado. Si contara, el botón de cerrar quedaría deshabilitado para siempre. |

Y un mes tiene **un** registro de cierre: al volver a cerrar se actualiza el mismo documento, no se crea otro.

**Límite honesto, anotado como pendiente y no como resuelto:** se bloquea lo que mueve los estados financieros fechados (ventas, gastos, abonos). Cambiar el **costo de un producto en Inventario** todavía puede mover el margen de un mes cerrado, porque `calcularMargenVenta` cae al costo del producto cuando la línea no lo tiene. Para cerrarlo de verdad habría que congelar el costo dentro de cada línea de venta al cerrar el mes.


### 14.25 Bitácora: quién tocó qué y cuándo (comentarios 785–786)

Siguiente de la lista premium, y la pareja natural del congelado de meses: **784 protege lo cerrado, esto cubre lo abierto.**

**El hueco que tapa.** Duppla la manejan dos socios sobre la misma base. La papelera guardaba lo borrado, pero **una edición no dejaba rastro de ninguna clase** — y editar un total es justo lo que más mueve la contabilidad. Si un número de un mes cambiaba, no había forma de saber quién lo cambió ni qué decía antes: solo quedaba la discusión.

**785. Lo que se guarda es el ANTES y el DESPUÉS de cada campo**, no "hubo un cambio". Un apunte que dice *"Ángel editó una venta"* no sirve para nada. El que sirve dice:

> ✏️ **angel certuche** editó una venta: SEBASTIAN BEDOYA · $260.000 · 11 may
> Precio unitario   ~~$260.000~~ → **$130.000**

Ese ejemplo no es inventado: es exactamente el arreglo del comentario 764, el del unitario inflado que daba márgenes del 114%. Si la bitácora hubiera existido entonces, encontrar el origen habría tomado un minuto en vez de media sesión.

**Qué se audita y por qué:**

| Colección | Motivo |
|---|---|
| Ventas (crear, editar, borrar) | Es el ingreso. |
| Gastos (crear, editar, borrar) | Es el egreso. |
| Abonos | Plata que entra y cambia el saldo de una venta. |
| **Inventario** | El **costo** de un producto mueve el margen de TODAS sus ventas pasadas, incluidas las de meses cerrados — es justo el hueco que quedó anotado en 784. |
| Cierres | Cerrar y reabrir un mes. |
| Papelera | Restaurar, y sobre todo el borrado definitivo, que es irreversible. |

Decisiones que importan:

- **Es append-only.** No hay forma de editar ni borrar un apunte desde la app. Una bitácora que se puede retocar no es una bitácora.
- **Si la bitácora falla, la operación de negocio NO se cae.** `registrarEnBitacora` traga el error y lo deja en consola. Perder un apunte es malo; perder la venta que el usuario acaba de registrar por culpa del apunte sería peor.
- **Un apunte vacío no se escribe.** Si se abre una venta y se guarda sin cambiar nada, no queda registro: ensuciar la lista con ruido es la forma más rápida de que nadie la lea.
- **Los ids se guardan ya traducidos** (`distribuidorId` → "OLIMPO GYM"). Si mañana se borra ese distribuidor, el apunte viejo sigue diciendo algo.
- **El oyente está limitado a 400 movimientos.** La bitácora crece sin tope; traerla entera en cada apertura desde el celular sería un impuesto diario por un dato que se consulta de vez en cuando. Lo viejo sigue en Firestore.

**Una limpieza que salió de aquí:** las tres ramas de `guardarVenta` (manual, un producto, varios) escribían con el mismo par `updateDoc`/`addDoc` copiado tres veces. Ahora pasan por `escribirVenta()`. Antes había **tres oportunidades de olvidarse de una** al tocar algo; ahora hay una.

**786. La página Actividad.** *"Qué pasó aquí"* y *"qué se borró"* son la misma pregunta con distinto alcance, así que la papelera se absorbió dentro de Actividad en vez de añadir una entrada más a un menú que ya estaba largo (ver 774). La página `papelera` y `showPage('papelera')` siguen existiendo.

El feed va agrupado por día, con filtros (Todo · Plata · Solo ediciones · Solo borrados) y tiempos en palabras (*"hace 2 horas"*): un sello de fecha exacto no dice nada a simple vista.

**Regla que sale de aquí:** *en un sistema con más de un dueño, cualquier campo que mueva plata necesita un antes y un después guardado.* No por desconfianza — por memoria. A los tres meses nadie recuerda por qué un número es el que es, y sin el rastro la única salida es volver a cuadrarlo todo a mano.


### 14.26 El costo se congela al cerrar el mes (comentarios 787–788)

Ángel, escogiendo de la lista:

> *"Sí, quiero que lo congeles, porque los precios pueden variar, pero el margen de ese mes ya estaría estipulado respecto al precio que nos valió ese producto en ese momento."*

Es el agujero que quedó anotado al final de 14.24, y lo describió exactamente.

**El problema.** `calcularMargenVenta` usa el `costoUnit` guardado dentro de la venta y, **si no lo tiene, cae al costo ACTUAL del producto**. O sea que subirle hoy el costo a una creatina cambiaba el margen de todas las creatinas vendidas en mayo. Un mes podía estar bloqueado contra ediciones (784) **y aun así moverse por la espalda**.

**El arreglo.** Al cerrar un mes se graba dentro de cada venta el costo vigente en ese momento.

**La propiedad que lo hace seguro, y que está probada como invariante y no como intención:** el costo que se graba es *exactamente el que el cálculo ya estaba usando*, así que **congelar no cambia ni un peso de los números de hoy**. Solo deja de moverlos mañana. La prueba lo verifica en los dos sentidos:

- congelar → todos los márgenes idénticos;
- subir el costo después de congelar → todos los márgenes idénticos;
- subir el costo **sin** haber congelado → los márgenes cambian (o sea: el problema era real, no teórico).

**Las cuatro formas de venta se tratan distinto:**

| Forma | Qué pasa |
|---|---|
| Normal sin `costoUnit` | Se graba el costo actual del producto. |
| Múltiple / combo | Se graba línea por línea, y **solo** en las que faltaban. |
| Ya tenía `costoUnit` | No se toca. El cierre es idempotente: cerrar dos veces no vuelve a escribir nada. |
| Manual, o con el producto ya borrado | **No se congela y se avisa.** No hay de dónde sacar un costo; inventarle uno sería peor que dejarla sin margen. |

El diálogo de confirmación dice, antes de cerrar, cuántas ventas van a quedar con el costo clavado y cuántas se quedan sin él y por qué. Y la franja del mes cerrado lo recuerda después.

**788. Un solo cierre.** Había dos caminos para cerrar un mes —el botón viejo de Metas y el nuevo de Informes— cada uno con su propia escritura. Dos caminos para el mismo acto es la receta de que uno congele los costos y el otro no. Ahora los dos pasan por `ejecutarCierreDeMes()`.

**Un agujero lateral que apareció revisando esto:** la pantalla de "Ventas sin costo" (comentario 760) escribe `costoUnit` **directo**, sin pasar por `guardarVenta`, así que se saltaba el candado de mes cerrado. Escribir un costo ahí en una venta de un mes cerrado le habría cambiado el margen — justo lo que el congelado viene a impedir. Ya tiene su candado.

**Regla que sale de aquí:** *un candado puesto en la puerta principal no sirve si hay funciones que escriben por la ventana.* Cada vez que se agregue una pantalla que escriba directo con `updateDoc`, hay que preguntarse si debería pasar por `exigirMesAbierto`. Las dos encontradas hasta ahora (esta y `guardarCostosManuales`) no se encontraron leyendo el código: se encontraron preguntando *"¿qué más puede mover este número?"*.


### 14.27 Buscador global de clientes y distribuidores (comentarios 789–790)

Pedido de Ángel, de la lista: *"buscador global de clientes y distribuidores"*.

**Por qué importa más de lo que parece.** Hasta ahora, para mirar a alguien había que acordarse de en qué pantalla vive: los clientes en Clientes, los gimnasios en Distribuidores, el que debe en Deudores. Pero **cuando a uno le escriben por WhatsApp no piensa "esto es un distribuidor", piensa en el nombre.** La app obligaba a traducir la pregunta antes de poder hacerla.

El buscador entra por el nombre y **sale en la ficha (778)**. Es la pieza que le faltaba a la ficha para ser útil de verdad: tenerla a dos toques desde cualquier parte, en vez de navegar hasta la tabla donde está la fila.

Se abre con el botón 🔍 (header móvil y encima del menú en escritorio) o con **Ctrl/Cmd + K**. Se mueve con flechas, se abre con Enter, se cierra con Esc.

**790. Busca por tokens, no por substring.** Un `includes()` plano falla justo como la gente escribe cuando busca de afán:

| Se escribe | `includes()` | Por tokens |
|---|---|---|
| `bedoya sebas` | ✗ (el orden no coincide) | ✓ |
| `sebas` | ✓ | ✓ |
| `jeronimo` sobre "JERÓNIMO" | ✗ (la tilde) | ✓ |
| `tina` sobre "CREATINA" | ✓ **(ruido)** | ✗ |

La última fila es deliberada: un token calza si **alguna palabra empieza por él**, no si lo contiene. Buscar por el final de una palabra casi nunca es lo que uno quiere y llena la lista de basura.

**Dos decisiones de datos:**

- **Un distribuidor registrado manda sobre la entrada por nombre.** Si no, el mismo gimnasio saldría dos veces —una como cliente y otra como distribuidor— porque sus ventas llevan su nombre en `cliente` *y* su `distribuidorId`. Se unifican por nombre normalizado y gana el registro formal, que es el que tiene ficha, ciudad y teléfono. Un distribuidor **sin** compras también aparece: existe aunque todavía no haya vendido nada.
- **El índice se arma en el momento de buscar, no se cachea.** `DATA` cambia con cada `onSnapshot`; un índice viejo mostraría a alguien que ya no existe o escondería al que acabas de crear.

Cada resultado trae ya lo que uno iba a preguntar: cuántas compras, cuánto en total, cuándo fue la última y **cuánto debe** si debe algo. Con el buscador abierto y sin escribir nada, muestra a los que más compran.

**791. Un arreglo que solo apareció al probarlo en producción.** La primera versión mostraba **"OLIMPO GYM." y "OLIMPO GYM" como dos resultados distintos**: el registro del distribuidor lleva punto y algunas ventas no. El dato es así, pero en pantalla parece un error de la app.

Ahora se agrupa por una clave que ignora puntuación y la palabra DISTRIBUIDOR. Con dos cuidados que importan:

- **Solo se agrupa lo idéntico salvo puntuación.** Una variante de verdad distinta —"OLIMPO GIMNASIO"— **sigue saliendo aparte a propósito**: es un nombre mal escrito que hay que unificar (para eso está la herramienta del 715), y esconderlo haría creer que no existe.
- **Las cifras de un distribuidor son las de SU registro** (por `distribuidorId`), las mismas que muestran el comparativo y la ficha. Si el buscador sumara además las ventas sueltas con su nombre, tres pantallas darían tres números para la misma pregunta. Lo suelto se **avisa** en una etiqueta ámbar (*"⚠️ 2 sin vincular"*) en vez de sumarse en silencio.

**Regla que sale de aquí:** *una función de búsqueda se diseña contra cómo se escribe de afán, no contra cómo está guardado el dato.* Las tildes, el orden de los apellidos y los apodos no son casos raros: son el caso normal.

**Y la otra:** *cuando dos pantallas puedan responder distinto a la misma pregunta, una tiene que ceder y la otra avisar.* Sumar en silencio para que "cuadre" es cómo nacen los números que nadie puede defender.


### 14.28 Presentación: tema oscuro, menú, carga y marca (comentarios 792–799)

Ángel: *"sigamos con la presentación"* — los cuatro puntos del grupo.

**792. Primero los tokens, porque sin eso el modo oscuro era imposible.** Había **142 colores escritos a mano** repartidos por el archivo: `#FDE68A` para el borde ámbar, `#92400E` para su texto, `#BFDBFE` para el azul, y así. Mientras siguieran sueltos no había dónde cambiarlos. Se reemplazaron por tokens semánticos (`--amber-bd`, `--amber-ink`, `--blue-bd`, `--red-ink`, `--green-bd`…). Dos pasadas, 142 reemplazos, y lo que quedó crudo son los degradados de marca, que funcionan igual en los dos temas.

**793. El tema oscuro no es un invertido.** Los pasos oscuros se escogieron uno a uno contra el fondo oscuro; invertir produce textos que vibran y colores que se apagan. Tres estados, no dos: **automático** (sigue al sistema operativo, que es lo normal), claro y oscuro. El interruptor manda sobre el sistema en los dos sentidos, por eso la media query lleva el guardia `:not([data-theme])`.

El tema guardado se aplica en un `<script>` del `<head>`, **antes** del módulo: si se aplicara desde el módulo llegaría después del primer pintado y la pantalla daría un fogonazo blanco antes de ponerse oscura.

**795. El error clásico, evitado a propósito: `--on-ink`.** En claro, el texto sobre un fondo fuerte (`--ink`, `--red`, `--blue`) es blanco. En oscuro esos fondos **se vuelven claros**, así que ese texto tiene que volverse oscuro. Sin ese token, los chips activos, los badges de mora y el toast habrían quedado **blanco sobre blanco** — es el fallo más común al ponerle tema oscuro a una app que nació clara, y pasa justo en los elementos que uno menos mira al probar.

**794. La paleta de las gráficas se lee del CSS, no de una constante en JS.** Si estuviera escrita en el código habría dos listas de colores en sitios distintos y habría que acordarse de cambiar las dos. Los seis matices oscuros son los mismos tonos re-escalonados para fondo oscuro, **validados contra él** (ΔE adyacente ≥ 8.4 para daltonismo, los seis por encima de 3:1 de contraste). Al cambiar de tema se repinta la página: los colores van metidos en el `style` de cada barra, así que no se enteran solos.

**796. El menú en cuatro cajones — y un bug que llevaba meses a la vista.** `buildNav` sacaba un título de grupo "cuando cambiaba el grupo", recorriendo los ítems. Como el array tenía los grupos **interleaveados**, la barra mostraba **"Negocio" y "Operaciones" dos veces cada uno**. Ahora los grupos van contiguos *y* `buildNav` recorre los grupos, no las filas: volver a desordenar el array ya no puede repetirlos.

Los cajones se armaron por **el momento en que se usa cada cosa**, no por lo que es:

| Cajón | Qué lleva |
|---|---|
| Día a día | Inicio · Ventas · Deudores · Gastos |
| Quién compra | Clientes · Distribuidores · Consignación |
| Cómo vamos | Dashboard · Informes · Metas |
| Operación | Pedidos · Proveedores · Combos · Actividad |

**797. Esqueletos de carga.** Mientras Firebase responde, las pantallas salían en blanco y la app parecía rota —sobre todo con datos móviles flojos—. Ahora muestran bloques grises con un brillo que recorre de izquierda a derecha. Dos decisiones: el brillo recorre en vez de parpadear (un parpadeo compite con el contenido real cuando aparece), y **se espera a las tres colecciones esenciales** (ventas, gastos, inventario) antes de pintar datos: mostrar $0 mientras carga es peor que no mostrar nada, porque **parece un dato**.

**798–799. La marca.** Inter se queda para la interfaz —es la que mejor se lee a 11px en un celular, que es como se usa esto—. Se suma **Archivo** para lo que identifica: logo, títulos y cifras grandes. La razón de fondo no es estética: Archivo trae cifras tabulares de verdad, y en una app de plata que los números de una columna no bailen al pasar de $9.000 a $11.000 es lo que permite compararlos de un vistazo.

El logo era la letra "D" tecleada dentro de un cuadro. Ahora es un dibujo: **una D partida en dos piezas**, con una ranura entre la vara y el arco. No es decoración — DUPPLA viene de *dupla*, y el negocio son dos socios. Una letra hecha de dos partes dice eso sin explicarlo. Va en SVG inline (pesa nada, nítida en cualquier pantalla, toma el color de donde esté) y el mismo dibujo es el favicon, embebido como data-URI.

**800. Un problema que solo se vio al mirarlo en oscuro.** La gráfica de distribuidores dibujaba **una banda gris por cada distribuidor fuera del top 6**. Con catorce, cada columna eran ocho tiras grises y la gráfica se leía como ruido: lo que debía resaltar —quién carga el mes— quedaba enterrado bajo rayas del mismo color. (En claro ya pasaba; el contraste del tema oscuro lo hizo evidente.)

Ahora todo lo que no tiene color propio se apila en **una sola banda "Otros"**, que es lo que prescribe la regla de paletas categóricas: pasado el octavo color no se inventan matices, se dobla en "Otros". La leyenda nombra solo a los seis con color y cierra con *"Otros 8 · en la tabla"*. **La tabla sigue mostrando a todos, uno por uno** — es ahí donde se consulta el detalle; la gráfica es para la forma.

**Regla que sale de aquí:** *un tema oscuro no se agrega al final, se habilita.* El trabajo de verdad fue el 792 —sacar los colores del código— y eso no se ve en pantalla. Cuando alguien pida "modo oscuro" en una app con colores a mano, el 80% del tiempo se va en esa limpieza, y conviene decirlo antes de empezar.


### 14.29 Tres sesiones y resumen del mes (comentarios 801–809)

**801. Roles.** `admin` (Jero y Ángel) y `visitante` (solo lectura). El rol vive en la colección `usuarios`, **un documento por persona con su UID como id** — no se deduce del correo en caliente, se lee de la base, para que la misma fuente que usa la app la puedan usar las reglas de Firestore.

El rol se resuelve **antes** de pintar nada. Si se pintara primero y se ocultara después, el visitante vería los botones un instante.

**802. LO MÁS IMPORTANTE: esconder botones no protege nada.** Cualquiera con la consola del navegador abierta llama a la función que hay detrás. El candado real son las reglas de Firestore (`firestore.rules`), y **desde la app no se pueden desplegar: hay que pegarlas en la consola de Firebase.** Todo lo del lado del cliente sirve para que el visitante no vea cosas que no puede hacer y para que nadie se lleve un error feo del servidor. Nada más.

Corolario que se aplicó: si el servidor **rechaza** crear la ficha de usuario —que es justo lo que hacen las reglas con un rol no autorizado— la app **no** puede devolver 'admin' igual. Entra como visitante, que es la verdad de lo que esa persona puede hacer. Una interfaz que dice que mandas mientras el servidor te bloquea cada guardado es peor que una que te lo dice de frente.

**Alta automática, con el default que menos daño hace.** La primera vez que alguien entra se le crea su ficha. Si `usuarios` está vacía, ese primero es admin (única forma de arrancar sin tocar la consola); de ahí en adelante **todos entran como visitante** y un admin los asciende. Entre equivocarse dando permisos de más y de menos, se escoge de menos.

**803. Candado en las 44 funciones que escriben.** Puesto por script sobre la lista completa de `window.guardar*`, `eliminar*`, etc., no a ojo: a mano se olvida una, y la que se olvida es la que alguien encuentra.

**804. Modo solo lectura por lo que HACE cada botón.** La app escribe los manejadores en `onclick`, así que se esconde con selectores de atributo (`[onclick*="guardar"]`, `[onclick*="eliminar"]`…) en vez de marcar uno por uno los cientos que existen. Cualquier botón nuevo que siga la convención queda cubierto solo. Y una cinta pegada arriba dice siempre quién está conectado y con qué permiso: *si uno no sabe con qué cuenta está, acaba registrando algo donde no es.*

**806. Pantalla de Usuarios (solo admins).** Con dos candados que no son paranoia: un admin **no puede quitarse el permiso a sí mismo**, y **no se puede dejar la casa sin admins**. En los dos casos el desenlace es el mismo: nadie puede volver a dar permisos y hay que ir a arreglarlo a la consola.

**807–808. La firma y la ubicación.** Todo registro nuevo lleva quién lo hizo y cuándo. No es lo mismo que la bitácora (785): la bitácora cuenta la *historia* de los cambios; esto pega el autor al registro, para poder preguntarle a una venta de hace tres meses quién la metió. Los registros viejos **no llevan dato inventado**: se muestran como "Sin asignar", que es la verdad.

El stock sale por defecto de la ubicación de quien registra. Antes siempre arrancaba en Jero, así que cada venta de Ángel había que corregirla a mano o salía descontada del lado equivocado. Es un **punto de partida, no una obligación**: si no hay suficiente en su lado, se cae al otro igual que antes — no se rompe nada de lo que ya funcionaba.

**805. Resumen del mes.** Va por **ciclo de Duppla** (día 4 al 3), no por mes de calendario, porque es la ventana con la que cuadra todo lo demás; medirlo distinto haría que dos pantallas dieran dos números para la misma pregunta.

Las unidades salen de las **líneas**, no de las ventas: "3 creatinas + 1 whey" son 4 unidades, no 1. Y el dinero de una venta de varias líneas se reparte entre ellas, de modo que **la suma por producto da exactamente el total del mes** (probado como invariante).

La parte que no es obvia es la de los productos que se vendían antes y este mes no: **no están en las ventas del mes** —por definición no hay fila que contarles— así que hay que traerlos del histórico completo y ponerles cero. Es la información más útil de la pantalla y la única que no aparece sola. Se mira todo el histórico anterior, no solo el mes pasado: un producto que se vendía en mayo y lleva cuatro meses quieto es justo el que uno quiere ver.

La gráfica son **barras horizontales**: con quince nombres de producto, las verticales obligan a girar las etiquetas y no se leen.

**809. Las reglas.** `firestore.rules` + `COMO-ACTIVAR-LOS-PERMISOS.md` en el repo, con el orden exacto (crear la cuenta del visitante → que entren los dos admins → que entre el visitante → publicar las reglas) y la prueba que importa: entrar como visitante, abrir la consola y llamar a `guardarGasto()` a mano. Si no guarda, quedó bien.

**810. Un arreglo que solo se vio con los datos reales.** La primera versión mostraba **86 "dormidos"** de golpe para septiembre: ahí dentro estaba todo el catálogo histórico, incluido lo que no se vende desde mayo. Una tabla de 86 filas no es información, es ruido.

Ahora son dos grupos: **los que se cayeron** —vendían en los últimos 3 ciclos y este mes quedaron en cero, que es lo accionable— van en la tabla, ordenados por el que se cayó más recientemente. Los que llevan más tiempo quietos se cuentan **en una línea** al pie: no se pierden, pero no es una novedad de este mes.

**811. Dos detalles que solo aparecieron mirando la pantalla con datos de verdad.** El texto decía **«quedóaron»**: estaba conjugando el verbo pegando un sufijo (`'quedó' + (n!==1?'aron':'')`). Eso funciona en inglés y casi nunca en español — ahora las dos frases se escriben enteras. Y la tabla salía con **55 filas**; va con tope de 20, que son las que se cayeron más recientemente, y el resto se cuenta al pie.

**Regla que sale de aquí:** *un permiso que solo existe en la interfaz no es un permiso, es una sugerencia.* Y cuando el despliegue de la parte que sí protege queda fuera del alcance de uno, lo honesto es decirlo en grande y dejar los pasos escritos — no entregarlo como si estuviera hecho.


### 14.30 La limpieza grande: un solo significado por número (comentarios 812–822)

Ángel dictó esta tanda durante varios días en modo "anota y no ejecutes todavía". Lo que pidió, en sus palabras: *"Necesito ese dashboard lo más limpio posible. Ese dashboard y toda la plataforma"*, *"no quiero relleno"*, *"lo que quede huérfano o que no abra nada, debes quitarlo"*, *"todas las palabras que pueden tener un acceso directo a información, que no se quede como ahí, sino que nos lleve a la info"*.

**812. El Dashboard llevaba semanas en blanco y nadie lo sabía.** En el 774 se borró el cálculo de `low`/`alertHtml` (el banner de stock bajo) pero quedó un `${alertHtml}` suelto en la plantilla, en la línea 4260. Un template literal con una variable inexistente **no falla al cargar**: falla el día que alguien abre esa pantalla, lanza `ReferenceError` antes de asignar el `.innerHTML`, y la página queda vacía. De paso se llevó los botones de exportar CSV/PDF, que vivían en ese mismo encabezado.

**Regla que sale de aquí, y es la más cara de esta sesión:** *al borrar una variable, buscar su nombre en TODO el archivo, no solo en el bloque que se está editando.* Un `node --check` pasa igual. Lo encontró una revisión que leyó la pantalla entera, no el diff.

**813. Nada bloquea registrar una venta.** Se quitaron los seis guardas de "Stock insuficiente" (`guardarVenta`, `guardarEditarVenta`, el guarda de stock negativo, `guardarVentaCombo`, `guardarConsumo`, `guardarDejarConsignacion`) y el bucle de pre-chequeo de combos. Ángel: *"hoy fui a registrar una y no me dejó porque no había stock de un producto"*.

El argumento es simple y vale para cualquier app de negocio: **nunca se hizo un conteo físico**, así que la cantidad que guarda la app es una suposición. Una suposición no puede impedir registrar una venta que de verdad ocurrió. El inventario pasa a ser **una base de datos de nombres y precios**, que es para lo que se usa.

**814–815. El inventario deja de pretender saber cuánto hay.** Fuera la columna Stock, el semáforo, el reparto J/Á de la tabla, la columna "Valor total", el botón "± Stock", el banner de stock bajo, y las frases de "inventario a precio de costo" en Inicio, Informes y la previa del cierre. La pestaña ahora dice lo que es: *"N productos · nombres y precios"*.

**816–817. Barrido de huérfanos.** Combos salió del menú (la página y los datos se conservan: las ventas viejas de combo se siguen viendo en Ventas). Y se borraron diez cosas que no abrían nada: `autorDe`, `toggleDetalleVenta` + `ventaDetalleId`, `fillVentaPrecio`, `seleccionarPrecio`, `actualizarTablaInventario`, `DUPPLA_MES_TRANSICION`, `renderPapelera` con su `<div id="page-papelera">` y su entrada en el router, y `rotacionAbierta`/`reposicionAbierta` fijados en `false`.

**818. "Utilidad neta" significaba tres cosas distintas.** El Dashboard la calculaba por su cuenta, Inicio la llamaba "Utilidad real" y los Informes usaban `estadoFinanciero`. Tres sitios, tres números, y el usuario leyendo el que le tocara. Ahora **el Dashboard también pasa por `estadoFinanciero`** y en Inicio se llama igual que en todas partes. Un concepto, un nombre, un número.

**819–820. Tocar una palabra y que explique.** `GLOSARIO` es el único sitio donde cada concepto está definido: diez entradas (vendido, margen bruto, gastos, utilidad neta, por cobrar, mercancía, flujo de caja, punto de equilibrio, ticket, cobros viejos), cada una con **qué es** (una frase, sin jerga), **cómo se calcula** (para poder rehacerlo a mano) y **ojo con esto** (la trampa que tiene, que suele ser lo más útil).

Por qué las definiciones viven en un solo objeto y no sueltas en cada pantalla: porque sueltas es exactamente como nació el problema del 818. Si la definición se escribe en seis sitios, en tres meses hay seis definiciones.

Se usa por tres vías: `tarjetaConcepto` (las métricas del Dashboard, tocables), `palabraConcepto` (once palabras en Inicio, Gastos e Informes, con subrayado punteado) y `bloqueConcepto` (**820**), que mete la definición **arriba del listado de registros** cuando se abre el detalle desde Inicio. Esa última es la que cierra el círculo: antes, tocar una cifra llevaba a sus registros sin decir qué era la cifra. La alternativa era un "?" al lado de cada número — dos gestos, dos destinos, y más suciedad justo en las pantallas que se estaban limpiando. Un solo toque da las dos cosas. El aviso azul que explicaba a mano los "cobros viejos" se borró: decía lo mismo que `GLOSARIO.cobrosViejos`.

**821. Registrar una venta: un solo camino.** Ángel: *"hay demasiados botones, necesito que me dejes seleccionar el producto que se vendió, si son varios productos"*. Salieron los tres botones de modo (📦 Inventario / ✏️ Manual / 🎁 Combo) y el formulario manual completo que vivía escondido debajo:

- **Combo** llevaba a una pantalla que ya no está en el menú (816).
- **Manual** hacía lo mismo que la línea manual del 583, pero peor: un solo producto, sin poder mezclarlo con los de catálogo, y prohibido al editar. Guardaba **exactamente el mismo documento** que la línea manual (`esManual:true`, `prodId:null`, `costoUnit:null`), así que no se perdió ningún caso de uso: una línea manual única cae en `lineasValidas.length === 1 && esManual`.
- **Inventario**, sin los otros dos, era un toggle de una sola opción: un botón que no hace nada.

Con eso murió también el `if(esInv)` de `calcVentaTotal` —el único motivo por el que el toggle existía— y `setTipoProducto` entero.

Lo demás de esta pantalla: `inputmode="numeric"` en cantidad, precio, pagado y el desglose mixto (*"cuando yo esté colocando el precio, despliégame el teclado que es solo números"* — `type="number"` no basta, en el móvil sigue saliendo la fila de símbolos); fuera el "Stock: N" del lado de cada producto en el buscador, por lo mismo del 813; y los botones de ubicación J/Á sin contadores y **sin el `disabled`** que traían cuando la ubicación marcaba cero. Ese `disabled` era un bloqueo escondido del tipo que el 813 quitó, y encima estaba roto: metía un **segundo atributo `style`** en el mismo botón, que el navegador ignora, así que el botón se veía normal y no respondía. La peor combinación posible.

**822. Cuánto registró cada uno, sin protagonismo.** Ángel: *"la venta que se registre, que le cuente a cada uno... quiero que aparezca cuánto he vendido yo y cuánto ha vendido él"*, y después, preguntado por el tono: *"que sea sin protagonismo"*.

Va **al pie del Resumen del mes**, no en el Dashboard: quien quiera verlo lo busca, pero no se lo encuentra de frente cada vez que abre la app. Sin medallas, sin podio, sin pintar de verde al que va arriba. Es un reparto, no una competencia.

Y dice con esas palabras lo que de verdad mide: **quién metió la venta en la app**, no quién la cerró con el cliente. Si Jero vende y Ángel la registra, queda a nombre de Ángel. Prometer "quién vendió" cuando el dato es "quién tecleó" es justo la clase de número que después nadie se cree. Las ventas anteriores al sello (801–808) caen en **"Sin asignar"**, que es la verdad, y si **ningún** registro del mes tiene autor la tarjeta entera no aparece: una tabla de una fila que dice "Sin asignar: todo" no informa nada y ocupa pantalla.

Probado con 13 casos (`registradores`): tres autores conviviendo con ventas sin sello, sello en blanco contado como sin asignar, el invariante de que **la suma por autor da el total del mes**, ventas fiadas contadas completas, `pagado` acumulado mayor que el total, meses sin ningún sello, ventas de otros ciclos excluidas, y una venta múltiple contando **una vez** para su autor aunque aporte tres unidades.


### 14.31 La dona: una sola gráfica de reparto (comentario 824)

Ángel mandó una infografía de anillos y pidió "este tipo de gráficas" en productos vendidos y en distribuidores. Se construyó **una sola** —`donaHtml` + `repartoParaDona`— y la usan las dos pantallas, para que un anillo signifique siempre lo mismo.

**Qué responde una dona y qué no.** Responde bien "de todo lo del periodo, cuánto se llevó cada quién". No responde comparar dos cosas parecidas —dos pedazos de 18% y 20% nadie los distingue a ojo— ni la evolución mes a mes. Por eso **la tabla se queda** en las dos pantallas: la dona es para el golpe de vista, la tabla para consultar. Y en Distribuidores la dona **no reemplaza** las columnas apiladas: son dos preguntas distintas (quién pesa / cómo va cada mes) y cada una tiene su forma.

**En Resumen del mes** la dona sustituyó las barras horizontales de unidades, por decisión de Ángel. Mide **plata, no unidades**: un producto barato que sale mucho llenaba la barra y no es el que sostiene el mes. Las unidades siguen, en el renglón de cada producto de la leyenda.

**Las reglas que no son de gusto:**

- **Tope de 6 pedazos + "Otros".** Con setenta productos o catorce distribuidores, una dona de setenta tajadas es un disco de colores. Misma regla del 800.
- **Hueco de 2–3px entre pedazos**, del color del fondo. Sin él, dos colores pegados se leen como uno solo.
- **El nombre nunca va solo en el color.** Cada pedazo tiene su renglón con nombre, porcentaje y valor. Quien no distingue rojo de verde —y quien mira el celular al sol— lee la gráfica igual.
- **El color sigue a la entidad, no a su puesto.** En Distribuidores la dona NO reparte colores otra vez: toma el `f.color` que ya trae cada fila, el mismo de las columnas y de la tabla. Si GO UP es azul arriba, es azul en la dona.
- **Un color de aviso no puede ser también un color de serie.** "Sin vincular" iba a ir en ámbar, como en la tabla — pero el ámbar ya es la serie 4, y dos ámbares en el mismo anillo se leen como el mismo distribuidor. Va en **gris rayado** (un `<pattern>` a 45°) con ⚠️ en el nombre: la textura dice "esto es un cajón, no una entidad" sin gastar un color. Dos grises planos tampoco servían — se probó y "Otros" y "Sin vincular" quedaban idénticos en el anillo.

**La paleta se validó con el script, no a ojo** (`validate_palette.js` de la skill de dataviz): las seis series pasan los cinco chequeos en claro y en oscuro, incluida la separación para daltonismo (ΔE adyacente 9,1 en claro / 8,4 en oscuro). El único WARN es de contraste contra el fondo claro en tres tonos, y lo cubre justo lo que ya hay: etiquetas visibles y tabla completa. El gris de "Otros" sale reprobado a propósito —no es un matiz categórico, es el gris de quitar énfasis—.

**825. La corrección: mes a mes, no acumulado.** Ángel, viendo la primera versión de la dona de Distribuidores: *"necesito que sea mensual, mes a mes, que yo abra y se vea; no un historial histórico, si no, eso no se entiende"*. Tenía razón, y el error era de concepto, no de código.

Una dona del acumulado de seis meses responde "quién ha pesado desde siempre" — una pregunta que casi nadie se hace, y que además se vuelve más rígida cada mes: con un año de datos, un distribuidor que dejó de comprar en marzo seguiría ocupando su pedazo. La pregunta real es **"este mes, ¿quién está moviendo el canal?"**, y esa solo se contesta con un mes a la vez.

La dona pasó a seguir el selector de ciclo que la página **ya tenía** (`distCicloOffset`, del 698): abre en el ciclo en curso, y los chips de mes se subieron a la tarjeta de la dona, que es lo primero que se ve al entrar. Son los mismos chips, no un selector nuevo — tocar un mes cambia la dona **y** las fichas de abajo. Tener dos selectores de mes en una pantalla es la repetición que Ángel marcó en Gastos (773).

**Un "Otros" no puede ser el pedazo más grande.** Con los datos reales de octubre, la primera versión mensual sacaba un pedazo con nombre del 50% y un "Otros 3" anónimo del otro 50% — porque los nombres se escogían por el ranking de seis meses, no por el del mes. Adentro de ese gris había gente que ESE mes compró más que el que sí aparecía. Ahora se nombran los 6 más grandes **del mes**; el color sigue saliendo del mapa global, así que quien compra todos los meses conserva su color siempre, y al que asoma un mes suelto se le presta uno de los que queden libres ese mes. Puede cambiarle de un mes a otro, pero **dentro de un mismo mes nunca hay dos pedazos del mismo color**, que es lo que hace falta para leer el anillo (probado con 7 casos).

Dos detalles que solo aparecen con datos reales: los chips se pintan **siempre**, aunque el mes elegido esté vacío (si desaparecieran justo cuando no hay ventas, no habría forma de volver a un mes que sí las tiene — un mes vacío se dice con palabras); y el color se sigue tomando del comparativo, no del ranking del mes: si se repartiera por el puesto de cada mes, cambiar de mes repintaría a todos y no se podría seguir a nadie con la vista.

**Y se miró renderizada**, que es lo que ningún validador hace: montada en un navegador con datos de prueba (12 productos, 9 distribuidores, ventas sin vincular), en claro y en oscuro, a 430px y a 1200px. De ahí salieron dos arreglos que no se ven en el código: los dos grises indistinguibles, y la leyenda estirándose hasta el borde en pantalla ancha —con el nombre a la izquierda y la cifra a media pantalla de distancia—, ahora con tope de 520px.


---
*Fin del documento. Para retomar el trabajo (Jero o Ángel, con cualquier instancia de Claude): clonar el repo, abrir la carpeta con Claude Code, y este archivo se carga solo como contexto. Verificar cualquier duda contra el `index.html` real antes de asumir algo de aquí — el código es la fuente de verdad, este documento es el mapa.*
