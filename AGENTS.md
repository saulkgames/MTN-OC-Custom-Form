# AGENTS.md — Equipo de transporte en Órdenes de compra (`mtto_equipo`)

Lee este archivo primero. Después lee solo la sección que necesites del README; nunca el README completo.
Estado: en producción, Liberado, con pruebas de aceptación del rol de compras aprobadas (2026-11-25). README versión 1.12.

## 1. Qué es

Proyecto SDF de NetSuite (SuiteScript 2.1). En el formulario exclusivo de OC de mantenimiento (ID interno 382 en producción), el campo `custbody_sads_mtn_equipo` define qué artículos se pueden capturar.
El selector "Artículo del equipo" y su botón "Agregar artículo" salen de la búsqueda guardada del equipo.
Al guardar, el servidor rechaza artículos fuera del listado en cualquier contexto (pantalla, CSV, servicios web).
Un equipo nuevo no requiere código: una búsqueda guardada y un registro Equipo.

## 2. Qué leer y qué no

| Necesidad | Lee |
|---|---|
| Entender o modificar una regla | Sección 4 de este archivo y `lib/reglas.js` |
| Un mensaje, ID o ruta | `lib/config.js` (única fuente) |
| Síntoma en producción | Sección 6 de este archivo, luego README §5.5, §5.7, §7.1, §12 |
| Despliegue o pasos manuales | README §4 y §4.1 |
| Alta de equipo | README §5.3 y §5.4 |
| Pruebas | README §6 y `planes/2026-11-24_mtto-equipo-oc_pruebas-rol-compras_v1.md` |
| Por qué se decidió algo | README §10 (desviaciones D-*) y §13 (supuestos S-*) |

No leer, salvo auditoría:
- `src/Objects/customsearch_sads_mtn_*.xml` (60 archivos). El `<definition>` es base64+gzip y, al decodificarlo, ~47,000 caracteres en una sola línea. Para ver filtros y columnas, decodificar con `python3 -I`: `base64.b64decode(definition.split('@',3)[3])`, luego `gzip.decompress`, y extraer solo `FIELD_FILTER_NAME` y las columnas.
- `planes/` v4 a v10 (historial). Útiles: `..._prompt_v1.md` (diseño de origen, §RN y mensajes) y los de `2026-11-24` (incidencia y pruebas).
- `referencia_sandbox/` (enlace y categoría del sandbox; no se despliegan).
- `ListadeEquipodetransporte.csv` (62 equipos: Nombre, Búsqueda guardada, Subsidiaria); es la carga CSV del registro Equipo.

## 3. Mapa

Raíz del repositorio: `ListadeEquipodetransporte.csv`, `AGENTS.md`, `CLAUDE.md`.
Proyecto SDF: `MTN-OC-Custom-Form/MTN-OC-Custom-Form/` (en adelante `<PROY>`): `README_mtto_equipo.md`, `planes/`, `src/`.
Código: `<PROY>/src/FileCabinet/SuiteScripts/mtto_equipo/`.

| Archivo | Líneas | Responsabilidad | Funciones principales (línea) |
|---|---|---|---|
| `ue_sads_mtn_oc.js` | 279 | User Event de OC | `beforeLoad` (21): agrega selector y botón en pestaña `items`, lo llena si hay equipo, bloquea artículo nativo. `beforeSubmit` (136): garantía de servidor |
| `cs_sads_mtn_oc.js` | 397 | Client Script con despliegue propio | `pageInit` (39), `validateField` (76), `fieldChanged` (92), `validateLine` (121), `saveRecord` (156), `agregarArticuloSeleccionado` (224, botón), `alCambiarEquipo` (272), `cargarSeleccion` (304), `poblarSelector` (326), `protegido` (346) |
| `lib/config.js` | 132 | IDs, mensajes MSG-01 a 09, códigos `MTTO_*`, rutas, `DIAGNOSTICO` | `formatearMensaje` |
| `lib/datos.js` | 171 | Acceso a datos con `N/search` | `obtenerEquipo(id, salida)` (23), `leerArticulosBusqueda` (86), `prepararSeleccion` (136; devuelve `{exito, equipo, articulos}` o `{exito:false, codigo, detalle}`) |
| `lib/reglas.js` | 203 | Reglas puras, sin `N/` | ver sección 4 |

