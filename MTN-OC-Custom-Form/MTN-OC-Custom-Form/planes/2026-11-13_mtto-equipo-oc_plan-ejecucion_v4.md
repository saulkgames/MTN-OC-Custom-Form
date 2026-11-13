# Plan de desarrollo y despliegue: filtrado de artículos por equipo en Órdenes de compra — v4

## 0. Control

| Campo | Valor |
|---|---|
| Fecha | 2026-11-13 |
| Versión | 4 |
| Estado | Aprobado |
| Insumo | Prompt para agente coder v1 (plan de diseño v2 aprobado) |
| Repositorio | `saulkgames/mtn-oc-custom-form`, rama `claude/wizardly-franklin-2fca8g` |
| Raíz SDF | `MTN-OC-Custom-Form/MTN-OC-Custom-Form/` (todas las rutas de este plan son relativas a ella) |

Historial:
v1, 2026-11-12, borrador inicial tras análisis del repositorio y del prompt.
v2, 2026-11-12, D-A: continuar sin inventario en cuenta; D-B: limpiar el equipo cuenta como cambio en RN-10.
v3, 2026-11-12, D-C: prefijo `_sads_mtn_` en IDs y archivos; D-D: sin pruebas locales, todas en cuenta.
v4, 2026-11-13, D-E: arquitectura Nivel 1 con 5 archivos; se corrige la afirmación de v3 de que el Nivel 2 seguía justificado sin pruebas.

## 1. Contexto

El campo nativo de artículo de la OC no admite filtrado; hoy se requeriría un formulario y una búsqueda por equipo (más de 20).
El prompt v1 define el diseño: columna `custpage` filtrada por la búsqueda guardada del equipo, bloqueo del campo nativo y validación en cliente y servidor.
Este plan define cómo implementarlo en este repositorio, cómo verificarlo y cómo lo despliega y prueba el administrador.
Reglas de negocio RN-01 a RN-12 y mensajes MSG-01 a MSG-08 no cambian.
Cambian por decisión del usuario: IDs, nombres de archivo, orden de UC-02, estrategia de pruebas y estructura de archivos (sección 3).

## 2. Fase 0 ejecutada (solo lectura)

### 2.1 Hechos verificados

| Hallazgo | Hecho | Efecto |
|---|---|---|
| Contenido del repo | 4 archivos, 1 commit: `manifest.xml`, `deploy.xml`, `suitecloud.config.js`, `.gitignore` | Proyecto SDF recién creado |
| Tipo de proyecto | `ACCOUNTCUSTOMIZATION`, framework 1.0, sin dependencias de features | Se agregan features requeridas |
| Doble anidación | Raíz git distinta de raíz SDF | No se reestructura |
| `src/FileCabinet`, `src/Objects` | No existen (git no versiona carpetas vacías) | Se crean; no es condición de paro |
| `deploy.xml` | Apunta también a `AccountConfiguration/` y `Translations/`, que no existen | Sin cambio salvo que la validación lo exija |
| Jest | Sin `package.json` ni configuración | No se crea (D-D) |
| Scripts, workflows y campos sobre OC en el repo | Ninguno | Riesgo de conflicto en repo: Ninguno |
| Colisión de IDs nuevos en el repo | Ninguna | — |
| MCP de NetSuite | Conectores "NetSuite" y "Netsuite Dev" instalados, conexión incompleta, no habilitados en la sesión | Inventario en cuenta pasa al administrador como paso 0 (D-A) |
| Red | Proxy responde 403 a `system.netsuite.com` y `content.netsuite.com` | SuiteCloud CLI 4.1.1 no puede descargar su SDK; `project:validate` probablemente no corre en la sesión |
| Herramientas | Node 22.23, npm 10.9, Java 21 | Verificación de sintaxis con `node --check` |

### 2.2 Reporte de inventario (formato sección 6 del prompt)

| Objeto | Tipo | ID | Evento o disparador | Qué hace sobre artículos o cabecera | Riesgo |
|---|---|---|---|---|---|
| Ninguno en el repositorio | — | — | — | — | Ninguno |
| Cuenta NetSuite | No consultada | — | — | Sin MCP conectado | No determinado |

