# Plan v6: refactorización para auditoría y línea temporal

| Campo | Valor |
|---|---|
| Fecha | 2026-11-13 |
| Versión | 6 (incremental sobre v5, `planes/2026-11-13_mtto-equipo-oc_plan-ejecucion_v5.md`) |
| Rama | `claude/wizardly-franklin-2fca8g` |
| Raíz SDF | `MTN-OC-Custom-Form/MTN-OC-Custom-Form/` |

Historial: v6, 2026-11-13, D-G: en UE y CS, una función con una sola llamada se escribe en línea; D-H: línea temporal activada por parámetro; D-I: el servidor elimina líneas temporales; D-J: con cero líneas reales, mensaje nativo de NetSuite.

## 1. Contexto

El usuario encuentra difícil auditar `ue_sads_mtn_oc.js` y `cs_sads_mtn_oc.js` porque la lógica está repartida en muchas funciones de una sola llamada.
Criterio D-G: en esos dos archivos, una función con una sola llamada no se declara; su código se escribe donde se usa. `lib/` no cambia.

La columna "Artículo del equipo" sale sin opciones en líneas nuevas (v5).
Propuesta del usuario (D-H): agregar por script una línea temporal confirmada, sin impacto, para que la columna pueda cargarse a través de una línea que sí existe, y borrarla al final.
Supuesto del que depende: que las opciones insertadas a través del campo de una línea confirmada lleguen a la línea en captura (R-08 de v5).

Hecho verificado en sandbox (usuario, 2026-11-13, con v5 desplegada): el Client Script sí se carga.
Se descarta la hipótesis de carga; la causa restante es `getSublistField` en la línea nueva sin confirmar.
En una OC nueva no se puede probar la segunda línea: la primera no se puede confirmar porque el artículo nativo está bloqueado y la columna no tiene opciones.
La línea temporal sirve también como esa prueba: si tras insertarla la línea en captura muestra opciones, R-08 queda confirmado.

## 2. Refactorización (D-G)

### 2.1 `ue_sads_mtn_oc.js`

| Función actual | Llamadas | Resultado |
|---|---|---|
| `beforeLoad`, `beforeSubmit` | Puntos de entrada | Se conservan |
| `crearError` | 5 | Se conserva |
| `leerParametroFormulario`, `determinarFormulario`, `agregarColumnaAuxiliar`, `bloquearArticuloNativo` | 1 | En línea dentro de `beforeLoad` |
| `validarEdicionEnLinea`, `construirEntrada`, `leerLineasActuales`, `leerTextoArticulo`, `leerLineasOriginales`, `validarDocumento`, `registrarErroresDeConfiguracion` | 1 | En línea dentro de `beforeSubmit` |
| `registrarAuditoria` | 1 (callback) | Función flecha escrita en el argumento `bitacora` |

`beforeSubmit` queda como una secuencia numerada de pasos, en este orden:
1. Filtrar tipo de evento.
2. Edición en línea (RN-11): lanzar error con MSG-08 si cambia el equipo.
3. Eliminar líneas temporales (D-I).
4. Leer cabecera, líneas actuales y líneas originales.
5. RN-10, que lanza error de inmediato.
6. RN-06, que sale sin validar.
7. Equipo existente: si no existe, `log.error` y lanzar error.
8. RN-08, que acumula el error.
9. RN-04.
10. UC-01: si falla, `log.error` y acumular el error.
11. RN-03, que acumula el error.
12. Lanzar los errores acumulados.

Los errores de configuración se registran en el punto donde ocurren, no en una función aparte.
El comportamiento no cambia salvo el paso 3.

### 2.2 `cs_sads_mtn_oc.js`

