// Carrega o JSON de disciplinas do arquivo
let materias;
let mostrarPendentes = false;
let mostrarCorequisitos = false;
let telaAtual = 'grade';
let historicoCarregado = false;

// Variáveis de zoom
let zoomLevel = 100; // Nível de zoom em percentual
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

// Função para atualizar o zoom
function atualizarZoom(novoZoom) {
    // Limitar zoom entre MIN_ZOOM e MAX_ZOOM
    zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, novoZoom));
    
    const gradeContainer = document.getElementById('grade-container');
    if (gradeContainer) {
        gradeContainer.style.transform = `scale(${zoomLevel / 100})`;
        gradeContainer.style.transformOrigin = 'top center';
    }
    
    // Atualizar exibição do nível de zoom
    const zoomLevelDisplay = document.getElementById('zoom-level');
    if (zoomLevelDisplay) {
        zoomLevelDisplay.textContent = `${zoomLevel}%`;
    }
    
    // Salvar o nível de zoom no localStorage
    localStorage.setItem('zoomLevel', zoomLevel);
}

// Função para aumentar zoom
function aumentarZoom() {
    atualizarZoom(zoomLevel + ZOOM_STEP);
}

// Função para diminuir zoom
function diminuirZoom() {
    atualizarZoom(zoomLevel - ZOOM_STEP);
}

// Função para resetar zoom
function resetarZoom() {
    atualizarZoom(100);
}

function obterNumeroPeriodo(nomePeriodo) {
    const match = nomePeriodo.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}

function mostrarTela(nomeTela) {
    telaAtual = nomeTela;
    const telaGrade = document.getElementById('tela-grade');
    const telaPlanos = document.getElementById('tela-planos');
    const btnGrade = document.getElementById('btn-tela-grade');
    const btnPlanos = document.getElementById('btn-tela-planos');

    if (!telaGrade || !telaPlanos || !btnGrade || !btnPlanos) return;

    const mostrarGrade = nomeTela === 'grade';
    telaGrade.classList.toggle('active', mostrarGrade);
    telaPlanos.classList.toggle('active', !mostrarGrade);
    btnGrade.classList.toggle('active', mostrarGrade);
    btnPlanos.classList.toggle('active', !mostrarGrade);
}

function atualizarAcessoTelaPlanos() {
    const btnPlanos = document.getElementById('btn-tela-planos');
    if (!btnPlanos) return;

    btnPlanos.disabled = !historicoCarregado;
    btnPlanos.classList.toggle('locked', !historicoCarregado);
    btnPlanos.title = historicoCarregado
        ? 'Abrir tela de planos de matricula'
        : 'Envie o historico para liberar os planos de matricula';
}

function popularSelectPeriodos() {
    const periodoSelect = document.getElementById('periodo-atual-select');
    if (!periodoSelect || !materias || !materias.semestres) return;

    periodoSelect.innerHTML = '';
    const optionAuto = document.createElement('option');
    optionAuto.value = 'auto';
    optionAuto.textContent = 'Automatico (com base no historico)';
    periodoSelect.appendChild(optionAuto);

    materias.semestres.forEach((semestre) => {
        const option = document.createElement('option');
        option.value = String(obterNumeroPeriodo(semestre.nome));
        option.textContent = semestre.nome;
        periodoSelect.appendChild(option);
    });

    periodoSelect.value = 'auto';
}

function obterTodosCodigosGrade() {
    const codigos = new Set();
    if (!materias || !materias.semestres) return codigos;

    materias.semestres.forEach((semestre) => {
        semestre.disciplinas.forEach((disc) => codigos.add(disc.id.trim().toUpperCase()));
    });

    return codigos;
}

