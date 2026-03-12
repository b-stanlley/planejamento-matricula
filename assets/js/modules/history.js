import { appState } from './state.js';
import { criarGradeCurricular } from './grade.js';
import { mostrarTela } from './navigation.js';
import { inferirPeriodoAtual, renderizarPlanoMatricula, atualizarAcessoTelaPlanos } from './plans.js';
import { extrairCodigosSecaoHistorico, obterTodosCodigosGrade } from './utils.js';

export function inicializarUploadHistorico() {
    const uploadHistorico = document.getElementById('upload-historico');
    if (!uploadHistorico) return;

    uploadHistorico.addEventListener('change', async (event) => {
        const [file] = event.target.files;
        if (!file) return;

        if (!globalThis.pdfjsLib) {
            alert('A biblioteca de leitura de PDF não foi carregada.');
            return;
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await globalThis.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let textoCompleto = '';

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            textoCompleto += `${content.items.map((item) => item.str).join(' ')}\n`;
        }

        const codigosGrade = obterTodosCodigosGrade(appState.materias);
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
        appState.historicoCarregado = true;
        atualizarAcessoTelaPlanos();

        const periodoInferido = inferirPeriodoAtual(new Set(window.materiasCursadas || []));
        alert(
            `Histórico analisado!`
        );

        criarGradeCurricular(appState.materias);
        if (appState.telaAtual === 'planos') {
            renderizarPlanoMatricula();
        } else if (appState.telaAtual !== 'grade') {
            mostrarTela('grade');
        }

        uploadHistorico.value = '';
    });
}