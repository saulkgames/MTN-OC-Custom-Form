# Equipo de transporte en Órdenes de compra (`mtto_equipo`)

| Campo | Valor |
|---|---|
| Versión | 1.1, 2026-11-13 |
| Diseño de origen | `planes/2026-11-12_mtto-equipo-oc_prompt_v1.md` |
| Plan de ejecución | `planes/2026-11-13_mtto-equipo-oc_plan-ejecucion_v4.md`; corrección en `..._v5.md` |
| Tipo de proyecto | SDF, personalización de cuenta |
| Estado del despliegue al instalar | Pruebas |

## 1. Propósito

En el formulario exclusivo de OC de mantenimiento, al elegir el equipo de transporte en la cabecera, la columna "Artículo del equipo" ofrece solo los artículos de la búsqueda guardada de ese equipo.
El campo nativo de artículo queda bloqueado en ese formulario.
Al guardar, en cualquier contexto (pantalla, CSV, servicios web, otros scripts), una OC con equipo se rechaza si tiene artículos fuera del listado.
Un equipo nuevo se da de alta sin cambios de código: un registro Equipo y una búsqueda guardada.

## 2. Componentes

### 2.1 Archivos (`src/FileCabinet/SuiteScripts/mtto_equipo/`)

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `ue_sads_mtn_oc.js` | User Event, único `scriptfile` | `beforeLoad`: en el formulario exclusivo agrega la columna auxiliar, bloquea el artículo nativo y adjunta el Client Script. `beforeSubmit`: rechaza el cambio de equipo en edición en línea y valida equipo, subsidiaria y artículos. Es la garantía |
| `cs_sads_mtn_oc.js` | Client Script, sin registro propio | Carga los artículos del equipo, confirma y reinicia líneas al cambiar el equipo, limpia el equipo si cambia la subsidiaria, llena las opciones de cada línea, asigna el artículo nativo y valida línea y guardado |
| `lib/reglas.js` | Reglas puras, sin módulos `N/` | RN-02, RN-03, RN-04, RN-05, RN-08, RN-10 |
| `lib/datos.js` | Acceso a datos con `N/search` | Lee el registro Equipo y la búsqueda guardada; arma la lista de artículos (UC-01) |
| `lib/config.js` | Configuración, sin módulos `N/` | IDs, etiquetas, límite de filas, mensajes MSG-01 a MSG-08 y códigos `MTTO_*` |

Flujo en pantalla: Client Script → `datos.prepararSeleccion` → `N/search`.
Flujo al guardar: User Event → reglas y `datos.prepararSeleccion` → `N/search`.

### 2.2 Objetos SDF (`src/Objects/`)

| Objeto | ID | Configuración |
|---|---|---|
| Tipo de registro | `customrecord_sads_mtn_equipo` | "Equipo de transporte"; Nombre e Inactivo estándar; acceso por lista de permisos, sin roles |
| Campo del registro | `custrecord_sads_mtn_eq_busqueda` | Texto libre, obligatorio; ID de script de la búsqueda |
| Campo del registro | `custrecord_sads_mtn_eq_subsidiaria` | Lista/registro Subsidiaria, obligatorio |
| Campo de cabecera | `custbody_sads_mtn_equipo` | Lista/registro Equipo; aplica a compras; no obligatorio a nivel de campo; filtrado por subsidiaria de la transacción |
| Script | `customscript_sads_mtn_ue_oc` | User Event; parámetro `custscript_sads_mtn_form_id` (entero, sin valor) |
| Despliegue | `customdeploy_sads_mtn_ue_oc` | Orden de compra; Pruebas; bitácora Error; audiencia todos los roles |

### 2.3 Objetos manuales

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
| 2 | Sandbox | Desplegar el proyecto | Registro, campos, script y despliegue en estado Pruebas |
| 3 | Sandbox | Crear el formulario exclusivo y ocultar `custbody_sads_mtn_equipo` en los demás formularios de compra (sección 5.1 y 5.2) | — |
| 4 | Sandbox | Capturar el ID interno del formulario exclusivo (`FORM_ID_SANDBOX`) en `custscript_sads_mtn_form_id` del despliegue | La columna "Artículo del equipo" aparece en el formulario |
| 5 | Sandbox | Crear dos búsquedas piloto (sección 5.3) y dos registros Equipo (sección 5.4) | — |
| 6 | Sandbox | Asignar permisos (sección 5.5) | — |
| 7 | Sandbox | Bitácora del despliegue en Auditoría; ejecutar POC-1 a POC-6 y SB-01 a SB-14 (sección 6) | POC-1, POC-2 y POC-3 aprobadas; si alguna falla, la solución no avanza |
| 8 | Sandbox | Despliegue a Liberado; prueba con usuarios de los roles de captura; bitácora de vuelta a Error | Sin incidencias |
| 9 | Producción | Repetir pasos 0 a 6 con `FORM_ID_PRODUCCION`; alta de todos los equipos y búsquedas | — |
| 10 | Producción | Piloto con usuarios reales y liberación general | Cero OC con equipo y artículos fuera de listado |

