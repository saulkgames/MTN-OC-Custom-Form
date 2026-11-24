# Diagnóstico y plan de corrección: selector vacío y líneas no eliminadas (mtto_equipo, producción)

## 1. Contexto

La solución está en producción desde el commit `2345d19`.
Se reportaron tres síntomas.

| # | Síntoma | Quién | Dato del usuario |
|---|---|---|---|
| E1 | Al elegir equipo, el selector "Artículo del equipo" no se llena | Propietario y usuario de compras | Al propietario se le llena al pulsar "Agregar artículo" |
| E2 | Al usuario de compras el botón tampoco llena el selector: muestra MSG-05 | Usuario de compras | Rol con restricción de subsidiarias, sin permiso al registro personalizado, subsidiaria distinta |
| E3 | Al cambiar el equipo no se borran las líneas | Propietario | No aparece la confirmación MSG-02 |

## 2. Diagnóstico

### 2.1 Causa A (E1 y E3): los eventos del Client Script no se ejecutan en producción

Hecho verificado en código: `pageInit`, `validateField` y `fieldChanged` son los únicos que llenan el selector al elegir equipo, piden MSG-02 y borran líneas (`cs_sads_mtn_oc.js:39-117`, `alCambiarEquipo` en `:272`).
Hecho verificado en código: el botón no depende del despliegue; carga el módulo con `require` desde el HTML del User Event (`ue_sads_mtn_oc.js:89-92`) y llama a `datos.prepararSeleccion` directamente (`cs_sads_mtn_oc.js:233-244`).
Inferencia: si el selector solo se llena con el botón y MSG-02 nunca aparece, NetSuite no invoca los puntos de entrada del despliegue `customdeploy_sads_mtn_cs_oc`. Es el mismo cuadro que D-Q (README §10) en sandbox.
Consecuencia adicional: `validateLine` y `saveRecord` tampoco corren. La integridad sigue protegida por `beforeSubmit` (MSG-04 al guardar), pero el usuario no recibe aviso por línea.

Causas candidatas, en orden de probabilidad. No se pueden confirmar desde el repositorio.

| ID | Candidata | Fundamento | Cómo se descarta |
|---|---|---|---|
| A1 | Función "Client SuiteScript" desactivada en producción | `manifest.xml` no declara `CLIENTSUITESCRIPT` (se retiró, I-08); SDF no lo exige. Sin la función, los scripts de cliente desplegados no corren, pero el `require` del botón sí | Configuración > Empresa > Habilitar funciones > SuiteCloud > "Client SuiteScript" |
| A2 | Audiencia por subsidiaria del despliegue de cliente | `customscript_sads_mtn_cs_oc.xml` trae `audsubsidiary` con 12 valores `[ACCOUNT_SPECIFIC_VALUE]`; en producción la lista pudo quedar distinta | Despliegue `customdeploy_sads_mtn_cs_oc` > Audiencia > Subsidiarias |
| A3 | Despliegue en Pruebas, no desplegado o propietario distinto | El XML anterior a `2345d19` lo instalaba en `TESTING`; en Pruebas solo corre para el propietario del script | Despliegue: Estado = Liberado, Desplegado = Sí |
| A4 | Otro script de cliente sobre OC falla antes | Paso 0 del README no se documentó ejecutado en producción | Personalización > Scripting > Registros con script > Orden de compra; consola F12 con errores |

Sobre MSG-01 al pulsar el botón: inferencia, no verificada. El valor del equipo aún no estaba confirmado en el campo cuando se pulsó el botón (escritura sin salir del campo). No requiere cambio de código; se revisa en la prueba P-03.

### 2.2 Causa B (E2): el rol de compras no puede leer el registro "Equipo de transporte"

Hecho verificado: `customrecord_sads_mtn_equipo.xml` tiene `accesstype` = `CUSTRECORDENTRYPERM` ("Requerir permiso de entradas de registros personalizados"). El README §2.2 dice "vacío"; está desactualizado desde `2345d19`.
Hecho verificado: `datos.obtenerEquipo` usa `search.lookupFields` con el rol del usuario y, si falla, devuelve nulo sin detalle (`datos.js:28-35`).
Hecho declarado por el usuario: el rol no tiene ese permiso.
Cadena: `lookupFields` falla → `EQUIPO_NO_ENCONTRADO` → MSG-05 en pantalla.
Riesgo: el mismo `obtenerEquipo` corre en `beforeSubmit` (`ue_sads_mtn_oc.js:208`). Fundamento: el User Event corre con el rol del usuario. Consecuencia: el usuario de compras no puede guardar ninguna OC con equipo; recibe MSG-05.

