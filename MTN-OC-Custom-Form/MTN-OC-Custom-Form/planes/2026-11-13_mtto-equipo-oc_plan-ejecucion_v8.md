# Plan v8: selector de artículos con botón "Agregar artículo" en la pestaña Artículos

| Campo | Valor |
|---|---|
| Fecha | 2026-11-13 |
| Versión | 8 (sustituye la columna auxiliar y la línea temporal de v4 a v6; v7 no se aplicó) |
| Rama | `claude/wizardly-franklin-2fca8g` |
| Raíz SDF | `MTN-OC-Custom-Form/MTN-OC-Custom-Form/` |

Historial: v8, 2026-11-13, D-K: selector de artículos en un campo de página con botón al lado; D-L: el botón deja la línea abierta; D-M: selector y botón en la pestaña Artículos; D-N: llenado del selector en servidor y registro de entradas y errores del Client Script.

## 1. Contexto

La columna "Artículo del equipo" de la sublista no recibió opciones en sandbox (v5 y v6), y la línea temporal no se insertó.
En v6 la consola solo mostró `[sads_mtn] módulo cargado`, nunca `pageInit`. Queda abierta la posibilidad de que NetSuite no ejecute los eventos del Client Script.
El usuario cambia de método:
- Un campo de selección de página con los artículos del equipo.
- Un botón "Agregar artículo" en la misma fila que el selector, no en la barra de botones superior o inferior.

Decisiones del usuario:

| ID | Decisión |
|---|---|
| D-K | Selector de artículos como campo de página, con botón al lado |
| D-L | El botón pone el artículo en la línea en captura sin confirmarla; el usuario captura cantidad y pulsa el "Agregar" nativo |
| D-M | Selector y botón en la pestaña Artículos, encima de la sublista |
| D-N | Respaldo: `beforeLoad` llena el selector cuando el equipo ya se conoce, y cada evento del Client Script registra entrada y errores en la consola |

Las reglas RN-01 a RN-12 no cambian. RN-12 se mantiene: el artículo nativo sigue bloqueado y solo se asigna por script.

## 2. Mecanismo del botón (desviación D-O)

`form.addButton` solo coloca botones en las barras superior e inferior.
El botón se implementa como un campo de página tipo HTML en línea (`INLINEHTML`) con un `<button type="button">`.
Selector y botón quedan en la misma fila con `Field.updateLayoutType`: el selector en `STARTROW` y el botón en `ENDROW`.
El `onclick` llama a `require(['<ruta absoluta del CS>'], cs => cs.agregarArticuloSeleccionado())`.
`agregarArticuloSeleccionado` no usa el estado de la página: lee el registro con `N/currentRecord.get()`, así que funciona aunque NetSuite no invoque `pageInit` y aunque `require` devuelva otra instancia del módulo.
El HTML es estático: solo contiene la etiqueta de `config.js`, sin datos del usuario.
Desviación de la regla 19.7 del prompt (APIs no documentadas): el patrón `INLINEHTML` con `require` no aparece como tal en la documentación de Oracle.

## 3. Cambios por archivo

### 3.1 `lib/config.js`

| Cambio | Detalle |
|---|---|
| Renombrar | `FLD_COL_AUX` pasa a `FLD_SEL_ARTICULO`; se conserva el ID `custpage_sads_mtn_articulo` |
| Agregar | `FLD_BTN_AGREGAR = 'custpage_sads_mtn_btn_agregar'`; `ESTANDAR.SUBPESTANA_ARTICULOS = 'items'` (supuesto); `RUTAS.MODULO_CS = '/SuiteScripts/mtto_equipo/cs_sads_mtn_oc.js'`; `ETIQUETAS.LBL_BTN_AGREGAR = 'Agregar artículo'`; `MSG_09 = 'Seleccione un artículo del equipo.'` |
| Quitar | `PARAM_ITEM_TEMPORAL`, `FLD_ITEM_TEMPORAL`, `LBL_ITEM_TEMPORAL`, `ESTANDAR.FLD_PROVEEDOR` |

### 3.2 `ue_sads_mtn_oc.js`

`beforeLoad`, en el formulario exclusivo:
1. Pasos 1 y 2 sin cambio: tipo, contexto e identificación del formulario.
2. Agregar el selector (SELECT sin origen) y el botón (INLINEHTML) con `container` igual a `items`. Si NetSuite rechaza la pestaña, repetir sin `container` (área principal) y registrar en auditoría.
3. Layout: selector `STARTROW`, botón `ENDROW`.
4. D-N: si el registro ya tiene equipo (edición, copia o recarga por proveedor), `datos.prepararSeleccion` llena el selector con la opción vacía y los artículos (16 unidades). Si falla, se registra en auditoría y el Client Script muestra MSG-05.
5. Bloquear el artículo nativo (sin cambio).
6. Adjuntar el Client Script (sin cambio).
7. Se elimina la columna de la sublista y el campo oculto del artículo temporal.

`beforeSubmit`: se elimina el paso 3 (líneas temporales). Quedan 11 pasos numerados; la validación no cambia.

### 3.3 `cs_sads_mtn_oc.js`

