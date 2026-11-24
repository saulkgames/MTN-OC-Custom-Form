# Diagnóstico v2 y plan de corrección: selector vacío y líneas no eliminadas (mtto_equipo, producción)

## 1. Contexto

La v1 del diagnóstico (commit `30018dc`) dejó la causa A sin confirmar.
El usuario revisó producción y descartó A1 a A3.

| Candidata v1 | Resultado en producción |
|---|---|
| A1 Client SuiteScript desactivado | Activo, igual que Server SuiteScript |
| A2 Audiencia por subsidiaria | Todas las subsidiarias |
| A3 Estado del despliegue | Liberado y desplegado |
| B Permiso sobre el registro Equipo | Corregido: tipo de acceso cambiado a "No se necesitan permisos para los roles internos" |
| B2 Restricción de subsidiarias | El rol tiene restricción, pero hay artículos que cumplen |

El parche `30018dc` aún no está instalado en producción.

## 2. Diagnóstico v2

### 2.1 Causa A confirmada por evidencia: límite de 10 scripts de cliente por registro

Hecho verificado (captura de Registros con script > Pedido, pestaña Scripts de cliente): hay 14 scripts de cliente liberados en Orden de compra; "SADS MTN Equipo en Orden de compra (CS)" ocupa el lugar 14.
Fundamento: la ayuda de Oracle documenta un máximo de 10 scripts de cliente por registro, localizados o no; desde 2025.2 el administrador puede quitar el límite en Configuración > Empresa > Preferencias generales. Los no localizados se ejecutan primero, en el orden de la página Registros con script.
Inferencia: los lugares 11 a 14 no se ejecutan. Oracle no documenta de forma explícita cuáles 10 corren; los foros reportan que corren los primeros 10.
Consecuencia: el Client Script no corre (E1 y E3); el botón sí funciona porque carga el módulo con `require`, fuera del despliegue.
En sandbox funcionó porque, como supuesto, hay 10 o menos scripts de cliente en OC.

Hallazgo fuera del alcance, con riesgo: hoy tampoco corren, como inferencia, los lugares 11 a 13.

| Lugar | Script | Punto de entrada | Consecuencia |
|---|---|---|---|
| 11 | DRT - Purchase Order CLNT | saveRecord | Validación al guardar inactiva en todas las OC |
| 12 | LRC Field Manager Client Script | fieldChanged | Comportamiento de campos inactivo |
| 13 | BM CS BudgetValidations | pageInit, saveRecord | Validación presupuestal en pantalla inactiva |

### 2.2 Decisión del usuario

Subir SADS MTN a los primeros 10 lugares en Registros con script.
Efecto lateral: el script que quede en el lugar 11 deja de correr en todas las OC. Con el orden actual sería "ALM - REGLAS ART DESCONTINUADOS" (saveRecord).

### 2.3 Causa B: corregida en cuenta, con riesgo de control

Hecho: el tipo de acceso de `customrecord_sads_mtn_equipo` es ahora "No se necesitan permisos" en producción; el XML del repositorio sigue con `CUSTRECORDENTRYPERM`.
Riesgo: con ese tipo de acceso, cualquier rol interno puede acceder al registro Equipo. Fundamento: definición del tipo de acceso de registros personalizados. Consecuencia: un usuario de compras podría editar el campo Búsqueda guardada o la Subsidiaria de un equipo y abrir el listado de artículos. Verificar el nivel real con la prueba P-14; si permite editar, cambiar a "Usar lista de permisos" con los roles de captura en Ver.
Riesgo de despliegue: el siguiente `project:deploy` regresa el tipo de acceso a `CUSTRECORDENTRYPERM` y reaparece MSG-05 para compras.

### 2.4 Hallazgos de la consola (otros scripts, fuera del alcance)

| Script | Hecho | Riesgo |
|---|---|---|
| DRT - Dimensión por Unidad Medida (lugar 5) | En `validateLine` busca `customrecord_drt_dimension`; el rol recibe `INSUFFICIENT_PERMISSION` y el script registra `{success: false}` | Si su `validateLine` devuelve falso con esa falla, bloquea líneas para ese rol; revisarlo con su propietario |
| DRT - Costo de Compra CS (lugar 6) | `validateLine` tiene `debugger;` y `console.log` | Con DevTools abierto pausa la ejecución en cada línea; afecta las pruebas con F12 |

## 3. Plan de corrección

### Paso A. Confirmar la causa en producción (sin código)

1. Registros con script > Pedido > Editar > Scripts de cliente: arrastrar "SADS MTN Equipo en Orden de compra (CS)" a un lugar del 1 al 10.
   Lugar recomendado: inmediatamente después de "MX CS Purchase Order" (lugar 7) o al final de los 10. Cualquiera empuja un script al lugar 11.
