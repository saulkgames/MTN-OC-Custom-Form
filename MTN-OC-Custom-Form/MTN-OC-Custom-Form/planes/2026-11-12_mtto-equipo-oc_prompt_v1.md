# Prompt para agente coder: filtrado de artículos por equipo de transporte en Órdenes de compra

| Campo | Valor |
|---|---|
| Versión del prompt | 1 |
| Plan de origen | v2, 2026-11-12, aprobado |
| Destino | Claude Code, ejecutado desde la raíz del proyecto SDF |
| Alcance del prompt | Un solo prompt genera todos los scripts, módulos, objetos SDF, pruebas y README |

## 0. Nota para el editor humano (el agente ignora esta sección)

1. Edita solo la sección 1. El resto del documento usa los nombres de variable de esa sección, por ejemplo `REC_EQUIPO`.
2. Un valor `PENDIENTE` puede quedarse así. El agente lo deja como parámetro o constante y lo reporta.
3. Respeta los prefijos obligatorios de la columna "Restricción"; NetSuite rechaza IDs con otro prefijo.
4. Guarda este archivo en `planes/` del proyecto y pide al agente: "Lee planes/<este archivo> y ejecútalo completo".

## 1. Configuración editable

### 1.1 Identificadores y etiquetas

| Variable | Valor | Restricción | Descripción |
|---|---|---|---|
| `CARPETA_PROYECTO` | `mtto_equipo` | Minúsculas, sin espacios | Carpeta bajo `SuiteScripts/` en el File Cabinet |
| `REC_EQUIPO` | `customrecord_mtto_equipo` | Prefijo `customrecord` | Tipo de registro Equipo de transporte |
| `FLD_EQ_BUSQUEDA` | `custrecord_mtto_eq_busqueda` | Prefijo `custrecord` | ID de script de la búsqueda guardada del equipo |
| `FLD_EQ_SUBSIDIARIA` | `custrecord_mtto_eq_subsidiaria` | Prefijo `custrecord` | Subsidiaria del equipo |
| `FLD_BODY_EQUIPO` | `custbody_mtto_equipo` | Prefijo `custbody` | Equipo en la cabecera de la OC |
| `FLD_COL_AUX` | `custpage_mtto_articulo` | Prefijo `custpage` obligatorio | Columna auxiliar agregada por script; no se almacena |
| `SCRIPT_UE` | `customscript_mtto_ue_oc` | Prefijo `customscript` | Registro de script del User Event |
| `DEPLOY_UE` | `customdeploy_mtto_ue_oc` | Prefijo `customdeploy` | Despliegue del User Event en Orden de compra |
| `PARAM_FORM` | `custscript_mtto_form_id` | Prefijo `custscript` | Parámetro de script con el ID interno del formulario exclusivo |
| `ARCHIVO_UE` | `ue_mtto_oc.js` | Extensión `.js` | Entry point del User Event |
| `ARCHIVO_CS` | `cs_mtto_oc.js` | Extensión `.js` | Módulo de cliente adjuntado por el User Event |
| `ETIQUETA_COL_EXCLUIR` | `MTTO_EXCLUIR` | Texto exacto, mayúsculas | Etiqueta personalizada de la columna opcional de exclusión en las búsquedas |
| `LBL_REC_EQUIPO` | Equipo de transporte | Texto | Nombre visible del tipo de registro |
| `LBL_EQUIPO` | Equipo de transporte | Texto | Etiqueta del campo de cabecera |
| `LBL_COL_AUX` | Artículo del equipo | Texto | Etiqueta de la columna auxiliar |
| `NOMENCLATURA_BUSQUEDAS` | `customsearch_mtto_<equipo>` | Prefijo `customsearch` | Convención para las búsquedas que crea el administrador |
| `MAX_RESULTADOS_BUSQUEDA` | 1000 | Entero, máximo 1000 | Filas leídas por búsqueda en una sola lectura |

### 1.2 Datos de cuenta

| Variable | Valor | Restricción | Descripción |
|---|---|---|---|
| `FORM_ID_SANDBOX` | PENDIENTE | Entero | ID interno del formulario exclusivo en sandbox; se captura en el despliegue |
| `FORM_ID_PRODUCCION` | PENDIENTE | Entero | ID interno del formulario exclusivo en producción |
| `ROLES_CAPTURA` | PENDIENTE | Lista de roles | Roles que capturan OC de mantenimiento |
| `ROL_ADMIN_CONFIG` | PENDIENTE | Rol | Rol que mantiene registros Equipo y búsquedas |
| `ESTADO_DESPLIEGUE_INICIAL` | Pruebas | Pruebas o Liberado | Estado del despliegue al instalar en sandbox |

### 1.3 Decisiones adoptadas

| ID | Decisión | Valor adoptado |
|---|---|---|
| D-02 | Subsidiarias | Cuenta multi-subsidiaria; cada equipo pertenece a una subsidiaria |
| D-03 | Confirmación antes de reiniciar líneas | Sí |
| D-04 | Validación en edición | Solo líneas nuevas o con artículo modificado; todas si cambió el equipo |
| D-05 | Inventario de scripts y workflows sobre OC | Lo ejecuta el agente en la Fase 0, con condiciones de paro |
| D-06 | Padres de artículos matriz | Se excluyen por criterio de la búsqueda; respaldo en código con la columna `ETIQUETA_COL_EXCLUIR` |
| D-07 | Bloqueo del campo nativo de artículo | En `beforeLoad` del User Event; el bloqueo en cliente queda documentado como alternativa |
| D-08 | Equipo en edición con líneas recibidas o facturadas | Bloqueado |
| D-09 | Columna auxiliar | Agregada por el User Event; aceptada por el cliente |

## 2. Rol

Eres un desarrollador senior de SuiteScript 2.1 para NetSuite.
Implementas exactamente el diseño aprobado de este documento.
No cambias reglas de negocio, IDs ni etiquetas; los tomas de la sección 1.
Si detectas una contradicción, un dato faltante o un conflicto con objetos existentes, te detienes y lo reportas en lugar de suponer.
Generas todos los entregables en una sola ejecución para que compartan constantes, mensajes, contratos y convenciones.

