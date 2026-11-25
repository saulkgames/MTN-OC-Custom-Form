# Cierre de la incidencia: README 1.12 y AGENTS.md (mapa para IA)

## 1. Contexto

Las pruebas con el empleado de compras fueron exitosas (reporte del usuario, 2026-11-25, sin detalle por caso).
Dato de C-11: con el rol de compras el registro "Equipo de transporte" se puede ver pero no editar. R-24 queda mitigado.
Dato de despliegue: el código de la rama (commits `30018dc`, `4150768`, `1a6891b`) está desplegado en producción.
Objetivos: dejar el README al día y crear `AGENTS.md` como punto de entrada para modelos de IA, para ahorrar tokens de lectura y análisis en futuras consultas y requerimientos.
Sin cambios de código en `src/FileCabinet/`.

## 2. Hechos del proyecto que alimentan el AGENTS.md (ya verificados en esta sesión)

| Dato | Valor |
|---|---|
| Raíz del repositorio | `/home/user/MTN-OC-Custom-Form`; el proyecto SDF está anidado en `MTN-OC-Custom-Form/MTN-OC-Custom-Form/` (con `src/`, `README_mtto_equipo.md`, `planes/`, `referencia_sandbox/`) |
| Código propio | 5 archivos, 1,182 líneas en total: `ue_sads_mtn_oc.js` (279), `cs_sads_mtn_oc.js` (397), `lib/config.js` (132), `lib/datos.js` (171), `lib/reglas.js` (203) |
| Objetos SDF propios | `customrecord_sads_mtn_equipo`, `custbody_sads_mtn_equipo`, `customscript_sads_mtn_ue_oc`, `customscript_sads_mtn_cs_oc`, formulario `custform_sads_mtn_form` (ID interno 382 en producción) |
| Búsquedas | 60 archivos `customsearch_sads_mtn_*.xml`; el `<definition>` es base64+gzip de cientos de líneas; no leerlos |
| Datos | `ListadeEquipodetransporte.csv` (62 equipos: Nombre, Búsqueda guardada, Subsidiaria) |
| Pruebas | No hay pruebas locales; se valida en cuenta. Se puede probar `lib/datos.js` y `lib/reglas.js` en Node con simulaciones de `N/search` (así se hizo en la sesión) |
| Instrucciones previas para IA | No existe `AGENTS.md` ni `CLAUDE.md` |

## 3. Cambios

### 3.1 `AGENTS.md` en la raíz del repositorio (nuevo, objetivo 150 líneas o menos)

Se lee primero. Remite al README solo por sección, nunca completo.