Comandos del paso 1 y 2, desde la carpeta del proyecto SDF:

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
| Audiencia | Mismo despliegue, pestaña Audiencia | Todos los roles |
| Filtro del campo de cabecera | `custbody_sads_mtn_equipo`, pestaña Sourcing & Filtering | Subsidiaria del equipo igual a la subsidiaria de la transacción. Si SDF no lo aplicó, configurarlo a mano |
| Aplicación del campo de cabecera | `custbody_sads_mtn_equipo`, pestaña Aplica a | Compras; el campo puede verse en otras transacciones de compra y debe ocultarse en sus formularios |

## 5. Configuración manual

### 5.1 Formulario exclusivo de OC de mantenimiento

| Requisito | Motivo |
|---|---|
| Mostrar `custbody_sads_mtn_equipo` como obligatorio | RN-06: equipo obligatorio para capturar y guardar |
| Ocultar columnas nativas de artículos no usadas | La columna auxiliar se agrega al final de la fila y no se puede reubicar |
| Mantener visibles las columnas Artículo, Recibido y Facturado | El Client Script lee el artículo y las cantidades recibida y facturada para RN-10 |
| Capturar su ID interno en `custscript_sads_mtn_form_id` | El User Event solo actúa en ese formulario |

### 5.2 Otros formularios de compra

Ocultar `custbody_sads_mtn_equipo`.
En esos formularios no hay columna auxiliar ni bloqueo del campo nativo.
La validación de servidor aplica a cualquier OC que tenga equipo, sin importar el formulario.

### 5.3 Contrato de la búsqueda guardada

| Requisito | Motivo |
|---|---|
| Tipo de búsqueda: Artículo | Otro tipo se rechaza con MSG-05 |
| Primera columna: nombre para mostrar | Es la etiqueta de la opción |
| El ID interno del artículo sale del resultado | No requiere columna de ID |
| Criterios: Inactivo = No; tipo Otro cargo para la compra; subsidiaria del equipo; padres de matriz excluidos si aplica | Solo artículos capturables en la OC |
| Columna opcional con etiqueta personalizada `MTTO_EXCLUIR` | Filas con valor verdadero (T, true, 1, Sí, Si, casilla marcada) se excluyen |
| Sin resumen ni agrupación | Una fila por artículo |
| Pública o compartida con los roles de captura | En pantalla se ejecuta con el rol del usuario |
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

## 6. Pruebas en cuenta

No hay pruebas locales; todas se ejecutan en sandbox.
Durante las pruebas, la bitácora del despliegue va en Auditoría para ver advertencias de `beforeLoad`.

