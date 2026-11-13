# Equipo de transporte en Órdenes de compra (`mtto_equipo`)

| Campo | Valor |
|---|---|
| Versión | 1.7, 2026-11-13 |
| Diseño de origen | `planes/2026-11-12_mtto-equipo-oc_prompt_v1.md` |
| Plan de ejecución | `planes/2026-11-13_mtto-equipo-oc_plan-ejecucion_v4.md`; cambios en `..._v5.md`, `..._v6.md`, `..._v8.md`, `..._v9.md` y `..._v10.md` (vigente) |
| Tipo de proyecto | SDF, personalización de cuenta |
| Estado del despliegue al instalar | Pruebas |

## 1. Propósito

En el formulario exclusivo de OC de mantenimiento, al elegir el equipo de transporte en la cabecera, el selector "Artículo del equipo" de la pestaña Artículos ofrece solo los artículos de la búsqueda guardada de ese equipo.
Junto al selector, en la misma fila, el botón "Agregar artículo" pone el artículo elegido en la línea en captura de la sublista; el usuario captura la cantidad y pulsa el "Agregar" nativo.
El campo nativo de artículo queda bloqueado en ese formulario.
Al guardar, en cualquier contexto (pantalla, CSV, servicios web, otros scripts), una OC con equipo se rechaza si tiene artículos fuera del listado.
Un equipo nuevo se da de alta sin cambios de código: un registro Equipo y una búsqueda guardada.

## 2. Componentes

### 2.1 Archivos (`src/FileCabinet/SuiteScripts/mtto_equipo/`)

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `ue_sads_mtn_oc.js` | User Event (`customscript_sads_mtn_ue_oc`) | `beforeLoad`: en el formulario exclusivo agrega el selector y el botón en la pestaña Artículos, llena el selector si el equipo ya se conoce y bloquea el artículo nativo (7 pasos numerados). `beforeSubmit`: rechaza el cambio de equipo en edición en línea y valida equipo, subsidiaria y artículos (11 pasos numerados). Es la garantía |
| `cs_sads_mtn_oc.js` | Client Script (`customscript_sads_mtn_cs_oc`), con despliegue propio en Orden de compra | Solo actúa en formularios que tienen el selector. Carga los artículos del equipo y llena el selector, atiende el botón "Agregar artículo", confirma y reinicia líneas al cambiar el equipo, limpia el equipo si cambia la subsidiaria, valida la línea y el guardado, y registra cada evento en la consola |
| `lib/reglas.js` | Reglas puras, sin módulos `N/` | RN-02, RN-03, RN-04, RN-05, RN-08, RN-10 |
| `lib/datos.js` | Acceso a datos con `N/search` | Lee el registro Equipo y la búsqueda guardada; arma la lista de artículos (UC-01) |
| `lib/config.js` | Configuración, sin módulos `N/` | IDs, etiquetas, rutas, límite de filas, mensajes MSG-01 a MSG-09 y códigos `MTTO_*` |

En `ue_sads_mtn_oc.js` y `cs_sads_mtn_oc.js`, una función con una sola llamada no se declara: su código está escrito donde se usa (criterio D-G).
Las funciones declaradas son puntos de entrada, la función del botón o funciones con dos o más llamadas.

Flujo en pantalla: Client Script → `datos.prepararSeleccion` → `N/search`; botón → `agregarArticuloSeleccionado` → línea en captura.
Flujo al cargar: User Event → `datos.prepararSeleccion` → selector lleno si el equipo ya se conoce.
Flujo al guardar: User Event → reglas y `datos.prepararSeleccion` → `N/search`.

### 2.2 Objetos SDF (`src/Objects/`)

| Objeto | ID | Configuración |
|---|---|---|
| Tipo de registro | `customrecord_sads_mtn_equipo` | "Equipo de transporte"; Nombre e Inactivo estándar; tipo de acceso vacío en el XML (ajuste del usuario para desplegar, commit `8abeb0b`): NetSuite aplica su valor predeterminado; revisarlo en el tipo de registro, campo Tipo de acceso |
| Campo del registro | `custrecord_sads_mtn_eq_busqueda` | Texto libre, obligatorio; ID de script de la búsqueda |
| Campo del registro | `custrecord_sads_mtn_eq_subsidiaria` | Lista/registro Subsidiaria, obligatorio |
| Campo de cabecera | `custbody_sads_mtn_equipo` | Lista/registro Equipo; aplica a compras; no obligatorio a nivel de campo; filtrado por subsidiaria de la transacción |
| Script | `customscript_sads_mtn_ue_oc` | User Event; parámetro `custscript_sads_mtn_form_id` (entero, sin valor) |
| Despliegue | `customdeploy_sads_mtn_ue_oc` | Orden de compra; Pruebas; bitácora Error; audiencia todos los roles |
| Script de cliente | `customscript_sads_mtn_cs_oc` | Client Script; archivo `cs_sads_mtn_oc.js` |
| Despliegue de cliente | `customdeploy_sads_mtn_cs_oc` | Orden de compra; Pruebas; bitácora Error; audiencia todos los roles |