## 3. Contexto del proyecto

### 3.1 Operación

La cuenta es NetSuite OneWorld con varias subsidiarias.
La empresa da mantenimiento recurrente a su flota de equipo de transporte (más de 20 unidades).
Cada equipo tiene un listado propio de artículos de mantenimiento.
Los artículos son de tipo "Otro cargo para la compra".
La compra se registra en Órdenes de compra estándar.
Las demás compras usan otros formularios y otros procesos; esta solución no los toca.

### 3.2 Problema

La sublista de artículos de la Orden de compra es nativa.
Su campo de artículo no admite Sourcing & Filtering ni filtrado por script.
La alternativa descartada era un formulario y una búsqueda guardada por equipo, con mantenimiento multiplicado.

### 3.3 Situación actual

No existe un registro de equipos en la cuenta.
El cliente no aprobó un maestro de vehículos o activos; el registro Equipo de esta solución solo guarda nombre, búsqueda y subsidiaria.
No hay inventario confirmado de scripts ni workflows sobre Orden de compra; lo obtienes en la Fase 0.

### 3.4 Restricciones de plataforma que justifican el diseño

| Restricción | Efecto en el diseño | Fuente |
|---|---|---|
| Insertar y eliminar opciones por script solo funciona en campos de selección agregados por un Suitelet o por `beforeLoad`, con prefijo `custpage` | La columna auxiliar se agrega en `beforeLoad`; una columna `custcol` creada en el formulario no sirve | Documentación de Oracle: `Field.insertSelectOption` y `Field.removeSelectOption` |
| Eliminar opciones con valor nulo elimina todas | Permite vaciar la columna al cambiar el equipo | Documentación de Oracle: `Field.removeSelectOption` |
| La columna agregada por script queda al final de la fila y no se reubica | El formulario oculta columnas nativas no usadas | Foros de NetSuite Professionals |
| Las opciones de una columna de sublista se manejan línea por línea | Las opciones se cargan en cada `lineInit` desde memoria de la página | Oracle Community; se confirma en POC-1 |
| El Client Script no corre en CSV, servicios web ni otros scripts | La regla se garantiza en `beforeSubmit` | Comportamiento estándar de SuiteScript |

## 4. Objetivo y métrica

| Concepto | Descripción |
|---|---|
| Objetivo | En un solo formulario, al elegir el equipo en la cabecera, la columna auxiliar ofrece solo los artículos de la búsqueda guardada de ese equipo, y el campo nativo de artículo queda bloqueado |
| Garantía | Ninguna OC con equipo se guarda con artículos fuera del listado del equipo, en ningún contexto de ejecución |
| Métrica 1 | Cero OC con equipo y artículos fuera de listado |
| Métrica 2 | Alta de un equipo nuevo sin cambios de código: un registro Equipo y una búsqueda guardada |

## 5. Alcance

| Incluye | No incluye |
|---|---|
| Orden de compra | Solicitudes, recepciones, facturas de proveedor y otras transacciones |
| Formulario exclusivo de OC de mantenimiento, creado manualmente por el administrador | Creación o modificación del formulario por el agente |
| Registro Equipo con nombre, búsqueda y subsidiaria | Maestro de vehículos o activos |
| Una búsqueda guardada por equipo, creada manualmente | Creación de búsquedas por el agente |
| Campo de cabecera Equipo filtrado por subsidiaria | Excepciones de compra fuera del listado |
| Columna auxiliar, bloqueo del campo nativo, validación en cliente y servidor | Reportes de costo por equipo |
| Reinicio de líneas al cambiar el equipo | Otros formularios de compra |

## 6. Fase 0: inventario obligatorio antes de codificar

Ejecuta estos pasos antes de crear cualquier archivo.

1. Revisa el repositorio: confirma que es un proyecto SDF de personalización de cuenta, identifica la carpeta `src/`, el `manifest.xml`, el `deploy.xml`, la configuración de Jest y las convenciones de nombres existentes.
2. Busca en `src/Objects/` scripts y despliegues cuyo tipo de registro sea Orden de compra, workflows sobre Orden de compra y campos personalizados de cabecera o línea que apliquen a compras.
3. Busca colisiones con cualquier ID de la sección 1.
4. Si el MCP de NetSuite está disponible, ejecuta consultas SuiteQL de solo lectura para listar despliegues de script activos y workflows activos sobre Orden de compra. Filtra activos, resuelve valores de despliegue con `BUILTIN.DF()` y no uses `ns_getSuiteQLMetadata` porque devuelve 403 en esta cuenta. No crees, edites ni borres nada en la cuenta.
5. Entrega un reporte con esta tabla: objeto, tipo, ID, evento o disparador, qué hace sobre la sublista de artículos o la cabecera, riesgo de conflicto (Alto, Medio, Bajo, Ninguno).

Condiciones de paro: te detienes, entregas el reporte y esperas confirmación si ocurre cualquiera de estas.

| Condición | Motivo |
|---|---|
| Otro script o workflow modifica líneas, el campo de artículo o el formulario de la OC | Puede anular la columna, el bloqueo o la validación |
| Existe otra validación `beforeSubmit` sobre líneas de OC | Orden de ejecución y mensajes en conflicto |
| Algún ID de la sección 1 ya existe | Colisión de objetos |
| El repositorio no es un proyecto SDF o falta su estructura base | No hay dónde integrar los entregables |
| Algún valor de la sección 1 viola su restricción de prefijo | El despliegue fallaría |

Si no hay condición de paro, continúa con la implementación y adjunta el reporte en tu respuesta final.

## 7. Entregables

