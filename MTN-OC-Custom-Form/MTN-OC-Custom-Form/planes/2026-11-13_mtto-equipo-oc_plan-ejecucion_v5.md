# Plan v5: corrección de opciones vacías en la columna "Artículo del equipo"

| Campo | Valor |
|---|---|
| Fecha | 2026-11-13 |
| Versión | 5 (incremental sobre v4, `planes/2026-11-13_mtto-equipo-oc_plan-ejecucion_v4.md`) |
| Rama | `claude/wizardly-franklin-2fca8g` |
| Raíz SDF | `MTN-OC-Custom-Form/MTN-OC-Custom-Form/` |

Historial: v5, 2026-11-13, D-F: corregir la carga de opciones de la columna auxiliar conservando la columna, con diagnóstico en consola.

## 1. Contexto

En sandbox, con el formulario exclusivo y un equipo seleccionado, la columna "Artículo del equipo" aparece, pero su lista sale vacía y no se muestra ningún mensaje.
Que la columna aparezca confirma que el User Event (`beforeLoad`) se ejecuta.
Que no aparezca MSG-05 indica que la carga de artículos no falló, o que el Client Script no corre.

Causa probable (inferencia, no verificada en cuenta):
`cs_sads_mtn_oc.js` obtiene el campo con `getSublistField({ line: getCurrentSublistIndex() })`.
En Client Scripts, `getSublistField` lanza `SSS_INVALID_SUBLIST_OPERATION` cuando la línea es nueva y no está confirmada (tipados de SuiteScript 2.0 y foros de NetSuite Professionals).
`obtenerCampoAuxiliar` (`cs_sads_mtn_oc.js:305-311`) atrapa el error y devuelve nulo sin registrar nada, así que `poblarOpcionesLineaActual` sale sin insertar opciones.
En una OC nueva todas las líneas en captura son nuevas, por eso la lista siempre sale vacía.

Decisión D-F del usuario: conservar la columna (D-09), agregar estrategias alternativas para obtener el campo y diagnóstico en la consola del navegador.
Si el diagnóstico confirma que no hay forma de llenar líneas nuevas, la siguiente iteración reemplaza la columna por un campo de cabecera.

Hipótesis alternativa con el mismo síntoma: el Client Script no se carga.
La columna la agrega el User Event; si el Client Script no corre, nadie inserta opciones y MSG-05 nunca se evalúa.

| Causa posible | Señal |
|---|---|
| `cs_sads_mtn_oc.js` o `lib/` no están en `SuiteScripts/mtto_equipo/` | Error `MODULE_DOES_NOT_EXIST` en la consola F12 |
| `clientScriptModulePath = './cs_sads_mtn_oc.js'` no se resuelve | El archivo no aparece en la pestaña Red de F12, o aparece con 404 |
| Error al cargar un módulo del Client Script | Error rojo en la consola al abrir la OC |

## 1.1 Comprobación previa sin cambiar código (administrador, en sandbox)

| # | Prueba | Si el Client Script carga | Si no carga |
|---|---|---|---|
| P-1 | OC nueva con el formulario exclusivo, sin equipo; pulsar "Agregar" en la sublista de artículos | Aparece MSG-01: "Seleccione un equipo de transporte antes de capturar artículos." | Aparece el mensaje nativo de NetSuite de artículo obligatorio, o ninguno |
| P-2 | F12 > Red, filtrar `sads_mtn`; recargar la OC | Se ven `cs_sads_mtn_oc.js`, `config.js`, `reglas.js` y `datos.js` con estado 200 | No aparecen, o aparecen con 404 |
| P-3 | F12 > Consola al abrir la OC y al elegir equipo | Sin errores rojos del proyecto | Error con `mtto_equipo` o `MODULE_DOES_NOT_EXIST` |

Con P-1 positiva, la causa es `getSublistField` y aplica la sección 2.
Con P-1 negativa, primero se corrige la carga: verificar archivos en el File Cabinet; si están, cambiar `RUTAS.ARCHIVO_CS` a la ruta absoluta `/SuiteScripts/mtto_equipo/cs_sads_mtn_oc.js` en `lib/config.js`.

## 2. Cambios

