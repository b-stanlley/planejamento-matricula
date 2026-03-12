import { appState } from './state.js';
import { normalizarCodigo, obterNumeroPeriodo, obterTodosCodigosGrade } from './utils.js';

export function atualizarAcessoTelaPlanos() {
    const btnPlanos = document.getElementById('btn-tela-planos');
    if (!btnPlanos) return;

    btnPlanos.disabled = !appState.historicoCarregado;
    btnPlanos.classList.toggle('locked', !appState.historicoCarregado);
    btnPlanos.title = appState.historicoCarregado
        ? 'Abrir tela de planos de matricula'
        : 'Envie o historico para liberar os planos de matricula';
}

export function popularSelectPeriodos() {
    const periodoSelect = document.getElementById('periodo-atual-select');
    if (!periodoSelect || !appState.materias?.semestres) return;

    periodoSelect.innerHTML = '';

    const optionAuto = document.createElement('option');
    optionAuto.value = 'auto';
    optionAuto.textContent = 'Automatico (com base no historico)';
    periodoSelect.appendChild(optionAuto);

    appState.materias.semestres.forEach((semestre) => {
        const option = document.createElement('option');
        option.value = String(obterNumeroPeriodo(semestre.nome));
        option.textContent = semestre.nome;
        periodoSelect.appendChild(option);
    });

    periodoSelect.value = 'auto';
}

function obterDisciplinasAprovadas() {
    const aprovadas = new Set();

    if (window.materiasCursadas?.length) {
        window.materiasCursadas.forEach((codigo) => aprovadas.add(normalizarCodigo(codigo)));
        return aprovadas;
    }

    if (window.materiasPendentes?.length) {
        const pendentes = new Set(window.materiasPendentes.map((codigo) => normalizarCodigo(codigo)));
        obterTodosCodigosGrade(appState.materias).forEach((codigo) => {
            if (!pendentes.has(codigo)) {
                aprovadas.add(codigo);
            }
        });
    }

    return aprovadas;
}

export function inferirPeriodoAtual(aprovadas) {
    if (!appState.materias?.semestres?.length) return 1;

    let maisAvancadoComAprovacao = 0;
    let maisAvancadoCompleto = false;

    for (const semestre of appState.materias.semestres) {
        const numero = obterNumeroPeriodo(semestre.nome);
        const total = semestre.disciplinas.length;
        const concluidas = semestre.disciplinas.filter((disciplina) => {
            return aprovadas.has(normalizarCodigo(disciplina.id));
        }).length;

        if (concluidas > 0) {
            maisAvancadoComAprovacao = numero;
            maisAvancadoCompleto = concluidas === total;
        }
    }

    if (maisAvancadoComAprovacao === 0) return 1;

    if (maisAvancadoCompleto) {
        const ultimoSemestre = appState.materias.semestres[appState.materias.semestres.length - 1];
        const maxPeriodo = obterNumeroPeriodo(ultimoSemestre.nome);
        return Math.min(maisAvancadoComAprovacao + 1, maxPeriodo);
    }

    return maisAvancadoComAprovacao;
}

function validarPreRequisitos(disciplina, aprovadas) {
    const reqTotais = (disciplina.requisitosTotais || []).map((codigo) => normalizarCodigo(codigo));
    const reqParciais = (disciplina.requisitosParciais || []).map((codigo) => normalizarCodigo(codigo));

    const faltandoTotais = reqTotais.filter((codigo) => !aprovadas.has(codigo));
    const parcialOk = reqParciais.length === 0 || reqParciais.some((codigo) => aprovadas.has(codigo));
    const faltandoParciais = parcialOk ? [] : reqParciais;

    return {
        apta: faltandoTotais.length === 0 && faltandoParciais.length === 0,
        faltandoTotais,
        faltandoParciais
    };
}

function montarItemPlano(disciplina, aprovadas) {
    const validacao = validarPreRequisitos(disciplina, aprovadas);
    return {
        codigo: disciplina.id,
        nome: disciplina.nome,
        apta: validacao.apta,
        faltandoTotais: validacao.faltandoTotais,
        faltandoParciais: validacao.faltandoParciais,
        coRequisitos: disciplina.coRequisitos || [],
        bloqueadoPorCoReq: []
    };
}

function gerarPlanoMatriculaPadrao(periodoAtual) {
    if (!appState.materias?.semestres) return null;

    const aprovadas = obterDisciplinasAprovadas();
    const periodoInferido = inferirPeriodoAtual(aprovadas);
    const periodoUsado = periodoAtual || periodoInferido;
    const todosItens = new Map();

    appState.materias.semestres.forEach((semestre) => {
        const numero = obterNumeroPeriodo(semestre.nome);
        semestre.disciplinas.forEach((disciplina) => {
            const codigo = normalizarCodigo(disciplina.id);
            if (!aprovadas.has(codigo)) {
                todosItens.set(codigo, {
                    item: montarItemPlano(disciplina, aprovadas),
                    numero
                });
            }
        });
    });

    let houveAlteracao = true;
    while (houveAlteracao) {
        houveAlteracao = false;
        todosItens.forEach(({ item }) => {
            if (!item.apta) return;

            for (const coreqId of item.coRequisitos) {
                const coreqCodigo = normalizarCodigo(coreqId);
                if (aprovadas.has(coreqCodigo)) continue;

                const entry = todosItens.get(coreqCodigo);
                if (!entry) continue;

                if (!entry.item.apta) {
                    item.apta = false;
                    item.bloqueadoPorCoReq.push(coreqCodigo);
                    houveAlteracao = true;
                    break;
                }
            }
        });
    }

    const atual = [];
    const atrasadas = [];
    const adiantamento = [];

    todosItens.forEach(({ item, numero }) => {
        if (numero === periodoUsado) {
            atual.push(item);
        } else if (numero < periodoUsado) {
            atrasadas.push(item);
        } else if (numero > periodoUsado && numero <= periodoUsado + 2) {
            adiantamento.push(item);
        }
    });

    return {
        periodoInferido,
        periodoUsado,
        atual,
        atrasadas,
        adiantamento,
        totalAprovadas: aprovadas.size
    };
}