function extrairCodigosSecaoHistorico(textoCompleto, tituloSecao, delimitadores, codigosGrade) {
    const inicio = textoCompleto.indexOf(tituloSecao);
    if (inicio === -1) return [];

    let trecho = textoCompleto.substring(inicio);
    let fim = -1;
    delimitadores.forEach((delim) => {
        const idx = trecho.indexOf(delim);
        if (idx !== -1 && (fim === -1 || idx < fim)) {
            fim = idx;
        }
    });

    if (fim !== -1) {
        trecho = trecho.substring(0, fim);
    }

    const capturados = trecho.match(/\b[A-Z]{3,5}[\s\u200B-\u200D]*\d{2,3}[A-Z]?\b/g) || [];
    const normalizados = capturados
        .map((codigo) => codigo.replace(/[\s\u200B-\u200D]/g, '').trim().toUpperCase())
        .filter((codigo) => codigosGrade.has(codigo));

    return Array.from(new Set(normalizados));
}

function obterDisciplinasAprovadas() {
    const aprovadas = new Set();

    if (window.materiasCursadas && window.materiasCursadas.length > 0) {
        window.materiasCursadas.forEach((id) => aprovadas.add(id.trim().toUpperCase()));
        return aprovadas;
    }

    if (window.materiasPendentes && window.materiasPendentes.length > 0) {
        const pendentes = new Set(window.materiasPendentes.map((id) => id.trim().toUpperCase()));
        obterTodosCodigosGrade().forEach((codigo) => {
            if (!pendentes.has(codigo)) {
                aprovadas.add(codigo);
            }
        });
    }

    return aprovadas;
}

function inferirPeriodoAtual(aprovadas) {
    if (!materias || !materias.semestres || materias.semestres.length === 0) return 1;

    // Encontra o período mais avançado onde o aluno tem ao menos uma aprovação.
    // Se esse período estiver 100% completo, o atual é o próximo.
    let maisAvancadoComAprovacao = 0;
    let maisAvancadoCompleto = false;

    for (const semestre of materias.semestres) {
        const numero = obterNumeroPeriodo(semestre.nome);
        const total = semestre.disciplinas.length;
        const concluidas = semestre.disciplinas.filter((disc) => aprovadas.has(disc.id.trim().toUpperCase())).length;

        if (concluidas > 0) {
            maisAvancadoComAprovacao = numero;
            maisAvancadoCompleto = concluidas === total;
        }
    }

    if (maisAvancadoComAprovacao === 0) return 1;

    if (maisAvancadoCompleto) {
        const maxPeriodo = obterNumeroPeriodo(materias.semestres[materias.semestres.length - 1].nome);
        return Math.min(maisAvancadoComAprovacao + 1, maxPeriodo);
    }

    return maisAvancadoComAprovacao;
}

