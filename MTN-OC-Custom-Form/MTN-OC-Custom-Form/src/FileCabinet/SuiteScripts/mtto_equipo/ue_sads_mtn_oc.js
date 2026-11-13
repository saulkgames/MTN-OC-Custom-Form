/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * User Event de Orden de compra (IDs en lib/config.js).
 * beforeLoad: en el formulario exclusivo agrega la columna auxiliar, bloquea el artículo nativo y adjunta el Client Script.
 * beforeSubmit: garantiza en todos los contextos que una OC con equipo solo tenga artículos de su listado.
 * Sin estado a nivel de módulo.
 */
define(['N/ui/serverWidget', 'N/runtime', 'N/error', 'N/log', './lib/config', './lib/reglas', './lib/datos'],
    (serverWidget, runtime, error, log, config, reglas, datos) => {

        const { IDS, ESTANDAR, ETIQUETAS, RUTAS, MENSAJES, CODIGOS, MENSAJE_POR_CODIGO, CODIGOS_DE_CONFIGURACION } = config;

        // ---------------------------------------------------------------- beforeLoad

        /**
         * @param {Object} contexto scriptContext de beforeLoad
         */
        function beforeLoad(contexto) {
            const tipos = contexto.UserEventType;
            if ([tipos.CREATE, tipos.EDIT, tipos.COPY].indexOf(contexto.type) === -1) {
                return;
            }
            if (runtime.executionContext !== runtime.ContextType.USER_INTERFACE) {
                return;
            }
            const idFormularioExclusivo = leerParametroFormulario();
            if (reglas.esVacio(idFormularioExclusivo)) {
                log.audit({
                    title: 'Parámetro de formulario vacío',
                    details: 'Capture el ID interno del formulario exclusivo en ' + IDS.PARAM_FORM + ' del despliegue ' + IDS.DEPLOY_UE + '.'
                });
                return;
            }
            if (reglas.aTextoId(determinarFormulario(contexto)) !== reglas.aTextoId(idFormularioExclusivo)) {
                return;
            }
            const sublista = contexto.form.getSublist({ id: ESTANDAR.SUBLISTA_ARTICULOS });
            if (!sublista) {
                log.audit({ title: 'Sublista de artículos no disponible', details: 'No se agregó la columna auxiliar.' });
                return;
            }
            agregarColumnaAuxiliar(sublista);
            bloquearArticuloNativo(sublista);
            contexto.form.clientScriptModulePath = RUTAS.ARCHIVO_CS;
            log.audit({ title: 'Client Script adjuntado', details: RUTAS.ARCHIVO_CS });
        }

        function leerParametroFormulario() {
            return runtime.getCurrentScript().getParameter({ name: IDS.PARAM_FORM });
        }

        /** Formulario del registro; si está vacío (creación), el parámetro cf de la solicitud. */
        function determinarFormulario(contexto) {
            const formulario = contexto.newRecord.getValue({ fieldId: ESTANDAR.FLD_FORMULARIO });
            if (!reglas.esVacio(formulario)) {
                return formulario;
            }
            const parametros = contexto.request && contexto.request.parameters;
            return parametros ? parametros[ESTANDAR.PARAM_SOLICITUD_FORMULARIO] : '';
        }

        function agregarColumnaAuxiliar(sublista) {
            sublista.addField({
                id: IDS.FLD_COL_AUX,
                type: serverWidget.FieldType.SELECT,
                label: ETIQUETAS.LBL_COL_AUX
            });
        }

        /** RN-12 (D-07). Si la plataforma rechaza el bloqueo, se registra y la validación sigue activa. */
        function bloquearArticuloNativo(sublista) {
            try {
                const campo = sublista.getField({ id: ESTANDAR.COL_ARTICULO });
                if (!campo) {
                    log.audit({ title: 'Artículo nativo no bloqueado', details: 'El campo no está disponible en la sublista.' });
                    return;
                }
                campo.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
            } catch (e) {
                log.audit({ title: 'Artículo nativo no bloqueado', details: (e && e.message) || String(e) });
            }
        }

        // ---------------------------------------------------------------- beforeSubmit

        /**
         * @param {Object} contexto scriptContext de beforeSubmit
         */
        function beforeSubmit(contexto) {
            const tipos = contexto.UserEventType;
            if (contexto.type === tipos.XEDIT) {
                validarEdicionEnLinea(contexto);
                return;
            }
            if (contexto.type !== tipos.CREATE && contexto.type !== tipos.EDIT) {
                return;
            }
            const entrada = construirEntrada(contexto);
            const errores = validarDocumento(entrada);
            if (!errores.length) {
                return;
            }
            registrarErroresDeConfiguracion(errores, entrada);
            throw error.create({
                name: errores[0].codigo,
                message: errores.map((e) => e.mensaje).join(' '),
                notifyOff: true
            });
        }

        /** RN-11. En edición en línea se rechaza cualquier cambio del equipo. */
        function validarEdicionEnLinea(contexto) {
            const campos = contexto.newRecord.getFields() || [];
            if (campos.indexOf(IDS.FLD_BODY_EQUIPO) === -1) {
                return;
            }
            const actual = contexto.newRecord.getValue({ fieldId: IDS.FLD_BODY_EQUIPO });
            const original = contexto.oldRecord ? contexto.oldRecord.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }) : '';
            if (!reglas.equipoCambio(original, actual)) {
                return;
            }
            throw error.create({ name: CODIGOS.EQUIPO_NO_EDITABLE, message: MENSAJES.MSG_08, notifyOff: true });
        }

        /** Arma objetos planos a partir del registro nuevo y el original. */
        function construirEntrada(contexto) {
            const nuevo = contexto.newRecord;
            const anterior = contexto.oldRecord;
            const esCreacion = contexto.type === contexto.UserEventType.CREATE;
            return {
                esCreacion,
                idEquipo: reglas.aTextoId(nuevo.getValue({ fieldId: IDS.FLD_BODY_EQUIPO })),
                idEquipoOriginal: esCreacion || !anterior ? '' : reglas.aTextoId(anterior.getValue({ fieldId: IDS.FLD_BODY_EQUIPO })),
                idSubsidiariaTransaccion: reglas.aTextoId(nuevo.getValue({ fieldId: ESTANDAR.FLD_SUBSIDIARIA })),
                lineasActuales: leerLineasActuales(nuevo),
                lineasOriginales: esCreacion || !anterior ? [] : leerLineasOriginales(anterior)
            };
        }

        function leerLineasActuales(registro) {
            const sublistId = ESTANDAR.SUBLISTA_ARTICULOS;
            const total = registro.getLineCount({ sublistId });
            const lineas = [];
            for (let i = 0; i < total; i++) {
                const idArticulo = reglas.aTextoId(registro.getSublistValue({ sublistId, fieldId: ESTANDAR.COL_ARTICULO, line: i }));
                lineas.push({
                    clave: reglas.aTextoId(registro.getSublistValue({ sublistId, fieldId: ESTANDAR.COL_CLAVE_LINEA, line: i })),
                    numero: i + 1,
                    idArticulo,
                    textoArticulo: leerTextoArticulo(registro, i) || idArticulo
                });
            }
            return lineas;
        }

        /** getSublistText puede no estar disponible en beforeSubmit según el contexto; el texto es opcional. */
        function leerTextoArticulo(registro, linea) {
            try {
                return registro.getSublistText({ sublistId: ESTANDAR.SUBLISTA_ARTICULOS, fieldId: ESTANDAR.COL_ARTICULO, line: linea });
            } catch (e) {
                return '';
            }
        }

        function leerLineasOriginales(registro) {
            const sublistId = ESTANDAR.SUBLISTA_ARTICULOS;
            const total = registro.getLineCount({ sublistId });
            const lineas = [];
            for (let i = 0; i < total; i++) {
                lineas.push({
                    clave: reglas.aTextoId(registro.getSublistValue({ sublistId, fieldId: ESTANDAR.COL_CLAVE_LINEA, line: i })),
                    idArticulo: reglas.aTextoId(registro.getSublistValue({ sublistId, fieldId: ESTANDAR.COL_ARTICULO, line: i })),
                    cantidadRecibida: registro.getSublistValue({ sublistId, fieldId: ESTANDAR.COL_CANT_RECIBIDA, line: i }),
                    cantidadFacturada: registro.getSublistValue({ sublistId, fieldId: ESTANDAR.COL_CANT_FACTURADA, line: i })
                });
            }
            return lineas;
        }

        /**
         * UC-02. Valida pertenencia, subsidiaria y edición permitida antes de guardar.
         * Orden ajustado por D-B: RN-10 se evalúa antes de RN-06 para impedir limpiar el equipo de una OC recibida o facturada.
         * @returns {Array<{codigo: string, mensaje: string, lineas: Array<number>, registro: Object}>}
         */
        function validarDocumento(entrada) {
            const cambio = reglas.equipoCambio(entrada.idEquipoOriginal, entrada.idEquipo);

            // 1. RN-10 (incluye pasar el equipo a vacío).
            if (!entrada.esCreacion && cambio && !reglas.equipoEditable(entrada.lineasOriginales)) {
                return [crearError(CODIGOS.EQUIPO_NO_EDITABLE, {})];
            }
            // 2. RN-06: sin equipo la regla no aplica en servidor.
            if (reglas.esVacio(entrada.idEquipo)) {
                return [];
            }
            // 3. Equipo existente (RN-07).
            const equipo = datos.obtenerEquipo(entrada.idEquipo);
            if (!equipo) {
                return [crearError(CODIGOS.EQUIPO_NO_ENCONTRADO, { equipo: entrada.idEquipo }, [],
                    { idEquipo: entrada.idEquipo, idBusqueda: '', detalle: 'Equipo inexistente o inaccesible.' })];
            }
            const errores = [];
            const nombreEquipo = equipo.nombre || equipo.id;

            // 4. RN-08.
            if (!reglas.esSubsidiariaCompatible(equipo.idSubsidiaria, entrada.idSubsidiariaTransaccion)) {
                errores.push(crearError(CODIGOS.SUBSIDIARIA_INCOMPATIBLE, { equipo: nombreEquipo }));
            }
            // 5. RN-04: sin líneas a validar no se ejecuta la búsqueda.
            const aValidar = reglas.lineasAValidar({
                esCreacion: entrada.esCreacion,
                equipoCambio: cambio,
                lineasActuales: entrada.lineasActuales,
                lineasOriginales: entrada.lineasOriginales
            });
            if (!aValidar.length) {
                return errores;
            }
            // 6. UC-01 con el equipo ya leído (sin segunda lectura).
            const seleccion = datos.prepararSeleccion(entrada.idEquipo, { equipo, bitacora: registrarAuditoria });
            if (!seleccion.exito) {
                errores.push(crearError(seleccion.codigo, { equipo: seleccion.nombreEquipo }, [],
                    { idEquipo: equipo.id, idBusqueda: equipo.idBusqueda, detalle: seleccion.detalle }));
                return errores;
            }
            // 7. RN-03.
            const permitidos = new Set(seleccion.articulos.map((articulo) => articulo.id));
            const fuera = reglas.lineasFueraDeListado(permitidos, aValidar);
            if (fuera.length) {
                const numeros = fuera.map((linea) => linea.numero);
                errores.push(crearError(CODIGOS.ARTICULO_FUERA_DE_LISTADO, { equipo: nombreEquipo, lineas: numeros.join(', ') }, numeros));
            }
            return errores;
        }

        function crearError(codigo, datosMensaje, lineas, registro) {
            return {
                codigo,
                mensaje: config.formatearMensaje(MENSAJE_POR_CODIGO[codigo], datosMensaje),
                lineas: lineas || [],
                registro: registro || null
            };
        }

        function registrarAuditoria(titulo, detalle) {
            log.audit({ title: titulo, details: detalle });
        }

        /** Registra con nivel error los problemas de configuración del equipo o su búsqueda. */
        function registrarErroresDeConfiguracion(errores, entrada) {
            errores
                .filter((e) => CODIGOS_DE_CONFIGURACION.indexOf(e.codigo) !== -1)
                .forEach((e) => {
                    const registro = e.registro || {};
                    log.error({
                        title: e.codigo,
                        details: 'Equipo: ' + (registro.idEquipo || entrada.idEquipo) +
                            ' | Búsqueda: ' + (registro.idBusqueda || '(vacía)') +
                            ' | Detalle: ' + (registro.detalle || '')
                    });
                });
        }

        return { beforeLoad, beforeSubmit };
    });