| Archivo | Cambio |
|---|---|
| `lib/config.js` | Nuevo bloque `DIAGNOSTICO = { ACTIVO: true, PREFIJO: '[sads_mtn]' }` para encender o apagar los mensajes de consola sin tocar la lógica |
| `cs_sads_mtn_oc.js` | `obtenerCampoAuxiliar` prueba dos estrategias en orden: (1) línea actual; (2) línea 0 si hay líneas confirmadas. Cada intento fallido o nulo se registra con estrategia, índice actual, total de líneas, nombre y mensaje del error. Devuelve el primer campo obtenido |
| `cs_sads_mtn_oc.js` | Nueva función `diagnostico(etapa, datos)`: `console.warn` con el prefijo, solo si `DIAGNOSTICO.ACTIVO` y existe `console`. No toca el DOM |
| `cs_sads_mtn_oc.js` | Diagnóstico en `pageInit` (modo, equipo), en `cargarSeleccion` (éxito, número de artículos o código de falla) y en `poblarOpcionesLineaActual` (estrategia usada, opciones insertadas, campo no disponible) |
| `cs_sads_mtn_oc.js` | La opción vacía se inserta en su propio `try/catch`; si falla se registra y se siguen insertando los artículos |
| `cs_sads_mtn_oc.js` | Mensaje de diagnóstico al cargar el módulo (antes de `pageInit`): distingue "módulo no cargado" de "módulo cargado pero `pageInit` no ejecutado" |
| `ue_sads_mtn_oc.js` | `log.audit` "Client Script adjuntado" con la ruta, después de asignar `clientScriptModulePath`; visible con la bitácora en Auditoría |
| `README_mtto_equipo.md` | Nueva sección "Diagnóstico en pantalla": cómo abrir la consola (F12), qué mensajes buscar, cómo interpretarlos y cómo apagar el diagnóstico. Riesgo R-07 sobre líneas nuevas. Desviación I-10. Prueba POC-1 indica revisar la consola |
| `planes/2026-11-13_mtto-equipo-oc_plan-ejecucion_v5.md` | Copia de este plan |

Sin cambios en `lib/reglas.js`, `lib/datos.js` ni en los XML.
La gobernanza no cambia: las opciones salen de memoria de la página.

## 3. Interpretación del diagnóstico (para el README)

| Mensaje en consola | Significado | Acción |
|---|---|---|
| No aparece ningún mensaje `[sads_mtn]` y la bitácora del UE dice "Client Script adjuntado" | El UE adjunta el script, pero el navegador no lo carga | Revisar P-2 y P-3; si los archivos existen, usar la ruta absoluta en `RUTAS.ARCHIVO_CS` |
| No aparece "Client Script adjuntado" en la bitácora del UE | `beforeLoad` termina antes de adjuntar | Revisar el parámetro de formulario y las advertencias de `beforeLoad` |
| `módulo cargado` sin `pageInit` | NetSuite no invoca los puntos de entrada | Revisar errores rojos en la consola |
| `carga de artículos: falla` con código | La búsqueda o el equipo fallan | Revisar el registro Equipo y la búsqueda (MSG-05 debió aparecer) |
| `campo auxiliar: línea actual falló` y luego `línea 0 obtenido` | La estrategia alternativa funciona | Ninguna; se confirma en POC-1 |
| `campo auxiliar no disponible` en la primera línea de una OC nueva | Ninguna estrategia funciona sin líneas confirmadas | Reportar; pasar a la alternativa de campo en cabecera |

## 4. Verificación

| Verificación | Método | Criterio |
|---|---|---|
| Sintaxis | `node --check` en los 5 `.js` | Sin errores |
| Regla de dependencia y configuración | Búsqueda de `N/` en `reglas.js` y `config.js`; IDs solo en `config.js` | Sin cambios respecto de v4 |
| Lógica de la estrategia | Comprobación desechable en scratchpad con un `currentRecord` simulado: la línea actual lanza `SSS_INVALID_SUBLIST_OPERATION` y la línea 0 devuelve campo; luego, sin líneas confirmadas | Primer caso: opciones insertadas con la estrategia 2 y advertencia registrada. Segundo caso: advertencia "no disponible", sin excepción |
| Git | Commit y push a `claude/wizardly-franklin-2fca8g` | — |
| Sandbox (administrador) | Volver a desplegar con `suitecloud project:deploy`; abrir OC nueva con el formulario exclusivo y la consola F12; elegir equipo; capturar y confirmar una línea; abrir una segunda línea | Reportar los mensajes `[sads_mtn]`. Esperado: opciones visibles al menos desde la segunda línea |

## 5. Riesgos

| ID | Enunciado | Fundamento | Consecuencia | Mitigación |
|---|---|---|---|---|
| R-07 | La primera línea de una OC nueva puede seguir sin opciones | Sin líneas confirmadas no existe línea 0 para la estrategia 2 | El usuario no puede capturar la primera línea con la columna | El diagnóstico lo confirma; alternativa: campo en cabecera |
| R-08 | La estrategia 2 depende de que las opciones de una línea confirmada afecten la línea en captura | Comportamiento no documentado del envoltorio SS2 sobre SS1 | Puede dejar de funcionar con una versión futura de NetSuite | Diagnóstico activo; POC-1 en cada actualización mayor |

## 6. Fuentes

Tipados de SuiteScript 2.0 (`headintheclouddev/typings-suitescript-2.0`, PR 393): `getSublistField` lanza `SSS_INVALID_SUBLIST_OPERATION` en Client Scripts.
Documentación de Oracle: `Field.insertSelectOption` solo en campos `custpage` agregados por Suitelet o `beforeLoad`.
Foros de NetSuite Professionals y Oracle Community: `getSublistField` no disponible en líneas nuevas desde `fieldChanged` y `lineInit` (hilos no leídos completos: dominios bloqueados por la red de la sesión).