### 2.3 Condiciones de paro

| Condición | Resultado |
|---|---|
| Otro script o workflow modifica líneas de OC | No en repo; cuenta no verificada |
| Otra validación `beforeSubmit` sobre líneas de OC | No en repo; cuenta no verificada |
| ID nuevo ya existe | No en repo; cuenta no verificada |
| Repo no es SDF o falta estructura base | Es SDF; faltan carpetas vacías, se crean |
| Prefijo inválido | No; los IDs con `_sads_mtn_` conservan el prefijo obligatorio de NetSuite |

## 3. Decisiones y desviaciones respecto del prompt

### 3.1 Decisiones del usuario

| ID | Decisión | Efecto |
|---|---|---|
| D-A | Continuar sin inventario en cuenta | Paso 0 obligatorio del administrador antes de desplegar |
| D-B | Limpiar el equipo en OC recibida o facturada es un cambio prohibido (RN-10) | La validación al guardar evalúa RN-10 antes de RN-06 |
| D-C | Prefijo `_sads_mtn_` en IDs y archivos | Tabla 3.2 |
| D-D | Sin pruebas locales; todas en cuenta | Sin Jest, `package.json` ni `__tests__/`; T-01 a T-17 se trasladan a la matriz en cuenta (sección 7) |
| D-E | Arquitectura Nivel 1 con 5 archivos | Sustituye las secciones 7, 8, 9 y la organización de 13.1 a 13.3 del prompt; ver 3.4 |

### 3.2 Configuración de la sección 1.1 que se aplica (D-C)

| Variable | Valor del prompt | Valor aplicado |
|---|---|---|
| `REC_EQUIPO` | `customrecord_mtto_equipo` | `customrecord_sads_mtn_equipo` |
| `FLD_EQ_BUSQUEDA` | `custrecord_mtto_eq_busqueda` | `custrecord_sads_mtn_eq_busqueda` |
| `FLD_EQ_SUBSIDIARIA` | `custrecord_mtto_eq_subsidiaria` | `custrecord_sads_mtn_eq_subsidiaria` |
| `FLD_BODY_EQUIPO` | `custbody_mtto_equipo` | `custbody_sads_mtn_equipo` |
| `FLD_COL_AUX` | `custpage_mtto_articulo` | `custpage_sads_mtn_articulo` |
| `SCRIPT_UE` | `customscript_mtto_ue_oc` | `customscript_sads_mtn_ue_oc` |
| `DEPLOY_UE` | `customdeploy_mtto_ue_oc` | `customdeploy_sads_mtn_ue_oc` |
| `PARAM_FORM` | `custscript_mtto_form_id` | `custscript_sads_mtn_form_id` |
| `ARCHIVO_UE` | `ue_mtto_oc.js` | `ue_sads_mtn_oc.js` |
| `ARCHIVO_CS` | `cs_mtto_oc.js` | `cs_sads_mtn_oc.js` |
| `NOMENCLATURA_BUSQUEDAS` | `customsearch_mtto_<equipo>` | `customsearch_sads_mtn_<equipo>` |
| `CARPETA_PROYECTO` | `mtto_equipo` | Sin cambio |
| `ETIQUETA_COL_EXCLUIR` | `MTTO_EXCLUIR` | Sin cambio |
| Códigos de error | `MTTO_*` | Sin cambio |

Etiquetas visibles (`LBL_*`) y `MAX_RESULTADOS_BUSQUEDA` sin cambio.

### 3.3 Contradicciones y huecos del prompt