2. Antes de guardar, decidir con el propietario de "ALM - REGLAS ART DESCONTINUADOS" (o del script que quede en el 11) si puede dejar de correr. Si no, mover a otro script de menor impacto al lugar 11.
3. Revisar la pestaña "Scripts de cliente localizados" y anotar cuántos hay; los no localizados corren primero, así que no deberían desplazar a SADS MTN.
4. Ejecutar P-00 a P-06 (§4).

### Paso B. Alinear el repositorio con producción

| Archivo | Cambio |
|---|---|
| `src/Objects/customrecord_sads_mtn_equipo.xml` | `accesstype` al valor de producción (`NONENEEDED`), o `USEPERMISSIONLIST` con permisos de rol si P-14 muestra que compras puede editar. Alternativa: `suitecloud object:import` del objeto desde producción |
| `README_mtto_equipo.md` | Versión 1.11. §2.2 tipo de acceso real. §5.7: requisito "el Client Script debe estar entre los primeros 10 de Registros con script > Orden de compra" y cómo verificarlo. §7.1: "ningún `entrada pageInit`" apunta primero al límite de 10. §12: R-23 límite de 10 (fundamento, consecuencia, mitigación); R-24 tipo de acceso sin permisos; ajustar R-21 (A1 descartada en producción) |
| `planes/2026-11-24_mtto-equipo-oc_diagnostico-incidencia_v2.md` | Copia de este plan |

Sin cambios en `cs_sads_mtn_oc.js`, `ue_sads_mtn_oc.js` ni `lib/`. El parche `30018dc` se instala como está.
El orden de Registros con script no viaja por SDF: queda como paso manual en §4.1 del README para cada ambiente.

### Paso C. Instalar el parche

`suitecloud project:validate --server` y `suitecloud project:deploy` contra producción, con el XML del registro ya alineado (paso B), para no revertir el tipo de acceso.

## 4. Pruebas a ejecutar por el usuario

Diagnóstico activo solo durante la prueba (`DIAGNOSTICO.ACTIVO = true`). Cerrar DevTools al probar el flujo normal, por el `debugger;` de "DRT - Costo de Compra CS".

| # | Usuario | Escenario | Esperado |
|---|---|---|---|
| P-00 | Propietario | Después del reordenamiento, abrir OC nueva en el formulario 382 con F12 | Consola: `módulo cargado` y `entrada pageInit` |
| P-01 | Compras | Lo mismo que P-00 | Igual |
| P-02 | Ambos | Elegir equipo con clic | El selector se llena sin pulsar el botón |
| P-03 | Ambos | Escribir el equipo y pulsar el botón sin salir del campo | Anotar resultado; al salir del campo y repetir, se llena |
| P-04 | Compras | Pulsar "Agregar artículo" sin artículo | MSG-09 y selector lleno; no MSG-05 |
| P-05 | Ambos | 2 líneas, cambiar equipo, aceptar MSG-02 | Cero líneas; artículos del nuevo equipo |
| P-06 | Ambos | Igual que P-05, cancelar MSG-02 | Sin cambios |
| P-07 | Compras | Capturar artículo del listado y confirmar la línea | `validateLine` acepta |
| P-08 | Compras | Guardar la OC | Se guarda sin MSG-05 |
| P-09 | Compras | Editar la OC de P-08 | Selector lleno desde la carga |
| P-10 | Compras | Línea fuera de listado (CSV o formulario estándar con equipo) | Rechazo MSG-04 |
| P-11 | Ambos | OC en otro formulario | Sin selector ni botón; resto de scripts igual que antes |
| P-12 | Ambos | OC con artículo descontinuado en cualquier formulario | Documentar si "ALM - REGLAS ART DESCONTINUADOS" (o el script desplazado) dejó de validar |
| P-13 | Compras | Después de instalar el parche, equipo con búsqueda inexistente | MSG-05; bitácora del UE con detalle `Búsqueda ...: <error>` |
| P-14 | Compras | Abrir un registro "Equipo de transporte" y pulsar Editar | Registrar si puede editar; si puede, aplicar "Usar lista de permisos" (§2.3) |

Criterio de cierre: P-00 a P-09 aprobadas con el usuario de compras y P-12 documentada.

## 5. Verificación y límites

Verificado: 14 scripts de cliente en OC y posición 14 de SADS MTN (captura del usuario); código propio sin cambios necesarios para la causa A.
Verificado parcialmente: el límite de 10 está en la ayuda de Oracle; cuáles 10 corren al excederlo es inferencia de foros.
No verificado: número de scripts de cliente en OC en sandbox; nivel de acceso efectivo con "No se necesitan permisos"; impacto de desplazar "ALM - REGLAS ART DESCONTINUADOS".
Fuentes: captura de Registros con script > Pedido; consola del navegador del usuario; Oracle, "Client Scripts and Localized Client Scripts Subtabs on the Scripted Records Page" y "Execution Order of Deployed Scripts"; README §5.7, §7.1, §10 D-Q.