| Caso | Regla | Escenario | Resultado esperado |
|---|---|---|---|
| POC-1 | — | OC con 30 líneas en el formulario exclusivo, con la consola F12 abierta (sección 7.1) | Opciones correctas en cada línea, incluida la primera de una OC nueva, sin retraso perceptible. Registrar los mensajes `[sads_mtn]` |
| POC-2 | — | Edición de OC existente | La columna muestra el artículo nativo de cada línea |
| POC-3 | — | Elegir artículo en la columna | Precio, descripción, unidad e impuesto se completan antes de confirmar la línea |
| POC-4 | RN-12 | Formulario exclusivo | Campo nativo no editable; asignación por script funciona |
| POC-5 | RN-04 | Copiar una OC | Equipo y líneas se conservan; el servidor valida |
| POC-6 | — | Usuario de rol de captura sin privilegios de administrador | Opciones visibles sin error |
| SB-01 | RN-07 | Equipo con búsqueda inexistente | Captura bloqueada con MSG-05 |
| SB-02 | RN-05 | Cambio de equipo con líneas, confirmación aceptada | Cero líneas; opciones del nuevo equipo |
| SB-03 | RN-05 | Cambio de equipo con líneas, confirmación cancelada | Equipo y líneas sin cambio |
| SB-04 | RN-03 | CSV con equipo y artículo fuera de listado | Rechazo con MSG-04 |
| SB-05 | RN-08 | CSV con equipo de otra subsidiaria | Rechazo con MSG-06 |
| SB-06 | RN-09 | Cambio de subsidiaria con equipo incompatible | Equipo limpio y líneas eliminadas |
| SB-07 | RN-10 | Edición de OC con línea recibida | Equipo bloqueado; cambio por CSV rechazado con MSG-07 |
| SB-08 | RN-11 | Edición en línea del equipo desde lista | Rechazo con MSG-08 |
| SB-09 | RN-06 | OC en otro formulario sin equipo | Sin efecto de la solución |
| SB-10 | RN-12 | OC en otro formulario | Campo nativo editable; sin columna auxiliar |
| SB-11 | RN-04 | Edición: línea original con artículo retirado de la búsqueda, sin cambio; línea original cambiada a artículo válido; línea nueva válida | Guarda; la línea original sin cambio no se valida |
| SB-12 | RN-02 | Búsqueda con columna `MTTO_EXCLUIR` verdadera en un artículo | El artículo no aparece; opciones ordenadas por etiqueta |
| SB-13 | RN-10 | CSV que limpia el equipo de una OC con línea recibida | Rechazo con MSG-07 |
| SB-14 | RN-07 | Equipo con búsqueda de otro tipo o sin filas válidas | MSG-05 en pantalla; CSV rechazado con MSG-05 |

Si POC-1, POC-2 o POC-3 fallan, la solución no avanza a producción.

## 7. Mensajes, códigos y diagnóstico

| Código | Cuándo | Mensaje | Bitácora en servidor |
|---|---|---|---|
| `MTTO_ARTICULO_FUERA_DE_LISTADO` | RN-03 | MSG-04 con números de línea desde 1 | — |
| `MTTO_EQUIPO_NO_ENCONTRADO` | Equipo inexistente o inaccesible | MSG-05 | Error, con ID de equipo |
| `MTTO_BUSQUEDA_INVALIDA` | Búsqueda vacía, inexistente, de otro tipo, inaccesible o sin filas válidas | MSG-05 | Error, con ID de equipo, búsqueda y detalle |
| `MTTO_SUBSIDIARIA_INCOMPATIBLE` | RN-08 | MSG-06 | — |
| `MTTO_EQUIPO_NO_EDITABLE` | RN-10 y RN-11 | MSG-07 o MSG-08 | — |

Mensajes de `beforeLoad` (nivel Auditoría): "Client Script adjuntado", parámetro de formulario vacío, sublista no disponible, artículo nativo no bloqueado, búsqueda con 1,000 filas.

### 7.1 Diagnóstico en pantalla

El Client Script escribe mensajes con el prefijo `[sads_mtn]` en la consola del navegador.
No muestra nada al usuario ni modifica la página.
Se apaga con `DIAGNOSTICO.ACTIVO = false` en `lib/config.js` y un nuevo despliegue.

Comprobaciones rápidas cuando la columna "Artículo del equipo" sale sin opciones:

| # | Prueba | Si el Client Script carga | Si no carga |
|---|---|---|---|
| P-1 | OC nueva con el formulario exclusivo, sin equipo; pulsar "Agregar" en la sublista de artículos | Aparece MSG-01 | Aparece el aviso nativo de artículo obligatorio, o nada |
| P-2 | F12 > Red, filtrar `sads_mtn`; recargar la OC | `cs_sads_mtn_oc.js`, `config.js`, `reglas.js` y `datos.js` con estado 200 | No aparecen, o aparecen con 404 |
| P-3 | F12 > Consola al abrir la OC y al elegir equipo | Mensajes `[sads_mtn]` y ningún error rojo del proyecto | Error con `mtto_equipo` o `MODULE_DOES_NOT_EXIST` |

Interpretación de los mensajes:

| Mensaje | Significado | Acción |
|---|---|---|
| Ningún mensaje `[sads_mtn]`, y la bitácora del UE dice "Client Script adjuntado" | El UE adjunta el script, pero el navegador no lo carga | Revisar P-2 y P-3. Si los archivos existen, cambiar `RUTAS.ARCHIVO_CS` a `/SuiteScripts/mtto_equipo/cs_sads_mtn_oc.js` |
| La bitácora del UE no dice "Client Script adjuntado" | `beforeLoad` termina antes de adjuntar | Revisar el parámetro de formulario y los demás mensajes de `beforeLoad` |
| `módulo cargado` sin `pageInit` | NetSuite no invoca los puntos de entrada | Revisar errores rojos en la consola |
| `carga de artículos: falla` | La búsqueda o el equipo fallan; también aparece MSG-05 | Revisar el registro Equipo y la búsqueda |
| `campo auxiliar: línea actual falló` y luego `opciones insertadas` con estrategia `línea 0` | La estrategia alternativa funciona | Ninguna |
| `campo auxiliar no disponible` | Ninguna estrategia obtiene el campo; ocurre en la primera línea de una OC nueva si NetSuite no entrega el campo de una línea sin confirmar | Reportar el mensaje completo; la alternativa es un campo de selección en cabecera |

## 8. Gobernanza

| Componente | Operación | Unidades | Por ejecución | Total | Límite |
|---|---|---|---|---|---|
| UE `beforeSubmit` | Lectura de campos del equipo | 1 | 1 | 1 | 1,000 |
| UE `beforeSubmit` | Carga y lectura de la búsqueda | 5 + 10 | 0 o 1 | 0 a 15 | 1,000 |
| UE `beforeLoad` | Sin consultas | 0 | — | 0 | 1,000 |
| Client Script | Carga de artículos al iniciar o cambiar equipo | 16 | 1 por evento | 16 | 1,000 |

Las opciones de cada línea salen de memoria de la página; `lineInit` no ejecuta la búsqueda.
Costos de referencia; validarlos contra la documentación vigente de Oracle.

## 9. Reversión

Desmarcar el despliegue `customdeploy_sads_mtn_ue_oc` (o cambiar su estado).
El formulario vuelve a comportamiento nativo, sin columna ni bloqueo, y el guardado deja de validar.
El registro Equipo y el campo de cabecera pueden quedarse sin efecto operativo.

## 10. Desviaciones respecto del prompt v1