| Elemento | Resultado |
|---|---|
| `pageInit` | Si hay equipo, `cargarSeleccion` y `poblarSelector` |
| `fieldChanged` | Equipo: `alCambiarEquipo` (RN-05) y `poblarSelector`. Subsidiaria: RN-09 sin cambio. Se elimina la rama de la columna |
| `validateField`, `validateLine`, `saveRecord` | Lógica de v4; se quita todo lo relacionado con la línea temporal |
| `lineInit`, `postSourcing` | Se eliminan; ya no hay opciones por línea ni línea temporal |
| `poblarSelector(registro)` | Nueva (2 llamadas): `getField` del selector, borrar opciones, insertar la opción vacía y los artículos del estado |
| `agregarArticuloSeleccionado()` | Nueva, exportada para el botón (1 llamada desde el HTML). Lee el registro con `currentRecord.get()`. Sin equipo: MSG-01. Sin artículo seleccionado: MSG-09. Si la línea en captura es una existente, abre una línea nueva con `selectNewLine`. Asigna el artículo nativo con sourcing síncrono, sin confirmar. Comprueba que el artículo quedó asignado; si no, lo registra (S-06). Limpia el selector |
| `protegido(nombre, funcion)` | Nueva (6 llamadas: 5 puntos de entrada y el botón). Registra `entrada <nombre>` con modo, `fieldId` y `sublistId`. Atrapa el error, registra `error en <nombre>` con nombre, mensaje y pila, y lo vuelve a lanzar |
| Se eliminan | `asegurarLineaTemporal`, `esLineaTemporal`, `poblarOpcionesLineaActual` |
| Módulos | Se agrega `N/currentRecord` (permitido por la sección 14.2 del prompt) |

Criterio D-G: toda función declarada es punto de entrada, se exporta para el botón o tiene 2 o más llamadas.

### 3.4 Otros archivos

| Archivo | Cambio |
|---|---|
| `src/Objects/customscript_sads_mtn_ue_oc.xml` | Se quita el parámetro `custscript_sads_mtn_item_temporal`. Si SDF no lo borra en la cuenta, se borra a mano; sin uso no tiene efecto |
| `README_mtto_equipo.md` | Propósito; componentes; sección 5.1 (formulario); nueva sección 5.6 "Selector y botón" en lugar del artículo temporal (inactivar el artículo temporal ya creado); pruebas; diagnóstico 7.1; gobernanza (`beforeLoad` 0 a 16 unidades); desviaciones D-K a D-O y MSG-09; riesgos; pendientes sin `ITEM_TEMPORAL_*` |
| `planes/2026-11-13_mtto-equipo-oc_plan-ejecucion_v8.md` | Copia de este plan |

`lib/reglas.js` y `lib/datos.js` sin cambios.

## 4. Pruebas en sandbox

| Caso | Escenario | Resultado esperado |
|---|---|---|
| POC-1 | OC nueva: elegir equipo | El selector de la pestaña Artículos muestra solo los artículos del equipo, ordenados |
| POC-2 | Editar una OC con equipo | El selector viene lleno desde la carga (servidor) |
| POC-3 | Elegir artículo y pulsar "Agregar artículo" | La línea en captura recibe el artículo con precio, descripción, unidad e impuesto; queda sin confirmar; el selector se limpia |
| POC-4 | Formulario exclusivo | Artículo nativo no editable; asignación por el botón funciona |
| SB-15 | Pulsar el botón sin artículo, o sin equipo | MSG-09, o MSG-01 |
| SB-16 | Ubicación | Selector y botón en la misma fila, en la pestaña Artículos, encima de la sublista |
| SB-17 | Elegir equipo y después proveedor (la página se recarga) | Después de la recarga el selector sigue lleno |
| SB-01 a SB-14 | Sin cambio | Según la sección 6 del README |

## 5. Verificación en la sesión

| Verificación | Método | Criterio |
|---|---|---|
| Criterio D-G | Conteo de llamadas de cada función declarada en UE y CS | Cumple |
| Sintaxis y XML | `node --check`, `xmllint --noout` | Sin errores |
| IDs y dependencias | Búsquedas estáticas | IDs solo en `config.js`; `reglas.js` y `config.js` sin `N/` |
| Servidor | Comprobación desechable: `beforeLoad` agrega selector y botón en `items`, usa el área principal si `items` falla, llena el selector cuando hay equipo; `beforeSubmit` con los 12 escenarios previos | Todos pasan |
| Cliente | Comprobación desechable: `poblarSelector`; botón sin equipo, sin artículo, con línea existente en captura y con línea nueva; `protegido` registra y vuelve a lanzar | Todos pasan |
| Git | Commit y push a `claude/wizardly-franklin-2fca8g` | — |

## 6. Riesgos

| ID | Enunciado | Fundamento | Consecuencia | Mitigación |
|---|---|---|---|---|
| R-12 | NetSuite puede rechazar campos de script en la pestaña estándar `items` | Supuesto: `container` con una pestaña estándar | Selector y botón quedan en el área principal | Respaldo automático y registro en auditoría; SB-16 |
| R-13 | El `require` desde el HTML del botón puede no resolver la ruta del módulo | Patrón no documentado por Oracle (D-O) | El botón no hace nada | `protegido` registra la entrada del botón; si no aparece `entrada agregarArticuloSeleccionado`, se ajusta la ruta |
| R-14 | El artículo nativo bloqueado puede ignorar la asignación por script | Supuesto S-06 | La línea queda sin artículo | El botón comprueba y registra la asignación; POC-3 y POC-4 |
| R-15 | NetSuite puede no invocar los eventos del Client Script | Evidencia de v6 | El selector no se actualiza al cambiar de equipo sin recarga; las validaciones de pantalla no corren | El llenado en servidor cubre la carga y la recarga; el servidor sigue validando; `protegido` lo confirma |
