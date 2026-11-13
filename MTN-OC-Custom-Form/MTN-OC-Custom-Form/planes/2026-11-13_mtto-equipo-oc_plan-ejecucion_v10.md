# Plan v10: aceptar búsquedas guardadas de subtipos de artículo

| Campo | Valor |
|---|---|
| Fecha | 2026-11-13 |
| Versión | 10 (incremental sobre v9, `planes/2026-11-13_mtto-equipo-oc_plan-ejecucion_v9.md`) |
| Rama | `claude/wizardly-franklin-2fca8g` |
| Raíz SDF | `MTN-OC-Custom-Form/MTN-OC-Custom-Form/` |

Historial: v10, 2026-11-13, D-R: el tipo de búsqueda se valida contra una lista de tipos de artículo de compra, no solo `item`.

## 1. Contexto

Hechos de la consola en sandbox con v9 (captura del usuario):

| Hecho | Conclusión |
|---|---|
| Aparecen `entrada validateField` y `entrada fieldChanged` | El despliegue propio del Client Script (D-Q) funciona |
| `carga de artículos: falla`, código `MTTO_BUSQUEDA_INVALIDA`, detalle "La búsqueda customsearch_sads_mtn_ch21_ls es de tipo otherchargepurchase" (igual para `customsearch_sads_mtn_di06_ls`) | La búsqueda se carga; `search.load` devuelve `searchType = 'otherchargepurchase'`. `lib/datos.js` (`leerArticulosBusqueda`) solo acepta `search.Type.ITEM` (`'item'`) y la rechaza |
| `selector llenado {opciones: 0}` | Consecuencia de la falla anterior |

La misma comprobación corre en `beforeLoad` y en `beforeSubmit`.
Efectos: selector vacío tras la recarga, y rechazo con MSG-05 al guardar cualquier OC con equipo.
No es un problema de permisos.

Motivo de conservar una comprobación de tipo: los IDs del resultado se asignan al artículo nativo y forman el conjunto permitido de RN-03.
Una búsqueda de otro tipo (por ejemplo, de clientes) daría IDs que podrían coincidir con artículos reales.

## 2. Cambios

| Archivo | Cambio |
|---|---|
| `lib/config.js` | Nuevo `TIPOS_BUSQUEDA_ARTICULO`: tipos aceptados en minúsculas. `item`; `otherchargepurchase` (verificado en sandbox); y, como supuesto, los demás tipos de artículo que pueden ir en una OC: `otherchargeitem`, `otherchargeresale`, `noninventoryitem`, `noninventorypurchase`, `noninventoryresale`, `serviceitem`, `servicepurchase`, `serviceresale`, `inventoryitem`, `assemblyitem`, `lotnumberedinventoryitem`, `serializedinventoryitem`, `lotnumberedassemblyitem`, `serializedassemblyitem`. Se excluyen los subtipos de venta (`...sale`) y los artículos que no se compran (descuento, pago, subtotal, descripción, grupo, kit) |
| `lib/datos.js` | `leerArticulosBusqueda` compara `searchType` en minúsculas contra `TIPOS_BUSQUEDA_ARTICULO`; el mensaje de error conserva el tipo encontrado |
| `README_mtto_equipo.md` | Sección 5.3: "Tipo de búsqueda: Artículo o un subtipo de compra (por ejemplo, Otro cargo para la compra)"; cómo agregar un tipo en `config.js`; desviación D-R; supuesto S-20 (cadenas de tipo no verificadas, salvo `otherchargepurchase`); el hecho de que v9 confirmó D-Q |
| `planes/2026-11-13_mtto-equipo-oc_plan-ejecucion_v10.md` | Copia de este plan |

Sin cambios en `ue_sads_mtn_oc.js`, `cs_sads_mtn_oc.js`, `lib/reglas.js` ni en los XML.

## 3. Verificación

| Verificación | Método | Criterio |
|---|---|---|
| Sintaxis | `node --check` en los 5 `.js` | Sin errores |
| Reglas estáticas | Búsquedas de v9 | Sin cambios |
| Comportamiento | Comprobación desechable de v9 más: búsqueda con `searchType = 'otherchargepurchase'` aceptada y opciones llenas; `'OtherChargePurchase'` aceptada (sin distinguir mayúsculas); `'customer'` y `'otherchargesale'` rechazadas con `MTTO_BUSQUEDA_INVALIDA` | Todos pasan |
| Git | Commit y push a `claude/wizardly-franklin-2fca8g` | — |

## 4. En sandbox después de desplegar

| Paso | Resultado esperado |
|---|---|
| OC nueva en el formulario exclusivo, elegir el equipo | Consola: `carga de artículos: éxito` y `selector llenado` con opciones mayores a 0 |
| Elegir artículo y pulsar "Agregar artículo" | La línea en captura recibe el artículo |
| Guardar con una línea válida | Se guarda sin MSG-05 |

## 5. Riesgos

| ID | Enunciado | Fundamento | Consecuencia | Mitigación |
|---|---|---|---|---|
| R-20 | Las cadenas de tipo distintas de `item` y `otherchargepurchase` no están verificadas | Solo se observó `otherchargepurchase` en sandbox | Una búsqueda de otro subtipo de compra se rechazaría con MSG-05 y el detalle del tipo | El detalle en consola y en la bitácora muestra el tipo; se agrega en `TIPOS_BUSQUEDA_ARTICULO` |
