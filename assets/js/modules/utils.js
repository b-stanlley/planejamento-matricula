export function normalizarCodigo(codigo) {
    return String(codigo || '')
        .replace(/[\s\u200B-\u200D]/g, '')
        .trim()
        .toUpperCase();
}

export function obterNumeroPeriodo(nomePeriodo) {
    const match = nomePeriodo.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}

export function obterTodosCodigosGrade(materias) {
    const codigos = new Set();
    if (!materias?.semestres) return codigos;

    materias.semestres.forEach((semestre) => {
        semestre.disciplinas.forEach((disciplina) => {
            codigos.add(normalizarCodigo(disciplina.id));
        });
    });

    return codigos;
}

export function extrairCodigosSecaoHistorico(textoCompleto, tituloSecao, delimitadores, codigosGrade) {
    const inicio = textoCompleto.indexOf(tituloSecao);
    if (inicio === -1) return [];

    let trecho = textoCompleto.substring(inicio);
    let fim = -1;

    delimitadores.forEach((delimitador) => {
        const indice = trecho.indexOf(delimitador);
        if (indice !== -1 && (fim === -1 || indice < fim)) {
            fim = indice;
        }
    });

    if (fim !== -1) {
        trecho = trecho.substring(0, fim);
    }

    const capturados = trecho.match(/\b[A-Z]{3,5}[\s\u200B-\u200D]*\d{2,3}[A-Z]?\b/g) || [];
    const normalizados = capturados
        .map((codigo) => normalizarCodigo(codigo))
        .filter((codigo) => codigosGrade.has(codigo));

    return Array.from(new Set(normalizados));
}

export function encontrarDisciplina(materias, disciplinaId) {
    const codigo = normalizarCodigo(disciplinaId);

    for (const semestre of materias?.semestres || []) {
        for (const disciplina of semestre.disciplinas) {
            if (normalizarCodigo(disciplina.id) === codigo) {
                return disciplina;
            }
        }
    }

    return null;
}

export function buscarTodosPreRequisitos(materias, disciplinaId) {
    const encontrados = new Set();

    function buscar(codigoAtual) {
        const codigoNormalizado = normalizarCodigo(codigoAtual);
        if (!codigoNormalizado || encontrados.has(codigoNormalizado)) return;

        encontrados.add(codigoNormalizado);
        const disciplina = encontrarDisciplina(materias, codigoNormalizado);
        if (!disciplina) return;

        (disciplina.requisitosTotais || []).forEach(buscar);
        (disciplina.requisitosParciais || []).forEach(buscar);
    }

    buscar(disciplinaId);
    encontrados.delete(normalizarCodigo(disciplinaId));
    return Array.from(encontrados);
}

export function buscarPreRequisitosPendentes(materias, disciplinaId, pendentes) {
    const pendentesSet = new Set((pendentes || []).map((codigo) => normalizarCodigo(codigo)));
    const encontrados = new Set();
    const codigoRaiz = normalizarCodigo(disciplinaId);

    function buscar(codigoAtual) {
        const codigoNormalizado = normalizarCodigo(codigoAtual);
        if (!codigoNormalizado || encontrados.has(codigoNormalizado) || !pendentesSet.has(codigoNormalizado)) {
            return;
        }

        encontrados.add(codigoNormalizado);
        const disciplina = encontrarDisciplina(materias, codigoNormalizado);
        if (!disciplina) return;

        (disciplina.requisitosTotais || []).forEach((codigo) => {
            if (pendentesSet.has(normalizarCodigo(codigo))) {
                buscar(codigo);
            }
        });

        (disciplina.requisitosParciais || []).forEach((codigo) => {
            if (pendentesSet.has(normalizarCodigo(codigo))) {
                buscar(codigo);
            }
        });
    }

    if (pendentesSet.has(codigoRaiz)) {
        buscar(codigoRaiz);
    }

    encontrados.delete(codigoRaiz);
    return Array.from(encontrados);
}