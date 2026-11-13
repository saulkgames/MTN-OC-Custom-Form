/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 *
 * Acceso a datos con N/search. Funciona en cliente y en servidor.
 * Lee el registro Equipo y la búsqueda guardada de artículos, y arma la selección (UC-01).
 * No usa N/query, SuiteQL ni N/record (prohibición 5 del prompt).
 *
 * Gobernanza por llamada a prepararSeleccion: lectura del equipo 1 + carga de búsqueda 5 + lectura de rango 10 = 16.
 */
define(['N/search', './reglas', './config'], (search, reglas, config) => {

    const { IDS, ESTANDAR, ETIQUETAS, LIMITES, CODIGOS } = config;

    /**
     * Lee el registro Equipo en una sola lectura de campos (1 unidad).
     * @param {*} idEquipo ID interno del equipo
     * @returns {{id: string, nombre: string, idBusqueda: string, idSubsidiaria: string, inactivo: boolean}|null}
     *          Nulo si el registro no existe o no es accesible.
     */
    function obtenerEquipo(idEquipo) {
        const id = reglas.aTextoId(idEquipo);
        if (!id) {
            return null;
        }
        let valores;
        try {
            valores = search.lookupFields({
                type: IDS.REC_EQUIPO,
                id,
                columns: [ESTANDAR.FLD_EQ_NOMBRE, IDS.FLD_EQ_BUSQUEDA, IDS.FLD_EQ_SUBSIDIARIA, ESTANDAR.FLD_EQ_INACTIVO]
            });
        } catch (e) {
            return null;
        }
        if (!valores || Object.keys(valores).length === 0) {
            return null;
        }
        return {
            id,
            nombre: reglas.aTextoId(valores[ESTANDAR.FLD_EQ_NOMBRE]),
            idBusqueda: reglas.aTextoId(valores[IDS.FLD_EQ_BUSQUEDA]),
            idSubsidiaria: valorDeSeleccion(valores[IDS.FLD_EQ_SUBSIDIARIA]),
            inactivo: valores[ESTANDAR.FLD_EQ_INACTIVO] === true
        };
    }

    /** lookupFields devuelve los campos de selección como [{ value, text }]. */
    function valorDeSeleccion(valor) {
        if (Array.isArray(valor)) {
            return valor.length ? reglas.aTextoId(valor[0].value) : '';
        }
        return reglas.aTextoId(valor);
    }

    /**
     * Carga la búsqueda guardada por su ID de script y lee sus filas en una sola lectura (15 unidades).
     * Lanza error si la búsqueda no existe o no es accesible.
     * No valida el tipo de búsqueda (D-S): las búsquedas de los equipos ya filtran por tipo de artículo.
     * @param {string} idBusqueda ID de script de la búsqueda
     * @param {{bitacora?: function(string, string): void}} [opciones] bitacora solo se inyecta en servidor
     * @returns {Array<{id: string, etiqueta: string, excluir: *}>}
     */
    function leerArticulosBusqueda(idBusqueda, opciones) {
        const bitacora = opciones && typeof opciones.bitacora === 'function' ? opciones.bitacora : null;
        const busqueda = search.load({ id: idBusqueda });
        const columnas = busqueda.columns || [];
        if (!columnas.length) {
            throw new Error('La búsqueda ' + idBusqueda + ' no tiene columnas.');
        }
        const columnaEtiqueta = columnas[0];
        const columnaExcluir = buscarColumnaExcluir(columnas);
        const maximo = LIMITES.MAX_RESULTADOS_BUSQUEDA;
        const resultados = busqueda.run().getRange({ start: 0, end: maximo }) || [];

        if (resultados.length >= maximo && bitacora) {
            bitacora('Búsqueda en el límite de filas',
                'La búsqueda ' + idBusqueda + ' devolvió ' + maximo + ' filas; puede haber artículos no leídos.');
        }
        return resultados.map((resultado) => ({
            id: reglas.aTextoId(resultado.id),
            etiqueta: etiquetaDeResultado(resultado, columnaEtiqueta),
            excluir: columnaExcluir ? resultado.getValue(columnaExcluir) : null
        }));
    }

    function buscarColumnaExcluir(columnas) {
        const etiqueta = ETIQUETAS.ETIQUETA_COL_EXCLUIR.toUpperCase();
        return columnas.find((columna) =>
            !reglas.esVacio(columna.label) && String(columna.label).trim().toUpperCase() === etiqueta) || null;
    }

    function etiquetaDeResultado(resultado, columna) {
        let texto = null;
        try {
            texto = resultado.getText(columna);
        } catch (e) {
            texto = null;
        }
        if (reglas.esVacio(texto)) {
            texto = resultado.getValue(columna);
        }
        return reglas.esVacio(texto) ? reglas.aTextoId(resultado.id) : String(texto);
    }

    /**
     * UC-01. Obtiene los artículos que el equipo puede comprar (RN-01, RN-02, RN-07).
     * @param {*} idEquipo ID interno del equipo
     * @param {{equipo?: Object, bitacora?: function(string, string): void}} [opciones]
     *        equipo: registro ya leído, para no repetir la lectura (gobernanza).
     * @returns {{exito: true, equipo: Object, articulos: Array<{id: string, etiqueta: string}>}
     *          |{exito: false, codigo: string, nombreEquipo: string, equipo: Object|null, detalle: string}}
     */
    function prepararSeleccion(idEquipo, opciones) {
        const ajustes = opciones || {};
        const equipo = ajustes.equipo || obtenerEquipo(idEquipo);
        if (!equipo) {
            return falla(CODIGOS.EQUIPO_NO_ENCONTRADO, reglas.aTextoId(idEquipo), null, 'Equipo inexistente o inaccesible.');
        }
        const nombreEquipo = equipo.nombre || equipo.id;
        if (reglas.esVacio(equipo.idBusqueda)) {
            return falla(CODIGOS.BUSQUEDA_INVALIDA, nombreEquipo, equipo, 'El equipo no tiene búsqueda configurada.');
        }
        let filas;
        try {
            filas = leerArticulosBusqueda(equipo.idBusqueda, ajustes);
        } catch (e) {
            return falla(CODIGOS.BUSQUEDA_INVALIDA, nombreEquipo, equipo, (e && e.message) || String(e));
        }
        const articulos = reglas.normalizarResultados(filas);
        if (!articulos.length) {
            return falla(CODIGOS.BUSQUEDA_INVALIDA, nombreEquipo, equipo, 'La búsqueda no devolvió filas válidas.');
        }
        return { exito: true, equipo, articulos };
    }

    function falla(codigo, nombreEquipo, equipo, detalle) {
        return { exito: false, codigo, nombreEquipo, equipo, detalle };
    }

    return {
        obtenerEquipo,
        leerArticulosBusqueda,
        prepararSeleccion
    };
});