| ID | Hallazgo | Resolución |
|---|---|---|
| C-01 | UC-02 paso 1 sale sin errores si el equipo queda vacío, antes de RN-10; por CSV se podría limpiar el equipo de una OC recibida | D-B. Orden: (1) edición, equipo distinto al original (incluido vacío) y `equipoEditable` falso → `MTTO_EQUIPO_NO_EDITABLE` con MSG-07; (2) sin equipo → sin errores; (3) resto igual que 13.2 |
| C-02 | La lectura de la búsqueda advierte al llegar a 1000 filas solo en servidor, sin saber dónde corre | `prepararSeleccion` recibe una función de bitácora opcional; el UE la pasa con `N/log`, el CS no |
| C-03 | Bitácora en Error oculta las advertencias y auditorías de `beforeLoad` | Se conserva Error; el README indica subir a Auditoría durante pruebas |
| C-04 | MSG-05 con equipo inexistente no tiene nombre | `[equipo]` toma el ID interno |
| C-05 | La lectura del equipo devuelve `inactivo` y ninguna regla lo usa | Se devuelve y no se usa |
| C-06 | "Sin roles en el XML" contra "todos los contextos": un UE sin audiencia no se ejecuta | Audiencia "Todos los roles" en el despliegue; no es asignación de permisos |
| C-07 | "Aplica a compras" muestra el `custbody` en otras transacciones de compra | Ocultarlo en sus formularios; ya es paso manual 10.4 |
| C-08 | `validateField` exige confirmación síncrona; `N/ui/dialog` es asíncrono | `confirm()` y `alert()` del navegador; no es manipulación del DOM |

### 3.4 Nivel de arquitectura (D-E)

| Concepto | Prompt | Aplicado |
|---|---|---|
| Nivel | 2 acotado: casos de uso, 2 puertos, 2 adaptadores, inyección | 1: reglas puras compartidas; acceso a datos en un módulo compartido |
| Archivos `.js` | 15 en 5 carpetas | 5 en 2 carpetas |
| Justificación | Misma regla en cliente y servidor; pruebas con adaptadores en memoria | Misma regla en cliente y servidor; sin pruebas locales (D-D), puertos e inyección no aportan |
| Se conserva | — | Regla única entre CS y UE; reglas sin módulos `N/`; IDs y mensajes en un solo archivo |
| Se elimina | — | Fábricas `crear({ puertos })`, `contratos.js`, separación `application/` e `infrastructure/` |

## 4. Estructura objetivo

```
MTN-OC-Custom-Form/MTN-OC-Custom-Form/
├── README_mtto_equipo.md                                   (nuevo)
├── planes/
│   ├── 2026-11-12_mtto-equipo-oc_prompt_v1.md              (copia del insumo)
│   └── 2026-11-13_mtto-equipo-oc_plan-ejecucion_v4.md      (este plan)
└── src/
    ├── manifest.xml                                        (features)
    ├── Objects/
    │   ├── customrecord_sads_mtn_equipo.xml
    │   ├── custbody_sads_mtn_equipo.xml
    │   └── customscript_sads_mtn_ue_oc.xml
    └── FileCabinet/SuiteScripts/mtto_equipo/
        ├── ue_sads_mtn_oc.js
        ├── cs_sads_mtn_oc.js
        └── lib/
            ├── reglas.js
            ├── datos.js
            └── config.js
```

### 4.1 Responsabilidad de cada archivo `.js`

| Archivo | Tipo | Responsabilidad | Importa | Lo usa |
|---|---|---|---|---|
| `ue_sads_mtn_oc.js` | User Event; único `scriptfile` en SDF | `beforeLoad` (13.4): en el formulario exclusivo agrega la columna auxiliar, bloquea el artículo nativo y adjunta el CS; sin consultas. `beforeSubmit`: rechaza edición en línea del equipo (RN-11); arma objetos planos de cabecera y líneas; ejecuta la validación al guardar (UC-02, orden de C-01); lanza error con código y mensajes. Es la garantía | `N/ui/serverWidget`, `N/runtime`, `N/error`, `N/log`, `lib/*` | NetSuite |
| `cs_sads_mtn_oc.js` | Client Script adjuntado por el UE, sin registro propio | Comportamiento de 13.5: estado de página, carga de opciones con `prepararSeleccion`, confirmación y reinicio al cambiar equipo, limpieza por subsidiaria, opciones por línea desde memoria, asignación del artículo nativo, `validateLine` y `saveRecord` | `lib/*` | UE (lo adjunta) |
| `lib/reglas.js` | Reglas puras, sin `N/` | `esVerdadero` y `normalizarResultados` (RN-02), `lineasFueraDeListado` (RN-03), `lineasAValidar` (RN-04), `requiereConfirmacion` (RN-05), `esSubsidiariaCompatible` (RN-08), `equipoEditable` (RN-10) | Nada | UE, CS, `datos.js` |
| `lib/datos.js` | Acceso a datos con `N/search` | `obtenerEquipo` (lectura de campos, 1 unidad, nulo si no existe); `leerArticulosBusqueda` (carga por ID de script, valida tipo Artículo, una lectura hasta 1000 filas, mapea id, etiqueta y exclusión; 15 unidades); `prepararSeleccion` (UC-01 de 13.2: devuelve equipo y artículos, o código de falla) | `N/search`, `lib/reglas.js`, `lib/config.js` | UE, CS |
| `lib/config.js` | Configuración, sin `N/` | IDs de tabla 3.2, IDs estándar (`customform`, `subsidiary`, sublista `item`, `item`, `lineuniquekey`, `quantityreceived`, `quantitybilled`), parámetro `cf`, etiquetas, límite 1000, ruta `./cs_sads_mtn_oc.js`, MSG-01 a MSG-08 con sustitución de llaves, 5 códigos `MTTO_*` y su mensaje | Nada | Todos |