### 2.3 Campos de página (los agrega `beforeLoad`; no se almacenan)

| Campo | ID | Tipo | Ubicación |
|---|---|---|---|
| Selector "Artículo del equipo" | `custpage_sads_mtn_articulo` | Selección sin origen | Pestaña Artículos (`items`), inicio de fila |
| Botón "Agregar artículo" | `custpage_sads_mtn_btn_agregar` | HTML en línea con un `<button>` | Misma fila, al lado del selector |

Si NetSuite rechaza la pestaña Artículos como contenedor, ambos se agregan en el área principal y la bitácora registra "Selector no agregado en items".

### 2.4 Objetos manuales

| Objeto | Responsable |
|---|---|
| Formulario exclusivo de OC de mantenimiento | Administrador |
| Búsquedas guardadas `customsearch_sads_mtn_<equipo>` | Administrador |
| Registros Equipo | Administrador (manual o CSV) |
| Permisos de roles | Administrador |

## 3. Paso 0: inventario en cuenta (obligatorio antes de desplegar)

El inventario no se ejecutó durante el desarrollo porque el conector de NetSuite no estaba disponible.
El administrador lo ejecuta en cada ambiente antes del paso 1.

| # | Revisión | Ruta en NetSuite | Condición de paro |
|---|---|---|---|
| 1 | Despliegues de script activos sobre Orden de compra | Personalización > Scripting > Despliegues de script; filtrar Tipo de registro = Orden de compra y Desplegado = Sí | Otro script modifica líneas, el campo de artículo o el formulario, o tiene validación `beforeSubmit` sobre líneas |
| 2 | Workflows activos sobre Orden de compra | Personalización > Flujo de trabajo > Flujos de trabajo; filtrar Tipo de registro = Orden de compra | Un workflow modifica líneas o el artículo |
| 3 | Colisión de IDs | Personalización > Listas, registros y campos > Tipos de registro y Campos de cuerpo de transacción; Personalización > Scripting > Scripts | Existe alguno de los IDs de la sección 2.2 |
| 4 | IDs estándar de línea | Records Browser de SuiteScript, registro Purchase Order, sublista `item` | `lineuniquekey`, `quantityreceived` o `quantitybilled` no existen con ese ID |

Formato del reporte: objeto, tipo, ID, evento o disparador, qué hace sobre artículos o cabecera, riesgo (Alto, Medio, Bajo, Ninguno).
Con un riesgo Alto, el despliegue se detiene y se revisa con desarrollo.
Si un ID estándar difiere, se corrige solo en `lib/config.js`.

## 4. Despliegue

| Paso | Ambiente | Acción | Criterio de salida |
|---|---|---|---|
| 0 | Sandbox | Inventario de la sección 3 | Sin riesgo Alto |
| 1 | Local | Autenticar y validar contra el sandbox (comandos abajo) | Validación sin errores |
| 2 | Sandbox | Desplegar el proyecto | Registro, campos, los dos scripts y sus despliegues en estado Pruebas |
| 3 | Sandbox | Crear el formulario exclusivo y ocultar `custbody_sads_mtn_equipo` en los demás formularios de compra (secciones 5.1 y 5.2) | — |
| 4 | Sandbox | Capturar el ID interno del formulario exclusivo (`FORM_ID_SANDBOX`) en `custscript_sads_mtn_form_id` del despliegue | El selector y el botón aparecen en la pestaña Artículos |
| 5 | Sandbox | Crear dos búsquedas piloto (sección 5.3) y dos registros Equipo (sección 5.4) | — |
| 6 | Sandbox | Asignar permisos (sección 5.5) | — |
| 7 | Sandbox | Bitácora del despliegue en Auditoría; ejecutar las pruebas de la sección 6 | POC-1 a POC-3 aprobadas; si alguna falla, la solución no avanza |
| 8 | Sandbox | Los dos despliegues a Liberado; prueba con usuarios de los roles de captura; bitácora de vuelta a Error | Sin incidencias |
| 9 | Producción | Repetir pasos 0 a 6 con `FORM_ID_PRODUCCION`; alta de todos los equipos y búsquedas | — |
| 10 | Producción | Piloto con usuarios reales y liberación general | Cero OC con equipo y artículos fuera de listado |