| Archivo u objeto | Tipo | ID o ruta | Origen |
|---|---|---|---|
| `entrypoints/ARCHIVO_UE` | User Event Script | `SCRIPT_UE` / `DEPLOY_UE` | Agente |
| `entrypoints/ARCHIVO_CS` | Módulo de Client Script, sin registro de despliegue propio | Adjuntado por el UE | Agente |
| `application/preparar_seleccion.js` | Caso de uso UC-01 | — | Agente |
| `application/validar_documento.js` | Caso de uso UC-02 | — | Agente |
| `domain/regla_pertenencia.js` | Regla pura RN-03 | — | Agente |
| `domain/seleccion_lineas.js` | Regla pura RN-04 | — | Agente |
| `domain/resultados_busqueda.js` | Regla pura RN-02 | — | Agente |
| `domain/subsidiaria.js` | Regla pura RN-08 | — | Agente |
| `domain/cambio_equipo.js` | Reglas puras RN-05 y RN-10 | — | Agente |
| `domain/contratos.js` | Contratos JSDoc de puertos y objetos planos | — | Agente |
| `infrastructure/equipos_registro.js` | Adaptador del puerto `Equipos` | — | Agente |
| `infrastructure/articulos_busqueda_guardada.js` | Adaptador del puerto `ArticulosPermitidos` | — | Agente |
| `shared/constantes.js` | Todos los IDs y etiquetas de la sección 1 | — | Agente |
| `shared/mensajes.js` | Mensajes MSG-01 a MSG-08 | — | Agente |
| `shared/errores.js` | Códigos de error de la sección 12 | — | Agente |
| Pruebas Jest | `__tests__/domain/`, `__tests__/application/`, `__tests__/contratos/` | — | Agente |
| XML del tipo de registro | `REC_EQUIPO` con `FLD_EQ_BUSQUEDA` y `FLD_EQ_SUBSIDIARIA` | `src/Objects/` | Agente |
| XML del campo de cabecera | `FLD_BODY_EQUIPO` | `src/Objects/` | Agente |
| XML del script y despliegue | `SCRIPT_UE`, `DEPLOY_UE`, parámetro `PARAM_FORM` | `src/Objects/` | Agente |
| `README_mtto_equipo.md` | Despliegue, configuración manual, contrato de búsqueda, pruebas en sandbox | Raíz del proyecto o `planes/` | Agente |
| Formulario exclusivo de OC | Formulario personalizado | ID por ambiente | Manual, administrador |
| Búsquedas guardadas por equipo | Búsqueda de artículos | `NOMENCLATURA_BUSQUEDAS` | Manual, administrador |
| Registros Equipo | Datos | — | Manual o CSV, administrador |
| Permisos de roles | Configuración de rol | `ROLES_CAPTURA`, `ROL_ADMIN_CONFIG` | Manual, administrador |

Actualiza `deploy.xml` y `manifest.xml` solo con lo necesario para los objetos nuevos.

## 8. Estructura de archivos

Ruta base en el File Cabinet: `src/FileCabinet/SuiteScripts/CARPETA_PROYECTO/`.

| Carpeta | Contenido | Puede importar | Nunca importa |
|---|---|---|---|
| `entrypoints/` | `ARCHIVO_UE`, `ARCHIVO_CS` | Todas las capas y módulos `N/` | — |
| `application/` | Casos de uso | `domain/`, `shared/` | Módulos `N/`, `infrastructure/`, `entrypoints/` |
| `domain/` | Reglas puras y contratos | `domain/`, `shared/` | Módulos `N/`, `application/`, `infrastructure/`, `entrypoints/` |
| `infrastructure/` | Adaptadores sobre `N/search` | `domain/`, `shared/`, módulos `N/` | `entrypoints/` |
| `shared/` | Constantes, mensajes, errores | Nada | Módulos `N/` y cualquier capa |

Solo `ARCHIVO_UE` se referencia como `scriptfile` en el XML del script.
`ARCHIVO_CS` se referencia por ruta relativa desde el UE al adjuntarlo al formulario.

## 9. Arquitectura

### 9.1 Nivel

Nivel 2 acotado.
Justificación: la misma regla corre en cliente y servidor, y ambos consultan la misma fuente de datos.
Un caso de uso por intención, dos puertos, dos adaptadores, sin patrones GoF adicionales.

### 9.2 Composition root

Cada entry point crea los adaptadores y los inyecta en los casos de uso con fábricas `crear({ puertos })`.
Los casos de uso no crean adaptadores.
Los adaptadores funcionan en cliente y en servidor porque solo usan `N/search`.

### 9.3 Casos de uso

| Caso de uso | Intención | Entrada | Salida | Reglas |
|---|---|---|---|---|
| UC-01 Preparar selección | Obtener los artículos que el equipo puede comprar | `idEquipo` | Éxito: equipo (id, nombre, idSubsidiaria) y artículos (id, etiqueta). Falla: código de error y nombre del equipo si existe | RN-01, RN-02, RN-07 |
| UC-02 Validar documento | Garantizar pertenencia, subsidiaria y edición permitida antes de guardar | `idEquipo`, `idEquipoOriginal`, `idSubsidiariaTransaccion`, `esCreacion`, `lineasActuales`, `lineasOriginales` | Lista de errores con código, líneas afectadas y datos para el mensaje; vacía si es válido | RN-03, RN-04, RN-06, RN-07, RN-08, RN-10 |

UC-03 (reinicio por cambio de equipo) y UC-04 (verificación de subsidiaria en pantalla) se orquestan en `ARCHIVO_CS` con funciones de dominio; no requieren módulo de aplicación propio.

### 9.4 Puertos secundarios

| Puerto | Operación | Entrada | Salida | Lote | Adaptador | Operaciones `N/` por llamada |
|---|---|---|---|---|---|---|
| `Equipos` | `obtener(idEquipo)` | ID interno del equipo | Objeto con id, nombre, idBusqueda, idSubsidiaria, inactivo; nulo si no existe | No aplica: una lectura por equipo | `infrastructure/equipos_registro.js` | 1 lectura de campos |
| `ArticulosPermitidos` | `porBusqueda(idBusqueda)` | ID de script de la búsqueda | Lista de filas con id, etiqueta, excluir | Sí: todas las filas en una lectura | `infrastructure/articulos_busqueda_guardada.js` | 1 carga y 1 lectura de rango |