function validarPreRequisitos(disciplina, aprovadas) {
    const reqTotais = (disciplina.requisitosTotais || []).map((id) => id.trim().toUpperCase());
    const reqParciais = (disciplina.requisitosParciais || []).map((id) => id.trim().toUpperCase());

    const faltandoTotais = reqTotais.filter((id) => !aprovadas.has(id));
    const parcialOk = reqParciais.length === 0 || reqParciais.some((id) => aprovadas.has(id));
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
    if (!materias || !materias.semestres) return null;

    const aprovadas = obterDisciplinasAprovadas();
    const periodoInferido = inferirPeriodoAtual(aprovadas);
    const periodoUsado = periodoAtual || periodoInferido;

    // Primeira passagem: monta todos os itens nao aprovados com seu numero de periodo
    const todosItens = new Map(); // codigo -> { item, numero }
    materias.semestres.forEach((semestre) => {
        const numero = obterNumeroPeriodo(semestre.nome);
        semestre.disciplinas.forEach((disciplina) => {
            const codigo = disciplina.id.trim().toUpperCase();
            if (!aprovadas.has(codigo)) {
                todosItens.set(codigo, { item: montarItemPlano(disciplina, aprovadas), numero });
            }
        });
    });

    // Segunda passagem: propagacao de bloqueio por co-requisito (ponto fixo)
    // Se X e co-requisito de Y e X esta bloqueada, entao Y tambem fica bloqueada
    let changed = true;
    while (changed) {
        changed = false;
        todosItens.forEach(({ item }) => {
            if (!item.apta) return;
            for (const coreqId of item.coRequisitos) {
                const coreqCodigo = coreqId.trim().toUpperCase();
                if (aprovadas.has(coreqCodigo)) continue;
                const entry = todosItens.get(coreqCodigo);
                if (!entry) continue;
                if (!entry.item.apta) {
                    item.apta = false;
                    item.bloqueadoPorCoReq.push(coreqCodigo);
                    changed = true;
                    break;
                }
            }
        });
    }

    // Distribui itens nos grupos
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
        if (item.bloqueadoPorCoReq && item.bloqueadoPorCoReq.length > 0) {
            item.bloqueadoPorCoReq.forEach((c) => motivosBloqueio.push(`co-req ${c} bloqueado`));
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

function renderizarPlanoMatricula() {
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

    const aptasAtual = plano.atual.filter(i => i.apta).length;
    const aptasAtrasadas = plano.atrasadas.filter(i => i.apta).length;
    const aptasAdiantamento = plano.adiantamento.filter(i => i.apta).length;

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

function inicializarNavegacaoTelas() {
    const btnTelaGrade = document.getElementById('btn-tela-grade');
    const btnTelaPlanos = document.getElementById('btn-tela-planos');

    if (btnTelaGrade) {
        btnTelaGrade.addEventListener('click', () => mostrarTela('grade'));
    }

    if (btnTelaPlanos) {
        btnTelaPlanos.addEventListener('click', () => {
            if (!historicoCarregado) {
                alert('Para acessar planos de matricula, envie o historico em PDF primeiro.');
                return;
            }
            mostrarTela('planos');
            renderizarPlanoMatricula();
        });
    }
}

function inicializarTelaPlanos() {
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

// Função para carregar o JSON do arquivo
async function carregarJSONDoArquivo(nomeArquivo = 'grade2015.json') {
    try {
        const response = await fetch(nomeArquivo);
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        const jsonData = await response.json();
        
        console.log('JSON original carregado:', jsonData);
        
        // Verificar se o JSON está vazio ou inválido
        if (!jsonData || Object.keys(jsonData).length === 0) {
            throw new Error('JSON vazio ou inválido');
        }
        
        // Converter o formato do JSON para o formato esperado pela visualização
        const semestres = [];
        
        // Processar cada período no JSON e ordenar os períodos corretamente
        const periodos = Object.keys(jsonData).sort((a, b) => {
            // Extrair o número do período (ex: "1º Período" -> 1)
            const numA = parseInt(a.match(/\d+/)[0]);
            const numB = parseInt(b.match(/\d+/)[0]);
            return numA - numB;
        });
        
        console.log('Períodos encontrados:', periodos);
        
        if (periodos.length === 0) {
            throw new Error('Nenhum período encontrado no JSON');
        }
        
        // Processar cada período no JSON na ordem correta
        for (const periodo of periodos) {
            const disciplinas = jsonData[periodo];
            
            if (!disciplinas || !Array.isArray(disciplinas)) {
                console.warn(`Período ${periodo} não contém uma lista válida de disciplinas`);
                continue; // Pula este período
            }
            
            console.log(`Processando período ${periodo} com ${disciplinas.length} disciplinas`);
            
            const disciplinasValidas = disciplinas.filter(disc => disc && disc.codigo && disc.disciplina);
            
            if (disciplinasValidas.length === 0) {
                console.warn(`Período ${periodo} não contém disciplinas válidas`);
                continue;
            }
            
            semestres.push({
                "nome": periodo,
                "disciplinas": disciplinasValidas.map(disc => ({
                    "id": disc.codigo,
                    "nome": disc.disciplina,
                    "requisitosTotais": Array.isArray(disc.prerequisitos?.totais) ? disc.prerequisitos.totais : [],
                    "requisitosParciais": Array.isArray(disc.prerequisitos?.parciais) ? disc.prerequisitos.parciais : [],
                    "coRequisitos": Array.isArray(disc.co_requisitos) ? disc.co_requisitos : []
                }))
            });
        }
        
        console.log(`Total de semestres processados: ${semestres.length}`);
        
        // Verificar se temos semestres válidos
        if (semestres.length === 0) {
            throw new Error('Nenhum semestre válido foi processado');
        }
        
        return { "semestres": semestres };
    } catch (error) {
        console.error('Erro ao carregar ou processar o arquivo JSON:', error);
        alert('Erro ao carregar o arquivo JSON: ' + error.message);
        return null;
    }
}

// Função para criar a visualização da grade curricular
function criarGradeCurricular(dados) {
    const container = document.getElementById('grade-container');
    container.innerHTML = '';
    
    console.log('Criando grade curricular com', dados.semestres.length, 'semestres');
    
    // Verificar se temos dados válidos
    if (!dados || !dados.semestres || dados.semestres.length === 0) {
        console.error('Dados inválidos para criar a grade curricular');
        container.innerHTML = '<p>Erro ao carregar os dados da grade curricular.</p>';
        return;
    }
    
    // Normaliza os códigos das matérias pendentes para comparação
    const materiasPendentesNorm = window.materiasPendentes ? window.materiasPendentes : [];
    // Função recursiva para verificar se a disciplina ou algum pré-requisito está pendente
    function disciplinaOuPreReqPendente(id) {
        id = id.trim().toUpperCase();
        // Só mostra se está pendente
        if (materiasPendentesNorm.includes(id)) return true;
        // Se não está pendente, não mostra nem pré-requisito
        return false;
    }
    // Criar elementos para cada semestre
    dados.semestres.forEach((semestre, semestreIndex) => {
        // Filtra disciplinas pendentes se o filtro estiver ativo
        let disciplinasVisiveis = semestre.disciplinas;
        if (mostrarPendentes) {
            disciplinasVisiveis = semestre.disciplinas.filter(disc => disciplinaOuPreReqPendente(disc.id));
        }
        // Oculta semestre se não houver disciplinas visíveis
        if (!disciplinasVisiveis || disciplinasVisiveis.length === 0) return;

        const semestreEl = document.createElement('div');
        semestreEl.className = 'semestre';
        semestreEl.id = `semestre-${semestreIndex}`;

        // Cabeçalho do semestre
        const header = document.createElement('div');
        header.className = 'semestre-header';
        header.textContent = semestre.nome;
        semestreEl.appendChild(header);

        // Adicionar disciplinas do semestre
        disciplinasVisiveis.forEach((disciplina, disciplinaIndex) => {
            const disciplinaEl = document.createElement('div');
            disciplinaEl.className = 'disciplina';
            disciplinaEl.id = disciplina.id;
            disciplinaEl.textContent = disciplina.nome;
            disciplinaEl.setAttribute('data-requisitos', JSON.stringify(disciplina.requisitos));

            // Adicionar evento para destacar pré-requisitos
            disciplinaEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (mostrarPendentes) {
                    destacarPreRequisitosPendentes(disciplina.id, disciplina.requisitos);
                } else {
                    destacarPreRequisitosCompleto(disciplina.id, disciplina.requisitos);
                }
            });

            semestreEl.appendChild(disciplinaEl);
        });

        container.appendChild(semestreEl);
    });

    // Evento para remover destaque e linhas ao clicar fora de qualquer matéria
    document.body.addEventListener('click', function limparDestaque(e) {
        // Só remove se não clicar em uma disciplina
        if (!e.target.classList.contains('disciplina')) {
            resetarDestaque();
            document.querySelectorAll('.conexao').forEach(el => el.remove());
        }
    });
    
    console.log('Grade curricular criada com sucesso!');
    
    // Não desenha conexões na visualização inicial
    // As linhas só serão desenhadas ao clicar em uma matéria
}



// Função para desenhar uma linha entre dois elementos
function desenharLinha(elementoA, elementoB) {
    const rectA = elementoA.getBoundingClientRect();
    const rectB = elementoB.getBoundingClientRect();
    // Considera o deslocamento de rolagem da página
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // Calcular pontos de início e fim relativos ao documento
    const startX = rectA.left + rectA.width / 2 + scrollLeft;
    const startY = rectA.bottom + scrollTop;
    const endX = rectB.left + rectB.width / 2 + scrollLeft;
    const endY = rectB.top + scrollTop;

    // Calcular comprimento e ângulo da linha
    const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;

    // Criar elemento de linha
    const linha = document.createElement('div');
    linha.className = 'conexao';
    linha.style.width = `${length}px`;
    linha.style.height = '2px';
    linha.style.left = `${startX}px`;
    linha.style.top = `${startY}px`;
    linha.style.transform = `rotate(${angle}deg)`;
    // Se for pontilhada ou co-requisito, adicionar classe
    if (arguments.length > 2) {
        if (arguments[2] === true) {
            linha.classList.add('parcial');
        } else if (arguments[2] === 'corequisito') {
            linha.classList.add('corequisito');
        }
    }
    document.body.appendChild(linha);
}

// Evento de carregamento da página
window.addEventListener('load', async () => {
    inicializarNavegacaoTelas();
    inicializarTelaPlanos();
    atualizarAcessoTelaPlanos();

    // Integração com upload do histórico PDF
    const uploadHistorico = document.getElementById('upload-historico');
    if (uploadHistorico) {
        uploadHistorico.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
            let textoCompleto = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                textoCompleto += content.items.map(item => item.str).join(' ') + '\n';
            }
            const codigosGrade = obterTodosCodigosGrade();

            const codigosPendentes = extrairCodigosSecaoHistorico(
                textoCompleto,
                'Componentes Curriculares Obrigatórios Pendentes',
                [
                    'Componentes Curriculares Optativos',
                    'Equivalências:',
                    'Componentes Curriculares Eletivos',
                    'Componentes Curriculares Obrigatórios Cursados'
                ],
                codigosGrade
            );

            let codigosCursados = extrairCodigosSecaoHistorico(
                textoCompleto,
                'Componentes Curriculares Obrigatórios Cursados',
                [
                    'Componentes Curriculares Obrigatórios Pendentes',
                    'Componentes Curriculares Optativos',
                    'Equivalências:',
                    'Componentes Curriculares Eletivos'
                ],
                codigosGrade
            );

            if (codigosCursados.length === 0 && codigosPendentes.length > 0) {
                codigosCursados = Array.from(codigosGrade).filter((codigo) => !codigosPendentes.includes(codigo));
            }

            window.materiasPendentes = codigosPendentes;
            window.materiasCursadas = codigosCursados;
            historicoCarregado = true;
            atualizarAcessoTelaPlanos();

            const periodoInferido = inferirPeriodoAtual(new Set(window.materiasCursadas || []));
            alert(
                `Histórico analisado. Cursadas: ${window.materiasCursadas.length}. Pendentes: ${window.materiasPendentes.length}. Período inferido: ${periodoInferido}.`
            );
            // Não ativa o filtro automaticamente, apenas atualiza a visualização normal
            criarGradeCurricular(materias);
            if (telaAtual === 'planos') {
                renderizarPlanoMatricula();
            }
        });
    }
    console.log('Página carregada, iniciando carregamento do JSON...');
    
    // Seletor de grade
    const seletorGrade = document.getElementById('seletor-grade');
    let nomeGradeAtual = seletorGrade ? seletorGrade.value : 'grade2015.json';
    materias = await carregarJSONDoArquivo(nomeGradeAtual);
    criarGradeCurricular(materias);
    popularSelectPeriodos();
    if (seletorGrade) {
        seletorGrade.addEventListener('change', async (e) => {
            nomeGradeAtual = e.target.value;
            materias = await carregarJSONDoArquivo(nomeGradeAtual);
            window.materiasPendentes = [];
            window.materiasCursadas = [];
            historicoCarregado = false;
            atualizarAcessoTelaPlanos();
            if (telaAtual === 'planos') {
                mostrarTela('grade');
            }
            criarGradeCurricular(materias);
            popularSelectPeriodos();
            if (telaAtual === 'planos') {
                renderizarPlanoMatricula();
            }
        });
    }
    
    // Depurar o JSON carregado
    console.log('JSON carregado:', materias);
    console.log('Número de semestres:', materias.semestres.length);
    
    // Criar a visualização
    criarGradeCurricular(materias);

    // Evento para checkbox de filtro de pendentes
    const filtroPendentes = document.getElementById('filtro-pendentes');
    if (filtroPendentes) {
        filtroPendentes.addEventListener('change', (e) => {
            if (e.target.checked && (!window.materiasPendentes || window.materiasPendentes.length === 0)) {
                alert('Por favor, faça o upload do histórico em PDF para visualizar as matérias pendentes.');
                filtroPendentes.checked = false;
                return;
            }
            mostrarPendentes = e.target.checked;
            criarGradeCurricular(materias);
        });
    }
    // Evento para checkbox de filtro de co-requisitos
    const filtroCorequisitos = document.getElementById('filtro-corequisitos');
    if (filtroCorequisitos) {
        mostrarCorequisitos = filtroCorequisitos.checked;
        filtroCorequisitos.addEventListener('change', (e) => {
            mostrarCorequisitos = e.target.checked;
            criarGradeCurricular(materias);
        });
    }

});