Objetos SDF propios en `<PROY>/src/Objects/`: `customrecord_sads_mtn_equipo`, `custbody_sads_mtn_equipo`, `customscript_sads_mtn_ue_oc`, `customscript_sads_mtn_cs_oc`, `custform_sads_mtn_form`, `customsearch_sads_mtn_*`. Los demás XML son dependencias de la cuenta; no editarlos.

Flujos:
- Carga: UE `beforeLoad` → `datos.prepararSeleccion` → selector lleno (solo si el equipo ya se conoce).
- Pantalla: Client Script → `datos.prepararSeleccion` → `poblarSelector`. El botón llama a `agregarArticuloSeleccionado` con `require` desde HTML en línea; no depende del despliegue del Client Script.
- Guardado: UE `beforeSubmit` → `obtenerEquipo` → `prepararSeleccion` → `reglas`.

## 4. Reglas de negocio (detalle en prompt v1 §RN)

| RN | Regla | Función |
|---|---|---|
| 01 | El conjunto permitido es el resultado de la búsqueda del equipo | `datos.prepararSeleccion` |
| 02 | Excluir `MTTO_EXCLUIR` verdadero, quitar duplicados, ordenar por etiqueta | `esVerdadero`, `normalizarResultados` |
| 03 | Línea válida solo si su artículo pertenece al conjunto | `perteneceAlListado`, `lineasFueraDeListado` |
| 04 | Creación y copia: todas las líneas; edición: nuevas, cambiadas, o todas si cambió el equipo | `lineasAValidar` |
| 05 | Cambiar el equipo con líneas pide confirmación y las borra | `requiereConfirmacion`, `equipoCambio`, CS `alCambiarEquipo` |
| 06 | Sin equipo no aplica en servidor; en el formulario exclusivo es obligatorio | UE `beforeSubmit`, CS `saveRecord` |
| 07 | Equipo o búsqueda inválida, inaccesible o vacía bloquea con MSG-05 | `prepararSeleccion` |
| 08 | Subsidiaria del equipo igual a la de la OC | `esSubsidiariaCompatible` |
| 09 | Si cambia la subsidiaria y el equipo no corresponde, se limpia | CS `fieldChanged` |
| 10 | Con líneas recibidas o facturadas el equipo no cambia | `equipoEditable` |
| 11 | Edición en línea no puede cambiar el equipo | UE `beforeSubmit` (XEDIT) |
| 12 | Artículo nativo bloqueado en el formulario exclusivo | UE `beforeLoad` paso 7 |

## 5. Invariantes

1. Todo ID, mensaje, ruta y etiqueta vive en `lib/config.js`; no duplicarlos en otros archivos.
2. `lib/config.js` y `lib/reglas.js` no importan módulos `N/`. `datos.js` es el único con `N/search`; no usar `N/query`, SuiteQL ni `N/record`.
3. El servidor (`beforeSubmit`) es la garantía; el cliente es comodidad. Un cambio de regla se hace primero en `reglas.js` y se refleja en ambos.
4. Una función con una sola llamada en UE o CS se escribe donde se usa (criterio D-G).
5. `DIAGNOSTICO.ACTIVO` queda en `false` al cerrar cualquier trabajo.
6. `obtenerEquipo` devuelve `null` sin lanzar; la causa va en `salida.detalle`.
7. Los IDs de objeto llevan el prefijo `_sads_mtn_` (máximo 40 caracteres).
8. No ejecutar `suitecloud project:adddependencies` contra sandbox antes de desplegar a producción (README §4.1).

## 6. Síntoma → causa → dónde revisar (aprendido en producción, 2026-11-24)