function renderizarGrupoPlano(titulo, lista, statusTextoApta) {
    if (lista.length === 0) return '';

    const items = lista.map((item) => {
        const classeItem = item.apta ? '' : 'bloqueada';
        const classeStatus = item.apta ? 'ok' : 'bloqueada';
        const motivosBloqueio = [...item.faltandoTotais, ...item.faltandoParciais];

        if (item.bloqueadoPorCoReq?.length) {
            item.bloqueadoPorCoReq.forEach((codigo) => motivosBloqueio.push(`co-req ${codigo} bloqueado`));
        }

        const statusTexto = item.apta
            ? statusTextoApta
            : `Bloqueada: faltam ${motivosBloqueio.join(', ')}`;

        const coreq = item.coRequisitos.length > 0
            ? `<p class="plano-coreq">Co-requisito(s): ${item.coRequisitos.join(', ')}</p>`
            : '';

        return `<article class="plano-item ${classeItem}"><h3>${item.codigo} - ${item.nome}</h3><span class="plano-status ${classeStatus}">${statusTexto}</span>${coreq}</article>`;
    }).join('');

    return `<section class="plano-grupo"><h4>${titulo}</h4><div class="plano-lista">${items}</div></section>`;
}

export function renderizarPlanoMatricula() {
    const tipoPlanoSelect = document.getElementById('tipo-plano-select');
    const periodoSelect = document.getElementById('periodo-atual-select');
    const resultado = document.getElementById('resultado-plano');

    if (!tipoPlanoSelect || !periodoSelect || !resultado) return;

    const periodoAtual = periodoSelect.value === 'auto' ? null : parseInt(periodoSelect.value, 10);
    if (periodoSelect.value !== 'auto' && Number.isNaN(periodoAtual)) {
        resultado.innerHTML = '<p>Selecione um periodo valido.</p>';
        return;
    }

    const tipoPlano = tipoPlanoSelect.value;
    if (tipoPlano !== 'padrao' && tipoPlano !== 'avancado') {
        resultado.innerHTML = '<p>Tipo de plano nao suportado.</p>';
        return;
    }

    const plano = gerarPlanoMatriculaPadrao(periodoAtual);
    if (!plano) {
        resultado.innerHTML = '<p>Nao foi possivel gerar plano para o periodo selecionado.</p>';
        return;
    }

    const cardsAtual = renderizarGrupoPlano('Sugestao principal (periodo atual)', plano.atual, 'Apta para matricula');
    const cardsAtrasadas = renderizarGrupoPlano('Disciplinas atrasadas sugeridas', plano.atrasadas, 'Apta para regularizacao');
    const cardsAdiantamento = renderizarGrupoPlano('Possivel adiantamento (periodos posteriores)', plano.adiantamento, 'Apta para adiantamento');
    const incluirAdiantamento = tipoPlano === 'avancado';

    const aptasAtual = plano.atual.filter((item) => item.apta).length;
    const aptasAtrasadas = plano.atrasadas.filter((item) => item.apta).length;
    const aptasAdiantamento = plano.adiantamento.filter((item) => item.apta).length;

    resultado.innerHTML = `
        <div class="plano-resumo">
            <p><strong>Periodo analisado: ${plano.periodoUsado}</strong> ${periodoSelect.value === 'auto' ? `(inferido: ${plano.periodoInferido})` : ''}</p>
            <p>${aptasAtual} do periodo atual aptas, ${aptasAtrasadas} atrasada(s) apta(s)${incluirAdiantamento ? ` e ${aptasAdiantamento} para adiantamento` : ''}.</p>
            <p class="plano-nota">Analise feita com as materias cursadas do historico (quando encontradas) e validacao de pre-requisitos.</p>
        </div>
        ${cardsAtual}
        ${cardsAtrasadas}
        ${incluirAdiantamento ? cardsAdiantamento : ''}
    `;
}

export function inicializarTelaPlanos() {
    const btnGerarPlano = document.getElementById('gerar-plano-btn');
    const periodoSelect = document.getElementById('periodo-atual-select');
    const tipoPlanoSelect = document.getElementById('tipo-plano-select');

    if (btnGerarPlano) {
        btnGerarPlano.addEventListener('click', renderizarPlanoMatricula);
    }

    if (periodoSelect) {
        periodoSelect.addEventListener('change', renderizarPlanoMatricula);
    }

    if (tipoPlanoSelect) {
        tipoPlanoSelect.addEventListener('change', renderizarPlanoMatricula);
    }
}