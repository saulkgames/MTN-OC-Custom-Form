# Plan v9: Client Script con despliegue propio y diagnóstico del llenado en servidor

| Campo | Valor |
|---|---|
| Fecha | 2026-11-13 |
| Versión | 9 (incremental sobre v8, `planes/2026-11-13_mtto-equipo-oc_plan-ejecucion_v8.md`) |
| Rama | `claude/wizardly-franklin-2fca8g` |
| Raíz SDF | `MTN-OC-Custom-Form/MTN-OC-Custom-Form/` |

Historial: v9, 2026-11-13, D-Q: el Client Script pasa a tener registro y despliegue propios en Orden de compra; registro de errores del llenado en servidor en nivel Error; el botón carga el selector si está vacío.

## 1. Contexto

Hechos verificados por el usuario en sandbox con v8 desplegada:

| Hecho | Conclusión |
|---|---|
| Al abrir la OC y elegir el equipo, la consola solo muestra `[sads_mtn] módulo cargado {archivo: './cs_sads_mtn_oc.js'}` | NetSuite carga el módulo adjuntado con `clientScriptModulePath`, pero no invoca `pageInit` ni `fieldChanged`. S-05 ("el módulo adjuntado por el UE no requiere despliegue propio") es falso en esta cuenta. Explica también v5 y v6 |
| Al pulsar el botón aparece `entrada agregarArticuloSeleccionado` y MSG-09 | El botón funciona; `require` con la ruta absoluta `/SuiteScripts/mtto_equipo/cs_sads_mtn_oc.js` resuelve el módulo; el selector está vacío |
| Tras elegir equipo y proveedor (recarga), el selector sigue vacío | El llenado en `beforeLoad` también falla. El motivo se registra como "Selector sin artículos" con `log.audit`, invisible con el despliegue en nivel Error |

Pregunta del usuario: ¿influyen los permisos de la búsqueda guardada?
Sí, para el llenado en servidor y en cliente: `search.load` y `search.lookupFields` corren con el rol del usuario.
No explican que NetSuite no invoque los eventos del Client Script.

Objetivo: que los eventos del Client Script se ejecuten con un mecanismo documentado, y que la causa del llenado vacío en servidor quede visible sin cambiar el nivel de bitácora.

## 2. Cambios

| Archivo | Cambio |
|---|---|
| `src/Objects/customscript_sads_mtn_cs_oc.xml` (nuevo) | Objeto SDF `clientscript`: `scriptfile` = `[/SuiteScripts/mtto_equipo/cs_sads_mtn_oc.js]`; despliegue `customdeploy_sads_mtn_cs_oc` en Orden de compra, estado Pruebas, todos los roles, bitácora Error. Mecanismo documentado de Oracle para que NetSuite invoque `pageInit`, `fieldChanged`, `validateField`, `validateLine` y `saveRecord` |
| `lib/config.js` | `IDS.SCRIPT_CS = 'customscript_sads_mtn_cs_oc'`, `IDS.DEPLOY_CS = 'customdeploy_sads_mtn_cs_oc'`; se retira `RUTAS.ARCHIVO_CS` (relativa); se conserva `RUTAS.MODULO_CS` para el botón |
| `ue_sads_mtn_oc.js` | Se elimina la asignación de `clientScriptModulePath` y su registro, para no cargar el módulo dos veces. El resultado del llenado del selector se registra siempre: con éxito, `log.audit` con el número de artículos; con falla, `log.error` "Selector sin artículos" con código, equipo, búsqueda y detalle del error de NetSuite (visible en nivel Error) |
| `cs_sads_mtn_oc.js` | `protegido` no ejecuta el punto de entrada si el formulario no tiene el selector (otros formularios de OC): devuelve `true`, sin registro. El despliegue en Orden de compra carga el script en todos los formularios; el selector solo existe en el exclusivo |
| `cs_sads_mtn_oc.js` | Botón: si no hay artículo elegido y hay equipo, carga los artículos del equipo (`datos.prepararSeleccion`, 16 unidades), llena el selector y muestra MSG-09; si la carga falla, muestra MSG-05 y registra el código y el detalle en la consola. Respaldo por si `fieldChanged` no corre |
| `cs_sads_mtn_oc.js` | `poblarSelector(registro, articulos)` recibe la lista; 3 llamadas (`pageInit`, `alCambiarEquipo`, botón) |
| `README_mtto_equipo.md` | Secciones 2 y 4 con el script de cliente nuevo y su despliegue; 5.5 permisos ampliados (búsqueda pública o con audiencia del rol, permiso del registro Equipo, artículos ver, audiencia de ambos despliegues); 7 y 7.1 con los registros nuevos; S-05 marcado como refutado; desviación D-Q; riesgos actualizados |
| `planes/2026-11-13_mtto-equipo-oc_plan-ejecucion_v9.md` | Copia de este plan |