Los contratos se declaran como `@typedef` en `domain/contratos.js` y se verifican con pruebas de contrato contra adaptadores en memoria.

### 9.5 Patrones

No aplica: una sola fuente de datos por puerto y sin variación de comportamiento.

## 10. Modelo de datos

### 10.1 Objetos que crea el agente por SDF

| Objeto | ID | Tipo | Configuración |
|---|---|---|---|
| Tipo de registro | `REC_EQUIPO` | Registro personalizado | Nombre visible `LBL_REC_EQUIPO`; incluye el campo estándar Nombre (texto del equipo) y el estándar Inactivo; acceso por lista de permisos, sin roles en el XML |
| Búsqueda del equipo | `FLD_EQ_BUSQUEDA` | Texto libre | En `REC_EQUIPO`; obligatorio; guarda el ID de script de la búsqueda, no el ID interno numérico |
| Subsidiaria del equipo | `FLD_EQ_SUBSIDIARIA` | Lista/Registro: Subsidiaria | En `REC_EQUIPO`; obligatorio |
| Equipo en cabecera | `FLD_BODY_EQUIPO` | Lista/Registro: `REC_EQUIPO` | Aplica a compras; etiqueta `LBL_EQUIPO`; no obligatorio a nivel de campo; filtrado por Sourcing & Filtering: `FLD_EQ_SUBSIDIARIA` igual a la subsidiaria de la transacción |
| Script | `SCRIPT_UE` | User Event | `scriptfile` = `ARCHIVO_UE`; parámetro `PARAM_FORM` tipo entero, sin valor por defecto |
| Despliegue | `DEPLOY_UE` | Despliegue del UE | Registro: Orden de compra; estado `ESTADO_DESPLIEGUE_INICIAL`; todos los contextos de ejecución; nivel de registro de bitácora: Error |

Si el XML de SDF no admite el filtro de Sourcing & Filtering del campo de cabecera, no lo inventes: documéntalo en el README como paso manual.

### 10.2 Campo generado en ejecución

| Campo | ID | Tipo | Regla |
|---|---|---|---|
| Columna auxiliar | `FLD_COL_AUX` | Selección sin origen, agregada a la sublista de artículos en `beforeLoad` | Etiqueta `LBL_COL_AUX`; no obligatoria; no se almacena |

### 10.3 Campos estándar usados

| Registro | Campo | Uso | Estado |
|---|---|---|---|
| Orden de compra | Formulario personalizado | Detectar el formulario exclusivo | Verificar ID en Fase 0 |
| Orden de compra | Subsidiaria | RN-08 y RN-09 | Estándar |
| Línea de artículo | Artículo | Valor asignado desde la columna auxiliar | Estándar |
| Línea de artículo | Identificador único de línea | Comparar líneas actuales contra originales en RN-04 | Verificar ID en Fase 0 |
| Línea de artículo | Cantidad recibida y cantidad facturada | RN-10 | Verificar IDs en Fase 0 |

### 10.4 Objetos manuales (no los crea el agente)

| Objeto | Responsable | Configuración |
|---|---|---|
| Formulario exclusivo de OC | Administrador | Muestra `FLD_BODY_EQUIPO` como obligatorio; oculta columnas nativas no usadas para que `FLD_COL_AUX` quede visible; su ID interno se captura en `PARAM_FORM` |
| Otros formularios de compra | Administrador | Ocultan `FLD_BODY_EQUIPO` |
| Búsquedas guardadas | Administrador | Cumplen el contrato de la sección 10.5 |
| Registros Equipo | Administrador | Nombre, búsqueda y subsidiaria |

### 10.5 Contrato de la búsqueda guardada

| Requisito | Motivo |
|---|---|
| Tipo de búsqueda: Artículo | El ID de cada fila alimenta el campo nativo de artículo |
| La primera columna es el nombre para mostrar | Es la etiqueta de la opción |
| El ID interno del artículo se toma del resultado, no de una columna | Evita depender del nombre de columna |
| Criterios: inactivo = No; tipo Otro cargo para la compra; subsidiaria del equipo; padres de matriz excluidos si aplica | Solo artículos capturables en la OC |
| Columna opcional con etiqueta personalizada `ETIQUETA_COL_EXCLUIR` | Respaldo: filas con valor verdadero se excluyen (RN-02) |
| Sin resumen ni agrupación | Una fila por artículo |
| Pública o compartida con `ROLES_CAPTURA` | En cliente se ejecuta con el rol del usuario |
| ID de script según `NOMENCLATURA_BUSQUEDAS` | Portabilidad entre sandbox y producción |
| Máximo `MAX_RESULTADOS_BUSQUEDA` filas | Una sola lectura |

La unicidad del nombre para mostrar es una convención interna del cliente sin validación; es un riesgo aceptado.

## 11. Reglas de negocio

| ID | Regla |
|---|---|
| RN-01 | El conjunto permitido de un equipo es el resultado de la búsqueda guardada indicada en su registro |
| RN-02 | Del resultado se excluyen las filas con la columna `ETIQUETA_COL_EXCLUIR` verdadera; se eliminan duplicados por ID y se ordena por etiqueta. Son verdaderos: verdadero booleano, "T", "true", "1", "Sí", "Si", sin distinguir mayúsculas |
| RN-03 | Una línea se acepta solo si su artículo pertenece al conjunto permitido del equipo de cabecera |
| RN-04 | En creación y copia se validan todas las líneas. En edición se validan las líneas nuevas y las que cambiaron de artículo; si cambió el equipo, se validan todas |
| RN-05 | Si el usuario cambia el equipo y hay líneas, se pide confirmación. Si confirma, se eliminan todas las líneas y todas las opciones de la columna, y se cargan las del nuevo equipo. Si cancela, el equipo anterior se conserva |
| RN-06 | Sin equipo en cabecera, la regla no aplica en servidor. En el formulario exclusivo el equipo es obligatorio para capturar líneas y para guardar |
| RN-07 | Si el equipo no existe, su búsqueda no existe, no es de artículos, no es accesible o no devuelve filas válidas, se bloquea la captura y el guardado con el nombre del equipo en el mensaje |
| RN-08 | La subsidiaria del equipo debe ser igual a la subsidiaria de la OC; si alguna está vacía, no son compatibles |
| RN-09 | Si cambia la subsidiaria de la OC y el equipo no le corresponde, el equipo se limpia sin confirmación, con mensaje informativo, y aplica el reinicio de RN-05 |
| RN-10 | En edición, el equipo no puede cambiar si alguna línea tiene cantidad recibida o facturada mayor que cero |
| RN-11 | En edición en línea desde listas, un cambio del equipo se rechaza |
| RN-12 | En el formulario exclusivo, el campo nativo de artículo está bloqueado y la selección se hace solo con la columna auxiliar |

