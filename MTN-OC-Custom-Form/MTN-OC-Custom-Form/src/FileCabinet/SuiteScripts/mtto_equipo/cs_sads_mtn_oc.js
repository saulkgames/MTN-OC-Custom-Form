/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * Client Script del formulario exclusivo de OC de mantenimiento.
 * No tiene registro de despliegue propio: lo adjunta ue_sads_mtn_oc.js con clientScriptModulePath.
 * Llena el selector "Artículo del equipo", atiende el botón "Agregar artículo" y valida en pantalla.
 * La garantía está en beforeSubmit del User Event.
 * No manipula el DOM; usa la API de registro actual y los diálogos nativos alert/confirm (confirmación síncrona en validateField).
 */
define(['N/currentRecord', './lib/config', './lib/reglas', './lib/datos'], (currentRecord, config, reglas, datos) => {

    const { IDS, ESTANDAR, MENSAJES, RUTAS, SELECTOR, DIAGNOSTICO } = config;
    const SUBLISTA = ESTANDAR.SUBLISTA_ARTICULOS;

    /**
     * Estado de la página. Vive lo que vive la página; exclusivo de este entry point.
     * El botón "Agregar artículo" no lo usa: lee el registro directamente.
     */
    const estado = {
        modo: '',
        idEquipo: '',
        idEquipoOriginal: '',
        equipo: null,
        nombreEquipo: '',
        articulos: [],
        permitidos: new Map(),
        cargaValida: true,
        lineasOriginales: new Map(),
        reinicioPorSubsidiaria: false
    };

    // Distingue "módulo no cargado" de "módulo cargado pero sin puntos de entrada invocados".
    diagnostico('módulo cargado', { archivo: RUTAS.ARCHIVO_CS });

    // ================================================================ pageInit

    function pageInit(contexto) {
        const registro = contexto.currentRecord;
        estado.modo = contexto.mode;
        estado.idEquipo = reglas.aTextoId(registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }));
        estado.idEquipoOriginal = esEdicion() ? estado.idEquipo : '';

        // Edición: guardar las líneas originales y, si hay recibidas o facturadas, bloquear el equipo (RN-10).
        if (esEdicion()) {
            estado.lineasOriginales = new Map();
            const total = registro.getLineCount({ sublistId: SUBLISTA });
            for (let i = 0; i < total; i++) {
                const clave = reglas.aTextoId(leerValorLinea(registro, ESTANDAR.COL_CLAVE_LINEA, i));
                estado.lineasOriginales.set(clave || ('#' + i), {
                    clave,
                    idArticulo: reglas.aTextoId(leerValorLinea(registro, ESTANDAR.COL_ARTICULO, i)),
                    cantidadRecibida: leerValorLinea(registro, ESTANDAR.COL_CANT_RECIBIDA, i),
                    cantidadFacturada: leerValorLinea(registro, ESTANDAR.COL_CANT_FACTURADA, i)
                });
            }
            if (!reglas.equipoEditable(lineasOriginalesComoLista())) {
                const campoEquipo = registro.getField({ fieldId: IDS.FLD_BODY_EQUIPO });
                if (campoEquipo) {
                    campoEquipo.isDisabled = true;
                }
            }
        }

        // Con equipo: cargar sus artículos y llenar el selector (el servidor ya lo llenó; esto lo sincroniza con el estado).
        if (!reglas.esVacio(estado.idEquipo)) {
            cargarSeleccion(registro, estado.idEquipo);
            poblarSelector(registro);
        }
    }

    // ================================================================ validateField

    /** RN-05. Confirmación síncrona antes de cambiar el equipo si hay líneas. */
    function validateField(contexto) {
        if (contexto.sublistId || contexto.fieldId !== IDS.FLD_BODY_EQUIPO || estado.reinicioPorSubsidiaria) {
            return true;
        }
        const registro = contexto.currentRecord;
        if (!reglas.equipoCambio(estado.idEquipo, registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }))) {
            return true;
        }
        if (!reglas.requiereConfirmacion(registro.getLineCount({ sublistId: SUBLISTA }))) {
            return true;
        }
        return window.confirm(MENSAJES.MSG_02);
    }

    // ================================================================ fieldChanged

    function fieldChanged(contexto) {
        const registro = contexto.currentRecord;

        // Equipo: reinicio de líneas y del selector (RN-05).
        if (!contexto.sublistId && contexto.fieldId === IDS.FLD_BODY_EQUIPO) {
            alCambiarEquipo(registro);
            return;
        }

        // Subsidiaria: si el equipo ya no le corresponde, se limpia sin confirmación (RN-09).
        if (!contexto.sublistId && contexto.fieldId === ESTANDAR.FLD_SUBSIDIARIA) {
            if (reglas.esVacio(estado.idEquipo) || !estado.equipo) {
                return;
            }
            if (reglas.esSubsidiariaCompatible(estado.equipo.idSubsidiaria, registro.getValue({ fieldId: ESTANDAR.FLD_SUBSIDIARIA }))) {
                return;
            }
            window.alert(config.formatearMensaje(MENSAJES.MSG_06, { equipo: estado.nombreEquipo }));
            estado.reinicioPorSubsidiaria = true;
            registro.setValue({ fieldId: IDS.FLD_BODY_EQUIPO, value: '' });
            if (estado.reinicioPorSubsidiaria) {
                // fieldChanged del equipo no se disparó: se aplica el reinicio directamente.
                alCambiarEquipo(registro);
            }
        }
    }

    // ================================================================ validateLine

    function validateLine(contexto) {
        if (contexto.sublistId !== SUBLISTA) {
            return true;
        }
        const registro = contexto.currentRecord;
        if (reglas.esVacio(registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }))) {
            window.alert(MENSAJES.MSG_01);
            return false;
        }
        if (!estado.cargaValida) {
            window.alert(config.formatearMensaje(MENSAJES.MSG_05, { equipo: estado.nombreEquipo }));
            return false;
        }
        const idArticulo = reglas.aTextoId(registro.getCurrentSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO }));

        // RN-04: en edición sin cambio de equipo, una línea original con su mismo artículo se acepta.
        const clave = reglas.aTextoId(registro.getCurrentSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_CLAVE_LINEA }));
        const original = esEdicion() && clave ? estado.lineasOriginales.get(clave) : null;
        if (original && original.idArticulo === idArticulo &&
            !reglas.equipoCambio(estado.idEquipoOriginal, registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }))) {
            return true;
        }

        // RN-03.
        if (reglas.perteneceAlListado(estado.permitidos, idArticulo)) {
            return true;
        }
        const textoArticulo = registro.getCurrentSublistText({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO }) || idArticulo;
        window.alert(config.formatearMensaje(MENSAJES.MSG_03, { articulo: textoArticulo, equipo: estado.nombreEquipo }));
        return false;
    }

    // ================================================================ saveRecord

    /** Replica el orden de validación del servidor para mostrar el mismo mensaje antes de enviar. */
    function saveRecord(contexto) {
        const registro = contexto.currentRecord;

        // 1. RN-06: equipo obligatorio en el formulario exclusivo.
        const idEquipo = reglas.aTextoId(registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }));
        if (!idEquipo) {
            window.alert(MENSAJES.MSG_01);
            return false;
        }

        // 2. RN-07: equipo existente.
        if (!estado.equipo) {
            window.alert(config.formatearMensaje(MENSAJES.MSG_05, { equipo: estado.nombreEquipo || idEquipo }));
            return false;
        }

        // 3. RN-08.
        if (!reglas.esSubsidiariaCompatible(estado.equipo.idSubsidiaria, registro.getValue({ fieldId: ESTANDAR.FLD_SUBSIDIARIA }))) {
            window.alert(config.formatearMensaje(MENSAJES.MSG_06, { equipo: estado.nombreEquipo }));
            return false;
        }

        // 4. RN-04: líneas a validar, numeradas desde 1.
        const lineasActuales = [];
        for (let i = 0; i < registro.getLineCount({ sublistId: SUBLISTA }); i++) {
            const idArticulo = reglas.aTextoId(leerValorLinea(registro, ESTANDAR.COL_ARTICULO, i));
            lineasActuales.push({
                clave: reglas.aTextoId(leerValorLinea(registro, ESTANDAR.COL_CLAVE_LINEA, i)),
                numero: i + 1,
                idArticulo,
                textoArticulo: registro.getSublistText({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO, line: i }) || idArticulo
            });
        }
        const aValidar = reglas.lineasAValidar({
            esCreacion: !esEdicion(),
            equipoCambio: reglas.equipoCambio(estado.idEquipoOriginal, idEquipo),
            lineasActuales,
            lineasOriginales: lineasOriginalesComoLista()
        });
        if (!aValidar.length) {
            return true;
        }

        // 5. RN-07: búsqueda válida.
        if (!estado.cargaValida) {
            window.alert(config.formatearMensaje(MENSAJES.MSG_05, { equipo: estado.nombreEquipo }));
            return false;
        }

        // 6. RN-03.
        const fuera = reglas.lineasFueraDeListado(estado.permitidos, aValidar);
        if (fuera.length) {
            window.alert(config.formatearMensaje(MENSAJES.MSG_04, {
                equipo: estado.nombreEquipo,
                lineas: fuera.map((linea) => linea.numero).join(', ')
            }));
            return false;
        }
        return true;
    }

    // ================================================================ botón "Agregar artículo"

    /**
     * La invoca el botón del selector (HTML en línea del UE) mediante require.
     * No usa el estado de la página: lee el registro con currentRecord.get().
     * Pone el artículo en la línea en captura sin confirmarla (D-L); el usuario captura cantidad y pulsa "Agregar".
     */
    function agregarArticuloSeleccionado() {
        const registro = currentRecord.get();
        if (reglas.esVacio(registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }))) {
            window.alert(MENSAJES.MSG_01);
            return;
        }
        const idArticulo = reglas.aTextoId(registro.getValue({ fieldId: IDS.FLD_SEL_ARTICULO }));
        if (!idArticulo) {
            window.alert(MENSAJES.MSG_09);
            return;
        }

        // Si se está editando una línea existente, se abre una línea nueva.
        if (registro.getCurrentSublistIndex({ sublistId: SUBLISTA }) < registro.getLineCount({ sublistId: SUBLISTA })) {
            registro.selectNewLine({ sublistId: SUBLISTA });
        }
        registro.setCurrentSublistValue({
            sublistId: SUBLISTA,
            fieldId: ESTANDAR.COL_ARTICULO,
            value: idArticulo,
            forceSyncSourcing: true
        });

        // S-06: comprobar que el artículo nativo bloqueado aceptó la asignación por script.
        const asignado = reglas.aTextoId(registro.getCurrentSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO }));
        diagnostico(asignado === idArticulo ? 'artículo asignado a la línea en captura' : 'artículo no asignado a la línea', {
            articulo: idArticulo,
            asignado
        });

        // Limpiar el selector para el siguiente artículo.
        registro.setValue({ fieldId: IDS.FLD_SEL_ARTICULO, value: SELECTOR.VALOR_VACIO, ignoreFieldChange: true });
    }

    // ================================================================ funciones con dos o más llamadas

    /** RN-05 tras confirmar: elimina líneas, carga los artículos del nuevo equipo y actualiza el selector. */
    function alCambiarEquipo(registro) {
        const idNuevo = reglas.aTextoId(registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }));
        if (!reglas.equipoCambio(estado.idEquipo, idNuevo)) {
            estado.reinicioPorSubsidiaria = false;
            return;
        }

        // Eliminar la línea en captura y todas las confirmadas, de la última a la primera.
        try {
            registro.cancelLine({ sublistId: SUBLISTA });
        } catch (e) {
            // Sin línea en captura.
        }
        for (let i = registro.getLineCount({ sublistId: SUBLISTA }) - 1; i >= 0; i--) {
            registro.removeLine({ sublistId: SUBLISTA, line: i });
        }

        estado.idEquipo = idNuevo;
        if (reglas.esVacio(idNuevo)) {
            estado.equipo = null;
            estado.nombreEquipo = '';
            estado.articulos = [];
            estado.permitidos = new Map();
            estado.cargaValida = true;
        } else {
            cargarSeleccion(registro, idNuevo);
        }
        poblarSelector(registro);
        estado.reinicioPorSubsidiaria = false;
    }

    /** UC-01: carga el equipo y sus artículos en el estado de la página. */
    function cargarSeleccion(registro, idEquipo) {
        const resultado = datos.prepararSeleccion(idEquipo);
        const textoCampo = registro.getText({ fieldId: IDS.FLD_BODY_EQUIPO });
        if (resultado.exito) {
            estado.equipo = resultado.equipo;
            estado.nombreEquipo = resultado.equipo.nombre || textoCampo || idEquipo;
            estado.articulos = resultado.articulos;
            estado.permitidos = new Map(resultado.articulos.map((articulo) => [articulo.id, articulo.etiqueta]));
            estado.cargaValida = true;
            diagnostico('carga de artículos: éxito', { equipo: idEquipo, articulos: resultado.articulos.length });
            return;
        }
        diagnostico('carga de artículos: falla', { equipo: idEquipo, codigo: resultado.codigo, detalle: resultado.detalle });
        estado.equipo = resultado.equipo;
        estado.nombreEquipo = (resultado.equipo && resultado.equipo.nombre) || textoCampo || resultado.nombreEquipo;
        estado.articulos = [];
        estado.permitidos = new Map();
        estado.cargaValida = false;
        window.alert(config.formatearMensaje(MENSAJES.MSG_05, { equipo: estado.nombreEquipo }));
    }

    /** Reemplaza las opciones del selector con la opción vacía y los artículos del estado. */
    function poblarSelector(registro) {
        const campo = registro.getField({ fieldId: IDS.FLD_SEL_ARTICULO });
        if (!campo) {
            diagnostico('selector no disponible', {});
            return;
        }
        campo.removeSelectOption({ value: null });
        campo.insertSelectOption({ value: SELECTOR.VALOR_VACIO, text: ' ' });
        estado.articulos.forEach((articulo) => {
            campo.insertSelectOption({ value: articulo.id, text: articulo.etiqueta });
        });
        diagnostico('selector llenado', { opciones: estado.articulos.length });
    }

    /**
     * Envuelve un punto de entrada: registra su entrada y cualquier error en la consola, y vuelve a lanzar el error
     * para que NetSuite se comporte igual que sin la envoltura.
     */
    function protegido(nombre, puntoDeEntrada) {
        return function (contexto) {
            diagnostico('entrada ' + nombre, contexto ? { modo: contexto.mode, campo: contexto.fieldId, sublista: contexto.sublistId } : {});
            try {
                return puntoDeEntrada(contexto);
            } catch (e) {
                diagnostico('error en ' + nombre, {
                    error: (e && (e.name || e.type)) || 'desconocido',
                    mensaje: (e && e.message) || String(e),
                    pila: String((e && e.stack) || '').split('\n').slice(0, 4).join(' | ')
                });
                throw e;
            }
        };
    }

    function esEdicion() {
        return estado.modo === 'edit';
    }

    function lineasOriginalesComoLista() {
        return Array.from(estado.lineasOriginales.values());
    }

    function leerValorLinea(registro, fieldId, linea) {
        return registro.getSublistValue({ sublistId: SUBLISTA, fieldId, line: linea });
    }

    /** Mensaje en la consola del navegador con el prefijo del proyecto; no toca el DOM ni interrumpe al usuario. */
    function diagnostico(etapa, datosDiagnostico) {
        if (!DIAGNOSTICO.ACTIVO || typeof console === 'undefined' || typeof console.warn !== 'function') {
            return;
        }
        try {
            console.warn(DIAGNOSTICO.PREFIJO + ' ' + etapa, datosDiagnostico || {});
        } catch (e) {
            // Consola no disponible.
        }
    }

    return {
        pageInit: protegido('pageInit', pageInit),
        validateField: protegido('validateField', validateField),
        fieldChanged: protegido('fieldChanged', fieldChanged),
        validateLine: protegido('validateLine', validateLine),
        saveRecord: protegido('saveRecord', saveRecord),
        agregarArticuloSeleccionado: protegido('agregarArticuloSeleccionado', agregarArticuloSeleccionado)
    };
});