| ID | Desviación | Justificación |
|---|---|---|
| D-B | La validación al guardar evalúa RN-10 antes de "sin equipo" | Decisión del usuario: limpiar el equipo de una OC recibida o facturada es un cambio prohibido |
| D-C | Prefijo `_sads_mtn_` en IDs y archivos; se conservan `mtto_equipo`, `MTTO_*` y `MTTO_EXCLUIR` | Decisión del usuario |
| D-D | Sin Jest; T-01 a T-17 trasladados a pruebas en cuenta | Decisión del usuario |
| D-E | 5 archivos (Nivel 1) en lugar de 15 (Nivel 2) | Decisión del usuario; sin pruebas locales, puertos e inyección no aportan |
| C-02 | `prepararSeleccion` acepta bitácora opcional y equipo ya leído | Advertencia solo en servidor; evita una segunda lectura del equipo (16 unidades) |
| C-04 | MSG-05 con equipo inexistente muestra el ID (servidor) o el texto del campo (pantalla) | No hay nombre que mostrar |
| C-05 | `inactivo` se lee y no se usa | Ninguna regla lo consume |
| C-06 | Audiencia del despliegue: todos los roles | Un User Event sin audiencia no se ejecuta |
| C-08 | `alert()` y `confirm()` del navegador | `validateField` exige respuesta síncrona |
| I-01 | `saveRecord` sigue el orden del servidor y muestra MSG-05 si el equipo no existe o su búsqueda es inválida y hay líneas que validar | Mismo mensaje en pantalla y en servidor |
| I-02 | Al cambiar el equipo también se cancela la línea en captura | La línea en captura conservaría el artículo del equipo anterior |
| I-03 | La opción vacía de la columna usa un espacio como valor | Evita depender de opciones con valor vacío |
| I-04 | Un error de permisos al leer el equipo se trata como equipo no encontrado | El adaptador devuelve nulo; el detalle queda en bitácora de servidor |
| I-05 | La etiqueta `MTTO_EXCLUIR` se compara sin distinguir mayúsculas | Tolera capturas del administrador |
| I-06 | Una línea sin artículo se considera fuera de listado | RN-03: se acepta solo si el artículo pertenece |
| I-07 | Etiquetas no definidas en el prompt: "Búsqueda guardada", "Subsidiaria", nombre del script y título del despliegue | El prompt no las define |
| I-08 | `manifest.xml` declara `CUSTOMRECORDS`, `SERVERSIDESCRIPTING`, `CLIENTSUITESCRIPT` y `SUBSIDIARIES` | Features que usan los objetos; confirmar con `project:validate --server` |
| I-09 | El parámetro `cf` se usa siempre que el registro no traiga formulario (creación y copia) | El prompt lo indica para creación; la copia también es creación |
| I-10 | El campo de la columna se obtiene con dos estrategias (línea actual y línea 0) y el Client Script escribe diagnóstico en la consola del navegador | En sandbox la columna salió sin opciones; `getSublistField` puede fallar en líneas nuevas sin confirmar |

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
| R-01 | Inventario en cuenta no ejecutado en desarrollo | Conector de NetSuite sin conexión | Un ID existente se sobrescribe o un script existente anula la columna o la validación | Paso 0 obligatorio y `project:validate --server` |
| R-02 | XML no validado contra el servidor | Red de desarrollo sin acceso a NetSuite | Errores de esquema aparecen en el paso 1 | Corregir y volver a validar |
| R-03 | Sin pruebas automatizadas | Decisión D-D | Una regresión futura solo se detecta en sandbox | Matriz SB-01 a SB-14; `lib/reglas.js` admite Jest sin reestructurar |
| R-04 | IDs estándar de línea y `selectrecordtype` -117 no verificados | Supuesto S-11 | RN-04 o RN-10 fallan en silencio | Paso 0, SB-07 y SB-11 |
| R-05 | El bloqueo del campo nativo o su asignación por script puede no funcionar | Supuesto S-06 | RN-12 no se cumple en pantalla | Bitácora; validación de servidor activa; POC-4 |
| R-06 | `lineuniquekey` puede no estar disponible en cliente | Comportamiento de cliente no verificado | En edición, el Client Script valida todas las líneas y puede rechazar líneas originales que el servidor aceptaría | SB-11; el servidor sigue siendo la referencia |
| R-07 | La primera línea de una OC nueva puede quedar sin opciones | Sin líneas confirmadas no hay línea 0 para la estrategia alternativa | El usuario no puede capturar la primera línea con la columna | Diagnóstico de la sección 7.1; alternativa: campo de selección en cabecera |
| R-08 | La estrategia de línea 0 supone que las opciones de una línea confirmada afectan la línea en captura | Comportamiento no documentado por Oracle | Puede dejar de funcionar en una versión futura de NetSuite | Diagnóstico activo; repetir POC-1 en cada actualización mayor |

## 13. Supuestos y fuentes

| ID | Supuesto | Se verifica en |
|---|---|---|
| S-02 | Los artículos son de tipo Otro cargo para la compra | Contrato de búsqueda |
| S-03 | Cada búsqueda devuelve pocas decenas de artículos | POC-1 |
| S-04 | Costos de gobernanza de la sección 8 | Documentación vigente |
| S-05 | El Client Script adjuntado por el User Event no requiere despliegue propio | POC-1 |
| S-06 | El campo nativo de artículo puede bloquearse en `beforeLoad` y asignarse por script | POC-4 |
| S-07 | Las opciones de la columna se cargan línea por línea | POC-1 |
| S-09 | NetSuite impide eliminar líneas con recepción o factura | SB-07 |
| S-10 | Sourcing & Filtering no limpia el equipo al cambiar la subsidiaria | SB-06 |
| S-11 | IDs de línea `lineuniquekey`, `quantityreceived`, `quantitybilled` | Paso 0 |
| S-12 | `validateField` se dispara al cambiar el equipo y admite confirmación síncrona | SB-02 y SB-03 |
| S-13 | El formulario se identifica por `customform` o el parámetro `cf` | POC-1 |
| S-14 | El XML de SDF admite el filtro de Sourcing & Filtering del campo de cabecera | Paso 1 y revisión posterior al paso 2 |
| S-15 | El nombre para mostrar es único por convención interna | Riesgo aceptado |
| S-16 | `selectrecordtype` -117 corresponde a Subsidiaria | Paso 1 |
| S-17 | Límite de 40 caracteres por ID de objeto; el más largo usa 34 | Paso 1 |

Fuentes: prompt v1 y plan de ejecución v4 en `planes/`; documentación de Oracle de `N/search`, `N/currentRecord` (`Field.insertSelectOption`, `Field.removeSelectOption`) y `N/ui/serverWidget` (`Sublist.addField`) citada en el prompt.
