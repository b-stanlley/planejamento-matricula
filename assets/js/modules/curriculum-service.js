import { obterNumeroPeriodo } from './utils.js';

export async function carregarJSONDoArquivo(nomeArquivo = 'data/grade2015.json') {
    try {
        const response = await fetch(nomeArquivo);
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const jsonData = await response.json();
        if (!jsonData || Object.keys(jsonData).length === 0) {
            throw new Error('JSON vazio ou inválido');
        }

        const periodos = Object.keys(jsonData).sort((periodoA, periodoB) => {
            return obterNumeroPeriodo(periodoA) - obterNumeroPeriodo(periodoB);
        });

        if (periodos.length === 0) {
            throw new Error('Nenhum período encontrado no JSON');
        }

        const semestres = periodos.reduce((listaSemestres, periodo) => {
            const disciplinas = jsonData[periodo];
            if (!Array.isArray(disciplinas)) {
                return listaSemestres;
            }

            const disciplinasValidas = disciplinas.filter((disciplina) => {
                return disciplina && disciplina.codigo && disciplina.disciplina;
            });

            if (disciplinasValidas.length === 0) {
                return listaSemestres;
            }

            listaSemestres.push({
                nome: periodo,
                disciplinas: disciplinasValidas.map((disciplina) => ({
                    id: disciplina.codigo,
                    nome: disciplina.disciplina,
                    requisitosTotais: Array.isArray(disciplina.prerequisitos?.totais)
                        ? disciplina.prerequisitos.totais
                        : [],
                    requisitosParciais: Array.isArray(disciplina.prerequisitos?.parciais)
                        ? disciplina.prerequisitos.parciais
                        : [],
                    coRequisitos: Array.isArray(disciplina.co_requisitos)
                        ? disciplina.co_requisitos
                        : []
                }))
            });

            return listaSemestres;
        }, []);

        if (semestres.length === 0) {
            throw new Error('Nenhum semestre válido foi processado');
        }

        return { semestres };
    } catch (error) {
        console.error('Erro ao carregar ou processar o arquivo JSON:', error);
        alert(`Erro ao carregar o arquivo JSON: ${error.message}`);
        return null;
    }
}