Comandos de los pasos 1 y 2, desde la carpeta del proyecto SDF:

```bash
suitecloud account:setup
```

```bash
suitecloud project:validate --server
```

```bash
suitecloud project:deploy
```

Revisiones después del paso 2:

| Revisión | Dónde | Esperado |
|---|---|---|
| Filtrado de contexto | Despliegue `customdeploy_sads_mtn_ue_oc`, pestaña de contexto de ejecución | Todos los contextos marcados; el XML no los restringe |
| Audiencia | Despliegues `customdeploy_sads_mtn_ue_oc` y `customdeploy_sads_mtn_cs_oc`, pestaña Audiencia | Todos los roles |
| Estado Pruebas | Ambos despliegues | En Pruebas solo corren para el propietario del script; probar con ese usuario hasta el paso 8 |
| Filtro del campo de cabecera | `custbody_sads_mtn_equipo`, pestaña Sourcing & Filtering | Subsidiaria del equipo igual a la subsidiaria de la transacción. Si SDF no lo aplicó, configurarlo a mano |
| Aplicación del campo de cabecera | `custbody_sads_mtn_equipo`, pestaña Aplica a | Compras; el campo puede verse en otras transacciones de compra y debe ocultarse en sus formularios |
| Parámetro retirado | Script `customscript_sads_mtn_ue_oc`, pestaña Parámetros | `custscript_sads_mtn_item_temporal` ya no se usa. Si SDF no lo borró, se puede borrar a mano; sin uso no tiene efecto |
| Artículo temporal | Artículo "NO USAR - LÍNEA TEMPORAL", si se creó en la versión 1.2 | Inactivarlo; ya no se usa |

## 5. Configuración manual

### 5.1 Formulario exclusivo de OC de mantenimiento

| Requisito | Motivo |
|---|---|
| Mostrar `custbody_sads_mtn_equipo` como obligatorio | RN-06: equipo obligatorio para capturar y guardar |
| Mantener visible la pestaña Artículos | Ahí se agregan el selector y el botón |
| Mantener visibles las columnas Artículo, Cantidad, Recibido y Facturado | El usuario ve el artículo asignado y captura la cantidad; el Client Script lee recibido y facturado para RN-10 |
| Capturar su ID interno en `custscript_sads_mtn_form_id` | El User Event solo actúa en ese formulario |

### 5.2 Otros formularios de compra

Ocultar `custbody_sads_mtn_equipo`.
En esos formularios no hay selector, botón ni bloqueo del campo nativo.
La validación de servidor aplica a cualquier OC que tenga equipo, sin importar el formulario.

### 5.3 Contrato de la búsqueda guardada

| Requisito | Motivo |
|---|---|
| Tipo de búsqueda: Artículo o un subtipo de artículo (por ejemplo, Otro cargo para la compra, que NetSuite reporta como `otherchargepurchaseitem`) | El código no valida el tipo (D-S). El ID de cada fila se asigna al artículo nativo: una búsqueda de otro registro (cliente, transacción) daría IDs que podrían coincidir con artículos reales. Responsabilidad del administrador |
| Primera columna: nombre para mostrar | Es la etiqueta de la opción |
| El ID interno del artículo sale del resultado | No requiere columna de ID |
| Criterios: Inactivo = No; tipo Otro cargo para la compra; subsidiaria del equipo; padres de matriz excluidos si aplica | Solo artículos capturables en la OC |
| Columna opcional con etiqueta personalizada `MTTO_EXCLUIR` | Filas con valor verdadero (T, true, 1, Sí, Si, casilla marcada) se excluyen |
| Sin resumen ni agrupación | Una fila por artículo |
| Pública o compartida con los roles de captura | Se ejecuta con el rol del usuario, en pantalla y en `beforeLoad` |
| ID de script `customsearch_sads_mtn_<equipo>` | Portabilidad entre sandbox y producción |
| Máximo 1,000 filas | Se leen en una sola lectura; con 1,000 filas se registra advertencia en servidor |

El nombre para mostrar debe ser único por convención interna; no se valida (riesgo aceptado).

### 5.4 Registros Equipo

| Campo | Valor |
|---|---|
| Nombre | Nombre del equipo, visible en la OC y en los mensajes |
| Búsqueda guardada | ID de script de la búsqueda, por ejemplo `customsearch_sads_mtn_unidad01`; no el ID interno numérico |
| Subsidiaria | Subsidiaria del equipo |

### 5.5 Permisos