// Função para destacar pré-requisitos e reduzir opacidade das outras disciplinas
// Função auxiliar para buscar todos os pré-requisitos em cadeia
// Busca todos os pré-requisitos (sem filtro de pendentes)
function buscarTodosPreRequisitos(disciplinaId, materias) {
    const encontrados = new Set();
    function buscar(id) {
        if (encontrados.has(id)) return;
        encontrados.add(id);
        // Procurar disciplina pelo id
        for (const semestre of materias.semestres) {
            for (const disc of semestre.disciplinas) {
                if (disc.id === id) {
                    // Buscar requisitosTotais
                    if (disc.requisitosTotais && disc.requisitosTotais.length > 0) {
                        disc.requisitosTotais.forEach(buscar);
                    }
                    // Buscar requisitosParciais
                    if (disc.requisitosParciais && disc.requisitosParciais.length > 0) {
                        disc.requisitosParciais.forEach(buscar);
                    }
                }
            }
        }
    }
    buscar(disciplinaId);
    encontrados.delete(disciplinaId); // Não incluir a própria disciplina
    return Array.from(encontrados);
}

// Destaca todos os pré-requisitos (sem filtro de pendentes)
function destacarPreRequisitosCompleto(disciplinaId, requisitos) {
    resetarDestaque();
    document.querySelectorAll('.conexao').forEach(el => el.remove());
    const disciplinaClicada = document.getElementById(disciplinaId);
    if (disciplinaClicada) {
        disciplinaClicada.classList.add('destacado');
    }
    // Buscar todos os pré-requisitos em cadeia
    const todosPreReqs = buscarTodosPreRequisitos(disciplinaId, materias);
    todosPreReqs.forEach(requisitoId => {
        const requisitoEl = document.getElementById(requisitoId);
        if (requisitoEl) {
            requisitoEl.classList.add('pre-requisito');
        }
    });
    // Destacar co-requisitos da matéria selecionada (se habilitado)
    if (mostrarCorequisitos) {
        for (const semestre of materias.semestres) {
            for (const disc of semestre.disciplinas) {
                if (disc.id === disciplinaId && disc.coRequisitos && disc.coRequisitos.length > 0) {
                    disc.coRequisitos.forEach(coreqId => {
                        const coreqEl = document.getElementById(coreqId);
                        if (coreqEl) {
                            coreqEl.classList.add('pre-requisito');
                        }
                    });
                }
            }
        }
    }
    document.querySelectorAll('.disciplina').forEach(el => {
        if (!el.classList.contains('destacado') && !el.classList.contains('pre-requisito')) {
            el.classList.add('opaco');
        }
    });
    // Desenhar somente as linhas dos pré-requisitos em cadeia
    function desenharLinhasPreReq(id, isRoot) {
        for (const semestre of materias.semestres) {
            for (const disc of semestre.disciplinas) {
                if (disc.id === id) {
                    // Linhas sólidas para requisitosTotais
                    if (disc.requisitosTotais && disc.requisitosTotais.length > 0) {
                        disc.requisitosTotais.forEach(requisitoId => {
                            const requisitoEl = document.getElementById(requisitoId);
                            const disciplinaEl = document.getElementById(id);
                            if (requisitoEl && disciplinaEl) {
                                desenharLinha(requisitoEl, disciplinaEl, false);
                            }
                            desenharLinhasPreReq(requisitoId, false);
                        });
                    }
                    // Linhas pontilhadas para requisitosParciais
                    if (disc.requisitosParciais && disc.requisitosParciais.length > 0) {
                        disc.requisitosParciais.forEach(requisitoId => {
                            const requisitoEl = document.getElementById(requisitoId);
                            const disciplinaEl = document.getElementById(id);
                            if (requisitoEl && disciplinaEl) {
                                desenharLinha(requisitoEl, disciplinaEl, true);
                            }
                            desenharLinhasPreReq(requisitoId, false);
                        });
                    }
                    // Linhas tracejadas azuis para co-requisitos apenas para a matéria raiz (se habilitado)
                    if (mostrarCorequisitos && isRoot && disc.coRequisitos && disc.coRequisitos.length > 0) {
                        disc.coRequisitos.forEach(coreqId => {
                            const coreqEl = document.getElementById(coreqId);
                            const disciplinaEl = document.getElementById(id);
                            if (coreqEl && disciplinaEl) {
                                desenharLinha(coreqEl, disciplinaEl, 'corequisito');
                            }
                        });
                    }
                }
            }
        }
    }
    desenharLinhasPreReq(disciplinaId, true);
}

