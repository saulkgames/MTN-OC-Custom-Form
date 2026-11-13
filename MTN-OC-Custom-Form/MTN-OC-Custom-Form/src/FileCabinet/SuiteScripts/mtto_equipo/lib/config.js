/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 *
 * Configuración única de la solución "Equipo de transporte en Orden de compra".
 * Concentra IDs, etiquetas, límites, mensajes y códigos de error.
 * No importa módulos N/; lo usan el User Event, el Client Script y los módulos de lib/.
 */
define([], () => {

    /** IDs de objetos creados por la solución (prefijo _sads_mtn_). */
    const IDS = Object.freeze({
        REC_EQUIPO: 'customrecord_sads_mtn_equipo',
        FLD_EQ_BUSQUEDA: 'custrecord_sads_mtn_eq_busqueda',
        FLD_EQ_SUBSIDIARIA: 'custrecord_sads_mtn_eq_subsidiaria',
        FLD_BODY_EQUIPO: 'custbody_sads_mtn_equipo',
        FLD_COL_AUX: 'custpage_sads_mtn_articulo',
        SCRIPT_UE: 'customscript_sads_mtn_ue_oc',
        DEPLOY_UE: 'customdeploy_sads_mtn_ue_oc',
        PARAM_FORM: 'custscript_sads_mtn_form_id',
        PARAM_ITEM_TEMPORAL: 'custscript_sads_mtn_item_temporal',
        FLD_ITEM_TEMPORAL: 'custpage_sads_mtn_item_temporal'
    });

    /** IDs estándar de NetSuite usados por la solución. Supuesto S-11: verificar en el paso 0 del despliegue. */
    const ESTANDAR = Object.freeze({
        FLD_FORMULARIO: 'customform',
        FLD_SUBSIDIARIA: 'subsidiary',
        FLD_PROVEEDOR: 'entity',
        SUBLISTA_ARTICULOS: 'item',
        COL_ARTICULO: 'item',
        COL_CLAVE_LINEA: 'lineuniquekey',
        COL_CANT_RECIBIDA: 'quantityreceived',
        COL_CANT_FACTURADA: 'quantitybilled',
        FLD_EQ_NOMBRE: 'name',
        FLD_EQ_INACTIVO: 'isinactive',
        PARAM_SOLICITUD_FORMULARIO: 'cf'
    });

    const ETIQUETAS = Object.freeze({
        LBL_REC_EQUIPO: 'Equipo de transporte',
        LBL_EQUIPO: 'Equipo de transporte',
        LBL_COL_AUX: 'Artículo del equipo',
        LBL_ITEM_TEMPORAL: 'Artículo de línea temporal',
        ETIQUETA_COL_EXCLUIR: 'MTTO_EXCLUIR'
    });

    const LIMITES = Object.freeze({
        MAX_RESULTADOS_BUSQUEDA: 1000
    });

    /** Ruta del Client Script relativa al User Event. */
    const RUTAS = Object.freeze({
        ARCHIVO_CS: './cs_sads_mtn_oc.js'
    });

    /**
     * Diagnóstico del Client Script en la consola del navegador (F12).
     * No afecta al usuario. Poner ACTIVO en false y volver a desplegar para apagarlo.
     */
    const DIAGNOSTICO = Object.freeze({
        ACTIVO: true,
        PREFIJO: '[sads_mtn]'
    });

    const MENSAJES = Object.freeze({
        MSG_01: 'Seleccione un equipo de transporte antes de capturar artículos.',
        MSG_02: 'Al cambiar el equipo se eliminarán todas las líneas capturadas. ¿Desea continuar?',
        MSG_03: 'El artículo [articulo] no pertenece al listado del equipo [equipo].',
        MSG_04: 'Líneas con artículos fuera del listado del equipo [equipo]: [lineas].',
        MSG_05: 'La búsqueda configurada para el equipo [equipo] no existe, no es accesible o no devuelve artículos. Contacte al administrador.',
        MSG_06: 'El equipo [equipo] no pertenece a la subsidiaria de la orden.',
        MSG_07: 'El equipo no puede cambiarse porque la orden tiene líneas recibidas o facturadas.',
        MSG_08: 'El equipo solo puede cambiarse desde el formulario de la orden.'
    });

    const CODIGOS = Object.freeze({
        ARTICULO_FUERA_DE_LISTADO: 'MTTO_ARTICULO_FUERA_DE_LISTADO',
        EQUIPO_NO_ENCONTRADO: 'MTTO_EQUIPO_NO_ENCONTRADO',
        BUSQUEDA_INVALIDA: 'MTTO_BUSQUEDA_INVALIDA',
        SUBSIDIARIA_INCOMPATIBLE: 'MTTO_SUBSIDIARIA_INCOMPATIBLE',
        EQUIPO_NO_EDITABLE: 'MTTO_EQUIPO_NO_EDITABLE'
    });

    /** Mensaje por defecto de cada código (sección 12 del prompt). RN-11 usa MSG_08 de forma explícita. */
    const MENSAJE_POR_CODIGO = Object.freeze({
        [CODIGOS.ARTICULO_FUERA_DE_LISTADO]: MENSAJES.MSG_04,
        [CODIGOS.EQUIPO_NO_ENCONTRADO]: MENSAJES.MSG_05,
        [CODIGOS.BUSQUEDA_INVALIDA]: MENSAJES.MSG_05,
        [CODIGOS.SUBSIDIARIA_INCOMPATIBLE]: MENSAJES.MSG_06,
        [CODIGOS.EQUIPO_NO_EDITABLE]: MENSAJES.MSG_07
    });

    /**
     * Sustituye las llaves [nombre] de una plantilla con los datos recibidos.
     * Una llave sin dato se conserva tal cual.
     * @param {string} plantilla
     * @param {Object<string, *>} [datos]
     * @returns {string}
     */
    function formatearMensaje(plantilla, datos) {
        const valores = datos || {};
        return String(plantilla).replace(/\[(\w+)\]/g, (llave, nombre) => {
            const valor = valores[nombre];
            return valor === undefined || valor === null ? llave : String(valor);
        });
    }

    return {
        IDS,
        ESTANDAR,
        ETIQUETAS,
        LIMITES,
        RUTAS,
        DIAGNOSTICO,
        MENSAJES,
        CODIGOS,
        MENSAJE_POR_CODIGO,
        formatearMensaje
    };
});