## 12. Mensajes y códigos de error

Los textos viven en `shared/mensajes.js` y los códigos en `shared/errores.js`. Las llaves entre corchetes se sustituyen en tiempo de ejecución.

| ID | Texto | Uso |
|---|---|---|
| MSG-01 | Seleccione un equipo de transporte antes de capturar artículos. | RN-06 |
| MSG-02 | Al cambiar el equipo se eliminarán todas las líneas capturadas. ¿Desea continuar? | RN-05 |
| MSG-03 | El artículo [articulo] no pertenece al listado del equipo [equipo]. | RN-03 en línea |
| MSG-04 | Líneas con artículos fuera del listado del equipo [equipo]: [lineas]. | RN-03 al guardar |
| MSG-05 | La búsqueda configurada para el equipo [equipo] no existe, no es accesible o no devuelve artículos. Contacte al administrador. | RN-07 |
| MSG-06 | El equipo [equipo] no pertenece a la subsidiaria de la orden. | RN-08 y RN-09 |
| MSG-07 | El equipo no puede cambiarse porque la orden tiene líneas recibidas o facturadas. | RN-10 |
| MSG-08 | El equipo solo puede cambiarse desde el formulario de la orden. | RN-11 |

| Código | Cuándo | Mensaje |
|---|---|---|
| `MTTO_ARTICULO_FUERA_DE_LISTADO` | RN-03 | MSG-04 |
| `MTTO_EQUIPO_NO_ENCONTRADO` | RN-07, equipo inexistente | MSG-05 |
| `MTTO_BUSQUEDA_INVALIDA` | RN-07, búsqueda inexistente, de otro tipo, inaccesible o vacía | MSG-05 |
| `MTTO_SUBSIDIARIA_INCOMPATIBLE` | RN-08 | MSG-06 |
| `MTTO_EQUIPO_NO_EDITABLE` | RN-10 y RN-11 | MSG-07 o MSG-08 |

Los números de línea en los mensajes se muestran desde 1.

## 13. Especificación por componente

### 13.1 `domain/` (funciones puras, sin módulos `N/`)

| Archivo | Función | Entrada | Salida | Regla |
|---|---|---|---|---|
| `regla_pertenencia.js` | `lineasFueraDeListado` | Conjunto o mapa de IDs permitidos; lista de líneas con numero, idArticulo, textoArticulo | Lista de líneas cuyo artículo no pertenece | RN-03 |
| `seleccion_lineas.js` | `lineasAValidar` | esCreacion, equipoCambio, lineasActuales y lineasOriginales con clave e idArticulo | Subconjunto de líneas actuales a validar | RN-04 |
| `resultados_busqueda.js` | `normalizarResultados` | Filas con id, etiqueta, excluir | Filas sin excluidas ni duplicadas, ordenadas por etiqueta | RN-02 |
| `resultados_busqueda.js` | `esVerdadero` | Valor de la columna de exclusión | Booleano según la lista de RN-02 | RN-02 |
| `subsidiaria.js` | `esSubsidiariaCompatible` | idSubsidiariaEquipo, idSubsidiariaTransaccion | Booleano | RN-08 |
| `cambio_equipo.js` | `requiereConfirmacion` | Número de líneas | Verdadero si es mayor que cero | RN-05 |
| `cambio_equipo.js` | `equipoEditable` | Líneas con cantidadRecibida y cantidadFacturada | Falso si alguna es mayor que cero | RN-10 |

Una línea sin clave en `lineasOriginales` se considera nueva. Una línea con clave existente y artículo distinto se considera modificada.

### 13.2 `application/`

UC-01, `preparar_seleccion.js`, fábrica `crear({ equipos, articulosPermitidos })`, operación `ejecutar(idEquipo)`:

1. Obtiene el equipo con el puerto `Equipos`. Si es nulo, devuelve falla `MTTO_EQUIPO_NO_ENCONTRADO`.
2. Si el ID de búsqueda está vacío, devuelve falla `MTTO_BUSQUEDA_INVALIDA`.
3. Obtiene filas con el puerto `ArticulosPermitidos`. Si el puerto lanza error, devuelve falla `MTTO_BUSQUEDA_INVALIDA`.
4. Normaliza las filas con RN-02. Si quedan cero, devuelve falla `MTTO_BUSQUEDA_INVALIDA`.
5. Devuelve éxito con el equipo y los artículos.

UC-02, `validar_documento.js`, fábrica `crear({ equipos, articulosPermitidos })`, operación `ejecutar(entrada)`:

1. Si `idEquipo` está vacío, devuelve sin errores y sin llamar a los puertos (RN-06).
2. Si es edición, el equipo cambió y `equipoEditable` es falso sobre las líneas originales, agrega `MTTO_EQUIPO_NO_EDITABLE` y termina (RN-10).
3. Obtiene el equipo; si es nulo, agrega `MTTO_EQUIPO_NO_ENCONTRADO` y termina.
4. Si la subsidiaria no es compatible, agrega `MTTO_SUBSIDIARIA_INCOMPATIBLE` (RN-08).
5. Calcula las líneas a validar con RN-04. Si no hay, termina sin ejecutar la búsqueda.
6. Ejecuta UC-01; si falla, agrega su código y termina.
7. Calcula `lineasFueraDeListado`; si hay, agrega `MTTO_ARTICULO_FUERA_DE_LISTADO` con sus números de línea.

