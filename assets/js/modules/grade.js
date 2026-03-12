import { appState } from './state.js';
import {
    buscarPreRequisitosPendentes,
    buscarTodosPreRequisitos,
    encontrarDisciplina,
    normalizarCodigo
} from './utils.js';

export function resetarDestaque() {
    document.querySelectorAll('.disciplina').forEach((elemento) => {
        elemento.classList.remove('destacado', 'pre-requisito', 'opaco');
    });

    document.querySelectorAll('.conexao').forEach((elemento) => {
        elemento.classList.remove('conexao-destacada');
    });
}

function limparConexoes() {
    document.querySelectorAll('.conexao').forEach((elemento) => elemento.remove());
}

function desenharLinha(elementoA, elementoB, tipo = false) {
    const gradeContainer = document.getElementById('grade-container');
    if (!gradeContainer) return;

    const rectA = elementoA.getBoundingClientRect();
    const rectB = elementoB.getBoundingClientRect();
    const containerRect = gradeContainer.getBoundingClientRect();
    const escala = appState.zoomLevel / 100;

    const startX = ((rectA.left - containerRect.left) + rectA.width / 2) / escala + gradeContainer.scrollLeft;
    const startY = (rectA.bottom - containerRect.top) / escala + gradeContainer.scrollTop;
    const endX = ((rectB.left - containerRect.left) + rectB.width / 2) / escala + gradeContainer.scrollLeft;
    const endY = (rectB.top - containerRect.top) / escala + gradeContainer.scrollTop;

    const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;

    const linha = document.createElement('div');
    linha.className = 'conexao';
    linha.style.width = `${length}px`;
    linha.style.height = '2px';
    linha.style.left = `${startX}px`;
    linha.style.top = `${startY}px`;
    linha.style.transform = `rotate(${angle}deg)`;

    if (tipo === true) {
        linha.classList.add('parcial');
    } else if (tipo === 'corequisito') {
        linha.classList.add('corequisito');
    }

    gradeContainer.appendChild(linha);
}

function destacarElementosBase(disciplinaId) {
    resetarDestaque();
    limparConexoes();

    const disciplinaClicada = document.getElementById(disciplinaId);
    if (disciplinaClicada) {
        disciplinaClicada.classList.add('destacado');
    }
}

function destacarCoRequisitos(disciplinaId) {
    if (!appState.mostrarCorequisitos) return;

    const disciplina = encontrarDisciplina(appState.materias, disciplinaId);
    if (!disciplina?.coRequisitos?.length) return;

    disciplina.coRequisitos.forEach((coreqId) => {
        const elemento = document.getElementById(normalizarCodigo(coreqId));
        if (elemento) {
            elemento.classList.add('pre-requisito');
        }
    });
}

function aplicarOpacidadeNosDemais() {
    document.querySelectorAll('.disciplina').forEach((elemento) => {
        if (!elemento.classList.contains('destacado') && !elemento.classList.contains('pre-requisito')) {
            elemento.classList.add('opaco');
        }
    });
}

export function destacarPreRequisitosCompleto(disciplinaId) {
    destacarElementosBase(disciplinaId);

    const todosPreRequisitos = buscarTodosPreRequisitos(appState.materias, disciplinaId);
    todosPreRequisitos.forEach((requisitoId) => {
        const requisitoEl = document.getElementById(requisitoId);
        if (requisitoEl) {
            requisitoEl.classList.add('pre-requisito');
        }
    });

    destacarCoRequisitos(disciplinaId);
    aplicarOpacidadeNosDemais();

    function desenharLinhasPreReq(codigoDisciplina, isRoot) {
        const disciplina = encontrarDisciplina(appState.materias, codigoDisciplina);
        if (!disciplina) return;

        (disciplina.requisitosTotais || []).forEach((requisitoId) => {
            const requisitoEl = document.getElementById(normalizarCodigo(requisitoId));
            const disciplinaEl = document.getElementById(normalizarCodigo(codigoDisciplina));

            if (requisitoEl && disciplinaEl) {
                desenharLinha(requisitoEl, disciplinaEl, false);
            }

            desenharLinhasPreReq(requisitoId, false);
        });

        (disciplina.requisitosParciais || []).forEach((requisitoId) => {
            const requisitoEl = document.getElementById(normalizarCodigo(requisitoId));
            const disciplinaEl = document.getElementById(normalizarCodigo(codigoDisciplina));

            if (requisitoEl && disciplinaEl) {
                desenharLinha(requisitoEl, disciplinaEl, true);
            }

            desenharLinhasPreReq(requisitoId, false);
        });

        if (appState.mostrarCorequisitos && isRoot && disciplina.coRequisitos?.length) {
            disciplina.coRequisitos.forEach((coreqId) => {
                const coreqEl = document.getElementById(normalizarCodigo(coreqId));
                const disciplinaEl = document.getElementById(normalizarCodigo(codigoDisciplina));

                if (coreqEl && disciplinaEl) {
                    desenharLinha(coreqEl, disciplinaEl, 'corequisito');
                }
            });
        }
    }

    desenharLinhasPreReq(disciplinaId, true);
}