function buscarPreRequisitosPendentes(disciplinaId, materias, pendentes) {
    const encontrados = new Set();
    function buscar(id) {
        id = id.trim().toUpperCase();
        if (encontrados.has(id)) return;
        if (!pendentes.includes(id)) return;
        encontrados.add(id);
        // Procurar disciplina pelo id
        for (const semestre of materias.semestres) {
            for (const disc of semestre.disciplinas) {
                if (disc.id.trim().toUpperCase() === id) {
                    // requisitosTotais
                    if (disc.requisitosTotais && disc.requisitosTotais.length > 0) {
                        disc.requisitosTotais.forEach(pr => {
                            pr = pr.trim().toUpperCase();
                            if (pendentes.includes(pr)) {
                                buscar(pr);
                            }
                        });
                    }
                    // requisitosParciais
                    if (disc.requisitosParciais && disc.requisitosParciais.length > 0) {
                        disc.requisitosParciais.forEach(pr => {
                            pr = pr.trim().toUpperCase();
                            if (pendentes.includes(pr)) {
                                buscar(pr);
                            }
                        });
                    }
                }
            }
        }
    }
    // Só busca se a própria disciplina for pendente
    if (pendentes.includes(disciplinaId.trim().toUpperCase())) {
        buscar(disciplinaId);
    }
    encontrados.delete(disciplinaId); // Não incluir a própria disciplina
    return Array.from(encontrados);
}

