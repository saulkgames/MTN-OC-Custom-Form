/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * Client Script del formulario exclusivo de OC de mantenimiento.
 * No tiene registro de despliegue propio: lo adjunta ue_sads_mtn_oc.js con clientScriptModulePath.
 * Mejora la captura; la garantía está en beforeSubmit del User Event.
 * No manipula el DOM; usa la API de registro actual y los diálogos nativos alert/confirm (confirmación síncrona en validateField).
 */
define(['./lib/config', './lib/reglas', './lib/datos'], (config, reglas, datos) => {

    const { IDS, ESTANDAR, MENSAJES } = config;
    const SUBLISTA = ESTANDAR.SUBLISTA_ARTICULOS;
    const VALOR_OPCION_VACIA = ' ';

    /**
     * Estado de la página. Vive lo que vive la página; exclusivo de este entry point.
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

    // ---------------------------------------------------------------- pageInit

    function pageInit(contexto) {
        const registro = contexto.currentRecord;
        estado.modo = contexto.mode;
        estado.idEquipo = reglas.aTextoId(registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }));
        estado.idEquipoOriginal = esEdicion() ? estado.idEquipo : '';

        if (esEdicion()) {
            guardarLineasOriginales(registro);
            if (!reglas.equipoEditable(lineasOriginalesComoLista())) {
                deshabilitarEquipo(registro);
            }
        }
        if (!reglas.esVacio(estado.idEquipo)) {
            cargarSeleccion(registro, estado.idEquipo);
        }
        poblarOpcionesLineaActual(registro);
    }

    function guardarLineasOriginales(registro) {
        estado.lineasOriginales = new Map();
        const total = registro.getLineCount({ sublistId: SUBLISTA });
        for (let i = 0; i < total; i++) {
            const clave = reglas.aTextoId(leerValorLinea(registro, ESTANDAR.COL_CLAVE_LINEA, i));
            const linea = {
                clave,
                idArticulo: reglas.aTextoId(leerValorLinea(registro, ESTANDAR.COL_ARTICULO, i)),
                cantidadRecibida: leerValorLinea(registro, ESTANDAR.COL_CANT_RECIBIDA, i),
                cantidadFacturada: leerValorLinea(registro, ESTANDAR.COL_CANT_FACTURADA, i)
            };
            estado.lineasOriginales.set(clave || ('#' + i), linea);
        }
    }

    function lineasOriginalesComoLista() {
        return Array.from(estado.lineasOriginales.values());
    }

    /** RN-10 en pantalla. */
    function deshabilitarEquipo(registro) {
        const campo = registro.getField({ fieldId: IDS.FLD_BODY_EQUIPO });
        if (campo) {
            campo.isDisabled = true;
        }
    }

    // ---------------------------------------------------------------- validateField

    /** RN-05. Confirmación síncrona antes de cambiar el equipo si hay líneas. */
    function validateField(contexto) {
        if (contexto.sublistId || contexto.fieldId !== IDS.FLD_BODY_EQUIPO) {
            return true;
        }
        if (estado.reinicioPorSubsidiaria) {
            return true;
        }
        const registro = contexto.currentRecord;
        const idNuevo = registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO });
        if (!reglas.equipoCambio(estado.idEquipo, idNuevo)) {
            return true;
        }
        if (!reglas.requiereConfirmacion(registro.getLineCount({ sublistId: SUBLISTA }))) {
            return true;
        }
        return window.confirm(MENSAJES.MSG_02);
    }

    // ---------------------------------------------------------------- fieldChanged

    function fieldChanged(contexto) {
        const registro = contexto.currentRecord;
        if (!contexto.sublistId && contexto.fieldId === IDS.FLD_BODY_EQUIPO) {
            alCambiarEquipo(registro);
        } else if (!contexto.sublistId && contexto.fieldId === ESTANDAR.FLD_SUBSIDIARIA) {
            alCambiarSubsidiaria(registro);
        } else if (contexto.sublistId === SUBLISTA && contexto.fieldId === IDS.FLD_COL_AUX) {
            alCambiarColumnaAuxiliar(registro);
        }
    }

    /** RN-05 tras confirmar: elimina líneas y opciones, y carga las del nuevo equipo. */
    function alCambiarEquipo(registro) {
        const idNuevo = reglas.aTextoId(registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }));
        if (!reglas.equipoCambio(estado.idEquipo, idNuevo)) {
            estado.reinicioPorSubsidiaria = false;
            return;
        }
        eliminarTodasLasLineas(registro);
        limpiarOpcionesLineaActual(registro);
        estado.idEquipo = idNuevo;
        if (reglas.esVacio(idNuevo)) {
            limpiarEstado();
        } else {
            cargarSeleccion(registro, idNuevo);
        }
        poblarOpcionesLineaActual(registro);
        estado.reinicioPorSubsidiaria = false;
    }

    /** RN-09. Si el equipo no corresponde a la nueva subsidiaria, se limpia sin confirmación. */
    function alCambiarSubsidiaria(registro) {
        if (reglas.esVacio(estado.idEquipo) || !estado.equipo) {
            return;
        }
        const idSubsidiaria = registro.getValue({ fieldId: ESTANDAR.FLD_SUBSIDIARIA });
        if (reglas.esSubsidiariaCompatible(estado.equipo.idSubsidiaria, idSubsidiaria)) {
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

    /** Asigna el artículo nativo desde la columna auxiliar. */
    function alCambiarColumnaAuxiliar(registro) {
        const valor = reglas.aTextoId(registro.getCurrentSublistValue({ sublistId: SUBLISTA, fieldId: IDS.FLD_COL_AUX }));
        if (!valor) {
            const actual = registro.getCurrentSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO });
            if (!reglas.esVacio(actual)) {
                registro.setCurrentSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO, value: '' });
            }
            return;
        }
        registro.setCurrentSublistValue({
            sublistId: SUBLISTA,
            fieldId: ESTANDAR.COL_ARTICULO,
            value: valor,
            forceSyncSourcing: true
        });
    }

    // ---------------------------------------------------------------- lineInit

    /** Opciones de la línea desde el estado de la página; nunca ejecuta la búsqueda. */
    function lineInit(contexto) {
        if (contexto.sublistId === SUBLISTA) {
            poblarOpcionesLineaActual(contexto.currentRecord);
        }
    }

    // ---------------------------------------------------------------- validateLine

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
        const clave = reglas.aTextoId(registro.getCurrentSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_CLAVE_LINEA }));
        if (esLineaOriginalSinCambio(registro, clave, idArticulo)) {
            return true;
        }
        if (reglas.perteneceAlListado(estado.permitidos, idArticulo)) {
            return true;
        }
        const textoArticulo = registro.getCurrentSublistText({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO }) || idArticulo;
        window.alert(config.formatearMensaje(MENSAJES.MSG_03, { articulo: textoArticulo, equipo: estado.nombreEquipo }));
        return false;
    }

    function esLineaOriginalSinCambio(registro, clave, idArticulo) {
        if (!esEdicion() || !clave || !estado.lineasOriginales.has(clave)) {
            return false;
        }
        const idEquipoActual = registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO });
        if (reglas.equipoCambio(estado.idEquipoOriginal, idEquipoActual)) {
            return false;
        }
        return estado.lineasOriginales.get(clave).idArticulo === idArticulo;
    }

    // ---------------------------------------------------------------- saveRecord

    /** Replica el orden de validación del servidor para mostrar el mismo mensaje antes de enviar. */
    function saveRecord(contexto) {
        const registro = contexto.currentRecord;
        const idEquipo = reglas.aTextoId(registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }));
        if (!idEquipo) {
            window.alert(MENSAJES.MSG_01);
            return false;
        }
        if (!estado.equipo) {
            window.alert(config.formatearMensaje(MENSAJES.MSG_05, { equipo: estado.nombreEquipo || idEquipo }));
            return false;
        }
        if (!reglas.esSubsidiariaCompatible(estado.equipo.idSubsidiaria, registro.getValue({ fieldId: ESTANDAR.FLD_SUBSIDIARIA }))) {
            window.alert(config.formatearMensaje(MENSAJES.MSG_06, { equipo: estado.nombreEquipo }));
            return false;
        }
        const aValidar = reglas.lineasAValidar({
            esCreacion: !esEdicion(),
            equipoCambio: reglas.equipoCambio(estado.idEquipoOriginal, idEquipo),
            lineasActuales: leerLineasActuales(registro),
            lineasOriginales: lineasOriginalesComoLista()
        });
        if (!aValidar.length) {
            return true;
        }
        if (!estado.cargaValida) {
            window.alert(config.formatearMensaje(MENSAJES.MSG_05, { equipo: estado.nombreEquipo }));
            return false;
        }
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

    // ---------------------------------------------------------------- apoyo

    function esEdicion() {
        return estado.modo === 'edit';
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
            return;
        }
        estado.equipo = resultado.equipo;
        estado.nombreEquipo = (resultado.equipo && resultado.equipo.nombre) || textoCampo || resultado.nombreEquipo;
        estado.articulos = [];
        estado.permitidos = new Map();
        estado.cargaValida = false;
        window.alert(config.formatearMensaje(MENSAJES.MSG_05, { equipo: estado.nombreEquipo }));
    }

    function limpiarEstado() {
        estado.equipo = null;
        estado.nombreEquipo = '';
        estado.articulos = [];
        estado.permitidos = new Map();
        estado.cargaValida = true;
    }

    /** Elimina la línea en captura y todas las líneas confirmadas, de la última a la primera. */
    function eliminarTodasLasLineas(registro) {
        try {
            registro.cancelLine({ sublistId: SUBLISTA });
        } catch (e) {
            // Sin línea en captura.
        }
        for (let i = registro.getLineCount({ sublistId: SUBLISTA }) - 1; i >= 0; i--) {
            registro.removeLine({ sublistId: SUBLISTA, line: i });
        }
    }

    function obtenerCampoAuxiliar(registro) {
        try {
            const linea = registro.getCurrentSublistIndex({ sublistId: SUBLISTA });
            return registro.getSublistField({ sublistId: SUBLISTA, fieldId: IDS.FLD_COL_AUX, line: linea });
        } catch (e) {
            return null;
        }
    }

    function limpiarOpcionesLineaActual(registro) {
        const campo = obtenerCampoAuxiliar(registro);
        if (campo) {
            campo.removeSelectOption({ value: null });
        }
    }

    /** Opción vacía más los artículos del estado; preselecciona el artículo nativo sin disparar fieldChanged. */
    function poblarOpcionesLineaActual(registro) {
        const campo = obtenerCampoAuxiliar(registro);
        if (!campo) {
            return;
        }
        campo.removeSelectOption({ value: null });
        campo.insertSelectOption({ value: VALOR_OPCION_VACIA, text: ' ' });
        estado.articulos.forEach((articulo) => {
            campo.insertSelectOption({ value: articulo.id, text: articulo.etiqueta });
        });
        const idArticulo = reglas.aTextoId(registro.getCurrentSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO }));
        if (idArticulo && estado.permitidos.has(idArticulo)) {
            registro.setCurrentSublistValue({
                sublistId: SUBLISTA,
                fieldId: IDS.FLD_COL_AUX,
                value: idArticulo,
                ignoreFieldChange: true
            });
        }
    }

    function leerLineasActuales(registro) {
        const total = registro.getLineCount({ sublistId: SUBLISTA });
        const lineas = [];
        for (let i = 0; i < total; i++) {
            const idArticulo = reglas.aTextoId(leerValorLinea(registro, ESTANDAR.COL_ARTICULO, i));
            lineas.push({
                clave: reglas.aTextoId(leerValorLinea(registro, ESTANDAR.COL_CLAVE_LINEA, i)),
                numero: i + 1,
                idArticulo,
                textoArticulo: registro.getSublistText({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO, line: i }) || idArticulo
            });
        }
        return lineas;
    }

    function leerValorLinea(registro, fieldId, linea) {
        return registro.getSublistValue({ sublistId: SUBLISTA, fieldId, line: linea });
    }

    return {
        pageInit,
        validateField,
        fieldChanged,
        lineInit,
        validateLine,
        saveRecord
    };
});