Regla de dependencia: `reglas.js` y `config.js` no importan módulos `N/`; `datos.js` no importa entry points.
Flujo en pantalla: CS → `prepararSeleccion` → `N/search`; reglas desde `reglas.js`.
Flujo al guardar: UE → validación en el propio UE → `reglas.js` y `prepararSeleccion` → `N/search`.

## 5. Secuencia de implementación

| Paso | Acción | Detalle |
|---|---|---|
| 1 | `lib/config.js` | Contenido de 4.1 |
| 2 | `lib/reglas.js` | 7 funciones puras con JSDoc de entradas y salidas |
| 3 | `lib/datos.js` | Lectura de equipo y búsqueda según 13.3; `prepararSeleccion` según UC-01 de 13.2; bitácora opcional (C-02) |
| 4 | `ue_sads_mtn_oc.js` | 13.4; validación al guardar según UC-02 de 13.2 con orden de C-01, en funciones pequeñas dentro del UE |
| 5 | `cs_sads_mtn_oc.js` | 13.5 |
| 6 | Objetos SDF | Sección 6 |
| 7 | `manifest.xml` | Solo features que exija la validación (supuesto: `CUSTOMRECORDS`, `SERVERSIDESCRIPTING`, `SUBSIDIARIES`) |
| 8 | README | Inventario en cuenta (paso 0), despliegue, pasos manuales, contrato de búsqueda con `customsearch_sads_mtn_<equipo>`, permisos, matriz de pruebas en cuenta, reversión |
| 9 | `planes/` | Copia del prompt v1 y de este plan |
| 10 | Verificación estática | Sección 8 |
| 11 | Git | Commit en `claude/wizardly-franklin-2fca8g` y push; sin PR |

## 6. Objetos SDF

| Archivo | Tipo SDF | Atributos clave |
|---|---|---|
| `customrecord_sads_mtn_equipo.xml` | `customrecordtype` | Nombre `Equipo de transporte`; incluye Nombre; Inactivo estándar; acceso por lista de permisos sin `permissions`. Campos: `custrecord_sads_mtn_eq_busqueda` texto libre obligatorio; `custrecord_sads_mtn_eq_subsidiaria` lista/registro Subsidiaria obligatorio (`selectrecordtype` -117, supuesto) |
| `custbody_sads_mtn_equipo.xml` | `transactionbodycustomfield` | Lista/registro `[customrecord_sads_mtn_equipo]`; etiqueta `Equipo de transporte`; aplica a compras; no obligatorio; filtro `custrecord_sads_mtn_eq_subsidiaria` igual a `STDBODYSUBSIDIARY`. Si el esquema lo rechaza, se retira y pasa a paso manual (S-14) |
| `customscript_sads_mtn_ue_oc.xml` | `usereventscript` | `scriptfile` = `[/SuiteScripts/mtto_equipo/ue_sads_mtn_oc.js]`; parámetro `custscript_sads_mtn_form_id` entero sin valor; despliegue `customdeploy_sads_mtn_ue_oc` en Orden de compra, estado Pruebas, bitácora Error, todos los contextos, audiencia todos los roles |