| Rol | Permisos mínimos |
|---|---|
| Roles de captura (`ROLES_CAPTURA`) | Orden de compra crear y editar; artículos ver; "Equipo de transporte" ver; audiencia de las búsquedas |
| Rol de configuración (`ROL_ADMIN_CONFIG`) | "Equipo de transporte" crear y editar; crear búsquedas públicas |

El selector se llena con el rol del usuario que abre la OC, en el servidor (`beforeLoad`) y en el cliente.
Si falta un permiso, el selector queda vacío; el registro de ejecución del User Event muestra el error "Selector sin artículos" con el usuario, el rol y el detalle de NetSuite.

| Revisión | Dónde | Requisito |
|---|---|---|
| Acceso a la búsqueda | Búsqueda guardada del equipo, casilla Pública o pestaña Audiencia | Pública, o con los roles de captura en la audiencia |
| Ejecución de la búsqueda | Búsqueda guardada, botón Ver resultados con el rol de captura | Devuelve los artículos esperados |
| Registro Equipo | Tipo de registro "Equipo de transporte", campo Tipo de acceso; y el rol de captura, pestaña Permisos | Según el tipo de acceso: con "Usar lista de permisos", el rol en la lista con nivel Ver; con "Requerir permiso de entradas de registros personalizados", ese permiso en el rol; con "Sin permiso requerido", nada |
| Artículos | Rol de captura, pestaña Permisos > Listas | Artículos con nivel Ver o superior |
| Valor de la búsqueda en el equipo | Registro Equipo, campo Búsqueda guardada | ID de script (`customsearch_...`) o ID interno de la búsqueda; no su título |

### 5.6 Selector y botón "Agregar artículo"

| Momento | Qué pasa |
|---|---|
| Abrir la OC con equipo (edición, copia o recarga al elegir proveedor) | `beforeLoad` llena el selector en el servidor; el Client Script lo vuelve a llenar con el mismo resultado |
| Elegir o cambiar el equipo | El Client Script confirma si hay líneas (RN-05), borra las líneas y vuelve a llenar el selector |
| Elegir un artículo y pulsar "Agregar artículo" | Si se estaba editando una línea existente, se abre una línea nueva. El artículo se asigna a la línea en captura con sourcing de precio, descripción, unidad e impuesto. La línea queda sin confirmar y el selector se limpia |
| Pulsar "Agregar artículo" sin artículo elegido | El botón carga los artículos del equipo en el selector y muestra MSG-09. Si la carga falla, muestra MSG-05 y la consola registra el código y el detalle |
| Capturar cantidad y pulsar "Agregar" de la sublista | NetSuite confirma la línea; `validateLine` comprueba que el artículo pertenece al equipo |

El botón no es un botón estándar de NetSuite: es un campo de HTML en línea que llama a `agregarArticuloSeleccionado` del Client Script.
Funciona aunque NetSuite no haya ejecutado `pageInit`, porque lee el registro directamente.
El Client Script se despliega en Orden de compra y se carga en todos sus formularios; solo actúa donde existe el selector.
Elegir proveedor recarga la página completa en OneWorld; el selector se vuelve a llenar en la carga.

## 6. Pruebas en cuenta

No hay pruebas locales; todas se ejecutan en sandbox.
Durante las pruebas, la bitácora de los despliegues va en Auditoría; para ver los mensajes de consola, activar el diagnóstico (sección 7.1).