| Función actual | Llamadas | Resultado |
|---|---|---|
| `pageInit`, `validateField`, `fieldChanged`, `lineInit`, `validateLine`, `saveRecord` | Puntos de entrada | Se conservan; se agrega `postSourcing` (sección 3) |
| `alCambiarEquipo` | 2 (equipo y reinicio por subsidiaria) | Se conserva |
| `cargarSeleccion` | 2 | Se conserva |
| `poblarOpcionesLineaActual` | 3 | Se conserva; absorbe `obtenerCampoAuxiliar` |
| `esEdicion`, `lineasOriginalesComoLista`, `leerValorLinea`, `diagnostico`, `describirError` | 2 o más | Se conservan |
| `guardarLineasOriginales`, `deshabilitarEquipo` | 1 | En línea en `pageInit` |
| `alCambiarSubsidiaria`, `alCambiarColumnaAuxiliar` | 1 | En línea en `fieldChanged` |
| `esLineaOriginalSinCambio` | 1 | En línea en `validateLine` |
| `limpiarEstado`, `eliminarTodasLasLineas` | 1 | En línea en `alCambiarEquipo` |
| `limpiarOpcionesLineaActual` | 1 | Se elimina: `poblarOpcionesLineaActual` ya borra las opciones antes de insertar; el comportamiento es idéntico |
| `obtenerCampoAuxiliar` | 1 tras eliminar la anterior | En línea en `poblarOpcionesLineaActual` |
| `leerLineasActuales` | 1 | En línea en `saveRecord` |

Funciones nuevas con dos o más llamadas: `asegurarLineaTemporal` (3) y `esLineaTemporal` (3).

## 3. Línea temporal (D-H, D-I, D-J)

### 3.1 Objetos

| Objeto | ID | Configuración |
|---|---|---|
| Parámetro del script (XML) | `custscript_sads_mtn_item_temporal` | Entero, no obligatorio. Vacío: la función queda apagada y no cambia nada |
| Campo de página oculto (runtime) | `custpage_sads_mtn_item_temporal` | Lo agrega `beforeLoad` en el formulario exclusivo con el valor del parámetro, para que el Client Script lo lea |
| Artículo temporal (manual) | ID interno por ambiente | Tipo "Otro cargo para la compra"; precio de compra 0; disponible en todas las subsidiarias; código de impuesto que no bloquee la línea; fuera de todas las búsquedas de equipo; nombre visible del tipo "NO USAR - LÍNEA TEMPORAL" |
| `lib/config.js` | `PARAM_ITEM_TEMPORAL`, `FLD_ITEM_TEMPORAL`, `ESTANDAR.FLD_PROVEEDOR = 'entity'` | Únicos lugares con los IDs nuevos |

### 3.2 Comportamiento en pantalla

| Momento | Acción |
|---|---|
| `asegurarLineaTemporal` | Solo si se cumplen todas: hay ID temporal, equipo cargado con éxito, proveedor capturado y cero líneas. Entonces `selectNewLine`, artículo temporal con sourcing síncrono y `commitLine`. Una bandera de estado hace que `validateLine` la acepte. Si NetSuite rechaza la línea, se registra en la consola, se cancela la línea y se sigue como en v5 |
| Llamadas | `pageInit` (tras cargar el equipo), `alCambiarEquipo` (tras eliminar líneas y cargar el nuevo equipo) y `postSourcing` del proveedor (`entity`), porque el supuesto es que NetSuite no admite líneas sin proveedor |
| Tras el `commitLine` | NetSuite abre una línea nueva; `lineInit` llena las opciones a través de la línea 0 confirmada (estrategia de v5) |
| `validateLine` | Acepta la línea temporal sin validar |
| `validateField` del equipo (RN-05) | Cuenta solo líneas reales: con solo la línea temporal no pide confirmación |
| `saveRecord` | Primero quita las líneas temporales; después valida como hoy, con números de línea correctos en MSG-04. Si quedan cero líneas reales, deja que NetSuite rechace la OC con su mensaje nativo (D-J) |

### 3.3 Servidor (D-I)

`beforeLoad`: agrega el campo oculto solo en el formulario exclusivo y solo si el parámetro tiene valor.
`beforeSubmit` (crear y editar, todos los contextos): si el parámetro tiene valor, elimina de la última a la primera las líneas con el artículo temporal y registra en auditoría cuántas quitó. Luego valida.
La línea temporal nunca se guarda: no genera registro contable, recepción ni CFDI.

## 4. Archivos