| Síntoma | Causa | Dónde |
|---|---|---|
| El selector no se llena al elegir equipo, no aparece MSG-02, no se borran líneas; el botón sí funciona | Client Script fuera de los primeros 10 de la OC (límite de 10 scripts de cliente por registro). R-23 | Personalización > Scripting > Registros con script > Orden de compra > Scripts de cliente |
| MSG-05 solo con ciertos roles | Rol sin acceso al registro Equipo, búsqueda no pública, o restricción de subsidiarias que oculta los artículos. R-22 | Tipo de acceso del registro (hoy `NONENEEDED`); búsqueda pública; "Ver resultados" con el rol. El detalle sale en la bitácora del UE y en la consola |
| Ni selector ni botón | Parámetro `custscript_sads_mtn_form_id` vacío o distinto del formulario, o despliegue del UE sin audiencia | Despliegue `customdeploy_sads_mtn_ue_oc` |
| Nada corre salvo para el propietario | Despliegue en Pruebas | Estado del despliegue = Liberado |
| Pausas con F12 abierto | `debugger;` en el script ajeno "DRT - Costo de Compra CS" | Cerrar F12 al capturar líneas |
| Error `INSUFFICIENT_PERMISSION` sobre `customrecord_drt_dimension` | Script ajeno "DRT - Dimensión por Unidad Medida" | Su propietario; no es de esta solución |

Después de instalar un SuiteApp o script nuevo en OC, revisar otra vez la posición del Client Script.
Un despliegue SDF puede revertir cambios hechos a mano en cuenta (por ejemplo el tipo de acceso); alinear el XML antes de desplegar.

## 7. Procedimientos

Alta de equipo (sin código): crear la búsqueda `customsearch_sads_mtn_<equipo>` según README §5.3 (tipo Artículo, pública, primera columna = nombre, máx. 1,000 filas) y el registro Equipo (nombre, ID de script de la búsqueda, subsidiaria) según §5.4.

Nuevo requerimiento:
1. Identificar la RN afectada (sección 4) y leer solo esa función.
2. Cambiar `lib/config.js` si hay mensajes, IDs o rutas; luego `reglas.js` o `datos.js`; luego UE y CS.
3. Verificar (sección 8).
4. Actualizar README: versión, §6 pruebas, §10 desviación si se aparta del diseño, §12 riesgo con enunciado, fundamento y consecuencia, §13 supuesto.
5. Actualizar este archivo en el mismo commit si cambian archivos, IDs, reglas o síntomas.

Despliegue (desde `<PROY>`): `suitecloud project:validate --server`, luego `suitecloud project:deploy`. Pasos manuales posteriores: README §4.1 (ID del formulario, enlace de menú, orden del Client Script, estado Liberado).
El proyecto no tiene `package.json` ni pruebas locales.

## 8. Verificación

1. `node --check` de los 5 archivos.
2. Simulación en Node de `lib/datos.js`: cargar con `vm.runInNewContext`, inyectar un `N/search` simulado y comprobar los cuatro caminos de falla (permiso, sin valores, búsqueda inexistente, cero filas).
3. Pruebas en cuenta: README §6 (SB-01 a SB-17) y el protocolo C-01 a C-12 de `planes/2026-11-24_mtto-equipo-oc_pruebas-rol-compras_v1.md`.
4. Cerrar con límites: qué se verificó y qué no.

## 9. Estilo y confidencialidad

- Español de México, lacónico, una idea por oración; tablas cuando haya varias variables.
- Separar hecho verificado de inferencia; marcar "supuesto"; no inventar cifras, IDs ni fundamentos.
- Riesgos con enunciado, fundamento y consecuencia.
- No reproducir RFC, saldos, datos bancarios ni de nómina en documentos o ejemplos.
- Confirmar antes de desplegar, publicar o crear pull requests; no se crea PR sin pedirlo.

## 10. Mantenimiento de este archivo

Mantenerlo en 150 líneas o menos. Si crece, mover el detalle al README y dejar aquí solo el puntero.
Última revisión: 2026-11-25, con README 1.12.