UC-02 reutiliza UC-01 recibiéndolo construido con los mismos puertos; no duplica su lógica.

### 13.3 `infrastructure/`

`equipos_registro.js`, fábrica `crear()`, operación `obtener(idEquipo)`:

1. Lee en una sola lectura de campos de `REC_EQUIPO`: nombre, `FLD_EQ_BUSQUEDA`, `FLD_EQ_SUBSIDIARIA` e inactivo.
2. Si el registro no existe, devuelve nulo.
3. Mapea a objeto plano con id, nombre, idBusqueda, idSubsidiaria, inactivo.

`articulos_busqueda_guardada.js`, fábrica `crear({ maxResultados })`, operación `porBusqueda(idBusqueda)`:

1. Carga la búsqueda por su ID de script.
2. Si no existe o su tipo no es Artículo, lanza error de infraestructura.
3. Ejecuta y lee una sola vez hasta `MAX_RESULTADOS_BUSQUEDA` filas.
4. Por fila: id = ID interno del resultado; etiqueta = texto de la primera columna, o su valor si no hay texto; excluir = valor de la columna cuya etiqueta sea `ETIQUETA_COL_EXCLUIR`, si existe.
5. Si se leen exactamente `MAX_RESULTADOS_BUSQUEDA` filas, registra advertencia en servidor; en cliente no registra.

No uses `N/query` ni SuiteQL; el cliente decidió que la fuente sea la búsqueda guardada.

### 13.4 `entrypoints/ARCHIVO_UE`

`beforeLoad`:

1. Ejecuta solo en tipos crear, editar y copiar, y solo en contexto de interfaz de usuario.
2. Determina el formulario: valor del formulario personalizado del registro; si está vacío al crear, el parámetro `cf` de la solicitud.
3. Si el formulario no es igual al parámetro `PARAM_FORM`, termina sin cambios. Si `PARAM_FORM` está vacío, termina y registra advertencia.
4. Agrega `FLD_COL_AUX` a la sublista de artículos: selección, sin origen, etiqueta `LBL_COL_AUX`.
5. Bloquea el campo nativo de artículo de la sublista (RN-12, D-07). Si la plataforma rechaza el bloqueo, registra auditoría y continúa; la validación de cliente y servidor sigue activa.
6. Adjunta `ARCHIVO_CS` al formulario por ruta relativa.

`beforeSubmit`:

1. Ejecuta en crear, editar y edición en línea; en eliminar termina. Corre en todos los contextos de ejecución.
2. Edición en línea: si el equipo está entre los campos modificados y es distinto al original, lanza `MTTO_EQUIPO_NO_EDITABLE` con MSG-08 (RN-11). En otro caso termina.
3. Crear y editar: arma objetos planos con equipo actual y original, subsidiaria, esCreacion, líneas actuales (clave, número, idArticulo, textoArticulo) y líneas originales (clave, idArticulo, cantidadRecibida, cantidadFacturada).
4. Construye los adaptadores y UC-02, y lo ejecuta.
5. Si hay errores, registra con nivel error los de configuración (`MTTO_EQUIPO_NO_ENCONTRADO`, `MTTO_BUSQUEDA_INVALIDA`) con equipo e ID de búsqueda, y lanza un error con el primer código y el mensaje de todos.

### 13.5 `entrypoints/ARCHIVO_CS`

Estado de la página, propiedad exclusiva del entry point de cliente: idEquipo, equipo, mapa de artículos permitidos, cargaValida, mapa de líneas originales por clave, bandera de reinicio por subsidiaria.
Justificación: en cliente el estado vive lo que vive la página; no se usa en servidor ni en otras capas.

| Evento | Comportamiento |
|---|---|
| `pageInit` | Guarda las líneas originales en edición. Si es edición y `equipoEditable` es falso, deshabilita `FLD_BODY_EQUIPO` (RN-10). Si hay equipo, ejecuta UC-01 y guarda el estado; si falla, muestra MSG-05 y marca cargaValida en falso. Puebla las opciones de la línea actual |
| `validateField` de `FLD_BODY_EQUIPO` | Si la bandera de reinicio por subsidiaria está activa, permite. Si `requiereConfirmacion` es verdadero, pide confirmación síncrona del navegador con MSG-02 y devuelve su resultado. La confirmación es síncrona porque este evento exige respuesta inmediata |
| `fieldChanged` de `FLD_BODY_EQUIPO` | Elimina todas las líneas de la última a la primera; elimina todas las opciones de `FLD_COL_AUX` en la línea actual; si hay equipo nuevo, ejecuta UC-01 y actualiza el estado, o muestra MSG-05 si falla; si queda vacío, limpia el estado. Apaga la bandera de reinicio por subsidiaria |
| `fieldChanged` de la subsidiaria | Si hay equipo y `esSubsidiariaCompatible` es falso, muestra MSG-06, activa la bandera y limpia `FLD_BODY_EQUIPO`, lo que dispara el reinicio (RN-09) |
| `lineInit` de la sublista de artículos | Elimina todas las opciones de `FLD_COL_AUX`, inserta una opción vacía y las opciones del estado. Si el artículo nativo de la línea está en el mapa, preselecciona la columna sin disparar `fieldChanged` |
| `fieldChanged` de `FLD_COL_AUX` | Con valor, asigna el artículo nativo con sourcing síncrono. Sin valor, limpia el artículo nativo |
| `validateLine` de la sublista de artículos | Sin equipo: MSG-01 y rechaza. Con cargaValida falsa: MSG-05 y rechaza. Línea original sin cambio de artículo en edición: acepta. Artículo fuera del mapa: MSG-03 y rechaza |
| `saveRecord` | Sin equipo: MSG-01 y rechaza. Subsidiaria incompatible: MSG-06 y rechaza. Aplica RN-04 y `lineasFueraDeListado`; si hay, MSG-04 y rechaza |

No manipules el DOM. Usa solo la API de registro actual de cliente.

## 14. Restricciones técnicas

