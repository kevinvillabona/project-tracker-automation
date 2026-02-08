/**
 * DASHBOARD CORE transformado de C# a JS para ejemplo de visualización de datos.
 * Sistema de visualización de métricas y roadmap.
 * Autor: Kevin Villabona
 */

/**
 * @typedef {Object} Module
 * @property {number} ID
 * @property {string} Nombre
 * @property {number} PorcentajeAvance
 * @property {string} FechaModificacion
 * @property {string} ID_Fase
 * @property {string} FechaInicio
 * @property {string} FechaFin
 * @property {string} Status
 * @property {string} StatusIcon
 * @property {string} StatusClaseFront
 * @property {string} Comentario
 * @property {number} TotalHours
 */

// --- CONFIGURACIÓN ---
// URLs públicas de Google Sheets (Formato CSV)
const CONFIG = Object.freeze({
    URL_PHASES: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdFVuQVSZo1N3tHpUTflvm4ihZwf03NVdgMmuUM5sfhWp7BqngiwiFKnpi-2h2Zz5SYegu5hoc5oWj/pub?gid=292334100&single=true&output=csv",
    URL_MODULES: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRYZ3wUgfEFjk9TzHKxaZf9iLGE30KDLOwR6_ufaanaz0ocO_4S0xNuJJtcfzpy1JyzasGeAPZ_s96S/pub?gid=1457823520&single=true&output=csv",
    URL_DAILY_LOGS: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQyyn3C4bgZfVW-AW2O4nfwKiDqCiLA7pAuhvN2x09sIMUweviV7C6NmhJbeZA2qgr5Mp_H1GqkN5rC/pub?gid=108739046&single=true&output=csv",
    ACTION_ICONS: {
        'Bugfix': '🐞',
        'Testing': '🧪',
        'Investigación': '🔍',
        'Documentación': '📄',
        'default': '🔧'
    }
});