`custscript_sads_mtn_form_id` queda vacío en el XML; `beforeLoad` termina sin cambios y advierte hasta que el administrador capture el ID.
`cs_sads_mtn_oc.js` y `lib/` no tienen objeto propio; se despliegan por `FileCabinet/*`.

## 7. Matriz de pruebas en cuenta (D-D)

Las ejecuta el administrador en sandbox y se documentan en el README.
POC-1 a POC-6 y SB-01 a SB-10 del prompt se conservan sin cambio.
Los casos T-xx sin equivalente en cuenta se agregan como SB-11 a SB-14.

| Caso | Regla | Origen | Escenario | Resultado esperado |
|---|---|---|---|---|
| SB-11 | RN-04 | T-04, T-15 | Edición: línea original con artículo retirado después de la búsqueda sin cambio; línea original cambiada a artículo válido; línea nueva válida | Guarda; la línea original sin cambio no se valida |
| SB-12 | RN-02 | T-06 | Búsqueda con columna `MTTO_EXCLUIR` en verdadero para un artículo | El artículo no aparece; opciones ordenadas por etiqueta |
| SB-13 | RN-10 | D-B | CSV que limpia el equipo de una OC con línea recibida | Rechazo con MSG-07 |
| SB-14 | RN-07 | T-11 | Equipo con búsqueda de otro tipo o con cero filas válidas | MSG-05 en pantalla; CSV rechazado con MSG-05 |

| T-xx del prompt | Caso en cuenta |
|---|---|
| T-01, T-02, T-12 | SB-04 |
| T-03, T-17 | POC-1, POC-3 |
| T-04, T-15 | SB-11 |
| T-05, T-08 | SB-02, SB-03 |
| T-06 | SB-12 |
| T-07, T-13 | SB-05, SB-06 |
| T-09, T-14 | SB-07 |
| T-10 | SB-09 |
| T-11 | SB-01, SB-14 |
| T-16 | No aplica: sin puertos ni pruebas de contrato |

## 8. Verificación en la sesión (estática)

| Verificación | Método | Criterio |
|---|---|---|
| Sintaxis | `node --check` en los 5 `.js` | Sin errores |
| Regla de dependencia | Búsqueda de `N/` en `reglas.js` y `config.js` | Cero coincidencias |
| IDs fuera de configuración | Búsqueda de `cust*`, `customsearch`, `custpage` fuera de `lib/config.js` y `src/Objects/` | Cero coincidencias |
| Residuos del prefijo anterior | Búsqueda de `_mtto_` en IDs y nombres de archivo | Cero coincidencias (salvo `mtto_equipo`, `MTTO_*` y `MTTO_EXCLUIR`) |
| Longitud de IDs | Conteo de caracteres | ≤ 40 (supuesto de límite; el más largo, `custrecord_sads_mtn_eq_subsidiaria`, tiene 34) |
| XML bien formado | `xmllint --noout` o parser de Python | Sin errores |
| Validación SDF | Intento de `npx @oracle/suitecloud-cli project:validate` | Si el 403 lo impide, se reporta y queda para el administrador |
| Encabezados | `@NApiVersion 2.1` y `@NModuleScope SameAccount` en los 5; `@NScriptType` en los 2 entry points | Todos |
| Gobernanza | Recalcular sección 15: 1 + 5 + 10 = 16 unidades máximo por evento | ≤ 1,000 |

## 9. Plan de despliegue (lo ejecuta el administrador)