1. SuiteScript 2.1 en todos los archivos, con encabezado JSDoc `@NApiVersion`, `@NScriptType` en entry points y `@NModuleScope SameAccount`.
2. Módulos `N/` estrictamente necesarios: `N/search`, `N/runtime`, `N/error`, `N/log`, `N/ui/serverWidget` en el UE, `N/currentRecord` en cliente si se requiere.
3. Regla de dependencia de la sección 8, sin excepciones.
4. Entry points delgados: filtran evento y contexto, leen parámetros, construyen adaptadores, mapean a objetos planos, invocan casos de uso y aplican el resultado.
5. Todos los IDs y etiquetas salen de `shared/constantes.js`; el ID del formulario solo sale de `PARAM_FORM`.
6. Sin estado a nivel de módulo en servidor.
7. Sin datos reales de clientes, proveedores, RFC ni bancos en código, pruebas o README.
8. Funciones pequeñas, nombres en español, errores explícitos con códigos de la sección 12.

## 15. Gobernanza y rendimiento

Costos por operación de referencia; valídalos contra la documentación vigente y reporta si difieren.

| Componente | Operación | Unidades por operación | Operaciones por ejecución | Total | Límite |
|---|---|---|---|---|---|
| UE `beforeSubmit` | Lectura de campos del equipo | 1 | 1 | 1 | 1,000 |
| UE `beforeSubmit` | Carga y lectura de la búsqueda | 5 + 10 | 0 o 1 | 0 a 15 | 1,000 |
| UE `beforeLoad` | Sin consultas | 0 | — | 0 | 1,000 |
| Cliente | UC-01 por inicio o cambio de equipo | 16 | 1 por evento | 16 | 1,000 |

Las opciones de cada línea salen del estado de la página; nunca ejecutes la búsqueda en `lineInit`.

## 16. Seguridad y permisos

| Rol | Permisos mínimos |
|---|---|
| `ROLES_CAPTURA` | Orden de compra crear y editar; artículos ver; `REC_EQUIPO` ver; audiencia de las búsquedas |
| `ROL_ADMIN_CONFIG` | `REC_EQUIPO` crear y editar; crear búsquedas públicas |

El agente no asigna roles en el XML; el README lista los pasos manuales.

## 17. Pruebas y criterios de aceptación

### 17.1 Pruebas Jest (las implementa y ejecuta el agente)

Usa la configuración de Jest del proyecto; si existe `@oracle/suitecloud-unit-testing`, respeta sus alias.

| Caso | Regla | Capa | Entrada | Resultado esperado |
|---|---|---|---|---|
| T-01 | RN-03 | Dominio | Permitidos {A, B}; línea con A | Sin líneas inválidas |
| T-02 | RN-03 | Dominio | Permitidos {A, B}; líneas A y C | Línea de C inválida con su número |
| T-03 | RN-04 | Dominio | Creación con tres líneas | Las tres a validar |
| T-04 | RN-04 | Dominio | Edición: original X sin cambio, original Y cambiada a A, nueva B | Se validan la de A y la de B |
| T-05 | RN-04 | Dominio | Edición con equipo cambiado | Todas a validar |
| T-06 | RN-02 | Dominio | Filas con excluir "T", "Sí", vacío; duplicados; desorden | Sin excluidas ni duplicadas, ordenadas |
| T-07 | RN-08 | Dominio | Subsidiarias iguales, distintas, una vacía | Verdadero, falso, falso |
| T-08 | RN-05 | Dominio | Cero y tres líneas | Falso y verdadero |
| T-09 | RN-10 | Dominio | Línea con recibida 2; líneas en cero | No editable; editable |
| T-10 | RN-06 | Aplicación | UC-02 sin equipo | Sin errores y sin llamadas a puertos |
| T-11 | RN-07 | Aplicación | UC-01 con equipo inexistente, búsqueda vacía, puerto con error, filas todas excluidas | Códigos correctos en cada caso |
| T-12 | RN-03 | Aplicación | UC-02 con línea fuera de listado | `MTTO_ARTICULO_FUERA_DE_LISTADO` con número de línea |
| T-13 | RN-08 | Aplicación | UC-02 con subsidiaria distinta | `MTTO_SUBSIDIARIA_INCOMPATIBLE` |
| T-14 | RN-10 | Aplicación | UC-02 edición con equipo cambiado y línea recibida | `MTTO_EQUIPO_NO_EDITABLE` |
| T-15 | RN-04 | Aplicación | UC-02 edición sin líneas a validar | No llama a `ArticulosPermitidos` |
| T-16 | Contratos | Contrato | Adaptadores en memoria de ambos puertos | Cumplen las firmas de la sección 9.4 |
| T-17 | RN-01 | Aplicación | UC-01 con equipo válido y búsqueda con filas | Éxito con el equipo y los artículos normalizados de su búsqueda |

### 17.2 Pruebas en sandbox (las ejecuta el administrador; el agente las lista en el README)

| Caso | Regla | Escenario | Resultado esperado |
|---|---|---|---|
| POC-1 | — | OC con 30 líneas en el formulario exclusivo | Opciones correctas en cada línea sin retraso perceptible |
| POC-2 | — | Edición de OC existente | La columna muestra el artículo nativo de cada línea |
| POC-3 | — | Elegir artículo en la columna | Precio, descripción, unidad e impuesto se completan antes de confirmar la línea |
| POC-4 | RN-12 | Formulario exclusivo | Campo nativo no editable; asignación por script funciona |
| POC-5 | RN-04 | Copiar una OC | Equipo y líneas se conservan; el servidor valida |
| POC-6 | — | Usuario de `ROLES_CAPTURA` sin privilegios de administrador | Opciones visibles sin error |
| SB-01 | RN-07 | Equipo con búsqueda inexistente | Captura bloqueada con MSG-05 |
| SB-02 | RN-05 | Cambio de equipo con líneas, confirmación aceptada | Cero líneas; opciones del nuevo equipo |
| SB-03 | RN-05 | Cambio de equipo con líneas, confirmación cancelada | Equipo y líneas sin cambio |
| SB-04 | RN-03 | CSV con equipo y artículo fuera de listado | Rechazo con MSG-04 |
| SB-05 | RN-08 | CSV con equipo de otra subsidiaria | Rechazo con MSG-06 |
| SB-06 | RN-09 | Cambio de subsidiaria con equipo incompatible | Equipo limpio y líneas eliminadas |
| SB-07 | RN-10 | Edición de OC con línea recibida | Equipo bloqueado; cambio por CSV rechazado |
| SB-08 | RN-11 | Edición en línea del equipo desde lista | Rechazo con MSG-08 |
| SB-09 | RN-06 | OC en otro formulario sin equipo | Sin efecto de la solución |
| SB-10 | RN-12 | OC en otro formulario | Campo nativo editable; sin columna auxiliar |

