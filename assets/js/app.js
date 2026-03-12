import { carregarJSONDoArquivo } from './modules/curriculum-service.js';
import { criarGradeCurricular, inicializarResetCliqueExterno } from './modules/grade.js';
import { inicializarUploadHistorico } from './modules/history.js';
import { inicializarNavegacaoTelas, mostrarTela } from './modules/navigation.js';
import {
    atualizarAcessoTelaPlanos,
    inicializarTelaPlanos,
    popularSelectPeriodos,
    renderizarPlanoMatricula
} from './modules/plans.js';
import { appState } from './modules/state.js';
import { inicializarControlesZoom } from './modules/zoom.js';

window.materiasPendentes = [];
window.materiasCursadas = [];

async function carregarGrade(nomeArquivo = appState.nomeGradeAtual) {
    appState.nomeGradeAtual = nomeArquivo;
    const materias = await carregarJSONDoArquivo(nomeArquivo);
    if (!materias) return null;

    appState.materias = materias;
    criarGradeCurricular(materias);
    popularSelectPeriodos();

    if (appState.telaAtual === 'planos') {
        renderizarPlanoMatricula();
    }

    return materias;
}

function resetarHistorico() {
    window.materiasPendentes = [];
    window.materiasCursadas = [];
    appState.historicoCarregado = false;
    atualizarAcessoTelaPlanos();
}

function inicializarFiltros() {
    const filtroPendentes = document.getElementById('filtro-pendentes');
    const filtroCorequisitos = document.getElementById('filtro-corequisitos');

    if (filtroPendentes) {
        filtroPendentes.addEventListener('change', (event) => {
            if (event.target.checked && !window.materiasPendentes.length) {
                alert('Por favor, faça o upload do histórico em PDF para visualizar as matérias pendentes.');
                filtroPendentes.checked = false;
                return;
            }

            appState.mostrarPendentes = event.target.checked;
            criarGradeCurricular(appState.materias);
        });
    }

    if (filtroCorequisitos) {
        appState.mostrarCorequisitos = filtroCorequisitos.checked;
        filtroCorequisitos.addEventListener('change', (event) => {
            appState.mostrarCorequisitos = event.target.checked;
            criarGradeCurricular(appState.materias);
        });
    }
}

function inicializarSeletorGrade() {
    const seletorGrade = document.getElementById('seletor-grade');
    if (!seletorGrade) return;

    seletorGrade.value = appState.nomeGradeAtual;
    seletorGrade.addEventListener('change', async (event) => {
        const proximaGrade = event.target.value;
        resetarHistorico();

        const filtroPendentes = document.getElementById('filtro-pendentes');
        if (filtroPendentes) {
            filtroPendentes.checked = false;
        }

        appState.mostrarPendentes = false;

        if (appState.telaAtual === 'planos') {
            mostrarTela('grade');
        }

        await carregarGrade(proximaGrade);
    });
}

window.addEventListener('load', async () => {
    inicializarControlesZoom();
    inicializarNavegacaoTelas();
    inicializarTelaPlanos();
    inicializarResetCliqueExterno();
    inicializarUploadHistorico();
    inicializarFiltros();
    inicializarSeletorGrade();
    atualizarAcessoTelaPlanos();

    await carregarGrade(appState.nomeGradeAtual);
});

window.carregarJSON = carregarGrade;