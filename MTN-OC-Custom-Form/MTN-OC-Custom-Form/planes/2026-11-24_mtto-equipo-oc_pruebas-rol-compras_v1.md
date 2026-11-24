# Fase 3: pruebas con el rol de compras (mtto_equipo, producción)

## 1. Contexto

Hecho reportado por el usuario: al mover "SADS MTN Equipo en Orden de compra (CS)" a los primeros 10 de Registros con script, desaparecieron E1 (selector no se llena al elegir equipo) y E3 (cambio de equipo no borra líneas) con su usuario y rol.
Conclusión: la causa A (límite de 10 scripts de cliente, R-23) queda confirmada.
Pendiente: validar con el usuario y rol del empleado de compras, que además tenía MSG-05 (causa B, permiso sobre el registro Equipo, corregida con el tipo de acceso "No se necesitan permisos").
Sin cambios de código en esta fase. El parche `30018dc` (detalle de errores) y `4150768` (XML y README) están en la rama `claude/wizardly-franklin-2fca8g`; no consta si ya están instalados en producción.

## 2. Cómo ejecutar las pruebas con ese rol

| Opción | Qué valida | Límite |
|---|---|---|
| 1. El empleado ejecuta las pruebas con su sesión, contigo presente (recomendado) | Rol, subsidiaria del empleado, preferencias de usuario y audiencia reales | Requiere su tiempo |
| 2. Asignar temporalmente el rol de compras a tu empleado y cambiar de rol | Permisos y restricción de subsidiarias del rol | No reproduce la subsidiaria ni las preferencias del empleado; quitar el rol al terminar |

Preparación:
1. Confirmar en Registros con script > Orden de compra que SADS MTN sigue entre los primeros 10.
2. Tener un equipo de la subsidiaria del empleado cuya búsqueda devuelva artículos con tu usuario.
3. Diagnóstico: si se activa `DIAGNOSTICO.ACTIVO = true`, desplegar y regresarlo a `false` al terminar. Con F12 abierto, "DRT - Costo de Compra CS" pausa en `debugger;`; cerrar F12 en los pasos de captura de líneas o pulsar "Reanudar".

## 3. Pruebas con el rol de compras

| # | Escenario | Esperado | Si falla |
|---|---|---|---|
| C-01 | Abrir OC nueva en el formulario 382 | Selector y botón visibles en la pestaña Artículos | UE no corre para el rol: revisar audiencia de `customdeploy_sads_mtn_ue_oc` |
| C-02 | Elegir proveedor y subsidiaria; abrir la lista Equipo de transporte | Solo equipos de la subsidiaria de la OC | Filtro del campo `custbody_sads_mtn_equipo` |
| C-03 | Elegir un equipo con clic | El selector se llena sin pulsar el botón; sin MSG-05 | MSG-05: ir a §4 |
| C-04 | Elegir artículo y pulsar "Agregar artículo" | El artículo queda en la línea con precio, descripción, unidad e impuesto | Anotar mensaje y consola |
| C-05 | Capturar cantidad y pulsar "Agregar" nativo | La línea se confirma | Si la rechaza otro script (por ejemplo "DRT - Dimensión por Unidad Medida", `INSUFFICIENT_PERMISSION` sobre `customrecord_drt_dimension`), es ajeno a esta solución: reportarlo a su propietario |
| C-06 | Con 2 líneas, cambiar el equipo y aceptar MSG-02 | Cero líneas; selector con artículos del nuevo equipo | E3 persiste para el rol: ir a §4 |
| C-07 | Repetir C-06 y cancelar MSG-02 | Equipo, líneas y selector sin cambio | — |
| C-08 | Guardar la OC | Se guarda sin MSG-05 ni MSG-04 | MSG-05 en servidor: bitácora del UE, ir a §4 |
| C-09 | Editar la OC guardada | Selector lleno al abrir | Bitácora del UE: "Selector sin artículos" |
| C-10 | Copiar la OC | Equipo, líneas y selector conservados; guarda | — |
| C-11 | Abrir un registro "Equipo de transporte" y pulsar Editar | Anotar si puede editar | Si puede editar: riesgo R-24; cambiar a "Usar lista de permisos" con el rol en Ver y repetir C-03 |
| C-12 | Abrir una OC en otro formulario de compra | Sin selector ni botón; comportamiento de siempre | — |

Criterio de cierre: C-01 a C-09 aprobadas; C-11 documentada.

## 4. Diagnóstico si aparece MSG-05 con el rol de compras

| Señal | Causa probable | Acción |
|---|---|---|
| Detalle `INSUFFICIENT_PERMISSION` en la lectura del equipo (requiere parche `30018dc`) | Tipo de acceso del registro Equipo revertido o insuficiente | Revisar el tipo de acceso; si un despliegue lo regresó, desplegar `4150768` |
| `Búsqueda ...: <error>` | Búsqueda no pública o no accesible para el rol | Búsqueda > Pública o audiencia con el rol |
| `no devolvió filas válidas para el rol` | Restricción de subsidiarias del rol frente a la subsidiaria de los artículos `MTN-*` | "Ver resultados" de la búsqueda con el rol; ajustar subsidiaria del artículo o del rol |
| Sin parche instalado | No hay detalle en consola | Ejecutar la búsqueda con el rol (Ver resultados) y abrir el registro Equipo con el rol para aislar cuál falla |

## 5. Cierre documental (después de las pruebas)

| Archivo | Cambio |
|---|---|
| `README_mtto_equipo.md` | R-23: causa confirmada en producción el 2026-11-24 al reordenar; §5.5 y §5.7: resultado de C-11 y tipo de acceso final; versión 1.12 |
| `src/Objects/customrecord_sads_mtn_equipo.xml` | Solo si C-11 obliga a cambiar a `USEPERMISSIONLIST` |
| `planes/2026-11-24_mtto-equipo-oc_pruebas-rol-compras_v1.md` | Esta fase con los resultados C-01 a C-12 |

## 6. Verificación y límites

Verificado: desaparición de E1 y E3 con el usuario propietario (reporte del usuario).
No verificado: comportamiento con el rol de compras; nivel de acceso efectivo con "No se necesitan permisos"; impacto en el script desplazado al lugar 11.
Supuesto: la restricción de subsidiarias del rol no excluye los artículos `MTN-*` del equipo probado (el usuario indicó que hay artículos que cumplen).