Si POC-1, POC-2 o POC-3 fallan, la solución no avanza a producción.

## 18. Despliegue y reversión

El agente no despliega. Prepara los archivos, ejecuta `suitecloud project:validate` si la CLI está configurada y documenta en el README estos pasos para el administrador:

| Paso | Ambiente | Acción |
|---|---|---|
| 1 | Sandbox | Revisar el reporte de la Fase 0 |
| 2 | Sandbox | Desplegar por SDF el tipo de registro, campos, script y despliegue en estado `ESTADO_DESPLIEGUE_INICIAL` |
| 3 | Sandbox | Crear el formulario exclusivo y ocultar `FLD_BODY_EQUIPO` en otros formularios de compra |
| 4 | Sandbox | Capturar `FORM_ID_SANDBOX` en `PARAM_FORM` del despliegue |
| 5 | Sandbox | Crear dos búsquedas piloto con el contrato y dos registros Equipo |
| 6 | Sandbox | Asignar permisos a `ROLES_CAPTURA` y `ROL_ADMIN_CONFIG` |
| 7 | Sandbox | Ejecutar POC-1 a POC-6 y SB-01 a SB-10 |
| 8 | Sandbox | Cambiar el despliegue a Liberado y probar con usuarios de `ROLES_CAPTURA` |
| 9 | Producción | Repetir pasos 2 a 6 con `FORM_ID_PRODUCCION`; dar de alta todos los equipos y búsquedas |
| 10 | Producción | Piloto con usuarios reales y luego liberación general |

Reversión: desmarcar el despliegue del UE. El formulario vuelve a comportamiento nativo, sin columna ni bloqueo. El registro Equipo y el campo de cabecera pueden quedarse sin efecto operativo.

## 19. Prohibiciones

1. No desplegar a ninguna cuenta.
2. No crear, editar ni borrar registros u objetos en la cuenta; el MCP solo para lectura en la Fase 0.
3. No crear el formulario ni las búsquedas guardadas.
4. No modificar objetos existentes del proyecto; ante colisión, detenerse.
5. No usar `N/query`, SuiteQL ni `N/record` para leer el equipo o los artículos en la solución.
6. No codificar IDs fuera de `shared/constantes.js` ni el ID del formulario fuera de `PARAM_FORM`.
7. No manipular el DOM ni usar APIs no documentadas.
8. No cambiar reglas, mensajes, IDs ni etiquetas de este documento.

## 20. Formato de respuesta esperado

1. Reporte de la Fase 0 con la tabla de la sección 6; si hubo condición de paro, solo este punto.
2. Lista de archivos creados o modificados con su ruta.
3. Resultado de Jest con el conteo de pruebas aprobadas por caso T-01 a T-17.
4. Resultado de `suitecloud project:validate`, o la razón por la que no se ejecutó.
5. Desviaciones respecto de este documento, cada una con justificación.
6. Lista de pasos manuales pendientes y valores `PENDIENTE` de la sección 1.

## 21. Supuestos y fuentes

### 21.1 Supuestos

| ID | Supuesto | Dónde se verifica |
|---|---|---|
| S-01 | "Pedido" equivale a Orden de compra | Confirmado por el cliente para el alcance |
| S-02 | Los artículos son de tipo Otro cargo para la compra | Contrato de búsqueda |
| S-03 | Cada búsqueda devuelve pocas decenas de artículos | POC-1 |
| S-04 | Costos de gobernanza de la sección 15 | Documentación vigente |
| S-05 | El módulo de cliente adjuntado por el UE no requiere despliegue propio | POC-1 |
| S-06 | El campo nativo de artículo puede bloquearse en `beforeLoad` y asignarse por script | POC-4 |
| S-07 | Las opciones de la columna se cargan línea por línea | POC-1 |
| S-08 | IDs de la sección 1 propuestos como convención | Fase 0 |
| S-09 | NetSuite impide eliminar líneas con recepción o factura | SB-07 |
| S-10 | Sourcing & Filtering no limpia el equipo al cambiar la subsidiaria | SB-06 |
| S-11 | IDs de campo de línea para clave única, cantidad recibida y cantidad facturada | Fase 0 |
| S-12 | `validateField` se dispara al cambiar el equipo y admite confirmación síncrona | SB-02 y SB-03 |
| S-13 | El formulario se identifica en `beforeLoad` por el campo de formulario o el parámetro `cf` | POC-1 |
| S-14 | El XML de SDF admite el filtro de Sourcing & Filtering del campo de cabecera | Validación de SDF |
| S-15 | El nombre para mostrar es único por convención interna, sin validación | Riesgo aceptado por el cliente |

### 21.2 Fuentes

| Fuente | Uso |
|---|---|
| Plan de desarrollo v2, 2026-11-12 | Diseño aprobado |
| Documentación de Oracle: `Field.insertSelectOption` y `Field.removeSelectOption` del módulo `N/currentRecord` | Restricción de campos `custpage` y eliminación total de opciones |
| Documentación de Oracle: `Sublist.addField` del módulo `N/ui/serverWidget` | Columna por script en `beforeLoad` |
| Foros de NetSuite Professionals y Oracle Community | Posición de columnas por script y carga de opciones por línea |
| Skills internas `netsuite-plan-diseno` y `netsuite-arquitectura-limpia` | Estructura del plan, capas y convenciones |