| Caso | Regla | Escenario | Resultado esperado |
|---|---|---|---|
| POC-1 | — | OC nueva en el formulario exclusivo: elegir equipo | El selector muestra solo los artículos del equipo, ordenados |
| POC-2 | — | Editar una OC con equipo | El selector viene lleno desde la carga |
| POC-3 | — | Elegir artículo y pulsar "Agregar artículo" | La línea en captura recibe el artículo con precio, descripción, unidad e impuesto; queda sin confirmar; el selector se limpia |
| POC-4 | RN-12 | Formulario exclusivo | Campo nativo no editable; la asignación por el botón funciona |
| POC-5 | RN-04 | Copiar una OC | Equipo y líneas se conservan; el selector viene lleno; el servidor valida |
| POC-6 | — | Usuario de rol de captura sin privilegios de administrador | Selector lleno y botón funcional sin error |
| SB-01 | RN-07 | Equipo con búsqueda inexistente | MSG-05; selector vacío; línea rechazada |
| SB-02 | RN-05 | Cambio de equipo con líneas, confirmación aceptada | Cero líneas; selector con los artículos del nuevo equipo |
| SB-03 | RN-05 | Cambio de equipo con líneas, confirmación cancelada | Equipo, líneas y selector sin cambio |
| SB-04 | RN-03 | CSV con equipo y artículo fuera de listado | Rechazo con MSG-04 |
| SB-05 | RN-08 | CSV con equipo de otra subsidiaria | Rechazo con MSG-06 |
| SB-06 | RN-09 | Cambio de subsidiaria con equipo incompatible | Equipo limpio, líneas eliminadas y selector vacío |
| SB-07 | RN-10 | Edición de OC con línea recibida | Equipo bloqueado; cambio por CSV rechazado con MSG-07 |
| SB-08 | RN-11 | Edición en línea del equipo desde lista | Rechazo con MSG-08 |
| SB-09 | RN-06 | OC en otro formulario sin equipo | Sin efecto de la solución |
| SB-10 | RN-12 | OC en otro formulario | Campo nativo editable; sin selector ni botón |
| SB-11 | RN-04 | Edición: línea original con artículo retirado de la búsqueda, sin cambio; línea original cambiada a artículo válido; línea nueva válida | Guarda; la línea original sin cambio no se valida |
| SB-12 | RN-02 | Búsqueda con columna `MTTO_EXCLUIR` verdadera en un artículo | El artículo no aparece; opciones ordenadas por etiqueta |
| SB-13 | RN-10 | CSV que limpia el equipo de una OC con línea recibida | Rechazo con MSG-07 |
| SB-14 | RN-07 | Equipo con búsqueda de otro tipo o sin filas válidas | MSG-05 en pantalla; CSV rechazado con MSG-05 |
| SB-15 | — | Pulsar el botón sin artículo elegido, o sin equipo | Sin artículo: el selector se llena y aparece MSG-09. Sin equipo: MSG-01 |
| SB-16 | — | Ubicación | Selector y botón en la misma fila, en la pestaña Artículos, encima de la sublista |
| SB-17 | — | Elegir equipo y después proveedor (la página se recarga) | Después de la recarga el selector sigue lleno |

Si POC-1, POC-2 o POC-3 fallan, la solución no avanza a producción.

## 7. Mensajes, códigos y diagnóstico

| Código | Cuándo | Mensaje | Bitácora en servidor |
|---|---|---|---|
| `MTTO_ARTICULO_FUERA_DE_LISTADO` | RN-03 | MSG-04 con números de línea desde 1 | — |
| `MTTO_EQUIPO_NO_ENCONTRADO` | Equipo inexistente o inaccesible | MSG-05 | Error, con ID de equipo |
| `MTTO_BUSQUEDA_INVALIDA` | Búsqueda vacía, inexistente, de otro tipo, inaccesible o sin filas válidas | MSG-05 | Error, con ID de equipo, búsqueda y detalle |
| `MTTO_SUBSIDIARIA_INCOMPATIBLE` | RN-08 | MSG-06 | — |
| `MTTO_EQUIPO_NO_EDITABLE` | RN-10 y RN-11 | MSG-07 o MSG-08 | — |
| — | Botón sin artículo elegido | MSG-09 | — |

Mensajes de `beforeLoad` en nivel Error (visibles con la bitácora en Error): "Selector sin artículos: <código>", con equipo, búsqueda, usuario, rol y detalle de NetSuite.
Mensajes de `beforeLoad` en nivel Auditoría: "Selector llenado en servidor", "Selector no agregado en items", parámetro de formulario vacío, sublista no disponible, artículo nativo no bloqueado, búsqueda con 1,000 filas.

### 7.1 Diagnóstico en pantalla

El Client Script escribe mensajes con el prefijo `[sads_mtn]` en la consola del navegador (F12).
No muestra nada al usuario ni modifica la página.
Activar "Conservar registro" (Preserve log): elegir proveedor recarga la página y, sin esa opción, la consola se borra.
Viene apagado (`DIAGNOSTICO.ACTIVO = false` en `lib/config.js`). Para diagnosticar, cambiarlo a `true` y volver a desplegar; al terminar, regresarlo a `false`.