function destacarPreRequisitosPendentes(disciplinaId, requisitos) {
    resetarDestaque();
    document.querySelectorAll('.conexao').forEach(el => el.remove());
    const disciplinaClicada = document.getElementById(disciplinaId);
    if (disciplinaClicada) {
        disciplinaClicada.classList.add('destacado');
    }
    // Buscar apenas pré-requisitos pendentes
    const pendentes = window.materiasPendentes ? window.materiasPendentes : [];
    const preReqsPendentes = buscarPreRequisitosPendentes(disciplinaId, materias, pendentes);
    preReqsPendentes.forEach(requisitoId => {
        const requisitoEl = document.getElementById(requisitoId);
        if (requisitoEl) {
            requisitoEl.classList.add('pre-requisito');
        }
    });
    // Destacar co-requisitos da matéria selecionada (se habilitado)
    if (mostrarCorequisitos) {
        for (const semestre of materias.semestres) {
            for (const disc of semestre.disciplinas) {
                if (disc.id === disciplinaId && disc.coRequisitos && disc.coRequisitos.length > 0) {
                    disc.coRequisitos.forEach(coreqId => {
                        const coreqEl = document.getElementById(coreqId);
                        if (coreqEl) {
                            coreqEl.classList.add('pre-requisito');
                        }
                    });
                }
            }
        }
    }
    document.querySelectorAll('.disciplina').forEach(el => {
        if (!el.classList.contains('destacado') && !el.classList.contains('pre-requisito')) {
            el.classList.add('opaco');
        }
    });
    // Desenhar linhas dos pré-requisitos e co-requisitos pendentes
    function desenharLinhasPreReqPendentes(id, isRoot) {
        for (const semestre of materias.semestres) {
            for (const disc of semestre.disciplinas) {
                if (disc.id === id) {
                    // Linhas sólidas para requisitosTotais pendentes
                    if (disc.requisitosTotais && disc.requisitosTotais.length > 0) {
                        disc.requisitosTotais.forEach(requisitoId => {
                            if (pendentes.includes(requisitoId.trim().toUpperCase())) {
                                const requisitoEl = document.getElementById(requisitoId);
                                const disciplinaEl = document.getElementById(id);
                                if (requisitoEl && disciplinaEl) {
                                    desenharLinha(requisitoEl, disciplinaEl, false);
                                }
                                desenharLinhasPreReqPendentes(requisitoId, false);
                            }
                        });
                    }
                    // Linhas pontilhadas para requisitosParciais pendentes
                    if (disc.requisitosParciais && disc.requisitosParciais.length > 0) {
                        disc.requisitosParciais.forEach(requisitoId => {
                            if (pendentes.includes(requisitoId.trim().toUpperCase())) {
                                const requisitoEl = document.getElementById(requisitoId);
                                const disciplinaEl = document.getElementById(id);
                                if (requisitoEl && disciplinaEl) {
                                    desenharLinha(requisitoEl, disciplinaEl, true);
                                }
                                desenharLinhasPreReqPendentes(requisitoId, false);
                            }
                        });
                    }
                    // Linhas de co-requisito apenas para a matéria raiz (se habilitado)
                    if (mostrarCorequisitos && isRoot && disc.coRequisitos && disc.coRequisitos.length > 0) {
                        disc.coRequisitos.forEach(coreqId => {
                            const coreqEl = document.getElementById(coreqId);
                            const disciplinaEl = document.getElementById(id);
                            if (coreqEl && disciplinaEl) {
                                desenharLinha(coreqEl, disciplinaEl, 'corequisito');
                            }
                        });
                    }
                }
            }
        }
    }
    desenharLinhasPreReqPendentes(disciplinaId, true);
}