Causa secundaria probable (B2): rol con restricción de subsidiarias.
Fundamento: las búsquedas `customsearch_sads_mtn_*` son públicas, de tipo Artículo, filtran Otro cargo/Compra, Inactivo = No y Nombre para mostrar = `MTN-<equipo>`; no filtran subsidiaria. La restricción del rol sí se aplica a los artículos.
Consecuencia: si los artículos están asignados a una subsidiaria fuera del rol, la búsqueda devuelve 0 filas → `BUSQUEDA_INVALIDA` → MSG-05, aunque se corrija B.

### 2.3 Dependencias de la funcionalidad

| Dependencia | Dónde | Requisito | Afecta |
|---|---|---|---|
| Función Client SuiteScript | Habilitar funciones > SuiteCloud | Activa | E1, E3 |
| Función Server SuiteScript | Habilitar funciones > SuiteCloud | Activa | Selector, botón, validación al guardar |
| Despliegue `customdeploy_sads_mtn_ue_oc` | Scripting > Despliegues | Liberado; audiencia todos los roles; subsidiarias que incluyan las de los usuarios; parámetro `custscript_sads_mtn_form_id` = ID del formulario en producción | Selector y botón |
| Despliegue `customdeploy_sads_mtn_cs_oc` | Scripting > Despliegues | Liberado; Desplegado; mismas audiencias | E1, E3 |
| Tipo de registro "Equipo de transporte" | Tipo de acceso | Ver tabla de permisos (§3, paso B) | E2 y guardado |
| Rol de compras: Transacciones | Permisos > Transacciones | Orden de compra: Crear/Editar | Captura |
| Rol de compras: Listas | Permisos > Listas | Artículos: Ver; Equipo de transporte (o Entradas de registros personalizados): Ver | E2 |
| Rol de compras: subsidiarias | Rol > Restricciones de subsidiaria | Incluir la subsidiaria de los artículos `MTN-*` y la de los equipos | B2 |
| Artículos `MTN-*` | Registro del artículo > Subsidiaria | Subsidiaria visible para el rol, o "Incluir subordinadas" | B2 |
| Búsquedas `customsearch_sads_mtn_*` | Búsqueda > Pública | Pública (verificado en XML) | — |
| Campo `custbody_sads_mtn_equipo` | Filtro por subsidiaria | Subsidiaria del equipo = subsidiaria de la OC | Lista de equipos |
| Archivos en `/SuiteScripts/mtto_equipo/` | Gabinete de archivos | El rol puede descargar los `.js` (por defecto sí) | Botón |

## 3. Plan de corrección

### Paso A. Confirmar la causa A en producción (sin cambio de código)

1. Revisar A1 a A4 en el orden de la tabla 2.1 y registrar el resultado.
2. Si ninguna explica el fallo: activar diagnóstico (`DIAGNOSTICO.ACTIVO = true` en `lib/config.js`), desplegar, abrir la OC con F12 y "Conservar registro".
   - Solo `módulo cargado` sin `entrada pageInit`: confirma que NetSuite no invoca el despliegue.
   - Ningún mensaje `[sads_mtn]` antes de pulsar el botón: el despliegue de cliente no carga el módulo.
3. Corregir la candidata confirmada en la cuenta: activar Client SuiteScript, ajustar audiencia o pasar a Liberado.

### Paso B. Permisos del rol de compras (corrige E2)

Recomendación: cambiar el tipo de acceso del registro a "Usar lista de permisos" y agregar los roles de captura con nivel Ver.
Motivo: "Entradas de registros personalizados" otorga acceso a todos los registros con ese tipo de acceso, no solo a Equipo.
Alternativa aceptable: dar al rol "Entradas de registros personalizados" nivel Ver.

1. Tipo de registro "Equipo de transporte" > Tipo de acceso > "Usar lista de permisos"; pestaña Permisos: roles de captura, nivel Ver.
2. Rol de compras > Restricciones de subsidiaria: confirmar que ve la subsidiaria de los artículos `MTN-*` (B2). Si no, asignar los artículos con "Incluir subordinadas" o ampliar el rol.
3. Ejecutar "Ver resultados" de una búsqueda `customsearch_sads_mtn_*` con el rol de compras; debe devolver artículos.
4. Reflejar el cambio en el repositorio: `customrecord_sads_mtn_equipo.xml` (`accesstype` y bloque de permisos), o exportarlo de producción con `suitecloud object:import` para no sobrescribirlo en el siguiente despliegue.

