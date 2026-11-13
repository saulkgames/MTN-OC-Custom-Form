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

    const { IDS, ESTANDAR, MENSAJES, RUTAS, DIAGNOSTICO } = config;
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
        reinicioPorSubsidiaria: false,
        idArticuloTemporal: '',
        insertandoLineaTemporal: false
    };

    // Distingue "módulo no cargado" de "módulo cargado pero pageInit no ejecutado".
    diagnostico('módulo cargado', { archivo: RUTAS.ARCHIVO_CS });

    // ================================================================ pageInit

    function pageInit(contexto) {
        const registro = contexto.currentRecord;
        estado.modo = contexto.mode;
        estado.idEquipo = reglas.aTextoId(registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }));
        estado.idEquipoOriginal = esEdicion() ? estado.idEquipo : '';
        try {
            // Campo oculto publicado por el UE solo si el parámetro del artículo temporal tiene valor.
            estado.idArticuloTemporal = reglas.aTextoId(registro.getValue({ fieldId: IDS.FLD_ITEM_TEMPORAL }));
        } catch (e) {
            estado.idArticuloTemporal = '';
        }
        diagnostico('pageInit', { modo: estado.modo, equipo: estado.idEquipo, articuloTemporal: estado.idArticuloTemporal });

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

        if (!reglas.esVacio(estado.idEquipo)) {
            cargarSeleccion(registro, estado.idEquipo);
            asegurarLineaTemporal(registro);
        }
        poblarOpcionesLineaActual(registro);
    }

    // ================================================================ validateField

    /** RN-05. Confirmación síncrona antes de cambiar el equipo si hay líneas reales. */
    function validateField(contexto) {
        if (contexto.sublistId || contexto.fieldId !== IDS.FLD_BODY_EQUIPO || estado.reinicioPorSubsidiaria) {
            return true;
        }
        const registro = contexto.currentRecord;
        if (!reglas.equipoCambio(estado.idEquipo, registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }))) {
            return true;
        }
        // La línea temporal no cuenta como línea capturada.
        let lineasReales = 0;
        const total = registro.getLineCount({ sublistId: SUBLISTA });
        for (let i = 0; i < total; i++) {
            if (!esLineaTemporal(leerValorLinea(registro, ESTANDAR.COL_ARTICULO, i))) {
                lineasReales++;
            }
        }
        if (!reglas.requiereConfirmacion(lineasReales)) {
            return true;
        }
        return window.confirm(MENSAJES.MSG_02);
    }

    // ================================================================ fieldChanged

    function fieldChanged(contexto) {
        const registro = contexto.currentRecord;

        // Equipo: reinicio de líneas y opciones (RN-05).
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
            return;
        }

        // Columna auxiliar: asigna el artículo nativo con sourcing síncrono, o lo limpia.
        if (contexto.sublistId === SUBLISTA && contexto.fieldId === IDS.FLD_COL_AUX) {
            const valor = reglas.aTextoId(registro.getCurrentSublistValue({ sublistId: SUBLISTA, fieldId: IDS.FLD_COL_AUX }));
            if (valor) {
                registro.setCurrentSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO, value: valor, forceSyncSourcing: true });
                return;
            }
            if (!reglas.esVacio(registro.getCurrentSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO }))) {
                registro.setCurrentSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO, value: '' });
            }
        }
    }

    // ================================================================ postSourcing

    /** Tras el sourcing del proveedor, inserta la línea temporal si ya hay equipo y no hay líneas. */
    function postSourcing(contexto) {
        if (!contexto.sublistId && contexto.fieldId === ESTANDAR.FLD_PROVEEDOR) {
            asegurarLineaTemporal(contexto.currentRecord);
        }
    }

    // ================================================================ lineInit

    /** Opciones de la línea desde el estado de la página; nunca ejecuta la búsqueda. */
    function lineInit(contexto) {
        if (contexto.sublistId === SUBLISTA) {
            poblarOpcionesLineaActual(contexto.currentRecord);
        }
    }

    // ================================================================ validateLine

    function validateLine(contexto) {
        if (contexto.sublistId !== SUBLISTA) {
            return true;
        }
        const registro = contexto.currentRecord;
        const idArticulo = reglas.aTextoId(registro.getCurrentSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO }));

        // D-H: la línea temporal se acepta sin validar; se quita al guardar.
        if (estado.insertandoLineaTemporal || esLineaTemporal(idArticulo)) {
            return true;
        }
        if (reglas.esVacio(registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }))) {
            window.alert(MENSAJES.MSG_01);
            return false;
        }
        if (!estado.cargaValida) {
            window.alert(config.formatearMensaje(MENSAJES.MSG_05, { equipo: estado.nombreEquipo }));
            return false;
        }

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

    /** Quita la línea temporal y replica el orden de validación del servidor. */
    function saveRecord(contexto) {
        const registro = contexto.currentRecord;

        // 1. D-H: quitar las líneas temporales. Si no quedan líneas reales, NetSuite rechaza con su mensaje nativo (D-J).
        for (let i = registro.getLineCount({ sublistId: SUBLISTA }) - 1; i >= 0; i--) {
            if (esLineaTemporal(leerValorLinea(registro, ESTANDAR.COL_ARTICULO, i))) {
                registro.removeLine({ sublistId: SUBLISTA, line: i });
                diagnostico('línea temporal quitada al guardar', { linea: i });
            }
        }

        // 2. RN-06: equipo obligatorio en el formulario exclusivo.
        const idEquipo = reglas.aTextoId(registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }));
        if (!idEquipo) {
            window.alert(MENSAJES.MSG_01);
            return false;
        }

        // 3. RN-07: equipo existente.
        if (!estado.equipo) {
            window.alert(config.formatearMensaje(MENSAJES.MSG_05, { equipo: estado.nombreEquipo || idEquipo }));
            return false;
        }

        // 4. RN-08.
        if (!reglas.esSubsidiariaCompatible(estado.equipo.idSubsidiaria, registro.getValue({ fieldId: ESTANDAR.FLD_SUBSIDIARIA }))) {
            window.alert(config.formatearMensaje(MENSAJES.MSG_06, { equipo: estado.nombreEquipo }));
            return false;
        }

        // 5. RN-04: líneas a validar, numeradas desde 1 sin la línea temporal.
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

        // 6. RN-07: búsqueda válida.
        if (!estado.cargaValida) {
            window.alert(config.formatearMensaje(MENSAJES.MSG_05, { equipo: estado.nombreEquipo }));
            return false;
        }

        // 7. RN-03.
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

    // ================================================================ funciones con dos o más llamadas

    /** RN-05 tras confirmar: elimina líneas y opciones, carga las del nuevo equipo e inserta la línea temporal. */
    function alCambiarEquipo(registro) {
        const idNuevo = reglas.aTextoId(registro.getValue({ fieldId: IDS.FLD_BODY_EQUIPO }));
        if (!reglas.equipoCambio(estado.idEquipo, idNuevo)) {
            estado.reinicioPorSubsidiaria = false;
            return;
        }

        // Eliminar la línea en captura y todas las confirmadas, de la última a la primera (incluye la temporal).
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
            asegurarLineaTemporal(registro);
        }
        poblarOpcionesLineaActual(registro);
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

    /**
     * D-H. Inserta una línea confirmada con el artículo temporal, para que la columna auxiliar
     * pueda cargarse a través de una línea existente. Se quita en saveRecord y en el servidor.
     * Requiere: ID temporal, equipo cargado con éxito, proveedor y cero líneas.
     */
    function asegurarLineaTemporal(registro) {
        if (!estado.idArticuloTemporal || reglas.esVacio(estado.idEquipo) || !estado.cargaValida) {
            return;
        }
        if (registro.getLineCount({ sublistId: SUBLISTA }) > 0) {
            return;
        }
        if (reglas.esVacio(registro.getValue({ fieldId: ESTANDAR.FLD_PROVEEDOR }))) {
            diagnostico('línea temporal pendiente: falta proveedor', {});
            return;
        }
        estado.insertandoLineaTemporal = true;
        try {
            registro.selectNewLine({ sublistId: SUBLISTA });
            registro.setCurrentSublistValue({
                sublistId: SUBLISTA,
                fieldId: ESTANDAR.COL_ARTICULO,
                value: estado.idArticuloTemporal,
                forceSyncSourcing: true
            });
            registro.commitLine({ sublistId: SUBLISTA });
            if (registro.getLineCount({ sublistId: SUBLISTA }) > 0) {
                diagnostico('línea temporal agregada', { articulo: estado.idArticuloTemporal });
            } else {
                diagnostico('línea temporal no confirmada por NetSuite', { articulo: estado.idArticuloTemporal });
                registro.cancelLine({ sublistId: SUBLISTA });
            }
        } catch (e) {
            diagnostico('línea temporal no agregada', describirError(e));
            try {
                registro.cancelLine({ sublistId: SUBLISTA });
            } catch (ignorado) {
                // Sin línea en captura.
            }
        } finally {
            estado.insertandoLineaTemporal = false;
        }
    }

    /**
     * Opción vacía más los artículos del estado en la columna auxiliar de la línea en captura,
     * y preselección del artículo nativo sin disparar fieldChanged.
     */
    function poblarOpcionesLineaActual(registro) {
        // 1. Obtener el campo: primero la línea actual; si falla, la línea 0.
        //    getSublistField puede fallar en una línea nueva sin confirmar (SSS_INVALID_SUBLIST_OPERATION).
        const total = registro.getLineCount({ sublistId: SUBLISTA });
        let indiceActual = null;
        try {
            indiceActual = registro.getCurrentSublistIndex({ sublistId: SUBLISTA });
        } catch (e) {
            diagnostico('campo auxiliar: índice actual no disponible', describirError(e));
        }
        const intentos = [];
        if (indiceActual !== null && indiceActual !== undefined) {
            intentos.push({ estrategia: 'línea actual', linea: indiceActual });
        }
        if (total > 0 && indiceActual !== 0) {
            intentos.push({ estrategia: 'línea 0', linea: 0 });
        }
        let campo = null;
        let estrategiaUsada = '';
        for (let i = 0; i < intentos.length && !campo; i++) {
            const datosIntento = { linea: intentos[i].linea, indiceActual, total };
            try {
                campo = registro.getSublistField({ sublistId: SUBLISTA, fieldId: IDS.FLD_COL_AUX, line: intentos[i].linea });
                if (campo) {
                    estrategiaUsada = intentos[i].estrategia;
                } else {
                    diagnostico('campo auxiliar: ' + intentos[i].estrategia + ' devolvió nulo', datosIntento);
                }
            } catch (e) {
                diagnostico('campo auxiliar: ' + intentos[i].estrategia + ' falló', Object.assign(datosIntento, describirError(e)));
            }
        }
        if (!campo) {
            diagnostico('campo auxiliar no disponible', { indiceActual, total });
            return;
        }

        // 2. Reemplazar las opciones.
        campo.removeSelectOption({ value: null });
        try {
            campo.insertSelectOption({ value: VALOR_OPCION_VACIA, text: ' ' });
        } catch (e) {
            diagnostico('opción vacía no insertada', describirError(e));
        }
        estado.articulos.forEach((articulo) => {
            campo.insertSelectOption({ value: articulo.id, text: articulo.etiqueta });
        });
        diagnostico('opciones insertadas', { estrategia: estrategiaUsada, opciones: estado.articulos.length });

        // 3. Preseleccionar el artículo nativo de la línea, si está en el listado.
        const idArticulo = reglas.aTextoId(registro.getCurrentSublistValue({ sublistId: SUBLISTA, fieldId: ESTANDAR.COL_ARTICULO }));
        if (idArticulo && estado.permitidos.has(idArticulo)) {
            registro.setCurrentSublistValue({ sublistId: SUBLISTA, fieldId: IDS.FLD_COL_AUX, value: idArticulo, ignoreFieldChange: true });
        }
    }

    function esLineaTemporal(idArticulo) {
        return estado.idArticuloTemporal !== '' && estado.idArticuloTemporal === reglas.aTextoId(idArticulo);
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

    function describirError(e) {
        return { error: (e && (e.name || e.type)) || 'desconocido', mensaje: (e && e.message) || String(e) };
    }

    return {
        pageInit,
        validateField,
        fieldChanged,
        postSourcing,
        lineInit,
        validateLine,
        saveRecord
    };
});