Criterio D-G: no se agregan funciones de una sola llamada.
`lib/reglas.js` y `lib/datos.js` sin cambios.

## 3. Lo que el administrador revisa en sandbox

| # | Acción | Dónde | Resultado esperado |
|---|---|---|---|
| 1 | Desplegar con `suitecloud project:deploy` | Local | Script `customscript_sads_mtn_cs_oc` y despliegue en Pruebas |
| 2 | Abrir OC nueva en el formulario exclusivo con la consola (filtro `sads_mtn`) | Navegador | `entrada pageInit`; al elegir equipo, `entrada fieldChanged` y `selector llenado` |
| 3 | Si el selector sigue vacío, revisar el registro de ejecución del despliegue del UE | Personalización > Scripting > Despliegues de script > `customdeploy_sads_mtn_ue_oc` > Registro de ejecución | Error "Selector sin artículos" con el detalle de NetSuite (por ejemplo, búsqueda inexistente o permiso insuficiente) |
| 4 | Verificar permisos con el rol de prueba | Búsqueda: Pública o audiencia con el rol. Rol: "Equipo de transporte" ver; Artículos ver | Selector lleno |
| 5 | Pulsar el botón con el selector vacío | Formulario | Selector lleno y MSG-09; o MSG-05 con el detalle en la consola |

## 4. Verificación en la sesión

| Verificación | Método | Criterio |
|---|---|---|
| Criterio D-G | Conteo de llamadas | Cumple |
| Sintaxis y XML | `node --check`; `xmllint --noout` en los 4 XML | Sin errores |
| IDs | Búsqueda estática | IDs solo en `config.js` y `src/Objects/` |
| Servidor | Comprobación desechable: `beforeLoad` sin `clientScriptModulePath`; `log.error` al fallar el llenado y `log.audit` al tener éxito; `beforeSubmit` con los escenarios previos | Todos pasan |
| Cliente | Comprobación desechable: `protegido` sin selector devuelve `true` y no ejecuta; con selector ejecuta; botón con selector vacío carga y muestra MSG-09; botón con carga fallida muestra MSG-05; escenarios previos del botón | Todos pasan |
| Git | Commit y push a `claude/wizardly-franklin-2fca8g` | — |

## 5. Riesgos

| ID | Enunciado | Fundamento | Consecuencia | Mitigación |
|---|---|---|---|---|
| R-16 | El Client Script se carga en todos los formularios de OC | Un despliegue de cliente aplica al tipo de registro, no al formulario | Descarga del módulo en cada OC; sin consultas ni efectos fuera del formulario exclusivo | `protegido` sale si no existe el selector |
| R-17 | En estado Pruebas, el script de cliente solo corre para el propietario del script | Comportamiento estándar de despliegues en Pruebas | Otros usuarios no ven el selector lleno hasta pasar a Liberado | Probar con el usuario propietario; liberar en el paso 8 |
| R-18 | El objeto SDF `clientscript` no se validó contra el servidor | Red de desarrollo sin acceso a NetSuite | Error de esquema en el paso 1 | `project:validate --server` antes de desplegar |
| R-19 | Permisos de búsqueda o de registro insuficientes para el rol de captura | `search.load` y `lookupFields` corren con el rol del usuario | Selector vacío y MSG-05 | Registro en nivel Error con el detalle; sección 5.5 del README |