| Sección | Contenido |
|---|---|
| 1. Qué es | 4 líneas: OC de mantenimiento con selector de artículos por equipo; garantía en servidor |
| 2. Reglas de lectura | Orden: este archivo → sección puntual del README → código. No leer: los 60 `customsearch_*.xml` (base64), `planes/` v4 a v10 (historial; solo `..._prompt_v1.md` para el diseño de origen y los planes del 2026-11-24 para la incidencia), `referencia_sandbox/`. Cómo leer una búsqueda: decodificar `<definition>` con Python `-I` (`split('@',3)[3]`, base64, gzip) y solo filtros y columnas |
| 3. Mapa | Tabla archivo → responsabilidad → funciones y números de línea aproximados; flujo carga / pantalla / guardado en 3 líneas |
| 4. Reglas de negocio | RN-01 a RN-12 en una línea cada una con su función en `lib/reglas.js` (`perteneceAlListado`, `lineasAValidar`, `equipoEditable`, etc.) |
| 5. Invariantes | Todo ID, mensaje y ruta vive en `lib/config.js`; `reglas.js` y `config.js` sin módulos `N/`; el servidor (`beforeSubmit`) es la garantía, el cliente es comodidad; D-G (función de una sola llamada se escribe donde se usa); `DIAGNOSTICO.ACTIVO` siempre `false` al cerrar |
| 6. Dependencias de ambiente | Tabla "síntoma → causa → dónde revisar" con lo aprendido: selector no se llena y no se borran líneas → posición del Client Script entre los primeros 10 de Registros con script > OC (R-23); MSG-05 con un rol → tipo de acceso del registro Equipo, búsqueda no pública o restricción de subsidiarias (R-22); botón sin selector → parámetro `custscript_sads_mtn_form_id`; scripts ajenos con `debugger;` (DRT - Costo de Compra CS) |
| 7. Procedimientos | Alta de un equipo nuevo (búsqueda + registro, sin código, README §5.3 y §5.4); nuevo requerimiento (revisar RN, tocar `config.js` primero, actualizar README §10 desviaciones y §12 riesgos); despliegue (`project:validate --server`, `project:deploy`, pasos manuales README §4.1) |
| 8. Verificación | `node --check` de los 5 archivos; simulación en Node de `datos.js`; matriz de pruebas README §6 y protocolo `planes/2026-11-24_mtto-equipo-oc_pruebas-rol-compras_v1.md` |
| 9. Estilo y confidencialidad | Español de México, lacónico; separar hecho de inferencia; citar fundamento; no reproducir RFC, saldos ni datos de nómina; marcar supuestos |
| 10. Mantenimiento | Actualizar este archivo en el mismo commit cuando cambien archivos, IDs, reglas o dependencias; fecha y versión del README al final |

### 3.2 `CLAUDE.md` en la raíz (nuevo, 1 línea)

Contenido: `@AGENTS.md`. Motivo: Claude Code carga `CLAUDE.md`, no `AGENTS.md`; así hay una sola fuente.

### 3.3 `README_mtto_equipo.md` (versión 1.12)

| Sección | Cambio |
|---|---|
| Encabezado | Versión 1.12, 2026-11-25. "Estado del despliegue": Producción, Liberado; pruebas de aceptación con rol de compras aprobadas 2026-11-25. Agregar fila "Mapa para IA: `AGENTS.md` (raíz del repositorio)" |
| §2.2 y §5.5 | Tipo de acceso `NONENEEDED`; rol de compras solo ve el registro Equipo (C-11, 2026-11-25) |
| §6 | Nueva subsección "Aceptación en producción (2026-11-25)": casos C-01 a C-12 con rol y usuario de compras; resultado global exitoso, sin detalle por caso, y referencia al protocolo en `planes/` |
| §12 | R-24: verificado en C-11 (solo ver); R-23: ya registrado como confirmado; R-21: ya marcado como descartado |
| §13 | Supuesto S-21: el límite de 10 scripts de cliente por registro aplica en producción; fuente y verificación (reordenamiento del 2026-11-24) |
| Sin cambio | §10 desviaciones y demás secciones, para no inflar el archivo |

## 4. Verificación

1. `AGENTS.md`: contar líneas (objetivo ≤150) y verificar por script que cada ID, ruta y función citados existen en `lib/config.js`, `lib/reglas.js` y `src/Objects/`.
2. Verificar que las referencias a secciones del README (§4.1, §5.3, §5.4, §5.7, §6, §10, §12) existen.
3. `node --check` de los 5 archivos (sin cambios, comprobación de no regresión).
4. `git diff --stat`: solo README, AGENTS.md, CLAUDE.md y una copia del plan en `planes/`.
5. Commit y push a `claude/wizardly-franklin-2fca8g`. Sin pull request.

## 5. Límites

Verificado: estructura, tamaños y rutas del repositorio; funciones exportadas de `reglas.js`.
No verificado: el resultado de cada caso C-01 a C-12 (el usuario informó éxito global); el contenido real de la subsidiaria de cada equipo del CSV.
Supuesto: el objetivo de 150 líneas basta para el mapa; si el mapa de funciones lo excede, se recorta la sección 4 y se remite a `reglas.js`.
