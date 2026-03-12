import { appState } from './state.js';
import { renderizarPlanoMatricula } from './plans.js';

export function mostrarTela(nomeTela) {
    appState.telaAtual = nomeTela;

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

export function inicializarNavegacaoTelas() {
    const btnTelaGrade = document.getElementById('btn-tela-grade');
    const btnTelaPlanos = document.getElementById('btn-tela-planos');

    if (btnTelaGrade) {
        btnTelaGrade.addEventListener('click', () => mostrarTela('grade'));
    }

    if (btnTelaPlanos) {
        btnTelaPlanos.addEventListener('click', () => {
            if (!appState.historicoCarregado) {
                alert('Para acessar planos de matricula, envie o historico em PDF primeiro.');
                return;
            }

            mostrarTela('planos');
            renderizarPlanoMatricula();
        });
    }
}