import { appState } from './state.js';
import { redesenharConexoesAtivas } from './grade.js';

export function atualizarZoom(novoZoom) {
    appState.zoomLevel = Math.max(appState.minZoom, Math.min(appState.maxZoom, novoZoom));

    const gradeContainer = document.getElementById('grade-container');
    if (gradeContainer) {
        gradeContainer.style.transform = `scale(${appState.zoomLevel / 100})`;
        gradeContainer.style.transformOrigin = 'top center';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                redesenharConexoesAtivas();
            });
        });
    }

    const zoomLevelDisplay = document.getElementById('zoom-level');
    if (zoomLevelDisplay) {
        zoomLevelDisplay.textContent = `${appState.zoomLevel}%`;
    }

    localStorage.setItem('zoomLevel', String(appState.zoomLevel));
}

function aumentarZoom() {
    atualizarZoom(appState.zoomLevel + appState.zoomStep);
}

function diminuirZoom() {
    atualizarZoom(appState.zoomLevel - appState.zoomStep);
}

export function inicializarControlesZoom() {
    console.log('Inicializando controles de zoom');
    
    const zoomSalvo = localStorage.getItem('zoomLevel');
    if (zoomSalvo) {
        atualizarZoom(parseInt(zoomSalvo, 10));
    } else {
        atualizarZoom(100);
    }

    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const gradeContainer = document.getElementById('grade-container');

    console.log('Botão +:', zoomInBtn);
    console.log('Botão -:', zoomOutBtn);
    console.log('Grade container:', gradeContainer);

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', (e) => {
            console.log('Clique no zoom in');
            e.preventDefault();
            e.stopPropagation();
            aumentarZoom();
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', (e) => {
            console.log('Clique no zoom out');
            e.preventDefault();
            e.stopPropagation();
            diminuirZoom();
        });
    }

    if (gradeContainer) {
        gradeContainer.addEventListener('wheel', (event) => {
            if (!event.ctrlKey) return;

            event.preventDefault();
            if (event.deltaY < 0) {
                aumentarZoom();
            } else {
                diminuirZoom();
            }
        }, { passive: false });
    }
}