| Paso | Ambiente | Acción | Criterio de salida |
|---|---|---|---|
| 0 | Sandbox | Inventario: despliegues de script y workflows activos sobre OC; existencia de los IDs de la tabla 3.2 (instrucciones en el README) | Sin conflicto Alto |
| 1 | Local | `suitecloud account:setup` con el sandbox; `suitecloud project:validate --server` | Sin errores |
| 2 | Sandbox | `suitecloud project:deploy` | Registro, campos, script y despliegue en Pruebas |
| 3 | Sandbox | Crear formulario exclusivo; ocultar `custbody_sads_mtn_equipo` en otros formularios de compra | Equipo obligatorio; columnas nativas no usadas ocultas |
| 4 | Sandbox | Capturar `FORM_ID_SANDBOX` en `custscript_sads_mtn_form_id` | Columna auxiliar visible |
| 5 | Sandbox | Dos búsquedas `customsearch_sads_mtn_<equipo>` con el contrato 10.5 y dos registros Equipo | — |
| 6 | Sandbox | Permisos a `ROLES_CAPTURA` y `ROL_ADMIN_CONFIG` | — |
| 7 | Sandbox | Bitácora en Auditoría; POC-1 a POC-6 y SB-01 a SB-14 | POC-1, POC-2 y POC-3 aprobadas; si alguna falla, no avanza |
| 8 | Sandbox | Despliegue a Liberado; prueba con usuarios de `ROLES_CAPTURA`; bitácora a Error | Sin incidencias |
| 9 | Producción | Repetir pasos 0 a 6 con `FORM_ID_PRODUCCION`; alta de todos los equipos y búsquedas | — |
| 10 | Producción | Piloto con usuarios reales; liberación general | Métrica 1 en cero |

Reversión: desmarcar el despliegue del UE; el formulario vuelve a comportamiento nativo. Registro y campo de cabecera quedan sin efecto operativo.

## 10. Riesgos

| ID | Enunciado | Fundamento | Consecuencia | Mitigación |
|---|---|---|---|---|
| R-01 | Inventario de cuenta no ejecutado | MCP sin conexión en la sesión | Un ID existente se sobrescribe al desplegar, o un script existente anula columna o validación | Paso 0 obligatorio; `project:validate --server` |
| R-02 | XML no validado contra el servidor | Proxy bloquea hosts de NetSuite | Errores de esquema aparecen hasta el paso 1 | Esquemas documentados; reportar como pendiente |
| R-03 | Sin pruebas automatizadas | D-D | Reglas puras (RN-02, RN-04, RN-10) solo se verifican a mano; una regresión futura no se detecta antes de sandbox | Matriz SB-01 a SB-14 cubre cada RN; `reglas.js` sin `N/` permite agregar Jest después sin reestructurar |
| R-04 | IDs de línea `lineuniquekey`, `quantityreceived`, `quantitybilled` y `selectrecordtype` -117 no verificados | Sin acceso a la cuenta (S-11) | RN-04 o RN-10 fallan en silencio | Centralizados en `config.js`; verificación en paso 0 y SB-07, SB-11 |
| R-05 | Bloqueo del campo nativo o asignación por script puede no funcionar | S-06 | RN-12 no se cumple en pantalla | Captura con bitácora; validación de servidor activa; POC-4 |
| R-06 | Advertencias invisibles con bitácora Error | C-03 | Diagnóstico lento en pruebas | Paso 7 sube el nivel |
| R-07 | Estructura, IDs y orden de UC-02 difieren del prompt | D-B, D-C, D-E | Revisores que comparen contra el prompt verán diferencias | Desviaciones declaradas en la entrega y en `planes/` |

## 11. Entrega final (formato sección 20 del prompt)

1. Reporte de Fase 0 (sección 2.2).
2. Lista de archivos creados o modificados.
3. Pruebas: no aplica por D-D; matriz en cuenta en el README.
4. Resultado de `project:validate` o razón de no ejecución, más resultado de la verificación estática.
5. Desviaciones (sección 3).
6. Pasos manuales y valores `PENDIENTE`: `FORM_ID_SANDBOX`, `FORM_ID_PRODUCCION`, `ROLES_CAPTURA`, `ROL_ADMIN_CONFIG`.

## 12. Supuestos y fuentes

Supuestos: S-01 a S-15 del prompt, excepto los que dependían de Jest; además, features del manifest (paso 7), `selectrecordtype` -117 para Subsidiaria y límite de 40 caracteres por ID.
Fuentes: archivos del repositorio en la rama `claude/wizardly-franklin-2fca8g`; prompt v1; skill `netsuite-plan-diseno` (checklist de niveles de arquitectura); metadatos npm de `@oracle/suitecloud-cli` 4.1.1; estado de conectores de la sesión; prueba de red al proxy; decisiones D-A a D-E del usuario.
