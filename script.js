// Carrega o JSON de disciplinas do arquivo
let materias;
let mostrarPendentes = false;
let mostrarCorequisitos = false;

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
            // Buscar a seção de Componentes Curriculares Obrigatórios Pendentes
            const inicioPendentes = textoCompleto.indexOf('Componentes Curriculares Obrigatórios Pendentes');
            let codigosPendentes = [];
            if (inicioPendentes !== -1) {
                // Pega o texto a partir da seção
                let textoPendentes = textoCompleto.substring(inicioPendentes);
                // Limita até a próxima seção relevante
                let delimitadores = [
                    'Componentes Curriculares Optativos',
                    'Equivalências:',
                    'Componentes Curriculares Eletivos',
                    'Componentes Curriculares Obrigatórios Cursados'
                ];
                let fimPendentes = -1;
                for (const delim of delimitadores) {
                    const idx = textoPendentes.indexOf(delim);
                    if (idx !== -1 && (fimPendentes === -1 || idx < fimPendentes)) {
                        fimPendentes = idx;
                    }
                }
                if (fimPendentes !== -1) {
                    textoPendentes = textoPendentes.substring(0, fimPendentes);
                }
                // Extrai códigos juntos ou separados por espaços/caracteres invisíveis
                codigosPendentes = Array.from(new Set(
                    textoPendentes.match(/\b[A-Z]{3,5}[\s\u200B-\u200D]*\d{2,3}[A-Z]?\b/g)
                ));
                // Normaliza para remover espaços/caracteres invisíveis
                codigosPendentes = codigosPendentes ? codigosPendentes.map(c => c.replace(/[\s\u200B-\u200D]/g, '').trim().toUpperCase()) : [];
            }
            // Filtra apenas códigos que existem na grade curricular
            const codigosGrade = new Set();
            materias.semestres.forEach(sem => sem.disciplinas.forEach(disc => codigosGrade.add(disc.id.trim().toUpperCase())));
            window.materiasPendentes = codigosPendentes
                ? codigosPendentes.map(c => c.replace(/[\s\u200B-\u200D]/g, '').trim().toUpperCase()).filter(c => codigosGrade.has(c))
                : [];
            alert('Matérias pendentes identificadas: ' + window.materiasPendentes.join(', '));
            // Não ativa o filtro automaticamente, apenas atualiza a visualização normal
            criarGradeCurricular(materias);
        });
    }
    console.log('Página carregada, iniciando carregamento do JSON...');
    
    // Seletor de grade
    const seletorGrade = document.getElementById('seletor-grade');
    let nomeGradeAtual = seletorGrade ? seletorGrade.value : 'grade2015.json';
    materias = await carregarJSONDoArquivo(nomeGradeAtual);
    criarGradeCurricular(materias);
    if (seletorGrade) {
        seletorGrade.addEventListener('change', async (e) => {
            nomeGradeAtual = e.target.value;
            materias = await carregarJSONDoArquivo(nomeGradeAtual);
            criarGradeCurricular(materias);
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

// Expor função para uso externo
window.carregarJSON = carregarJSON;