// Função para resetar o destaque de todas as disciplinas
function resetarDestaque() {
    document.querySelectorAll('.disciplina').forEach(el => {
        el.classList.remove('destacado', 'pre-requisito', 'opaco');
    });
    
    document.querySelectorAll('.conexao').forEach(el => {
        el.classList.remove('conexao-destacada');
    });
}


// Adicionar evento para resetar o destaque ao clicar fora das disciplinas
document.addEventListener('click', (event) => {
    if (!event.target.classList.contains('disciplina')) {
        resetarDestaque();
    }
});

// Função para inicializar os controles de zoom
function inicializarControlesZoom() {
    // Carregar zoom salvo do localStorage
    const zoomSalvo = localStorage.getItem('zoomLevel');
    if (zoomSalvo) {
        atualizarZoom(parseInt(zoomSalvo));
    } else {
        atualizarZoom(100);
    }
    
    // Event listeners para os botões
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', aumentarZoom);
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', diminuirZoom);
    }
    
    // Event listener para scroll do mouse (zoom com Ctrl + scroll)
    const gradeContainer = document.getElementById('grade-container');
    if (gradeContainer) {
        gradeContainer.addEventListener('wheel', (event) => {
            // Verificar se Ctrl está pressionado
            if (event.ctrlKey) {
                event.preventDefault();
                
                // Scroll para cima aumenta zoom, scroll para baixo diminui
                if (event.deltaY < 0) {
                    aumentarZoom();
                } else {
                    diminuirZoom();
                }
            }
        }, { passive: false });
    }
}

// Expor função para uso externo
window.carregarJSON = carregarJSON;