// --- SERVICIO DE DATOS ---
const DataService = {
    /**
     * Obtiene y procesa todos los datos necesarios para el dashboard.
     * Realiza peticiones en paralelo para optimizar tiempos de carga.
     */
    async fetchAll() {
        try {
            const [phasesRes, modulesRes, logsRes] = await Promise.all([
                fetch(CONFIG.URL_PHASES),
                fetch(CONFIG.URL_MODULES),
                fetch(CONFIG.URL_DAILY_LOGS)
            ]);

            if (!phasesRes.ok || !modulesRes.ok || !logsRes.ok) throw new Error("Error en la respuesta de red");

            const phasesText = await phasesRes.text();
            const modulesText = await modulesRes.text();
            const logsText = await logsRes.text();

            const phases = this.parsePhases(phasesText);
            const modules = this.parseModules(modulesText);
            const dailyLogs = this.parseLogs(logsText);

            // Calcular métricas derivadas (horas acumuladas)
            this.aggregateHours(modules, dailyLogs);

            return { phases, modules, dailyLogs };
        } catch (error) {
            console.error("[DataService] Fallo crítico al cargar datos:", error);
            // Propagar error o manejar UI state externamente
            return null;
        }
    },

    /**
     * Parser CSV compatible con RFC 4180.
     * Maneja correctamente celdas que contienen comas dentro de comillas.
     * @param {string} line - Línea cruda del CSV.
     * @returns {string[]} Array de valores parseados.
     */
    parseCSVLine(line) {
        const values = [];
        let inQuotes = false;
        let currentValue = '';

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                    currentValue += '"'; // Manejo de comillas escapadas ("")
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(currentValue);
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue);
        return values;
    },

    /**
     * Convierte texto CSV en array de arrays, omitiendo headers.
     * @param {string} text 
     */
    readCSV(text) {
        const lines = text.split(/\r?\n/);
        const records = [];
        // Comenzamos en i=1 para omitir la cabecera
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            records.push(this.parseCSVLine(lines[i]));
        }
        return records;
    },

    parsePhases(csv) {
        return this.readCSV(csv).map(col => ({
            ID: col[0],
            Nombre: col[1],
            Color: col[2]
        })).filter(p => p.ID);
    },

    parseModules(csv) {
        return this.readCSV(csv).map(col => ({
            ID: parseInt(col[0]) || 0,
            Nombre: col[1],
            PorcentajeAvance: parseInt(col[2]) || 0,
            FechaModificacion: col[3],
            ID_Fase: col[4],
            FechaInicio: col[5],
            FechaFin: col[6],
            Status: col[7],
            StatusIcon: col[8],
            StatusClaseFront: col[9],
            Comentario: col[10],
            TotalHours: 0 // Se calculará posteriormente
        })).filter(m => m.ID);
    },

    parseLogs(csv) {
        return this.readCSV(csv)
            // Filtro de integridad: Asegurar columnas mínimas requeridas
            .filter(col => col.length >= 5)
            .map(col => {
                let date = new Date(col[0]);

                // Fallback para formatos de fecha inconsistentes (dd/mm/yyyy vs mm/dd/yyyy)
                if (isNaN(date.getTime())) {
                    const parts = col[0].split(' ');
                    if (parts.length > 0 && parts[0].includes('/')) {
                        const dateParts = parts[0].split('/');
                        const timePart = parts[1] || '00:00:00';
                        // Forzamos ISO 8601: yyyy-mm-dd
                        date = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${timePart}`);
                    }
                }

                const timeStr = (col[5] || "0").replace(',', '.'); // Normalización decimal

                return {
                    Timestamp: date,
                    Developer: col[1] || "Desconocido",
                    Module: col[2] || "-",
                    ActionType: col[3] || "Info",
                    Message: col[4] || "",
                    WorkingTime: parseFloat(timeStr) || 0
                };
            })
            .sort((a, b) => b.Timestamp - a.Timestamp);
    },

    /**
     * Lógica de Negocio: Agregación de horas.
     * Asocia logs de tiempo a módulos específicos y suma horas de mantenimiento (Bugfix).
     */
    aggregateHours(modules, logs) {
        const modulesByName = modules.filter(m => m.Nombre);

        logs.forEach(log => {
            if (!log.Module) return;

            // Asociación directa por nombre de módulo
            const mainModule = modulesByName.find(m => m.Nombre.toLowerCase() === log.Module.toLowerCase());
            if (mainModule) {
                mainModule.TotalHours += log.WorkingTime;
            }

            // Regla de negocio: Los 'Bugfix' suman tiempo al módulo correspondiente
            if (log.ActionType && log.ActionType.toLowerCase() === 'bugfix') {
                const bugfixModules = modulesByName.filter(m => m.Nombre.toLowerCase().includes('bugfix'));
                bugfixModules.forEach(bm => bm.TotalHours += log.WorkingTime);
            }
        });
    }
};

// --- RENDERIZADOR UI ---
const DashboardApp = (function () {
    // Estado local del módulo
    let _data = { phases: [], modules: [], dailyLogs: [] };
    let _modalInstance = null;
    let _tableInstance = null;

    // Utilidades de formateo y UI
    const utils = {
        getPhaseColor: (id) => (_data.phases.find(p => p.ID === id) || { Color: 'grey' }).Color,

        formatDate: (date) => {
            if (!date || isNaN(date.getTime())) return "-";
            return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        },

        parseCustomDate: function (dateStr) {
            if (!dateStr) return null;
            const parts = dateStr.split('/');
            if (parts.length !== 3) return null;
            // Mes en JS es 0-indexed
            return new Date(parts[2], parts[1] - 1, parts[0]);
        },

        createFeedItem: function (row) {
            const icon = CONFIG.ACTION_ICONS[row.ActionType] || CONFIG.ACTION_ICONS['default'];
            const dateStr = utils.formatDate(row.Timestamp);

            return `
                <div class="feed-item border-start-custom">
                    <div class="feed-header">
                        <span class="feed-dev"><strong>${row.Developer}</strong></span>
                        <span class="feed-date">${dateStr}</span>
                    </div>
                    <div class="feed-body">
                        <span class="badge-type">${icon} ${row.ActionType}</span>
                        <span class="badge-module">[${row.Module}]</span>
                        <span class="feed-msg">${row.Message}</span>
                    </div>
                </div>`;
        }
    };

    // Métodos de Renderizado
    const render = {
        loading: function () {
            // Generación de Skeletons para mejorar UX durante la carga asíncrona
            const skeletonModules = Array(4).fill(0).map(() => `
                <div class="progress-item">
                    <div class="skeleton skeleton-circle"></div>
                    <div class="skeleton skeleton-text" style="width: 100px;"></div>
                    <div class="skeleton skeleton-text" style="width: 60px; height: 10px; margin-top:5px;"></div>
                </div>
            `).join('');
            document.getElementById('modules-container').innerHTML = skeletonModules;

            const skeletonRoadmap = `
                <div class="skeleton skeleton-banner" style="width: 200px;"></div>
                <div class="timeline">
                    ${Array(3).fill(0).map(() => `
                        <div class="timeline-item">
                            <div class="skeleton skeleton-circle" style="width:50px; height:50px; margin: 0 auto 15px auto;"></div>
                            <div class="timeline-content">
                                <div class="skeleton skeleton-text"></div>
                                <div class="skeleton skeleton-text" style="width: 60%;"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            document.getElementById('roadmap-container').innerHTML = skeletonRoadmap;

            const skeletonTable = Array(5).fill(0).map(() => `
                <tr><td colspan="7"><div class="skeleton skeleton-row"></div></td></tr>
            `).join('');
            document.getElementById('table-body').innerHTML = skeletonTable;
        },

        all: function () {
            this.lastUpdate();
            this.modules();
            this.roadmap();
            this.table();
            this.animateCharts();
        },

        lastUpdate: function () {
            let maxDate = new Date('2020-01-01');
            _data.modules.forEach(mod => {
                const dateObj = utils.parseCustomDate(mod.FechaModificacion);
                if (dateObj && dateObj > maxDate) maxDate = dateObj;
            });

            const finalDate = maxDate > new Date('2020-01-01') ? maxDate : new Date();
            const container = document.getElementById('last-update-container');
            if (container) container.innerText = `Última actualización: ${utils.formatDate(finalDate)}`;
        },

        modules: function () {
            const html = _data.modules
                .sort((a, b) => b.PorcentajeAvance - a.PorcentajeAvance)
                .map(mod => {
                    const theme = utils.getPhaseColor(mod.ID_Fase);
                    let innerContent = `<span class="counter">0</span>%`;
                    let circleClass = "circle-inner";
                    const totalHours = Math.round(mod.TotalHours * 10) / 10;

                    // Visualización condicional: Si está al 0% o 100%, mostramos horas en lugar de porcentaje
                    if ((mod.PorcentajeAvance === 0 || mod.PorcentajeAvance === 100) && totalHours > 0) {
                        const hourText = totalHours + "hs";
                        innerContent = hourText;
                        if (hourText.length > 4) circleClass += " small-text-chart";
                    }

                    const subtitle = totalHours > 0 ?
                        `<div class="hours-subtitle">${totalHours} hs dedicadas</div>` :
                        `<div class="hours-subtitle">-</div>`;

                    return `
                    <div class="progress-item interactive-card" data-id="${mod.ID}">
                        <div class="circle-chart theme-${theme}" data-percent="${mod.PorcentajeAvance}">
                            <div class="${circleClass}">${innerContent}</div>
                        </div>
                        <div class="label">${mod.Nombre}</div>
                        ${subtitle}
                    </div>`;
                }).join('');

            document.getElementById('modules-container').innerHTML = html;

            // Binding de eventos click
            document.querySelectorAll('.progress-item').forEach(el => {
                el.addEventListener('click', () => DashboardApp.showDetails(parseInt(el.dataset.id)));
            });
        },

        roadmap: function () {
            const html = _data.phases.map(phase => {
                // Filtrar y ordenar módulos cronológicamente por fecha fin
                const modules = _data.modules
                    .filter(m => m.ID_Fase === phase.ID && m.FechaInicio)
                    .sort((a, b) => {
                        const dateA = utils.parseCustomDate(a.FechaFin);
                        const dateB = utils.parseCustomDate(b.FechaFin);
                        if (!dateA) return 1;
                        if (!dateB) return -1;
                        return dateA - dateB;
                    });

                if (modules.length === 0) return '';

                const items = modules.map(mod => `
                    <div class="timeline-item interactive-card ${mod.StatusClaseFront}" data-id="${mod.ID}">
                        <div class="timeline-icon">${mod.StatusIcon}</div>
                        <div class="timeline-content">
                            <div class="date-container">
                                <span class="timeline-start">Inicio: ${mod.FechaInicio}</span>
                                <span class="timeline-end">Fin: ${mod.FechaFin}</span>
                            </div>
                            <div class="timeline-title">${mod.Nombre}</div>
                        </div>
                    </div>`).join('');

                return `<div class="phase-banner banner-${phase.Color}">${phase.Nombre}</div>
                        <div class="timeline">${items}</div>`;
            }).join('');

            document.getElementById('roadmap-container').innerHTML = html;

            document.querySelectorAll('.timeline-item').forEach(el => {
                el.addEventListener('click', () => DashboardApp.showDetails(parseInt(el.dataset.id)));
            });
        },

        table: function () {
            const html = _data.modules
                .sort((a, b) => b.PorcentajeAvance - a.PorcentajeAvance)
                .map(mod => {
                    const phase = _data.phases.find(p => p.ID === mod.ID_Fase);
                    const pillClass = mod.StatusClaseFront === 'status-done' ? 'pill-done' :
                        (mod.StatusClaseFront === 'status-progress' ? 'pill-progress' : 'pill-planned');

                    const totalHours = Math.round(mod.TotalHours * 10) / 10;

                    return `
                    <tr class="clickable-row" data-id="${mod.ID}">
                        <td style="font-weight:700; color:var(--brand-black)">${mod.Nombre}</td>
                        <td><span class="badge-phase bg-${phase.Color}">${phase.Nombre.split(':')[0]}</span></td>
                        <td>${mod.FechaInicio || '-'}</td>
                        <td>${mod.FechaFin || '-'}</td>
                        <td><strong>${totalHours} hs</strong></td>
                        <td><span class="status-pill ${pillClass}">${mod.StatusIcon || ''} ${mod.Status || 'N/A'}</span></td>
                        <td>
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:50px; background:#eee; height:6px; border-radius:3px;">
                                    <div style="width:${mod.PorcentajeAvance}%; background:var(--brand-orange); height:100%; border-radius:3px;"></div>
                                </div>
                                <small>${mod.PorcentajeAvance}%</small>
                            </div>
                        </td>
                    </tr>`;
                }).join('');

            document.getElementById('table-body').innerHTML = html;

            document.querySelectorAll('.clickable-row').forEach(el => {
                el.addEventListener('click', () => DashboardApp.showDetails(parseInt(el.dataset.id)));
            });
        },

        animateCharts: function () {
            document.querySelectorAll('.circle-chart').forEach(chart => {
                const target = parseInt(chart.getAttribute('data-percent'));
                const counter = chart.querySelector('.counter');

                if (counter) {
                    let current = 0;
                    // Resetear propiedad CSS antes de animar
                    chart.style.removeProperty('--deg');
                    counter.innerText = '0';

                    setTimeout(() => chart.style.setProperty('--deg', (360 * target / 100) + 'deg'), 100);

                    const interval = setInterval(() => {
                        if (current >= target) clearInterval(interval);
                        else { current++; counter.innerText = current; }
                    }, 15);
                } else {
                    // Animación solo CSS si no hay contador numérico
                    setTimeout(() => chart.style.setProperty('--deg', (360 * target / 100) + 'deg'), 100);
                }
            });
        }
    };

    // API Pública
    return {
        init: async function () {
            render.loading(); // Estado inicial inmediato

            const rawData = await DataService.fetchAll();

            if (!rawData) {
                document.getElementById('modules-container').innerHTML = '<p class="text-danger text-center">No se pudieron cargar los datos. Verifique la conexión o la consola.</p>';
                return;
            }

            _data = rawData;
            render.all();

            this.setupDataTable();
            this.setupFilters();
            this.setupEventListeners();
        },

        toggleView: function () {
            const isTableMode = document.getElementById('viewSwitch').checked;
            document.getElementById('gridView').style.display = isTableMode ? 'none' : 'grid';
            document.getElementById('tableView').style.display = isTableMode ? 'block' : 'none';

            if (!isTableMode) render.animateCharts();
        },

        showDetails: function (moduleId) {
            const module = _data.modules.find(m => m.ID === moduleId);
            if (!module) return;

            document.getElementById('modalTitle').innerText = module.Nombre;
            document.getElementById('modalDescription').innerText = module.Comentario || "Sin descripción disponible.";

            const datesEl = document.getElementById('modalDates');
            datesEl.style.display = module.FechaInicio ? 'block' : 'none';
            datesEl.innerText = module.FechaInicio ? `📅 Cronograma: ${module.FechaInicio} al ${module.FechaFin}` : '';

            // Inicialización segura de Bootstrap Modal
            const el = document.getElementById('infoModal');
            if (!_modalInstance && window.bootstrap) {
                _modalInstance = new bootstrap.Modal(el);
            }
            if (_modalInstance) _modalInstance.show();
        },

        setupDataTable: function () {
            if (_tableInstance) _tableInstance.destroy();

            if (window.$ && $.fn.DataTable) {
                _tableInstance = $('#activityTable').DataTable({
                    data: _data.dailyLogs,
                    dom: '<"row"<"col-sm-6"l><"col-sm-6"f>>rtp',
                    language: { url: "//cdn.datatables.net/plug-ins/1.13.4/i18n/es-ES.json" },
                    pageLength: 10,
                    lengthMenu: [10, 20, 50],
                    order: [[0, 'desc']],
                    columns: [
                        { data: 'Timestamp', visible: false },
                        { data: 'Developer', visible: false },
                        { data: 'Module', visible: false },
                        { data: 'ActionType', visible: false },
                        {
                            data: null,
                            orderable: false,
                            render: (data, type, row) => utils.createFeedItem(row)
                        }
                    ]
                });
            }
        },

        setupFilters: function () {
            const uniqueMods = [...new Set(_data.dailyLogs.map(item => item.Module))];
            const select = window.$ ? $('#filter-module') : null;

            if (select) {
                select.find('option:not(:first)').remove();
                uniqueMods.forEach(mod => select.append(`<option value="${mod}">${mod}</option>`));

                select.off('change').on('change', function () {
                    const val = $.fn.dataTable.util.escapeRegex($(this).val());
                    if (_tableInstance) {
                        _tableInstance.column(2).search(val ? val : '', true, false).draw();
                    }
                });
            }
        },

        setupEventListeners: function () {
            const switchEl = document.getElementById('viewSwitch');
            if (switchEl) switchEl.addEventListener('change', () => this.toggleView());
        }
    };
})();

// Punto de entrada
document.addEventListener('DOMContentLoaded', () => {
    DashboardApp.init();
});