export function destacarPreRequisitosPendentes(disciplinaId) {
    destacarElementosBase(disciplinaId);

    const pendentes = window.materiasPendentes || [];
    const preRequisitosPendentes = buscarPreRequisitosPendentes(appState.materias, disciplinaId, pendentes);

    preRequisitosPendentes.forEach((requisitoId) => {
        const requisitoEl = document.getElementById(requisitoId);
        if (requisitoEl) {
            requisitoEl.classList.add('pre-requisito');
        }
    });

    destacarCoRequisitos(disciplinaId);
    aplicarOpacidadeNosDemais();

    const pendentesSet = new Set(pendentes.map((codigo) => normalizarCodigo(codigo)));

    function desenharLinhasPreReqPendentes(codigoDisciplina, isRoot) {
        const disciplina = encontrarDisciplina(appState.materias, codigoDisciplina);
        if (!disciplina) return;

        (disciplina.requisitosTotais || []).forEach((requisitoId) => {
            const requisitoNormalizado = normalizarCodigo(requisitoId);
            if (!pendentesSet.has(requisitoNormalizado)) return;

            const requisitoEl = document.getElementById(requisitoNormalizado);
            const disciplinaEl = document.getElementById(normalizarCodigo(codigoDisciplina));
            if (requisitoEl && disciplinaEl) {
                desenharLinha(requisitoEl, disciplinaEl, false);
            }

            desenharLinhasPreReqPendentes(requisitoId, false);
        });

        (disciplina.requisitosParciais || []).forEach((requisitoId) => {
            const requisitoNormalizado = normalizarCodigo(requisitoId);
            if (!pendentesSet.has(requisitoNormalizado)) return;

            const requisitoEl = document.getElementById(requisitoNormalizado);
            const disciplinaEl = document.getElementById(normalizarCodigo(codigoDisciplina));
            if (requisitoEl && disciplinaEl) {
                desenharLinha(requisitoEl, disciplinaEl, true);
            }

            desenharLinhasPreReqPendentes(requisitoId, false);
        });

        if (appState.mostrarCorequisitos && isRoot && disciplina.coRequisitos?.length) {
            disciplina.coRequisitos.forEach((coreqId) => {
                const coreqEl = document.getElementById(normalizarCodigo(coreqId));
                const disciplinaEl = document.getElementById(normalizarCodigo(codigoDisciplina));
                if (coreqEl && disciplinaEl) {
                    desenharLinha(coreqEl, disciplinaEl, 'corequisito');
                }
            });
        }
    }

    desenharLinhasPreReqPendentes(disciplinaId, true);
}

export function redesenharConexoesAtivas() {
    if (!appState.disciplinaSelecionadaId) return;

    const disciplinaEl = document.getElementById(appState.disciplinaSelecionadaId);
    if (!disciplinaEl) return;

    if (appState.mostrarPendentes) {
        destacarPreRequisitosPendentes(appState.disciplinaSelecionadaId);
    } else {
        destacarPreRequisitosCompleto(appState.disciplinaSelecionadaId);
    }
}

export function criarGradeCurricular(dados) {
    const container = document.getElementById('grade-container');
    if (!container) return;

    appState.disciplinaSelecionadaId = null;
    container.innerHTML = '';

    if (!dados?.semestres?.length) {
        container.innerHTML = '<p>Erro ao carregar os dados da grade curricular.</p>';
        return;
    }

    const materiasPendentes = window.materiasPendentes || [];
    const materiasPendentesSet = new Set(materiasPendentes.map((codigo) => normalizarCodigo(codigo)));

    dados.semestres.forEach((semestre, semestreIndex) => {
        let disciplinasVisiveis = semestre.disciplinas;
        if (appState.mostrarPendentes) {
            disciplinasVisiveis = semestre.disciplinas.filter((disciplina) => {
                return materiasPendentesSet.has(normalizarCodigo(disciplina.id));
            });
        }

        if (!disciplinasVisiveis.length) return;

        const semestreEl = document.createElement('div');
        semestreEl.className = 'semestre';
        semestreEl.id = `semestre-${semestreIndex}`;

        const header = document.createElement('div');
        header.className = 'semestre-header';
        header.textContent = semestre.nome;
        semestreEl.appendChild(header);

        disciplinasVisiveis.forEach((disciplina) => {
            const disciplinaEl = document.createElement('div');
            const codigoNormalizado = normalizarCodigo(disciplina.id);

            disciplinaEl.className = 'disciplina';
            disciplinaEl.id = codigoNormalizado;
            disciplinaEl.textContent = disciplina.nome;
            disciplinaEl.title = `${disciplina.id} - ${disciplina.nome}`;

            disciplinaEl.addEventListener('click', (event) => {
                event.stopPropagation();
                appState.disciplinaSelecionadaId = codigoNormalizado;

                if (appState.mostrarPendentes) {
                    destacarPreRequisitosPendentes(codigoNormalizado);
                } else {
                    destacarPreRequisitosCompleto(codigoNormalizado);
                }
            });

            semestreEl.appendChild(disciplinaEl);
        });

        container.appendChild(semestreEl);
    });
}

export function inicializarResetCliqueExterno() {
    document.addEventListener('click', (event) => {
        const clicouDisciplina = event.target.closest('.disciplina');
        const clicouControlesZoom = event.target.closest('.zoom-controls');
        const clicouTopBar = event.target.closest('.top-bar');

        if (clicouDisciplina || clicouControlesZoom || clicouTopBar) return;

        appState.disciplinaSelecionadaId = null;
        resetarDestaque();
        limparConexoes();
    });
}