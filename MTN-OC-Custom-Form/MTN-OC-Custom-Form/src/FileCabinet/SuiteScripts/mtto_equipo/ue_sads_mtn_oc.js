/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 *
 * User Event de Orden de compra (IDs en lib/config.js).
 * beforeLoad: en el formulario exclusivo agrega el selector "Artículo del equipo" y el botón "Agregar artículo"
 *             en la pestaña Artículos, llena el selector si el equipo ya se conoce, bloquea el artículo nativo
 *             y adjunta el Client Script.
 * beforeSubmit: garantiza, en todos los contextos, que una OC con equipo solo tenga artículos de su listado.
 * Sin estado a nivel de módulo.
 */
define(['N/ui/serverWidget', 'N/runtime', 'N/error', 'N/log', './lib/config', './lib/reglas', './lib/datos'],
    (serverWidget, runtime, error, log, config, reglas, datos) => {

        const { IDS, ESTANDAR, ETIQUETAS, RUTAS, SELECTOR, MENSAJES, CODIGOS, MENSAJE_POR_CODIGO } = config;
        const SUBLISTA = ESTANDAR.SUBLISTA_ARTICULOS;

        // ================================================================ beforeLoad

        function beforeLoad(contexto) {
            // 1. Solo crear, editar y copiar, en interfaz de usuario.
            const tipos = contexto.UserEventType;
            if ([tipos.CREATE, tipos.EDIT, tipos.COPY].indexOf(contexto.type) === -1) {
                return;
            }
            if (runtime.executionContext !== runtime.ContextType.USER_INTERFACE) {
                return;
            }

            // 2. Solo en el formulario exclusivo: el del registro o, si viene vacío al crear, el parámetro cf de la URL.
            const idFormularioExclusivo = runtime.getCurrentScript().getParameter({ name: IDS.PARAM_FORM });
            if (reglas.esVacio(idFormularioExclusivo)) {
                log.audit({
                    title: 'Parámetro de formulario vacío',
                    details: 'Capture el ID interno del formulario exclusivo en ' + IDS.PARAM_FORM + ' del despliegue ' + IDS.DEPLOY_UE + '.'
                });
                return;
            }
            let idFormulario = contexto.newRecord.getValue({ fieldId: ESTANDAR.FLD_FORMULARIO });
            if (reglas.esVacio(idFormulario) && contexto.request && contexto.request.parameters) {
                idFormulario = contexto.request.parameters[ESTANDAR.PARAM_SOLICITUD_FORMULARIO];
            }
            if (reglas.aTextoId(idFormulario) !== reglas.aTextoId(idFormularioExclusivo)) {
                return;
            }

            const formulario = contexto.form;
            const sublista = formulario.getSublist({ id: SUBLISTA });
            if (!sublista) {
                log.audit({ title: 'Sublista de artículos no disponible', details: 'No se agregó el selector.' });
                return;
            }

            // 3. Selector y botón "Agregar artículo" en la pestaña Artículos.
            //    Si NetSuite rechaza la pestaña estándar, se agregan en el área principal.
            let selector = null;
            let boton = null;
            const contenedores = [ESTANDAR.SUBPESTANA_ARTICULOS, ''];
            for (let i = 0; i < contenedores.length && !selector; i++) {
                const opcionesSelector = { id: IDS.FLD_SEL_ARTICULO, type: serverWidget.FieldType.SELECT, label: ETIQUETAS.LBL_SEL_ARTICULO };
                const opcionesBoton = { id: IDS.FLD_BTN_AGREGAR, type: serverWidget.FieldType.INLINEHTML, label: ETIQUETAS.LBL_BTN_AGREGAR };
                if (contenedores[i]) {
                    opcionesSelector.container = contenedores[i];
                    opcionesBoton.container = contenedores[i];
                }
                try {
                    selector = formulario.addField(opcionesSelector);
                    boton = formulario.addField(opcionesBoton);
                } catch (e) {
                    log.audit({
                        title: 'Selector no agregado en ' + (contenedores[i] || 'área principal'),
                        details: (e && e.message) || String(e)
                    });
                    selector = null;
                    boton = null;
                }
            }
            if (!selector || !boton) {
                log.audit({ title: 'Selector no disponible', details: 'No se pudo agregar el selector ni el botón.' });
                return;
            }

            // 4. Misma fila: el selector abre la fila y el botón la cierra.
            selector.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.STARTROW });
            boton.updateLayoutType({ layoutType: serverWidget.FieldLayoutType.ENDROW });

            // 5. D-O: el botón llama a agregarArticuloSeleccionado del Client Script. HTML estático, sin datos del usuario.
            boton.defaultValue =
                '<button type="button" id="' + IDS.FLD_BTN_AGREGAR + '_boton" ' +
                'onclick="require([\'' + RUTAS.MODULO_CS + '\'], function (cs) { cs.agregarArticuloSeleccionado(); }); return false;">' +
                ETIQUETAS.LBL_BTN_AGREGAR + '</button>';

            // 6. D-N: si el equipo ya se conoce (edición, copia o recarga por proveedor), llenar el selector en servidor.
            selector.addSelectOption({ value: SELECTOR.VALOR_VACIO, text: ' ' });
            const idEquipoCargado = reglas.aTextoId(contexto.newRecord.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }));
            if (idEquipoCargado) {
                const seleccion = datos.prepararSeleccion(idEquipoCargado, {
                    bitacora: (titulo, detalle) => log.audit({ title: titulo, details: detalle })
                });
                if (seleccion.exito) {
                    seleccion.articulos.forEach((articulo) => {
                        selector.addSelectOption({ value: articulo.id, text: articulo.etiqueta });
                    });
                } else {
                    log.audit({
                        title: 'Selector sin artículos: ' + seleccion.codigo,
                        details: 'Equipo: ' + idEquipoCargado + ' | Detalle: ' + (seleccion.detalle || '')
                    });
                }
            }

            // 7. RN-12: bloquear el artículo nativo. Si la plataforma lo rechaza, se registra y la validación sigue activa.
            try {
                const campoArticulo = sublista.getField({ id: ESTANDAR.COL_ARTICULO });
                if (campoArticulo) {
                    campoArticulo.updateDisplayType({ displayType: serverWidget.FieldDisplayType.DISABLED });
                } else {
                    log.audit({ title: 'Artículo nativo no bloqueado', details: 'El campo no está disponible en la sublista.' });
                }
            } catch (e) {
                log.audit({ title: 'Artículo nativo no bloqueado', details: (e && e.message) || String(e) });
            }

            // 8. Adjuntar el Client Script.
            formulario.clientScriptModulePath = RUTAS.ARCHIVO_CS;
            log.audit({ title: 'Client Script adjuntado', details: RUTAS.ARCHIVO_CS });
        }

        // ================================================================ beforeSubmit

        function beforeSubmit(contexto) {
            const tipos = contexto.UserEventType;
            const nuevo = contexto.newRecord;
            const anterior = contexto.oldRecord;

            // 1. RN-11: en edición en línea se rechaza cualquier cambio del equipo.
            if (contexto.type === tipos.XEDIT) {
                const camposEditados = nuevo.getFields() || [];
                const equipoOriginalXedit = anterior ? anterior.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }) : '';
                if (camposEditados.indexOf(IDS.FLD_BODY_EQUIPO) !== -1 &&
                    reglas.equipoCambio(equipoOriginalXedit, nuevo.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }))) {
                    throw error.create({ name: CODIGOS.EQUIPO_NO_EDITABLE, message: MENSAJES.MSG_08, notifyOff: true });
                }
                return;
            }

            // 2. Solo crear y editar.
            if (contexto.type !== tipos.CREATE && contexto.type !== tipos.EDIT) {
                return;
            }

            // 3. Datos planos de cabecera y líneas.
            const esCreacion = contexto.type === tipos.CREATE;
            const idEquipo = reglas.aTextoId(nuevo.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }));
            const idEquipoOriginal = esCreacion || !anterior ? '' : reglas.aTextoId(anterior.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }));
            const idSubsidiariaTransaccion = reglas.aTextoId(nuevo.getValue({ fieldId: ESTANDAR.FLD_SUBSIDIARIA }));
            const equipoCambio = reglas.equipoCambio(idEquipoOriginal, idEquipo);

            const lineasActuales = [];
            for (let i = 0; i < nuevo.getLineCount({ sublistId: SUBLISTA }); i++) {
                const idArticulo = reglas.aTextoId(nuevo.getSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO, line: i }));
                let textoArticulo = '';
                try {
                    textoArticulo = nuevo.getSublistText({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO, line: i });
                } catch (e) {
                    // getSublistText no siempre está disponible en beforeSubmit; el texto es opcional.
                }
                lineasActuales.push({
                    clave: reglas.aTextoId(nuevo.getSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_CLAVE_LINEA, line: i })),
                    numero: i + 1,
                    idArticulo,
                    textoArticulo: textoArticulo || idArticulo
                });
            }

            const lineasOriginales = [];
            if (!esCreacion && anterior) {
                for (let i = 0; i < anterior.getLineCount({ sublistId: SUBLISTA }); i++) {
                    lineasOriginales.push({
                        clave: reglas.aTextoId(anterior.getSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_CLAVE_LINEA, line: i })),
                        idArticulo: reglas.aTextoId(anterior.getSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO, line: i })),
                        cantidadRecibida: anterior.getSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_CANT_RECIBIDA, line: i }),
                        cantidadFacturada: anterior.getSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_CANT_FACTURADA, line: i })
                    });
                }
            }

            // 4. RN-10 (D-B): con líneas recibidas o facturadas, el equipo no cambia; tampoco puede quedar vacío.
            if (!esCreacion && equipoCambio && !reglas.equipoEditable(lineasOriginales)) {
                throw error.create({
                    name: CODIGOS.EQUIPO_NO_EDITABLE,
                    message: MENSAJE_POR_CODIGO[CODIGOS.EQUIPO_NO_EDITABLE],
                    notifyOff: true
                });
            }

            // 5. RN-06: sin equipo la regla no aplica en servidor.
            if (!idEquipo) {
                return;
            }

            // 6. RN-07: el equipo debe existir.
            const equipo = datos.obtenerEquipo(idEquipo);
            if (!equipo) {
                log.error({
                    title: CODIGOS.EQUIPO_NO_ENCONTRADO,
                    details: 'Equipo: ' + idEquipo + ' | Detalle: equipo inexistente o inaccesible.'
                });
                throw error.create({
                    name: CODIGOS.EQUIPO_NO_ENCONTRADO,
                    message: config.formatearMensaje(MENSAJE_POR_CODIGO[CODIGOS.EQUIPO_NO_ENCONTRADO], { equipo: idEquipo }),
                    notifyOff: true
                });
            }
            const nombreEquipo = equipo.nombre || equipo.id;
            const errores = [];

            // 7. RN-08: subsidiaria del equipo igual a la de la OC.
            if (!reglas.esSubsidiariaCompatible(equipo.idSubsidiaria, idSubsidiariaTransaccion)) {
                errores.push(crearError(CODIGOS.SUBSIDIARIA_INCOMPATIBLE, { equipo: nombreEquipo }));
            }

            // 8. RN-04: líneas a validar. Sin líneas a validar no se ejecuta la búsqueda.
            const aValidar = reglas.lineasAValidar({ esCreacion, equipoCambio, lineasActuales, lineasOriginales });
            if (aValidar.length) {

                // 9. UC-01 con el equipo ya leído (sin segunda lectura).
                const seleccion = datos.prepararSeleccion(idEquipo, {
                    equipo,
                    bitacora: (titulo, detalle) => log.audit({ title: titulo, details: detalle })
                });
                if (!seleccion.exito) {
                    log.error({
                        title: seleccion.codigo,
                        details: 'Equipo: ' + equipo.id + ' | Búsqueda: ' + (equipo.idBusqueda || '(vacía)') + ' | Detalle: ' + (seleccion.detalle || '')
                    });
                    errores.push(crearError(seleccion.codigo, { equipo: seleccion.nombreEquipo }));
                } else {

                    // 10. RN-03: cada línea a validar debe estar en el listado del equipo.
                    const permitidos = new Set(seleccion.articulos.map((articulo) => articulo.id));
                    const fuera = reglas.lineasFueraDeListado(permitidos, aValidar);
                    if (fuera.length) {
                        errores.push(crearError(CODIGOS.ARTICULO_FUERA_DE_LISTADO, {
                            equipo: nombreEquipo,
                            lineas: fuera.map((linea) => linea.numero).join(', ')
                        }));
                    }
                }
            }

            // 11. Lanzar con el primer código y el mensaje de todos.
            if (errores.length) {
                throw error.create({
                    name: errores[0].codigo,
                    message: errores.map((e) => e.mensaje).join(' '),
                    notifyOff: true
                });
            }
        }

        /** Error de validación con su mensaje ya formateado. */
        function crearError(codigo, datosMensaje) {
            return { codigo, mensaje: config.formatearMensaje(MENSAJE_POR_CODIGO[codigo], datosMensaje) };
        }

        return { beforeLoad, beforeSubmit };
    });