| Mensaje | Significado | Acción |
|---|---|---|
| Ningún mensaje `[sads_mtn]` | El navegador no carga el módulo, o el despliegue `customdeploy_sads_mtn_cs_oc` no corre para el usuario (estado Pruebas con otro usuario, o audiencia) | Revisar el despliegue de cliente; F12 > Red: `cs_sads_mtn_oc.js` y `lib/` con 200 |
| `módulo cargado` sin `entrada pageInit` | NetSuite carga el módulo pero no invoca sus puntos de entrada | Revisar errores rojos sin filtro y el despliegue de cliente; el botón sigue funcionando porque no depende de `pageInit` |
| `entrada <evento>` seguido de `error en <evento>` | El evento falla; el mensaje trae nombre, texto y pila | Corregir la línea indicada en la pila |
| `carga de artículos: falla` o `carga de artículos desde el botón: falla` | La búsqueda o el equipo fallan; también aparece MSG-05. El detalle trae el error de NetSuite | Revisar permisos y el registro Equipo (sección 5.5) |
| `selector llenado` con número de opciones | El selector se llenó desde el cliente | Ninguna |
| `selector no disponible` | El campo del selector no existe en la página | Revisar la bitácora de `beforeLoad` |
| Al pulsar el botón no aparece `entrada agregarArticuloSeleccionado` | El `require` del botón no encontró el módulo | Revisar `RUTAS.MODULO_CS` en `lib/config.js` contra la ruta real en el Gabinete de archivos |
| `artículo asignado a la línea en captura` | El botón funcionó | Ninguna |
| `artículo no asignado a la línea` | El artículo nativo bloqueado no aceptó la asignación por script (S-06) | Reportar; la alternativa es no bloquear el artículo nativo y confiar en `validateLine` y el servidor |

## 8. Gobernanza

| Componente | Operación | Unidades | Por ejecución | Total | Límite |
|---|---|---|---|---|---|
| UE `beforeSubmit` | Lectura de campos del equipo | 1 | 1 | 1 | 1,000 |
| UE `beforeSubmit` | Carga y lectura de la búsqueda | 5 + 10 | 0 o 1 | 0 a 15 | 1,000 |
| UE `beforeLoad` | Llenado del selector cuando el equipo ya se conoce | 16 | 0 o 1 | 0 a 16 | 1,000 |
| Client Script | Carga de artículos al iniciar o cambiar equipo | 16 | 1 por evento | 16 | 1,000 |
| Client Script | Botón "Agregar artículo" | 0 | — | 0 | 1,000 |

Costos de referencia; validarlos contra la documentación vigente de Oracle.

## 9. Reversión

Desmarcar los despliegues `customdeploy_sads_mtn_ue_oc` y `customdeploy_sads_mtn_cs_oc` (o cambiar su estado).
El formulario vuelve a comportamiento nativo, sin selector, botón ni bloqueo, y el guardado deja de validar.
El registro Equipo y el campo de cabecera pueden quedarse sin efecto operativo.

## 10. Desviaciones respecto del prompt v1

