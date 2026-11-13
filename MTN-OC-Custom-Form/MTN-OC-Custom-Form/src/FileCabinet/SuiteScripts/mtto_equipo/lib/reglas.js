/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 *
 * Reglas de negocio puras. No importa módulos N/ ni lee registros.
 * Las usan el User Event (al guardar), el Client Script (en pantalla) y lib/datos.js.
 *
 * Formas de datos:
 *   FilaBusqueda    { id: string, etiqueta: string, excluir: * }
 *   Articulo        { id: string, etiqueta: string }
 *   LineaActual     { clave: string, numero: number, idArticulo: string, textoArticulo: string }
 *   LineaOriginal   { clave: string, idArticulo: string, cantidadRecibida: number, cantidadFacturada: number }
 */
define([], () => {

    /** Valores que RN-02 considera verdaderos en la columna de exclusión (sin distinguir mayúsculas). */
    const VALORES_VERDADEROS = Object.freeze(['t', 'true', '1', 'sí', 'si']);

    /**
     * Indica si un valor está vacío (nulo, indefinido, cadena en blanco o arreglo vacío).
     * @param {*} valor
     * @returns {boolean}
     */
    function esVacio(valor) {
        if (valor === null || valor === undefined) {
            return true;
        }
        if (Array.isArray(valor)) {
            return valor.length === 0;
        }
        return String(valor).trim() === '';
    }

    /**
     * Normaliza un ID a cadena; vacío si no tiene valor.
     * @param {*} valor
     * @returns {string}
     */
    function aTextoId(valor) {
        return esVacio(valor) ? '' : String(valor).trim();
    }

    /**
     * Convierte a número; 0 si no es numérico.
     * @param {*} valor
     * @returns {number}
     */
    function aNumero(valor) {
        const numero = parseFloat(valor);
        return isNaN(numero) ? 0 : numero;
    }

    /**
     * RN-02. Interpreta el valor de la columna de exclusión.
     * @param {*} valor
     * @returns {boolean}
     */
    function esVerdadero(valor) {
        if (valor === true) {
            return true;
        }
        if (esVacio(valor) || valor === false) {
            return false;
        }
        return VALORES_VERDADEROS.indexOf(String(valor).trim().toLowerCase()) !== -1;
    }

    /**
     * RN-02. Quita filas excluidas y duplicadas por ID, y ordena por etiqueta.
     * @param {Array<{id: *, etiqueta: *, excluir: *}>} filas
     * @returns {Array<{id: string, etiqueta: string}>}
     */
    function normalizarResultados(filas) {
        const vistos = {};
        const articulos = [];
        (filas || []).forEach((fila) => {
            const id = aTextoId(fila && fila.id);
            if (!id || esVerdadero(fila.excluir) || vistos[id]) {
                return;
            }
            vistos[id] = true;
            articulos.push({ id, etiqueta: esVacio(fila.etiqueta) ? id : String(fila.etiqueta) });
        });
        return articulos.sort(compararPorEtiqueta);
    }

    function compararPorEtiqueta(a, b) {
        return a.etiqueta.toLowerCase().localeCompare(b.etiqueta.toLowerCase());
    }

    /**
     * Indica si un ID pertenece a un conjunto de permitidos (Set, Map, arreglo u objeto).
     * @param {Set<string>|Map<string, *>|Array<string>|Object<string, *>} permitidos
     * @param {*} idArticulo
     * @returns {boolean}
     */
    function perteneceAlListado(permitidos, idArticulo) {
        const id = aTextoId(idArticulo);
        if (!id || !permitidos) {
            return false;
        }
        if (typeof permitidos.has === 'function') {
            return permitidos.has(id);
        }
        if (Array.isArray(permitidos)) {
            return permitidos.map(aTextoId).indexOf(id) !== -1;
        }
        return Object.prototype.hasOwnProperty.call(permitidos, id);
    }

    /**
     * RN-03. Devuelve las líneas cuyo artículo no pertenece al listado del equipo.
     * @param {Set<string>|Map<string, *>|Array<string>|Object<string, *>} permitidos
     * @param {Array<{numero: number, idArticulo: *, textoArticulo: string}>} lineas
     * @returns {Array<{numero: number, idArticulo: *, textoArticulo: string}>}
     */
    function lineasFueraDeListado(permitidos, lineas) {
        return (lineas || []).filter((linea) => !perteneceAlListado(permitidos, linea.idArticulo));
    }

    /**
     * RN-04. Selecciona las líneas actuales que deben validarse.
     * Creación o copia: todas. Edición con equipo cambiado: todas.
     * Edición sin cambio de equipo: líneas nuevas (sin clave original) o con artículo distinto al original.
     * @param {{esCreacion: boolean, equipoCambio: boolean, lineasActuales: Array, lineasOriginales: Array}} entrada
     * @returns {Array}
     */
    function lineasAValidar(entrada) {
        const actuales = entrada.lineasActuales || [];
        if (entrada.esCreacion || entrada.equipoCambio) {
            return actuales.slice();
        }
        const articuloOriginalPorClave = {};
        (entrada.lineasOriginales || []).forEach((linea) => {
            const clave = aTextoId(linea.clave);
            if (clave) {
                articuloOriginalPorClave[clave] = aTextoId(linea.idArticulo);
            }
        });
        return actuales.filter((linea) => {
            const clave = aTextoId(linea.clave);
            if (!clave || !Object.prototype.hasOwnProperty.call(articuloOriginalPorClave, clave)) {
                return true;
            }
            return articuloOriginalPorClave[clave] !== aTextoId(linea.idArticulo);
        });
    }

    /**
     * Indica si el equipo cambió entre el valor original y el actual (incluye pasar a vacío).
     * @param {*} idEquipoOriginal
     * @param {*} idEquipoActual
     * @returns {boolean}
     */
    function equipoCambio(idEquipoOriginal, idEquipoActual) {
        return aTextoId(idEquipoOriginal) !== aTextoId(idEquipoActual);
    }

    /**
     * RN-05. Verdadero si hay líneas y el cambio de equipo requiere confirmación.
     * @param {number} numeroLineas
     * @returns {boolean}
     */
    function requiereConfirmacion(numeroLineas) {
        return aNumero(numeroLineas) > 0;
    }

    /**
     * RN-08. Subsidiarias iguales y no vacías.
     * @param {*} idSubsidiariaEquipo
     * @param {*} idSubsidiariaTransaccion
     * @returns {boolean}
     */
    function esSubsidiariaCompatible(idSubsidiariaEquipo, idSubsidiariaTransaccion) {
        const equipo = aTextoId(idSubsidiariaEquipo);
        const transaccion = aTextoId(idSubsidiariaTransaccion);
        return equipo !== '' && transaccion !== '' && equipo === transaccion;
    }

    /**
     * RN-10. Falso si alguna línea tiene cantidad recibida o facturada mayor que cero.
     * @param {Array<{cantidadRecibida: *, cantidadFacturada: *}>} lineas
     * @returns {boolean}
     */
    function equipoEditable(lineas) {
        return !(lineas || []).some((linea) =>
            aNumero(linea.cantidadRecibida) > 0 || aNumero(linea.cantidadFacturada) > 0);
    }

    return {
        esVacio,
        aTextoId,
        esVerdadero,
        normalizarResultados,
        perteneceAlListado,
        lineasFueraDeListado,
        lineasAValidar,
        equipoCambio,
        requiereConfirmacion,
        esSubsidiariaCompatible,
        equipoEditable
    };
});
