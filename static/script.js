document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Cargado. Iniciando Audio Architect...");
    
    const tasksList = document.getElementById('tasksList');
    const template = document.getElementById('taskTemplate');
    
    if (!tasksList || !template) {
        console.error("No se encontraron los elementos críticos del DOM (tasksList o taskTemplate).");
        return;
    }

    // Botones principales
    const addUrlBtn = document.getElementById('addUrlBtn');
    const startProcessBtn = document.getElementById('startProcessBtn');
    const cancelProcessBtn = document.getElementById('cancelProcessBtn');
    const clearTasksBtn = document.getElementById('clearTasksBtn');
    const bulkUploadFile = document.getElementById('bulkUploadFile');
    const gitSyncBtn = document.getElementById('gitSyncBtn');
    
    // Consola y Templates
    const consoleOutput = document.getElementById('consoleOutput');
    const statusIndicator = document.getElementById('statusIndicator');
    const timerIndicator = document.getElementById('timerIndicator');
    const timerVal = document.getElementById('timerVal');
    
    // UI Popovers
    const guideToggleBtn = document.getElementById('guideToggleBtn');
    const guideBlock = document.getElementById('guideBlock');
    const pasteJsonToggleBtn = document.getElementById('pasteJsonToggleBtn');
    const pasteJsonBlock = document.getElementById('pasteJsonBlock');
    const pasteJsonInput = document.getElementById('pasteJsonInput');
    const loadPastedJsonBtn = document.getElementById('loadPastedJsonBtn');

    let pollInterval = null;
    let timerInterval = null;
    let timerStart = null;

    function updateQueueCount() {
        const count = tasksList.querySelectorAll('.task-card').length;
        const title = document.getElementById('queueTitle');
        if (title) title.textContent = `Cola de Tareas (${count})`;
    }

    function init() {
        tasksList.innerHTML = '';
        addTask();
    }

    init();

    if (addUrlBtn) addUrlBtn.addEventListener('click', () => addTask());
    
    clearTasksBtn.addEventListener('click', () => {
        tasksList.innerHTML = '';
        addTask();
    });

    bulkUploadFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);
                if (Array.isArray(data)) {
                    tasksList.innerHTML = '';
                    data.forEach(item => addTask(item));
                    consoleOutput.textContent = `✅ JSON cargado satisfactoriamente (${data.length} enlaces).`;
                } else {
                    throw new Error("El JSON debe ser un arreglo de objetos.");
                }
            } catch (error) {
                alert("Error parseando JSON: " + error.message);
            }
            bulkUploadFile.value = "";
        };
        reader.readAsText(file);
    });

    if (guideToggleBtn) {
        guideToggleBtn.addEventListener('click', () => {
            guideBlock.style.display = guideBlock.style.display === 'none' ? 'block' : 'none';
            if (pasteJsonBlock) pasteJsonBlock.style.display = 'none';
        });
    }

    if (pasteJsonToggleBtn) {
        pasteJsonToggleBtn.addEventListener('click', () => {
            pasteJsonBlock.style.display = pasteJsonBlock.style.display === 'none' ? 'block' : 'none';
            if (guideBlock) guideBlock.style.display = 'none';
        });
    }

    if (loadPastedJsonBtn) {
        loadPastedJsonBtn.addEventListener('click', () => {
            const jsonText = pasteJsonInput.value.trim();
            if (!jsonText) {
                alert("Por favor, pega el código JSON primero.");
                return;
            }
            try {
                const data = JSON.parse(jsonText);
                if (Array.isArray(data)) {
                    tasksList.innerHTML = '';
                    data.forEach(item => addTask(item));
                    consoleOutput.textContent = `✅ JSON cargado desde portapapeles satisfactoriamente (${data.length} enlaces).`;
                    pasteJsonInput.value = "";
                    pasteJsonBlock.style.display = 'none';
                } else {
                    throw new Error("El JSON debe ser un arreglo de objetos.");
                }
            } catch (error) {
                alert("Error parseando JSON: " + error.message);
            }
        });
    }

    if (gitSyncBtn) {
        gitSyncBtn.addEventListener('click', async () => {
            gitSyncBtn.disabled = true;
            const originalText = gitSyncBtn.textContent;
            gitSyncBtn.textContent = "⏳ Sincronizando con GitHub...";
            consoleOutput.textContent += "\nIniciando sincronización con GitHub (git add, commit, push)...";
            
            try {
                const res = await fetch('/api/git_sync', { method: 'POST' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Error desconocido");
                
                consoleOutput.innerHTML += `<br><span style="color: #10b981;">✅ ${data.status}</span>`;
                alert("Sincronización con GitHub exitosa.");
            } catch (error) {
                consoleOutput.innerHTML += `<br><span style="color: #ef4444;">❌ Error Git: ${error.message}</span>`;
                alert("Error al sincronizar: " + error.message);
            } finally {
                gitSyncBtn.disabled = false;
                gitSyncBtn.textContent = originalText;
                consoleOutput.scrollTop = consoleOutput.scrollHeight;
            }
        });
    }

    function addTask(preload = null) {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.task-card');
        
        card.querySelector('.remove-task').addEventListener('click', () => {
            card.classList.add('fade-out');
            setTimeout(() => {
                card.remove();
                updateQueueCount();
            }, 300);
        });

        const urlInput = card.querySelector('.task-url');
        urlInput.addEventListener('input', () => {
            const val = urlInput.value.trim();
            if(!val) {
                urlInput.classList.remove('url-valid', 'url-invalid');
            } else if(val.includes('youtube.com/') || val.includes('youtu.be/')) {
                urlInput.classList.add('url-valid');
                urlInput.classList.remove('url-invalid');
            } else {
                urlInput.classList.add('url-invalid');
                urlInput.classList.remove('url-valid');
            }
        });

        const pitchSlider = card.querySelector('.task-pitch');
        const pitchVal = card.querySelector('.val-pitch');
        if (pitchSlider && pitchVal) pitchSlider.addEventListener('input', () => pitchVal.textContent = pitchSlider.value);

        const bassSlider = card.querySelector('.task-bass');
        const bassVal = card.querySelector('.val-bass');
        if (bassSlider && bassVal) bassSlider.addEventListener('input', () => bassVal.textContent = bassSlider.value);

        const panSlider = card.querySelector('.task-pan');
        const panVal = card.querySelector('.val-pan');
        if (panSlider && panVal) panSlider.addEventListener('input', () => panVal.textContent = panSlider.value);

        const previewBtn = card.querySelector('.preview-btn');
        const audioPlayer = card.querySelector('.task-audio');
        if (previewBtn) {
            previewBtn.addEventListener('click', async () => {
                const url = urlInput.value.trim();
                if (!url) {
                    alert("Ingresa una URL primero.");
                    return;
                }

                const startM = card.querySelector('.task-start-m').value || 0;
                const startS = card.querySelector('.task-start-s').value || 0;
                const durM = card.querySelector('.task-dur-m').value || 0;
                const durS = card.querySelector('.task-dur-s').value || 0;
                const speed = card.querySelector('.task-speed').value || 1.0;
                const fadeIn = card.querySelector('.task-fade-in').value || 0;
                const fadeOut = card.querySelector('.task-fade-out').value || 0;
                const pitch = pitchSlider.value || 0;
                const bass = bassSlider.value || 0;
                const pan = panSlider.value || 0;

                try {
                    previewBtn.disabled = true;
                    previewBtn.textContent = "⌛ Generando...";
                    
                    const res = await fetch('/api/preview', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url,
                            start: `${startM}:${startS}`,
                            duration: `${durM}:${durS}`,
                            speed,
                            fade_in: fadeIn,
                            fade_out: fadeOut,
                            pitch: pitch,
                            bass: bass,
                            pan: pan,
                            pan_dinamico: card.querySelector('.task-pan-dinamico') ? card.querySelector('.task-pan-dinamico').checked : false
                        })
                    });

                    if (!res.ok) throw new Error(await res.text());
                    const data = await res.json();

                    audioPlayer.src = data.preview_url;
                    audioPlayer.style.display = "block";
                    audioPlayer.play();
                    
                    previewBtn.textContent = "🎧 Actualizar Previa";
                    previewBtn.disabled = false;

                } catch (e) {
                    alert("Error en previa: " + e.message);
                    previewBtn.textContent = "🎧 Generar Previa";
                    previewBtn.disabled = false;
                }
            });
        }

        if (preload) {
            if (preload.url) card.querySelector('.task-url').value = preload.url;
            if (preload.speed) card.querySelector('.task-speed').value = preload.speed;
            
            if (preload.start) {
                const parts = preload.start.split(':');
                if (parts.length === 2) {
                    card.querySelector('.task-start-m').value = parseInt(parts[0]);
                    card.querySelector('.task-start-s').value = parseInt(parts[1]);
                } else {
                    card.querySelector('.task-start-s').value = parseInt(parts[0]);
                }
            }
            if (preload.duration) {
                const parts = preload.duration.split(':');
                if (parts.length === 2) {
                    card.querySelector('.task-dur-m').value = parseInt(parts[0]);
                    card.querySelector('.task-dur-s').value = parseInt(parts[1]);
                } else {
                    card.querySelector('.task-dur-s').value = parseInt(parts[0]);
                }
            }
            if (preload.fade_in !== undefined) card.querySelector('.task-fade-in').value = preload.fade_in;
            if (preload.fade_out !== undefined) card.querySelector('.task-fade-out').value = preload.fade_out;
            if (preload.artist !== undefined) card.querySelector('.task-artist').value = preload.artist;
            if (preload.title !== undefined) card.querySelector('.task-title').value = preload.title;
            if (preload.pitch !== undefined) {
                const el = card.querySelector('.task-pitch'); if(el) el.value = preload.pitch;
                const valEl = card.querySelector('.val-pitch'); if(valEl) valEl.textContent = preload.pitch;
            }
            if (preload.bass !== undefined) {
                const el = card.querySelector('.task-bass'); if(el) el.value = preload.bass;
                const valEl = card.querySelector('.val-bass'); if(valEl) valEl.textContent = preload.bass;
            }
            if (preload.pan !== undefined) {
                const el = card.querySelector('.task-pan'); if(el) el.value = preload.pan;
                const valEl = card.querySelector('.val-pan'); if(valEl) valEl.textContent = preload.pan;
            }
            if (preload.pan_dinamico !== undefined) {
                const el = card.querySelector('.task-pan-dinamico');
                if (el) el.checked = preload.pan_dinamico;
            }
        }
        
        tasksList.appendChild(clone);
        updateQueueCount();
    }

    startProcessBtn.addEventListener('click', async () => {
        const folderName = document.getElementById('folderName').value;
        const taskCards = document.querySelectorAll('.task-card');
        
        const tasks = Array.from(taskCards).map(card => {
            const url = card.querySelector('.task-url').value;
            const artist = card.querySelector('.task-artist').value;
            const title = card.querySelector('.task-title').value;
            const startM = card.querySelector('.task-start-m').value || 0;
            const startS = card.querySelector('.task-start-s').value || 0;
            const durM = card.querySelector('.task-dur-m').value || 0;
            const durS = card.querySelector('.task-dur-s').value || 0;
            const speed = card.querySelector('.task-speed').value || 1.0;
            const fadeIn = card.querySelector('.task-fade-in').value || 0;
            const fadeOut = card.querySelector('.task-fade-out').value || 0;
            const pitch = card.querySelector('.task-pitch').value || 0;
            const bass = card.querySelector('.task-bass').value || 0;
            const pan = card.querySelector('.task-pan').value || 0;
            const panDinamico = card.querySelector('.task-pan-dinamico') ? card.querySelector('.task-pan-dinamico').checked : false;

            return {
                url: url,
                artist: artist,
                title: title,
                start: `${startM}:${startS}`,
                duration: `${durM}:${durS}`,
                speed: speed,
                fade_in: fadeIn,
                fade_out: fadeOut,
                pitch: pitch,
                bass: bass,
                pan: pan,
                pan_dinamico: panDinamico
            };
        }).filter(t => t.url.trim() !== '');

        if (tasks.length === 0) {
            alert("No hay URLs válidas para procesar.");
            return;
        }

        const failedBox = document.getElementById('failedItemsBox');
        if(failedBox) failedBox.style.display = 'none';

        try {
            startProcessBtn.disabled = true;
            statusIndicator.textContent = "Processing...";
            statusIndicator.className = "status-active";
            consoleOutput.textContent = "Enviando lote al backend orquestador...";

            if (timerInterval) clearInterval(timerInterval);
            timerStart = Date.now();
            timerVal.textContent = "00:00";
            timerIndicator.style.display = "inline";
            timerInterval = setInterval(() => {
                const elapsedMs = Date.now() - timerStart;
                const totalSecs = Math.floor(elapsedMs / 1000);
                const minutes = Math.floor(totalSecs / 60);
                const seconds = totalSecs % 60;
                
                const minStr = String(minutes).padStart(2, '0');
                const secStr = String(seconds).padStart(2, '0');
                timerVal.textContent = `${minStr}:${secStr}`;
            }, 1000);

            window.currentTotalTasks = tasks.length;
            document.getElementById('globalProgressBar').style.width = `0%`;
            document.getElementById('progressText').textContent = `0%`;

            if (cancelProcessBtn) {
                cancelProcessBtn.style.display = "inline-flex";
                cancelProcessBtn.disabled = false;
            }

            const res = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder: folderName, tasks })
            });

            if (!res.ok) throw new Error(await res.text());

            startPolling();

        } catch (e) {
            consoleOutput.textContent = "Error de Ingesta: " + e.message;
            resetUI();
        }
    });

    if (cancelProcessBtn) {
        cancelProcessBtn.addEventListener('click', async () => {
            if (confirm("¿Estás seguro de que deseas cancelar el procesamiento de este lote?")) {
                try {
                    cancelProcessBtn.disabled = true;
                    consoleOutput.textContent += "\n⏳ Solicitando cancelación del proceso...";
                    const res = await fetch('/api/cancel', { method: 'POST' });
                    if (!res.ok) throw new Error(await res.text());
                } catch (e) {
                    consoleOutput.textContent += "\n❌ Error al cancelar: " + e.message;
                    cancelProcessBtn.disabled = false;
                }
            }
        });
    }

    function startPolling() {
        if (pollInterval) clearInterval(pollInterval);
        pollInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                
                const coloredLogs = data.logs.map(line => {
                    if (line.includes("❌")) return `<span style="color: #ef4444;">${line}</span>`;
                    if (line.includes("🛑") || line.includes("⚠️")) return `<span style="color: #f59e0b;">${line}</span>`;
                    if (line.includes("✅")) return `<span style="color: #10b981;">${line}</span>`;
                    return line;
                }).join('<br>');
                
                consoleOutput.innerHTML = coloredLogs;
                consoleOutput.scrollTop = consoleOutput.scrollHeight;

                if (window.currentTotalTasks > 0) {
                    const completedCount = data.logs.filter(l => l.includes("✅ DB actualizada") || l.includes("✅ Audio guardado") || l.includes("❌ Error en") || l.includes("⚠️ Omitida")).length;
                    const progress = Math.min(100, Math.round((completedCount / window.currentTotalTasks) * 100));
                    document.getElementById('globalProgressBar').style.width = `${progress}%`;
                    document.getElementById('progressText').textContent = `${progress}%`;
                }

                if (!data.is_processing && data.logs.length > 0 && data.logs[data.logs.length-1].includes("--- FINALIZADO ---")) {
                    clearInterval(pollInterval);
                    document.getElementById('globalProgressBar').style.width = `100%`;
                    document.getElementById('progressText').textContent = `100%`;
                    if (timerInterval) {
                        clearInterval(timerInterval);
                        timerInterval = null;
                    }

                    if (data.failed_items && data.failed_items.length > 0) {
                        const failedBox = document.getElementById('failedItemsBox');
                        const failedJson = document.getElementById('failedItemsJson');
                        if (failedBox && failedJson) {
                            failedBox.style.display = 'block';
                            failedJson.value = JSON.stringify(data.failed_items, null, 2);
                        }
                    }
                    resetUI();
                }
            } catch(e) {
                console.error("Polling error", e);
            }
        }, 1000);
    }

    function resetUI() {
        startProcessBtn.disabled = false;
        if (cancelProcessBtn) {
            cancelProcessBtn.style.display = "none";
            cancelProcessBtn.disabled = false;
        }
        statusIndicator.textContent = "Idle";
        statusIndicator.className = "status-idle";
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    const copyFailedBtn = document.getElementById('copyFailedBtn');
    if (copyFailedBtn) {
        copyFailedBtn.addEventListener('click', () => {
            const failedJson = document.getElementById('failedItemsJson');
            failedJson.select();
            document.execCommand('copy');
            const originalText = copyFailedBtn.textContent;
            copyFailedBtn.textContent = "✅ ¡Copiado!";
            setTimeout(() => {
                copyFailedBtn.textContent = originalText;
            }, 2000);
        });
    }
});