### Paso C. Cambios de código (robustez y diagnóstico)

| Archivo | Cambio | Motivo |
|---|---|---|
| `lib/datos.js` | `obtenerEquipo` conserva el nombre y mensaje del error de `lookupFields` (por ejemplo `INSUFFICIENT_PERMISSION`) y `prepararSeleccion` lo pasa en `detalle`. Mantener la firma: devolver nulo, y exponer el último error mediante una segunda función o un objeto de opciones, para no romper `ue_sads_mtn_oc.js:208` | Hoy el detalle es "Equipo inexistente o inaccesible" y oculta la falta de permiso |
| `ue_sads_mtn_oc.js:210-213` | Incluir en `log.error` usuario, rol y el detalle anterior | Diagnosticar desde el registro de ejecución sin consola |
| `lib/config.js` | Dejar `DIAGNOSTICO.ACTIVO = false` al cerrar | Criterio vigente |
| `cs_sads_mtn_oc.js` | Sin cambio si el paso A corrige la causa. Si la causa no es corregible en la cuenta, se replantea con el usuario (por ejemplo, llenar el selector desde el botón también al cambiar equipo); no se incluye en este plan | Evitar parches sobre una causa de configuración |

Despliegue: `suitecloud project:validate --server` y `suitecloud project:deploy` contra producción, después de validar en sandbox.

### Paso D. Documentación

`README_mtto_equipo.md`: §2.2 tipo de acceso real; §5.5 permisos de §2.3 de este plan, incluida la restricción de subsidiarias; §7.1 detalle `INSUFFICIENT_PERMISSION`; §12 riesgos R-21 (Client SuiteScript desactivado) y R-22 (rol sin permiso bloquea el guardado); versión 1.10.

## 4. Pruebas a ejecutar por el usuario

Ejecutar con dos sesiones: propietario (administrador) y usuario de compras real. Diagnóstico activo solo durante la prueba.

| # | Usuario | Escenario | Resultado esperado |
|---|---|---|---|
| P-01 | Ambos | Abrir OC nueva en el formulario exclusivo con F12 | Consola: `módulo cargado` y `entrada pageInit` |
| P-02 | Ambos | Elegir equipo con clic en la lista | Sin pulsar el botón, el selector muestra los artículos del equipo |
| P-03 | Ambos | Escribir el equipo y pulsar el botón sin salir del campo | Documentar el resultado; si aparece MSG-01, salir del campo y repetir: debe llenar el selector |
| P-04 | Compras | Pulsar "Agregar artículo" sin artículo elegido | MSG-09 y selector lleno; no MSG-05 |
| P-05 | Ambos | Agregar 2 líneas, cambiar equipo, aceptar MSG-02 | Cero líneas; selector con artículos del nuevo equipo |
| P-06 | Ambos | Igual que P-05, cancelar MSG-02 | Equipo, líneas y selector sin cambio |
| P-07 | Compras | Guardar OC con equipo y artículos del listado | Se guarda sin MSG-05 |
| P-08 | Compras | Editar la OC de P-07 | Selector lleno desde la carga; sin "Selector sin artículos" en el registro de ejecución del UE |
| P-09 | Compras | Capturar línea con artículo fuera de listado (CSV o formulario estándar con equipo) | Rechazo MSG-04 al guardar |
| P-10 | Compras | Equipo de otra subsidiaria permitida por el rol | Solo aparecen equipos de la subsidiaria de la OC |
| P-11 | Compras, antes del paso B | Repetir P-04 con diagnóstico | `carga de artículos desde el botón: falla` con detalle de permiso (valida el cambio de `datos.js`) |
| P-12 | Ambos | Abrir OC en otro formulario | Sin selector, sin botón, sin efectos |

Criterio de cierre: P-01 a P-08 aprobadas con el usuario de compras.

## 5. Verificación y límites

Verificado: código del Client Script, User Event, `datos.js`, `config.js`; XML de scripts, registro, campo y 60 búsquedas (filtros decodificados de 3; públicas).
No verificado: estado real de funciones, despliegues, roles y subsidiarias de artículos en producción; no hay conexión a NetSuite desde este entorno.
Supuesto: la falta de la función Client SuiteScript o la audiencia del despliegue explica E1 y E3; se confirma en el paso A.
Fuentes: `README_mtto_equipo.md` (§2.2, §5.5, §7.1, §10 D-Q, I-08), `src/Objects/*.xml`, `src/FileCabinet/SuiteScripts/mtto_equipo/*`.