| ID | Desviación | Justificación |
|---|---|---|
| D-B | La validación al guardar evalúa RN-10 antes de "sin equipo" | Decisión del usuario: limpiar el equipo de una OC recibida o facturada es un cambio prohibido |
| D-C | Prefijo `_sads_mtn_` en IDs y archivos; se conservan `mtto_equipo`, `MTTO_*` y `MTTO_EXCLUIR` | Decisión del usuario |
| D-D | Sin Jest; T-01 a T-17 trasladados a pruebas en cuenta | Decisión del usuario |
| D-E | 5 archivos (Nivel 1) en lugar de 15 (Nivel 2) | Decisión del usuario; sin pruebas locales, puertos e inyección no aportan |
| D-G | En UE y CS, una función con una sola llamada se escribe donde se usa | Decisión del usuario: facilitar la auditoría |
| D-K | Selector de artículos en un campo de página, en lugar de la columna auxiliar de la sublista (D-09 del prompt) | Decisión del usuario: la columna no recibió opciones en líneas nuevas en sandbox |
| D-L | El botón deja la línea abierta; el usuario captura la cantidad y confirma con el "Agregar" nativo | Decisión del usuario |
| D-M | Selector y botón en la pestaña Artículos, en la misma fila | Decisión del usuario |
| D-N | `beforeLoad` llena el selector cuando el equipo ya se conoce (0 a 16 unidades; el prompt preveía 0) y el Client Script registra cada evento | Decisión del usuario: respaldo por si NetSuite no ejecuta los eventos del Client Script |
| D-O | El botón es un campo de HTML en línea que llama al Client Script con `require` | `form.addButton` solo coloca botones en las barras superior e inferior. El patrón no está documentado por Oracle (regla 19.7 del prompt) |
| D-P | Nuevo mensaje MSG-09: "Seleccione un artículo del equipo." | El botón necesita un aviso cuando no hay artículo elegido |
| D-Q | El Client Script tiene registro y despliegue propios en Orden de compra (`customscript_sads_mtn_cs_oc`), en lugar de adjuntarse con `clientScriptModulePath` | En sandbox, NetSuite cargó el módulo adjuntado pero nunca invocó `pageInit` ni `fieldChanged`; S-05 resultó falso en esta cuenta. Con el despliegue propio, la consola ya muestra `entrada validateField` y `entrada fieldChanged` |
| D-S | No se valida el tipo de la búsqueda guardada (el prompt pedía rechazar búsquedas que no fueran de Artículo, RN-07 y sección 13.3) | Decisión del usuario: las búsquedas ya filtran por tipo de artículo. En sandbox, NetSuite reporta las búsquedas como `otherchargepurchaseitem` y la validación las rechazaba |
| C-02 | `prepararSeleccion` acepta bitácora opcional y equipo ya leído | Advertencia solo en servidor; evita una segunda lectura del equipo |
| C-04 | MSG-05 con equipo inexistente muestra el ID (servidor) o el texto del campo (pantalla) | No hay nombre que mostrar |
| C-05 | `inactivo` se lee y no se usa | Ninguna regla lo consume |
| C-06 | Audiencia del despliegue: todos los roles | Un User Event sin audiencia no se ejecuta |
| C-08 | `alert()` y `confirm()` del navegador | `validateField` exige respuesta síncrona |
| I-01 | `saveRecord` sigue el orden del servidor y muestra MSG-05 si el equipo no existe o su búsqueda es inválida y hay líneas que validar | Mismo mensaje en pantalla y en servidor |
| I-02 | Al cambiar el equipo también se cancela la línea en captura | La línea en captura conservaría el artículo del equipo anterior |
| I-03 | La opción vacía del selector usa un espacio como valor | Evita depender de opciones con valor vacío |
| I-04 | Un error de permisos al leer el equipo se trata como equipo no encontrado | El acceso a datos devuelve nulo; el detalle queda en bitácora de servidor |
| I-05 | La etiqueta `MTTO_EXCLUIR` se compara sin distinguir mayúsculas | Tolera capturas del administrador |
| I-06 | Una línea sin artículo se considera fuera de listado | RN-03: se acepta solo si el artículo pertenece |
| I-07 | Etiquetas no definidas en el prompt: "Búsqueda guardada", "Subsidiaria", "Agregar artículo", nombre del script y título del despliegue | El prompt no las define |
| I-08 | `manifest.xml` declara como requeridas `CUSTOMRECORDS`, `SERVERSIDESCRIPTING` y `SUBSIDIARIES`, y `ACCOUNTING` como opcional | Ajuste del usuario para desplegar (commit `8abeb0b`); se retiró `CLIENTSUITESCRIPT` |
| I-09 | El parámetro `cf` se usa siempre que el registro no traiga formulario (creación y copia) | El prompt lo indica para creación; la copia también es creación |

Retirado en la versión 1.3: la columna auxiliar de la sublista, la línea temporal y el parámetro `custscript_sads_mtn_item_temporal` (decisiones D-H a D-J de la versión 1.2).

## 11. Valores pendientes

| Variable | Dónde se captura |
|---|---|
| `FORM_ID_SANDBOX` | `custscript_sads_mtn_form_id` del despliegue en sandbox |
| `FORM_ID_PRODUCCION` | `custscript_sads_mtn_form_id` del despliegue en producción |
| `ROLES_CAPTURA` | Sección 5.5 |
| `ROL_ADMIN_CONFIG` | Sección 5.5 |

## 12. Riesgos