| Archivo | Cambio |
|---|---|
| `ue_sads_mtn_oc.js` | Refactorización 2.1; campo oculto en `beforeLoad`; eliminación de líneas temporales en `beforeSubmit` |
| `cs_sads_mtn_oc.js` | Refactorización 2.2; `asegurarLineaTemporal`, `esLineaTemporal`, `postSourcing`; ajustes en `validateLine`, `validateField` y `saveRecord` |
| `lib/config.js` | IDs nuevos de 3.1 |
| `src/Objects/customscript_sads_mtn_ue_oc.xml` | Parámetro `custscript_sads_mtn_item_temporal` |
| `README_mtto_equipo.md` | Artículo temporal y parámetro (secciones 2.2, 4 y 5), pruebas SB-15 a SB-17, mensajes de diagnóstico de la línea temporal, desviaciones, riesgos R-09 a R-11, pendientes `ITEM_TEMPORAL_SANDBOX` y `ITEM_TEMPORAL_PRODUCCION` |
| `planes/2026-11-13_mtto-equipo-oc_plan-ejecucion_v6.md` | Copia de este plan |

Sin cambios en `lib/reglas.js` ni `lib/datos.js`.

## 5. Pruebas en sandbox nuevas

| Caso | Escenario | Resultado esperado |
|---|---|---|
| SB-15 | OC nueva: elegir proveedor y equipo | Aparece la línea temporal y la primera línea en captura tiene opciones. La consola registra "línea temporal agregada" y "opciones insertadas" con estrategia "línea 0" |
| SB-16 | Guardar una OC con líneas reales y la línea temporal | Se guarda sin la línea temporal; los números de línea de MSG-04, si aplica, corresponden a las líneas reales |
| SB-17 | CSV con una línea del artículo temporal y líneas válidas | Se guarda sin la línea temporal; la bitácora de auditoría registra la eliminación |

## 6. Verificación en la sesión

| Verificación | Método | Criterio |
|---|---|---|
| Criterio D-G | Conteo de llamadas de cada función declarada en UE y CS | Toda función declarada es punto de entrada o tiene 2 o más llamadas |
| Sintaxis | `node --check` en los 5 `.js` | Sin errores |
| IDs y dependencias | Búsquedas estáticas de v5 | Sin cambios |
| XML | `xmllint --noout` | Sin errores |
| Comportamiento del servidor | Comprobación desechable en scratchpad: los 20 escenarios previos más la eliminación de líneas temporales | Todos pasan |
| Comportamiento en pantalla | Comprobación desechable con registro simulado: inserción de la línea temporal con proveedor y sin él; `validateField` sin confirmación con solo la línea temporal; `saveRecord` quita la línea temporal antes de numerar | Todos pasan |
| Git | Commit y push a `claude/wizardly-franklin-2fca8g` | — |

## 7. Riesgos

| ID | Enunciado | Fundamento | Consecuencia | Mitigación |
|---|---|---|---|---|
| R-08 | La línea temporal solo sirve si las opciones insertadas por la línea 0 llegan a la línea en captura | Comportamiento no documentado por Oracle | Si la segunda línea sale vacía en sandbox, la línea temporal tampoco resuelve el problema | Probar SB-15 junto con la segunda línea; con el parámetro vacío se apaga |
| R-09 | `commitLine` de la línea temporal puede fallar | Columnas obligatorias de la cuenta (departamento, clase, ubicación, impuesto) o proveedor sin capturar | No se inserta; el comportamiento queda igual que v5 | Configurar el artículo y las preferencias; el diagnóstico registra el error |
| R-10 | Con cero líneas reales, `saveRecord` quita la línea temporal y NetSuite rechaza la OC | Decisión D-J | La siguiente línea puede quedar sin opciones hasta cambiar el equipo o recargar la página | Documentado en el README |
| R-11 | El usuario ve la línea temporal y puede editarla o borrarla | Una línea de sublista no se puede ocultar | Si la borra con cero líneas reales, ocurre lo mismo que en R-10 | Nombre visible "NO USAR - LÍNEA TEMPORAL"; capacitación |