| ID | Enunciado | Fundamento | Consecuencia | Mitigación |
|---|---|---|---|---|
| R-01 | Inventario en cuenta no ejecutado en desarrollo | Conector de NetSuite sin conexión | Un ID existente se sobrescribe o un script existente anula el selector o la validación | Paso 0 obligatorio y `project:validate --server` |
| R-02 | XML no validado contra el servidor | Red de desarrollo sin acceso a NetSuite | Errores de esquema aparecen en el paso 1 | Corregir y volver a validar |
| R-03 | Sin pruebas automatizadas | Decisión D-D | Una regresión futura solo se detecta en sandbox | Matriz SB-01 a SB-17; `lib/reglas.js` admite Jest sin reestructurar |
| R-04 | IDs estándar de línea y `selectrecordtype` -117 no verificados | Supuesto S-11 | RN-04 o RN-10 fallan en silencio | Paso 0, SB-07 y SB-11 |
| R-06 | `lineuniquekey` puede no estar disponible en cliente | Comportamiento de cliente no verificado | En edición, el Client Script valida todas las líneas y puede rechazar líneas originales que el servidor aceptaría | SB-11; el servidor sigue siendo la referencia |
| R-12 | NetSuite puede rechazar campos de script en la pestaña estándar `items` | Supuesto S-18 | Selector y botón quedan en el área principal | Respaldo automático y registro en auditoría; SB-16 |
| R-13 | El `require` del botón puede no resolver la ruta del módulo | Patrón no documentado por Oracle (D-O) | El botón no hace nada | El diagnóstico registra la entrada del botón; ajustar `RUTAS.MODULO_CS` |
| R-14 | El artículo nativo bloqueado puede ignorar la asignación por script | Supuesto S-06 | La línea queda sin artículo | El botón comprueba la asignación y lo registra; POC-3 y POC-4 |
| R-15 | Con el despliegue propio, NetSuite podría seguir sin invocar los eventos del Client Script | En sandbox, con `clientScriptModulePath`, la consola solo mostró `módulo cargado` (D-Q) | El selector no se actualiza al cambiar de equipo; las validaciones de pantalla no corren | El botón carga el selector si está vacío; el llenado en servidor cubre la carga y la recarga; el servidor sigue validando |
| R-16 | El Client Script se carga en todos los formularios de OC | Un despliegue de cliente aplica al tipo de registro, no al formulario | Descarga del módulo en cada OC; sin consultas ni efectos fuera del formulario exclusivo | `protegido` sale si no existe el selector |
| R-17 | En estado Pruebas, los scripts solo corren para el propietario | Comportamiento estándar de despliegues en Pruebas | Otros usuarios no ven el selector ni el botón funcional hasta pasar a Liberado | Probar con el propietario; liberar en el paso 8 |
| R-18 | El objeto SDF `clientscript` no se validó contra el servidor | Red de desarrollo sin acceso a NetSuite | Error de esquema en el paso 1 | `project:validate --server` antes de desplegar |
| R-19 | Permisos de búsqueda o de registro insuficientes para el rol que abre la OC | `search.load` y `lookupFields` corren con el rol del usuario | Selector vacío y MSG-05 | Registro en nivel Error con usuario, rol y detalle; sección 5.5 |
| R-20 | Una búsqueda que no sea de artículos se acepta sin aviso | D-S: sin validación de tipo | Sus IDs llenarían el selector y el conjunto permitido; un ID que coincida con un artículo real permitiría comprarlo | Contrato de búsqueda (sección 5.3); revisar cada búsqueda nueva antes de asignarla a un equipo |

## 13. Supuestos y fuentes

| ID | Supuesto | Se verifica en |
|---|---|---|
| S-02 | Los artículos son de tipo Otro cargo para la compra | Contrato de búsqueda |
| S-03 | Cada búsqueda devuelve pocas decenas de artículos | POC-1 |
| S-04 | Costos de gobernanza de la sección 8 | Documentación vigente |
| S-05 | El Client Script adjuntado por el User Event no requiere despliegue propio | Refutado en sandbox (2026-11-13): el módulo se cargó, pero sus eventos no se invocaron. Sustituido por D-Q |
| S-06 | El campo nativo de artículo puede bloquearse en `beforeLoad` y asignarse por script | POC-3 y POC-4 |
| S-09 | NetSuite impide eliminar líneas con recepción o factura | SB-07 |
| S-10 | Sourcing & Filtering no limpia el equipo al cambiar la subsidiaria | SB-06 |
| S-11 | IDs de línea `lineuniquekey`, `quantityreceived`, `quantitybilled` | Paso 0 |
| S-12 | `validateField` se dispara al cambiar el equipo y admite confirmación síncrona | SB-02 y SB-03 |
| S-13 | El formulario se identifica por `customform` o el parámetro `cf` | POC-1 |
| S-14 | El XML de SDF admite el filtro de Sourcing & Filtering del campo de cabecera | Paso 1 y revisión posterior al paso 2 |
| S-15 | El nombre para mostrar es único por convención interna | Riesgo aceptado |
| S-16 | `selectrecordtype` -117 corresponde a Subsidiaria | Paso 1 |
| S-17 | Límite de 40 caracteres por ID de objeto; el más largo usa 34 | Paso 1 |
| S-18 | `items` es el ID de la pestaña Artículos de la OC y admite campos de script como contenedor | SB-16 |
| S-19 | `require` con la ruta absoluta del Client Script resuelve el módulo desde el HTML del botón | Verificado en sandbox (2026-11-13): la consola registró `entrada agregarArticuloSeleccionado` |
| S-20 | Las búsquedas de los equipos solo devuelven artículos | Responsabilidad del administrador (D-S) |

Fuentes: prompt v1 y planes de ejecución en `planes/`; documentación de Oracle de `N/search`, `N/currentRecord` (`Field.insertSelectOption`, `Field.removeSelectOption`, `currentRecord.get`) y `N/ui/serverWidget` (`Form.addField`, `Field.addSelectOption`, `Field.updateLayoutType`).
