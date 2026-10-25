document.addEventListener('DOMContentLoaded', () => {
    console.log("Audio Architect UI V3 Inicializada");

    // --- TOAST NOTIFICATIONS (Centro Superior con tiempo extendido y botón de cierre) ---
    const toastContainer = document.getElementById('toast-container');
    function showToast(message, type = 'info', durationMs = null) {
        if (!durationMs) {
            // Tiempos más generosos para lectura cómoda:
            durationMs = (type === 'warning' || type === 'error') ? 9000 : 6000;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ️';
        if(type === 'success') icon = '✅';
        if(type === 'error') icon = '❌';
        if(type === 'warning') icon = '⚠️';

        toast.innerHTML = `
            <span style="font-size: 1.3rem; line-height: 1;">${icon}</span>
            <div style="flex: 1; word-break: break-word;">${message}</div>
            <button type="button" class="toast-close-btn" title="Cerrar">&times;</button>
            <div class="toast-progress-bar" style="transition: transform ${durationMs}ms linear; transform: scaleX(1);"></div>
        `;

        toastContainer.appendChild(toast);

        // Disparar barra de progreso
        const bar = toast.querySelector('.toast-progress-bar');
        setTimeout(() => {
            if (bar) bar.style.transform = 'scaleX(0)';
        }, 20);

        let timeoutId;
        const removeToast = () => {
            toast.style.animation = 'slideUpOut 0.25s ease forwards';
            setTimeout(() => toast.remove(), 250);
        };

        timeoutId = setTimeout(removeToast, durationMs);

        // Botón de cierre manual
        const closeBtn = toast.querySelector('.toast-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                clearTimeout(timeoutId);
                removeToast();
            });
        }

        // Si el usuario pone el mouse encima, pausar el temporizador
        toast.addEventListener('mouseenter', () => {
            clearTimeout(timeoutId);
            if (bar) bar.style.transition = 'none';
        });
        toast.addEventListener('mouseleave', () => {
            timeoutId = setTimeout(removeToast, 2500);
        });
    }

    // --- TAB NAVIGATION ---
    const navButtons = document.querySelectorAll('#sidebarNav button');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(t => t.classList.remove('active'));

            btn.classList.add('active');
            const targetEl = document.getElementById(btn.dataset.target);
            if (targetEl) targetEl.classList.add('active');
            
            // Guardar en localStorage
            localStorage.setItem('activeTab', btn.dataset.target);

            // Si entra a la pestaña de catálogo o herramientas, refrescar carpetas
            if (btn.dataset.target === 'catalog-tab') {
                if (typeof loadCatalogFolders === 'function') {
                    loadCatalogFolders();
                }
            } else if (btn.dataset.target === 'tools-tab') {
                if (typeof loadToolsFolders === 'function') {
                    loadToolsFolders();
                }
            }
        });
    });
    
    // Restaurar tab activo al recargar
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) {
        const targetBtn = Array.from(navButtons).find(b => b.dataset.target === savedTab);
        if (targetBtn) targetBtn.click();
    }

    // --- PROFILES MANAGER ---
    let currentProfiles = [];
    const profileSelect = document.getElementById('profileSelect');
    
    // Inputs
    const pName = document.getElementById('profName');
    const pAtToken = document.getElementById('profAtToken');
    const pAtBase = document.getElementById('profAtBase');
    const pAtTable = document.getElementById('profAtTable');
    const pBwToken = document.getElementById('profBwToken');
    const pBwTable = document.getElementById('profBwTable');
    
    // Nuevos campos Inyección
    const pTargetFolder = document.getElementById('profTargetFolder');
    const pColAudio = document.getElementById('profColAudio');
    const pColArtist = document.getElementById('profColArtist');
    const pColTitle = document.getElementById('profColTitle');
    const pColIcon = document.getElementById('profColIcon');
    const pFilenameFormat = document.getElementById('profFilenameFormat');
    
    const profileEditor = document.getElementById('profileEditor');

    function loadProfiles() {
        fetch('/api/profiles')
            .then(r => r.json())
            .then(data => {
                currentProfiles = data;
                profileSelect.innerHTML = '<option value="">-- Selecciona un perfil --</option>';
                data.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.textContent = p.name || 'Sin Nombre';
                    profileSelect.appendChild(opt);
                });
            })
            .catch(e => showToast("Error cargando perfiles: " + e, 'error'));
    }

    profileSelect.addEventListener('change', () => {
        const id = profileSelect.value;
        if (!id) {
            profileEditor.style.opacity = '0.5';
            profileEditor.style.pointerEvents = 'none';
            clearProfileForm();
            return;
        }
        const p = currentProfiles.find(x => x.id === id);
        if (p) {
            profileEditor.style.opacity = '1';
            profileEditor.style.pointerEvents = 'auto';
            pName.value = p.name;
            pAtToken.value = p.airtable_token;
            pAtBase.value = p.airtable_base_id;
            pAtTable.value = p.airtable_table_id;
            pBwToken.value = p.baserow_token;
            pBwTable.value = p.baserow_table_id;
            
            pTargetFolder.value = p.target_folder || "base";
            pColAudio.value = p.col_audio || "Ringtone";
            pColArtist.value = p.col_artist || "Subtitle";
            pColTitle.value = p.col_title || "Title";
            pColIcon.value = p.col_icon || "Icon";
            pFilenameFormat.value = p.filename_format || "artista_titulo";
        }
    });

    document.getElementById('newProfileBtn').addEventListener('click', () => {
        profileSelect.value = "";
        clearProfileForm();
        profileEditor.style.opacity = '1';
        profileEditor.style.pointerEvents = 'auto';
        pName.focus();
    });

    document.getElementById('deleteProfileBtn').addEventListener('click', () => {
        const id = profileSelect.value;
        if (!id) return;
        if (confirm("¿Estás seguro de que quieres borrar este perfil?")) {
            fetch(`/api/profiles/${id}`, { method: 'DELETE' })
                .then(r => r.json())
                .then(d => {
                    showToast("Perfil borrado", "success");
                    loadProfiles();
                    clearProfileForm();
                    profileEditor.style.opacity = '0.5';
                    profileEditor.style.pointerEvents = 'none';
                });
        }
    });

    document.getElementById('saveProfileBtn').addEventListener('click', () => {
        const payload = {
            name: pName.value.trim(),
            airtable_token: pAtToken.value.trim(),
            airtable_base_id: pAtBase.value.trim(),
            airtable_table_id: pAtTable.value.trim(),
            baserow_token: pBwToken.value.trim(),
            baserow_table_id: pBwTable.value.trim(),
            target_folder: pTargetFolder.value.trim() || "base",
            col_audio: pColAudio.value.trim() || "Ringtone",
            col_artist: pColArtist.value.trim() || "Subtitle",
            col_title: pColTitle.value.trim() || "Title",
            col_icon: pColIcon.value.trim() || "Icon",
            filename_format: pFilenameFormat.value || "artista_titulo"
        };
        const id = profileSelect.value;
        if (id) payload.id = id;

        if (!payload.name) {
            showToast("Debes darle un nombre al perfil.", "warning");
            return;
        }

        fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(r => r.json())
        .then(data => {
            showToast("Perfil guardado correctamente", "success");
            loadProfiles();
            setTimeout(() => { profileSelect.value = data.id; }, 200);
        })
        .catch(e => showToast("Error guardando perfil: " + e, "error"));
    });

    function clearProfileForm() {
        pName.value = "";
        pAtToken.value = "";
        pAtBase.value = "";
        pAtTable.value = "";
        pBwToken.value = "";
        pBwTable.value = "";
        pTargetFolder.value = "base";
        pColAudio.value = "Ringtone";
        pColArtist.value = "Subtitle";
        pColTitle.value = "Title";
        pColIcon.value = "Icon";
        pFilenameFormat.value = "artista_titulo";
    }

    loadProfiles();

    // --- RUN EXTERNAL SCRIPTS ---
    let activeScripts = {}; // consoleElemId -> { taskId, pollInterval }

    function executeScript(scriptName, consoleElemId, extraData = {}) {
        const consoleEl = document.getElementById(consoleElemId);
        consoleEl.textContent = "Iniciando script...\n";
        
        let cancelBtnId = consoleElemId === 'syncConsole' ? 'cancelSyncBtn' : 'cancelToolsBtn';
        const cancelBtn = document.getElementById(cancelBtnId);
        if (cancelBtn) cancelBtn.style.display = 'block';
        
        const payload = {
            script: scriptName,
            profile_id: profileSelect.value,
            ...extraData
        };

        fetch('/api/run_script', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                showToast(data.error, "error");
                consoleEl.textContent += "\nError: " + data.error;
                if (cancelBtn) cancelBtn.style.display = 'none';
            } else if (data.status === 'started') {
                const taskId = data.task_id;
                
                const interval = setInterval(() => {
                    fetch('/api/script_status/' + taskId)
                    .then(r => r.json())
                    .then(statusData => {
                        if (statusData.error) return;
                        
                        consoleEl.textContent = statusData.logs.join("\n");
                        consoleEl.scrollTop = consoleEl.scrollHeight;
                        
                        if (statusData.status === 'completed' || statusData.status === 'error' || statusData.status === 'cancelled') {
                            clearInterval(interval);
                            delete activeScripts[consoleElemId];
                            if (cancelBtn) cancelBtn.style.display = 'none';
                            
                            if (statusData.status === 'completed') {
                                showToast("Operación finalizada con éxito", "success");
                            } else if (statusData.status === 'error') {
                                showToast("El script terminó con errores. Revisa la consola.", "warning");
                            } else {
                                showToast("Operación cancelada", "info");
                            }
                        }
                    });
                }, 1000);
                
                activeScripts[consoleElemId] = { taskId: taskId, pollInterval: interval };
            }
        })
        .catch(e => {
            showToast("Error de conexión al servidor", "error");
            consoleEl.textContent += "\nExcepción: " + e;
            if (cancelBtn) cancelBtn.style.display = 'none';
        });
    }

    function cancelActiveScript(consoleElemId) {
        if (activeScripts[consoleElemId]) {
            const taskId = activeScripts[consoleElemId].taskId;
            fetch('/api/cancel_script/' + taskId, {method: 'POST'})
            .then(() => {
                showToast("Cancelando...", "warning");
            });
        }
    }

    document.getElementById('cancelSyncBtn')?.addEventListener('click', () => cancelActiveScript('syncConsole'));
    document.getElementById('cancelToolsBtn')?.addEventListener('click', () => cancelActiveScript('toolsConsole'));


    document.getElementById('runAirtableBtn').addEventListener('click', () => {
        executeScript("airtable", "syncConsole");
    });
    
    document.getElementById('runBaserowBtn').addEventListener('click', () => {
        executeScript("baserow", "syncConsole");
    });

    // --- HERRAMIENTAS Y UTILIDADES LOGIC ---
    const toolsFolderSelect = document.getElementById('toolsFolderSelect');
    const toolsPurgeSelect = document.getElementById('toolsPurgeSelect');
    const openFolderBtn = document.getElementById('openFolderBtn');
    const copyJsonBtn = document.getElementById('copyJsonBtn');

    async function loadToolsFolders() {
        try {
            const res = await fetch('/api/folders');
            if (!res.ok) return;
            const data = await res.json();
            const folders = data.folders || [];

            if (toolsFolderSelect) {
                toolsFolderSelect.innerHTML = '';
                if (folders.length === 0) {
                    toolsFolderSelect.innerHTML = '<option value="">Sin carpetas</option>';
                } else {
                    folders.forEach(f => {
                        const opt = document.createElement('option');
                        opt.value = f;
                        opt.textContent = `📁 ${f}`;
                        toolsFolderSelect.appendChild(opt);
                    });
                    const saved = localStorage.getItem('catalogFolder') || folders[0];
                    if (folders.includes(saved)) toolsFolderSelect.value = saved;
                }
            }

            if (toolsPurgeSelect) {
                toolsPurgeSelect.innerHTML = '<option value="*">⚡ [Todas las Carpetas]</option>';
                folders.forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f;
                    opt.textContent = `📁 ${f}`;
                    toolsPurgeSelect.appendChild(opt);
                });
            }
        } catch (e) {
            console.error("Error al cargar carpetas en herramientas:", e);
        }
    }

    // Cargar carpetas al inicio
    loadToolsFolders();

    // 1. Abrir Carpeta y Señalar ringtones.json en Windows Explorer
    if (openFolderBtn) {
        openFolderBtn.addEventListener('click', async () => {
            const folder = toolsFolderSelect ? toolsFolderSelect.value : '';
            if (!folder) return showToast("Selecciona una carpeta primero.", "warning");

            try {
                const res = await fetch('/api/open_folder', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ folder })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "No se pudo abrir la carpeta");

                if (data.has_json) {
                    showToast(`Carpeta abierta en Windows resaltando 'ringtones.json' listo para arrastrar a Gemini.`, "success");
                } else {
                    showToast(`Carpeta '${folder}' abierta en Windows (aún no tiene ringtones.json).`, "info");
                }
            } catch (e) {
                showToast("Error abriendo carpeta: " + e.message, "error");
            }
        });
    }

    // 2. Copiar todo el JSON directamente al portapapeles
    if (copyJsonBtn) {
        copyJsonBtn.addEventListener('click', async () => {
            const folder = toolsFolderSelect ? toolsFolderSelect.value : '';
            if (!folder) return showToast("Selecciona una carpeta primero.", "warning");

            try {
                const res = await fetch(`/api/get_catalog_json/${encodeURIComponent(folder)}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Error al obtener JSON");

                await navigator.clipboard.writeText(data.content);
                showToast(`📋 ¡Catálogo de '${folder}' copiado al portapapeles! Listo para pegar en Gemini (Ctrl + V).`, "success");
            } catch (e) {
                showToast("Error copiando catálogo: " + e.message, "error");
            }
        });
    }

    // 3. Purgar CDN con selector
    document.getElementById('runPurgeBtn')?.addEventListener('click', () => {
        const folder = toolsPurgeSelect ? toolsPurgeSelect.value.trim() : '*';
        executeScript("purgar_cdn", "toolsConsole", { target: folder });
    });
    document.getElementById('runGithubBtn').addEventListener('click', () => {
        executeScript("subir_github", "toolsConsole");
    });

    document.getElementById('gitSyncBtn')?.addEventListener('click', () => {
        const toolsNavBtn = document.querySelector('button[data-target="tools-tab"]');
        if (toolsNavBtn) toolsNavBtn.click();
        executeScript("subir_github", "toolsConsole");
    });

    document.getElementById('clearCacheBtn').addEventListener('click', () => {
        const consoleEl = document.getElementById("toolsConsole");
        consoleEl.textContent = "Limpiando caché...\n";
        fetch('/api/clear_cache', { method: 'POST' })
            .then(r => r.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                showToast(data.status, "success");
                consoleEl.textContent += "Caché limpiada correctamente (Previas y Archivos Temporales).\n";
            })
            .catch(e => {
                showToast("Error limpiando caché: " + e.message, "error");
                consoleEl.textContent += "Error: " + e.message + "\n";
            });
    });


    // --- YOUTUBE DOWNLOADER LOGIC ---
    const tasksList = document.getElementById('tasksList');
    const template = document.getElementById('taskTemplate');
    const ytConsole = document.getElementById('ytConsole');
    
    // --- FOLDER SELECTOR & CREATOR LOGIC ---
    const folderSelect = document.getElementById('folderSelect');
    const folderNameHidden = document.getElementById('folderName');
    const refreshFoldersBtn = document.getElementById('refreshFoldersBtn');
    const toggleNewFolderBtn = document.getElementById('toggleNewFolderBtn');
    const newFolderContainer = document.getElementById('newFolderContainer');
    const newFolderNameInput = document.getElementById('newFolderNameInput');
    const confirmNewFolderBtn = document.getElementById('confirmNewFolderBtn');
    const cancelNewFolderBtn = document.getElementById('cancelNewFolderBtn');

    async function loadFolders(selectedToSet = null) {
        try {
            const res = await fetch('/api/folders');
            if (!res.ok) throw new Error("Error cargando carpetas");
            const data = await res.json();
            const folders = data.folders || [];

            if (folderSelect) {
                folderSelect.innerHTML = '';
                if (folders.length === 0) {
                    folderSelect.innerHTML = '<option value="">No hay carpetas existentes</option>';
                } else {
                    folders.forEach(f => {
                        const opt = document.createElement('option');
                        opt.value = f;
                        opt.textContent = `📁 ${f}`;
                        folderSelect.appendChild(opt);
                    });
                }

                // Determinar cuál seleccionar (preferencia guardada o predeterminada)
                const savedFolder = selectedToSet || localStorage.getItem('selectedFolder') || (folderNameHidden ? folderNameHidden.value : '') || 'tonos_cristianos';
                if (folders.includes(savedFolder)) {
                    folderSelect.value = savedFolder;
                    if (folderNameHidden) folderNameHidden.value = savedFolder;
                } else if (folders.length > 0) {
                    folderSelect.value = folders[0];
                    if (folderNameHidden) folderNameHidden.value = folders[0];
                }
            }
        } catch (e) {
            console.error("Error al obtener carpetas:", e);
            if (folderSelect) {
                folderSelect.innerHTML = '<option value="tonos_cristianos">📁 tonos_cristianos</option>';
            }
        }
    }

    if (folderSelect) {
        folderSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            if (folderNameHidden) folderNameHidden.value = val;
            if (val) localStorage.setItem('selectedFolder', val);
        });
    }

    if (refreshFoldersBtn) {
        refreshFoldersBtn.addEventListener('click', async () => {
            const currentVal = folderSelect ? folderSelect.value : null;
            await loadFolders(currentVal);
            showToast("Lista de carpetas actualizada desde el disco.", "success");
        });
    }

    if (toggleNewFolderBtn) {
        toggleNewFolderBtn.addEventListener('click', () => {
            const isHidden = newFolderContainer.style.display === 'none';
            newFolderContainer.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                newFolderNameInput.value = '';
                newFolderNameInput.focus();
            }
        });
    }

    if (cancelNewFolderBtn) {
        cancelNewFolderBtn.addEventListener('click', () => {
            newFolderContainer.style.display = 'none';
            newFolderNameInput.value = '';
        });
    }

    if (confirmNewFolderBtn) {
        confirmNewFolderBtn.addEventListener('click', async () => {
            const name = newFolderNameInput.value.trim();
            if (!name) return showToast("Escribe un nombre para la nueva carpeta.", "warning");

            try {
                confirmNewFolderBtn.disabled = true;
                confirmNewFolderBtn.textContent = 'Creando...';
                const res = await fetch('/api/folders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Error al crear carpeta");

                const createdFolder = data.folder;
                await loadFolders(createdFolder);
                newFolderContainer.style.display = 'none';
                newFolderNameInput.value = '';
                showToast(`Carpeta "${createdFolder}" creada y seleccionada con éxito.`, "success");
            } catch (err) {
                showToast("Error: " + err.message, "error");
            } finally {
                confirmNewFolderBtn.disabled = false;
                confirmNewFolderBtn.textContent = 'Crear';
            }
        });

        newFolderNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmNewFolderBtn.click();
            if (e.key === 'Escape') cancelNewFolderBtn.click();
        });
    }

    // Inicializar carpetas al cargar
    loadFolders();

    // Filtro de búsqueda en la cola de tareas
    const taskSearchInput = document.getElementById('taskSearchInput');
    const clearTaskSearchBtn = document.getElementById('clearTaskSearchBtn');

    function filterTasksQueue() {
        const query = taskSearchInput ? taskSearchInput.value.trim().toLowerCase() : '';
        const allCards = tasksList.querySelectorAll('.task-card');
        let visibleCount = 0;

        allCards.forEach(card => {
            if (!query) {
                card.style.display = '';
                visibleCount++;
                return;
            }
            const title = (card.querySelector('.task-title')?.value || '').toLowerCase();
            const artist = (card.querySelector('.task-artist')?.value || '').toLowerCase();
            const url = (card.querySelector('.task-url')?.value || '').toLowerCase();

            if (title.includes(query) || artist.includes(query) || url.includes(query)) {
                card.style.display = '';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        if (clearTaskSearchBtn) {
            clearTaskSearchBtn.style.display = query ? 'block' : 'none';
        }

        const totalCount = allCards.length;
        const queueTitleEl = document.getElementById('queueTitle');
        if (queueTitleEl) {
            if (query) {
                queueTitleEl.textContent = `Cola (${visibleCount} de ${totalCount})`;
            } else {
                queueTitleEl.textContent = `Cola de Tareas (${totalCount})`;
            }
        }
    }

    if (taskSearchInput) {
        taskSearchInput.addEventListener('input', filterTasksQueue);
    }
    if (clearTaskSearchBtn) {
        clearTaskSearchBtn.addEventListener('click', () => {
            taskSearchInput.value = '';
            filterTasksQueue();
            taskSearchInput.focus();
        });
    }

    function updateQueueCount() {
        filterTasksQueue();
    }

    // --- TIME HELPERS (MM:SS, RAW SECONDS & END TIMESTAMPS) ---
    function parseTimeToSeconds(val) {
        if (!val && val !== 0) return 0;
        val = String(val).trim().toLowerCase().replace('s', '');
        if (!val) return 0;
        if (val.includes(':')) {
            const parts = val.split(':').map(p => parseFloat(p) || 0);
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2) return parts[0] * 60 + parts[1];
        }
        return parseFloat(val) || 0;
    }

    function formatSecondsToTime(sec) {
        if (isNaN(sec) || sec < 0) sec = 0;
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        const frac = sec % 1;
        let res = `${m}:${s < 10 ? '0' : ''}${s}`;
        if (frac > 0.01) {
            res += `.${Math.round(frac * 10)}`;
        }
        return res;
    }

    function resolveTimeRange(startStr, durOrEndStr) {
        const startSec = parseTimeToSeconds(startStr);
        const rawEnd = String(durOrEndStr || '').trim().toLowerCase().replace('s', '');
        const parsedSec = parseTimeToSeconds(rawEnd);

        let durationSec = 30;
        let endSec = startSec + 30;
        let isEndTime = false;

        if (rawEnd.includes(':')) {
            if (parsedSec > startSec) {
                durationSec = parsedSec - startSec;
                endSec = parsedSec;
                isEndTime = true;
            } else {
                durationSec = parsedSec > 0 ? parsedSec : 30;
                endSec = startSec + durationSec;
            }
        } else {
            if (parsedSec > startSec && startSec > 0) {
                durationSec = parsedSec - startSec;
                endSec = parsedSec;
                isEndTime = true;
            } else {
                durationSec = parsedSec > 0 ? parsedSec : 30;
                endSec = startSec + durationSec;
            }
        }

        if (durationSec <= 0) {
            durationSec = 30;
            endSec = startSec + durationSec;
        }

        return {
            startSec,
            durationSec: Math.round(durationSec * 100) / 100,
            endSec: Math.round(endSec * 100) / 100,
            isEndTime,
            formattedStart: formatSecondsToTime(startSec),
            formattedEnd: formatSecondsToTime(endSec)
        };
    }

    function addTask(data = {}, autoScroll = false) {
        const node = template.content.cloneNode(true);
        const card = node.querySelector('.task-card');
        const taskId = data.task_id || ('task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
        card._taskId = taskId;
        card.dataset.taskId = taskId;
        
        card.querySelector('.task-url').value = data.url || '';
        if(data.artist) card.querySelector('.task-artist').value = data.artist;
        const titleInputEl = card.querySelector('.task-title');
        if(data.title) titleInputEl.value = data.title;

        // Si el usuario escribe o modifica el título, retirar advertencia de duplicado
        titleInputEl.addEventListener('input', () => {
            if (card.classList.contains('task-has-warning')) {
                const dupBanner = card.querySelector('.task-status-banner.warning');
                if (dupBanner && dupBanner.textContent.includes('Canción repetida en el lote')) {
                    card.classList.remove('task-has-warning');
                    dupBanner.remove();
                    titleInputEl.style.borderColor = '';
                }
            }
        });
        
        const startInput = card.querySelector('.task-start-m');
        const durInput = card.querySelector('.task-dur-m');
        const timeCutSummary = card.querySelector('.time-cut-summary');
        const timeCutRange = card.querySelector('.time-cut-range');

        if (data.start !== undefined && data.start !== null) startInput.value = data.start;
        if (data.duration !== undefined && data.duration !== null) durInput.value = data.duration;
        if (data.speed) card.querySelector('.task-speed').value = data.speed;

        const updateTimeBadge = () => {
            const range = resolveTimeRange(startInput.value, durInput.value);
            const iconEl = card.querySelector('.time-cut-icon');
            if (timeCutSummary) {
                const sText = (range.durationSec % 1 === 0) ? `${range.durationSec}s` : `${range.durationSec.toFixed(1)}s`;
                if (range.isEndTime) {
                    timeCutSummary.style.color = '#4ade80';
                    timeCutSummary.textContent = `${sText} de audio (fin exacto)`;
                    if (iconEl) iconEl.textContent = '🎯';
                } else {
                    timeCutSummary.style.color = '#38bdf8';
                    timeCutSummary.textContent = `${sText} de audio`;
                    if (iconEl) iconEl.textContent = '⏱️';
                }
            }
            if (timeCutRange) {
                timeCutRange.textContent = `(desde ${range.formattedStart} hasta ${range.formattedEnd})`;
            }
        };

        startInput.addEventListener('input', updateTimeBadge);
        durInput.addEventListener('input', updateTimeBadge);
        updateTimeBadge();
        
        // Ranges
        const pitch = card.querySelector('.task-pitch');
        const bass = card.querySelector('.task-bass');
        const pan = card.querySelector('.task-pan');
        
        const updateVal = (input, spanClass) => {
            input.addEventListener('input', (e) => {
                card.querySelector(spanClass).textContent = e.target.value;
            });
        };
        updateVal(pitch, '.val-pitch');
        updateVal(bass, '.val-bass');
        updateVal(pan, '.val-pan');

        if (data.pitch !== undefined) { pitch.value = data.pitch; card.querySelector('.val-pitch').textContent = data.pitch; }
        if (data.bass !== undefined) { bass.value = data.bass; card.querySelector('.val-bass').textContent = data.bass; }
        if (data.pan !== undefined) { pan.value = data.pan; card.querySelector('.val-pan').textContent = data.pan; }
        if (data.fade_in !== undefined) card.querySelector('.task-fade-in').value = data.fade_in;
        if (data.fade_out !== undefined) card.querySelector('.task-fade-out').value = data.fade_out;
        if (data.pan_dinamico !== undefined) card.querySelector('.task-pan-dinamico').checked = data.pan_dinamico;

        // --- Portada / Imagen de la tarea ---
        const taskImgFile = card.querySelector('.task-img-file');
        const taskImgPreview = card.querySelector('.task-img-preview');
        const previewImgThumb = card.querySelector('.preview-img-thumb');
        const noImgText = card.querySelector('.no-img-text');
        const imgFilename = card.querySelector('.img-filename');
        const imgDimensions = card.querySelector('.img-dimensions');
        const removeImgBtn = card.querySelector('.remove-img-btn');

        const clearTaskImage = () => {
            card._imageData = "";
            if (taskImgFile) taskImgFile.value = "";
            if (previewImgThumb) {
                previewImgThumb.src = "";
                previewImgThumb.style.display = "none";
            }
            if (noImgText) noImgText.style.display = "block";
            if (imgFilename) {
                imgFilename.textContent = "Sin foto seleccionada";
                imgFilename.style.color = "var(--text-muted)";
            }
            if (imgDimensions) {
                imgDimensions.textContent = "";
                imgDimensions.style.display = "none";
            }
            if (removeImgBtn) removeImgBtn.style.display = "none";
        };

        const setTaskImageData = (dataUrl, fileName = "foto_portada.png") => {
            card._imageData = dataUrl;
            if (previewImgThumb) {
                previewImgThumb.src = dataUrl;
                previewImgThumb.style.display = "block";
            }
            if (noImgText) noImgText.style.display = "none";
            if (imgFilename) {
                imgFilename.textContent = fileName;
                imgFilename.style.color = "var(--accent-cyan)";
            }
            if (imgDimensions) {
                imgDimensions.textContent = "✓ 512×512 recortada";
                imgDimensions.style.display = "inline";
            }
            if (removeImgBtn) removeImgBtn.style.display = "inline-flex";
        };

        if (data.image_data) {
            setTaskImageData(data.image_data, "Imagen cargada");
        }

        if (taskImgPreview && taskImgFile) {
            taskImgPreview.addEventListener('click', () => {
                taskImgFile.click();
            });
        }

        if (taskImgFile) {
            taskImgFile.addEventListener('change', (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;

                // Validación de tipo
                if (!file.type || !file.type.startsWith('image/')) {
                    showToast("Por favor selecciona un archivo de imagen válido (JPG, PNG o WEBP).", "error");
                    taskImgFile.value = "";
                    return;
                }

                // Validación de tamaño (máx 15MB)
                const maxSizeBytes = 15 * 1024 * 1024;
                if (file.size > maxSizeBytes) {
                    showToast("La imagen es demasiado pesada. El tamaño máximo permitido es 15MB.", "warning");
                    taskImgFile.value = "";
                    return;
                }

                const reader = new FileReader();
                reader.onerror = () => {
                    showToast("Error al leer el archivo de imagen.", "error");
                    taskImgFile.value = "";
                };
                reader.onload = (ev) => {
                    const tempImg = new Image();
                    tempImg.onerror = () => {
                        showToast("El archivo no es una imagen válida o está dañado.", "error");
                        taskImgFile.value = "";
                    };
                    tempImg.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = 512;
                            canvas.height = 512;
                            const ctx = canvas.getContext('2d');

                            // Recorte centrado 1:1 (cuadrado)
                            const minSide = Math.min(tempImg.naturalWidth, tempImg.naturalHeight);
                            const sx = (tempImg.naturalWidth - minSide) / 2;
                            const sy = (tempImg.naturalHeight - minSide) / 2;

                            ctx.drawImage(tempImg, sx, sy, minSide, minSide, 0, 0, 512, 512);
                            const dataUrl = canvas.toDataURL('image/png', 0.95);

                            setTaskImageData(dataUrl, file.name);
                            showToast(`Foto "${file.name}" cargada y ajustada a 512×512`, "success");
                        } catch (err) {
                            console.error("Error procesando imagen:", err);
                            showToast("Error al procesar el recorte de la imagen.", "error");
                        }
                    };
                    tempImg.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        if (removeImgBtn) {
            removeImgBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                clearTaskImage();
                showToast("Foto removida de la tarea", "info");
            });
        }

        const removeTaskBtn = card.querySelector('.remove-task');
        if (removeTaskBtn) {
            removeTaskBtn.addEventListener('click', () => {
                card.remove();
                updateQueueCount();
            });
        }

        // Auto clean URL helper
        const urlInput = card.querySelector('.task-url');
        const cleanUrlInput = () => {
            let val = urlInput.value.trim();
            if (val.includes('watch?v=')) {
                const match = val.match(/(https?:\/\/[^\/]+\/watch\?v=[a-zA-Z0-9_-]{11})/);
                if (match && val !== match[1]) {
                    urlInput.value = match[1];
                }
            } else if (val.includes('youtu.be/')) {
                const match = val.match(/(https?:\/\/youtu\.be\/[a-zA-Z0-9_-]{11})/);
                if (match && val !== match[1]) {
                    urlInput.value = match[1];
                }
            } else if (val.includes('/shorts/')) {
                const match = val.match(/(https?:\/\/[^\/]+\/shorts\/[a-zA-Z0-9_-]{11})/);
                if (match && val !== match[1]) {
                    urlInput.value = match[1];
                }
            }
        };
        urlInput.addEventListener('input', cleanUrlInput);
        urlInput.addEventListener('change', cleanUrlInput);
        urlInput.addEventListener('paste', () => setTimeout(cleanUrlInput, 50));

        // Preview Logic
        const prevBtn = card.querySelector('.preview-btn');
        const audioEl = card.querySelector('.task-audio');
        let lastPayloadStr = null;
        let previewAbortController = null;

        prevBtn.addEventListener('click', async () => {
            // Si ya está cargando, hacer clic cancela la descarga/generación
            if (previewAbortController) {
                previewAbortController.abort();
                previewAbortController = null;
                prevBtn.textContent = '🎧 Previa';
                prevBtn.classList.remove('btn-danger');
                prevBtn.classList.add('btn-secondary');
                showToast("Generación de previa cancelada.", "info");
                return;
            }

            cleanUrlInput();
            const url = urlInput.value.trim();
            if(!url) return showToast("Falta la URL de YouTube", "warning");

            const timeRange = resolveTimeRange(
                card.querySelector('.task-start-m').value,
                card.querySelector('.task-dur-m').value
            );

            const payload = {
                url,
                start: timeRange.formattedStart,
                duration: timeRange.durationSec.toString(),
                speed: parseFloat(card.querySelector('.task-speed').value) || 1.0,
                pitch: parseFloat(card.querySelector('.task-pitch').value) || 0.0,
                bass: parseFloat(card.querySelector('.task-bass').value) || 0.0,
                pan: parseFloat(card.querySelector('.task-pan').value) || 0.0,
                pan_dinamico: card.querySelector('.task-pan-dinamico').checked,
                fade_in: parseInt(card.querySelector('.task-fade-in').value) || 0,
                fade_out: parseInt(card.querySelector('.task-fade-out').value) || 0
            };

            const payloadStr = JSON.stringify(payload);
            if (lastPayloadStr === payloadStr && audioEl.src) {
                if (!audioEl.paused) {
                    audioEl.pause();
                    prevBtn.textContent = '▶️ Reproducir Previa';
                    showToast("Previa pausada.", "info");
                } else {
                    audioEl.play();
                    prevBtn.textContent = '⏸️ Pausar Previa';
                    showToast("Reproduciendo previa...", "info");
                }
                return;
            }

            prevBtn.textContent = '🛑 Cancelar';
            prevBtn.classList.remove('btn-secondary');
            prevBtn.classList.add('btn-danger');
            previewAbortController = new AbortController();

            try {
                const res = await fetch('/api/preview', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: payloadStr,
                    signal: previewAbortController.signal
                });
                const responseData = await res.json();
                if(responseData.error) throw new Error(responseData.error);
                
                audioEl.src = responseData.preview_url + "?t=" + Date.now();
                audioEl.style.display = 'block';
                audioEl.play();
                lastPayloadStr = payloadStr;
                showToast("Nueva previa lista y reproduciendo.", "success");
                prevBtn.textContent = '⏸️ Pausar Previa';
            } catch(e) {
                if (e.name === 'AbortError') {
                    // Cancelado por el usuario intencionalmente
                    return;
                }
                showToast("Error generando previa: " + e.message, "error");
                prevBtn.textContent = '🎧 Previa';
            } finally {
                previewAbortController = null;
                prevBtn.classList.remove('btn-danger');
                prevBtn.classList.add('btn-secondary');
                if (prevBtn.textContent === '🛑 Cancelar') {
                    prevBtn.textContent = '🎧 Previa';
                }
            }
        });

        // Mantener sincronizado el texto del botón si el usuario usa los controles nativos del audio
        audioEl.addEventListener('play', () => {
            if (!previewAbortController) prevBtn.textContent = '⏸️ Pausar Previa';
        });
        audioEl.addEventListener('pause', () => {
            if (!previewAbortController) prevBtn.textContent = '▶️ Reproducir Previa';
        });
        audioEl.addEventListener('ended', () => {
            if (!previewAbortController) prevBtn.textContent = '▶️ Reproducir Previa';
        });

        tasksList.appendChild(card);
        updateQueueCount();

        if (autoScroll) {
            requestAnimationFrame(() => {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const urlInput = card.querySelector('.task-url');
                if (urlInput) {
                    urlInput.focus();
                }
            });
        }
        return card;
    }

    document.getElementById('addUrlBtn').addEventListener('click', () => addTask({}, true));
    const addUrlBtnBottom = document.getElementById('addUrlBtnBottom');
    if (addUrlBtnBottom) {
        addUrlBtnBottom.addEventListener('click', () => addTask({}, true));
    }
    document.getElementById('clearTasksBtn').addEventListener('click', () => {
        tasksList.innerHTML = '';
        addTask();
    });

    document.getElementById('bulkUploadFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const data = JSON.parse(event.target.result);
                tasksList.innerHTML = '';
                data.forEach(item => addTask(item));
                showToast(`✅ JSON cargado (${data.length} canciones)`, "success");
            } catch (error) {
                showToast("Error parseando JSON", "error");
            }
            e.target.value = "";
        };
        reader.readAsText(file);
    });

    const pasteJsonToggleBtn = document.getElementById('pasteJsonToggleBtn');
    const pasteJsonBlock = document.getElementById('pasteJsonBlock');
    if (pasteJsonToggleBtn) {
        pasteJsonToggleBtn.addEventListener('click', () => {
            pasteJsonBlock.style.display = pasteJsonBlock.style.display === 'none' ? 'block' : 'none';
        });
    }

    document.getElementById('loadPastedJsonBtn').addEventListener('click', () => {
        const text = document.getElementById('pasteJsonInput').value.trim();
        if (!text) return showToast("Pega un JSON o URLs primero", "warning");
        try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
                tasksList.innerHTML = '';
                data.forEach(item => addTask(item));
                showToast(`✅ Tareas cargadas desde el portapapeles (${data.length})`, "success");
                pasteJsonBlock.style.display = 'none';
            } else {
                throw new Error("El JSON debe ser una lista/array []");
            }
        } catch (error) {
            // Si no es JSON válido, verificar si son enlaces URL directos (uno o varios por línea)
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('http://') || l.startsWith('https://'));
            if (lines.length > 0) {
                tasksList.innerHTML = '';
                lines.forEach(u => addTask({ url: u }));
                showToast(`✅ ${lines.length} enlaces detectados y cargados al tablero`, "success");
                pasteJsonBlock.style.display = 'none';
                return;
            }
            showToast("Error parseando JSON: " + error.message, "error");
        }
    });

    // Start Process
    let pollInterval = null;
    document.getElementById('startProcessBtn').addEventListener('click', async () => {
        const folder = document.getElementById('folderName').value.trim();
        if (!folder) return showToast("Ingresa la carpeta de destino.", "warning");

        const cards = document.querySelectorAll('.task-card');
        const tasks = [];
        const cardMap = {};

        // Limpiar errores visuales previos de las tarjetas
        cards.forEach(card => {
            card.classList.remove('task-has-error', 'task-has-warning');
            const oldBanner = card.querySelector('.task-status-banner');
            if (oldBanner) oldBanner.remove();
        });

        cards.forEach(card => {
            let url = card.querySelector('.task-url').value.trim();
            if (!url) return;
            if (url.includes('watch?v=')) {
                const match = url.match(/(https?:\/\/[^\/]+\/watch\?v=[a-zA-Z0-9_-]{11})/);
                if (match) url = match[1];
            } else if (url.includes('youtu.be/')) {
                const match = url.match(/(https?:\/\/youtu\.be\/[a-zA-Z0-9_-]{11})/);
                if (match) url = match[1];
            } else if (url.includes('/shorts/')) {
                const match = url.match(/(https?:\/\/[^\/]+\/shorts\/[a-zA-Z0-9_-]{11})/);
                if (match) url = match[1];
            }
            const timeRange = resolveTimeRange(
                card.querySelector('.task-start-m').value,
                card.querySelector('.task-dur-m').value
            );

            const taskId = card._taskId || card.dataset.taskId || ('task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
            card._taskId = taskId;
            card.dataset.taskId = taskId;
            cardMap[taskId] = card;

            tasks.push({
                task_id: taskId,
                url,
                artist: card.querySelector('.task-artist').value.trim(),
                title: card.querySelector('.task-title').value.trim(),
                image_data: card._imageData || "",
                start: timeRange.formattedStart,
                duration: timeRange.durationSec.toString(),
                speed: parseFloat(card.querySelector('.task-speed').value) || 1.0,
                pitch: parseFloat(card.querySelector('.task-pitch').value) || 0.0,
                bass: parseFloat(card.querySelector('.task-bass').value) || 0.0,
                pan: parseFloat(card.querySelector('.task-pan').value) || 0.0,
                pan_dinamico: card.querySelector('.task-pan-dinamico').checked,
                fade_in: parseInt(card.querySelector('.task-fade-in').value) || 0,
                fade_out: parseInt(card.querySelector('.task-fade-out').value) || 0
            });
        });

        if (tasks.length === 0) return showToast("Agrega al menos una URL válida.", "warning");

        // Detección preventiva de canciones repetidas en el mismo lote con mismo título
        const urlTitleTracker = {};
        let duplicateFound = false;

        for (const t of tasks) {
            const normTitle = t.title.toLowerCase().trim();
            const key = `${t.url}:::${normTitle}`;
            if (urlTitleTracker[key]) {
                const firstCard = cardMap[urlTitleTracker[key].task_id];
                const currentCard = cardMap[t.task_id];

                // Función auxiliar para insertar banner explicativo in-situ
                const applyDuplicateWarning = (cardEl, isSecond) => {
                    cardEl.classList.add('task-has-warning');
                    let banner = cardEl.querySelector('.task-status-banner');
                    if (!banner) {
                        banner = document.createElement('div');
                        banner.className = 'task-status-banner warning';
                        cardEl.insertBefore(banner, cardEl.firstChild);
                    }
                    const note = isSecond 
                        ? '<strong>Canción repetida en el lote:</strong> Tienes la misma URL con el mismo título. Cambia el campo <u>Título</u> abajo (ej. <em>"Canción (Parte 2)"</em> o <em>"Versión 2"</em>) para que no se sobreescriban.'
                        : '<strong>Canción repetida en el lote:</strong> Esta canción se está agregando más de una vez en esta cola. Asegúrate de diferenciar sus títulos.';
                    banner.innerHTML = `<span>⚠️</span><div style="flex:1;">${note}</div>`;
                };

                if (firstCard) applyDuplicateWarning(firstCard, false);
                if (currentCard) {
                    applyDuplicateWarning(currentCard, true);
                    const titleInput = currentCard.querySelector('.task-title');
                    if (titleInput) {
                        titleInput.focus();
                        titleInput.style.borderColor = '#fbbf24';
                        titleInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }

                showToast("⚠️ <strong>Canción repetida detectada:</strong> Para guardar ambas partes, debes escribir un título diferente en una de ellas (ej. 'Parte 2' o 'Coro'). Revisa el aviso en la tarjeta resaltada.", "warning", 10000);
                duplicateFound = true;
                break;
            } else {
                urlTitleTracker[key] = t;
            }
        }

        if (duplicateFound) return;

        try {
            ytConsole.textContent = "Iniciando...\n";
            document.getElementById('startProcessBtn').style.display = 'none';
            document.getElementById('cancelProcessBtn').style.display = 'block';

            // Iniciar cronómetro en vivo
            const timerBadge = document.getElementById('ytConsoleTimer');
            const timerText = document.getElementById('ytConsoleTimerText');
            if (timerBadge && timerText) {
                timerBadge.style.display = 'inline-flex';
                timerBadge.className = 'console-timer-badge active';
                timerText.textContent = '00:00';
            }
            batchStartTime = Date.now();

            const forceOverwrite = document.getElementById('forceOverwrite').checked;

            const res = await fetch('/api/process', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ folder, tasks, force_overwrite: forceOverwrite })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al iniciar");
            }

            pollInterval = setInterval(pollStatus, 1000);
            showToast("Procesamiento iniciado", "info");
        } catch (e) {
            showToast(e.message, "error");
            document.getElementById('startProcessBtn').style.display = 'block';
            document.getElementById('cancelProcessBtn').style.display = 'none';
            const timerBadge = document.getElementById('ytConsoleTimer');
            if (timerBadge) timerBadge.style.display = 'none';
        }
    });

    const cancelProcessBtn = document.getElementById('cancelProcessBtn');
    cancelProcessBtn.addEventListener('click', async () => {
        cancelProcessBtn.disabled = true;
        cancelProcessBtn.textContent = "⏳ Deteniendo...";
        try {
            await fetch('/api/cancel', { method: 'POST' });
            showToast("Cancelación en curso. Las tareas activas se detienen sin guardar cambios.", "warning");
        } catch (err) {
            showToast("Error al solicitar cancelación.", "error");
            cancelProcessBtn.disabled = false;
            cancelProcessBtn.textContent = "🛑 Cancelar";
        }
    });

    let batchStartTime = null;

    function formatTimeSec(seconds) {
        const s = Math.floor(seconds);
        const m = Math.floor(s / 60);
        const remS = s % 60;
        return `${m < 10 ? '0' : ''}${m}:${remS < 10 ? '0' : ''}${remS}`;
    }

    function formatTimeHuman(seconds) {
        const s = Math.round(seconds);
        const m = Math.floor(s / 60);
        const remS = s % 60;
        if (m > 0) return `${m}m ${remS}s`;
        return `${remS}s`;
    }

    function pollStatus() {
        fetch('/api/status')
        .then(r => r.json())
        .then(data => {
            ytConsole.textContent = data.logs.join("\n");
            ytConsole.scrollTop = ytConsole.scrollHeight;

            // Actualizar cronómetro en vivo
            const timerBadge = document.getElementById('ytConsoleTimer');
            const timerText = document.getElementById('ytConsoleTimerText');
            if (timerBadge && timerText) {
                const elapsedSec = (data.elapsed_seconds !== undefined && data.elapsed_seconds !== null) 
                    ? data.elapsed_seconds 
                    : (batchStartTime ? (Date.now() - batchStartTime) / 1000 : 0);
                timerText.textContent = formatTimeSec(elapsedSec);
            }

            if (!data.is_processing) {
                clearInterval(pollInterval);
                document.getElementById('startProcessBtn').style.display = 'block';
                const cancelBtn = document.getElementById('cancelProcessBtn');
                cancelBtn.style.display = 'none';
                cancelBtn.disabled = false;
                cancelBtn.textContent = '🛑 Cancelar';

                const totalSec = (data.elapsed_seconds !== undefined && data.elapsed_seconds !== null) 
                    ? data.elapsed_seconds 
                    : (batchStartTime ? (Date.now() - batchStartTime) / 1000 : 0);
                const humanTime = formatTimeHuman(totalSec);

                if (timerBadge && timerText) {
                    timerBadge.className = 'console-timer-badge finished';
                    timerText.textContent = `${formatTimeSec(totalSec)} (${humanTime})`;
                }

                // --- GESTIÓN INTELIGENTE DE TARJETAS AL FINALIZAR ---
                const results = data.task_results || [];
                const cards = Array.from(tasksList.querySelectorAll('.task-card'));
                let successCount = 0;
                let failureCount = 0;
                let abortedCount = 0;

                results.forEach(res => {
                    const taskId = res.task_id;
                    const card = cards.find(c => (c._taskId === taskId || c.dataset.taskId === taskId));
                    if (!card) return;

                    if (res.status === 'success') {
                        successCount++;
                        card.classList.add('task-fade-out');
                        setTimeout(() => {
                            card.remove();
                            updateQueueCount();
                            // Si se vació todo con éxito, crear una tarjeta nueva lista para trabajar
                            if (tasksList.querySelectorAll('.task-card').length === 0) {
                                addTask();
                                updateQueueCount();
                            }
                        }, 400);
                    } else if (res.status === 'aborted') {
                        abortedCount++;
                        // Mantener la tarjeta intacta para que el usuario pueda corregir o reanudar
                        card.classList.remove('task-has-error', 'task-has-warning');
                        let banner = card.querySelector('.task-status-banner');
                        if (!banner) {
                            banner = document.createElement('div');
                            card.insertBefore(banner, card.firstChild);
                        }
                        banner.className = 'task-status-banner warning';
                        banner.innerHTML = `<span>🛑</span> <span>Procesamiento cancelado por el usuario. No se guardaron cambios.</span>`;
                    } else {
                        failureCount++;
                        // Preservar la tarjeta intacta y colocar banner explicativo
                        card.classList.remove('task-has-error', 'task-has-warning');
                        const isWarning = (res.status === 'skipped_existing' || res.reason === 'duplicate_in_catalog');
                        card.classList.add(isWarning ? 'task-has-warning' : 'task-has-error');

                        let banner = card.querySelector('.task-status-banner');
                        if (!banner) {
                            banner = document.createElement('div');
                            card.insertBefore(banner, card.firstChild);
                        }
                        banner.className = `task-status-banner ${isWarning ? 'warning' : 'error'}`;

                        const icon = isWarning ? '🟡' : '🔴';
                        const bannerMsg = res.message || (isWarning ? 'Canción ya existe en el catálogo' : 'Error al procesar');
                        banner.innerHTML = `<span>${icon}</span> <span>${bannerMsg}</span>`;
                    }
                });

                if (abortedCount > 0) {
                    showToast(`Proceso detenido por el usuario. (${abortedCount} canciones canceladas intactas).`, "info");
                } else if (failureCount > 0) {
                    showToast(`Lote completado en ${humanTime}. ${successCount} listas, ${failureCount} pendientes por revisar.`, "warning");
                } else if (successCount > 0) {
                    showToast(`¡Todas las canciones (${successCount}) procesadas con éxito en ${humanTime}!`, "success");
                } else {
                    showToast(`Proceso finalizado en ${humanTime}.`, "info");
                }
            }
        });
    }


    // --- GESTOR DE CATÁLOGO / BIBLIOTECA DE TONOS ---
    const catalogFolderSelect = document.getElementById('catalogFolderSelect');
    const catalogRefreshBtn = document.getElementById('catalogRefreshBtn');
    const catalogSearchInput = document.getElementById('catalogSearchInput');
    const catalogClearSearchBtn = document.getElementById('catalogClearSearchBtn');
    const catalogCountText = document.getElementById('catalogCountText');
    const catalogFilterText = document.getElementById('catalogFilterText');
    const catalogLoading = document.getElementById('catalogLoading');
    const catalogEmpty = document.getElementById('catalogEmpty');
    const catalogGrid = document.getElementById('catalogGrid');
    const catalogGitSyncBtn = document.getElementById('catalogGitSyncBtn');

    // Modales
    const editSongModal = document.getElementById('editSongModal');
    const editModalSongId = document.getElementById('editModalSongId');
    const closeEditModalX = document.getElementById('closeEditModalX');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const saveEditBtn = document.getElementById('saveEditBtn');
    const editImgPreviewBox = document.getElementById('editImgPreviewBox');
    const editImgThumb = document.getElementById('editImgThumb');
    const editNoImgText = document.getElementById('editNoImgText');
    const editImgStatusText = document.getElementById('editImgStatusText');
    const editImgFileInput = document.getElementById('editImgFileInput');
    const editRemoveImgBtn = document.getElementById('editRemoveImgBtn');
    const editSongTitleInput = document.getElementById('editSongTitleInput');
    const editSongSubtitleInput = document.getElementById('editSongSubtitleInput');

    const deleteSongModal = document.getElementById('deleteSongModal');
    const deleteModalSongTitle = document.getElementById('deleteModalSongTitle');
    const deleteModalSongSubtitle = document.getElementById('deleteModalSongSubtitle');
    const deletePhysicalFilesCheckbox = document.getElementById('deletePhysicalFilesCheckbox');
    const closeDeleteModalX = document.getElementById('closeDeleteModalX');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    let currentCatalogSongs = [];
    let activeCatalogAudio = null;
    let currentEditingSong = null;
    let editingImageData = null;
    let editingRemoveImage = false;
    let currentDeletingSong = null;

    // Sincronizar con GitHub desde Catálogo
    if (catalogGitSyncBtn) {
        catalogGitSyncBtn.addEventListener('click', () => {
            const toolsNavBtn = document.querySelector('button[data-target="tools-tab"]');
            if (toolsNavBtn) toolsNavBtn.click();
            executeScript("subir_github", "toolsConsole");
        });
    }

    async function loadCatalogFolders() {
        try {
            const res = await fetch('/api/folders');
            if (!res.ok) throw new Error("Error cargando carpetas");
            const data = await res.json();
            const folders = data.folders || [];

            if (catalogFolderSelect) {
                catalogFolderSelect.innerHTML = '';
                if (folders.length === 0) {
                    catalogFolderSelect.innerHTML = '<option value="">Sin carpetas</option>';
                    return;
                }
                folders.forEach(f => {
                    const opt = document.createElement('option');
                    opt.value = f;
                    opt.textContent = `📁 ${f}`;
                    catalogFolderSelect.appendChild(opt);
                });

                // Seleccionar carpeta guardada o la activa en YT downloader
                const defaultFolder = localStorage.getItem('catalogFolder') || localStorage.getItem('selectedFolder') || folders[0];
                if (folders.includes(defaultFolder)) {
                    catalogFolderSelect.value = defaultFolder;
                }
                loadCatalog(catalogFolderSelect.value);
            }
        } catch (e) {
            console.error("Error al cargar carpetas del catálogo:", e);
        }
    }

    async function loadCatalog(folder) {
        if (!folder) return;
        localStorage.setItem('catalogFolder', folder);
        if (catalogLoading) catalogLoading.style.display = 'block';
        if (catalogEmpty) catalogEmpty.style.display = 'none';
        if (catalogGrid) catalogGrid.innerHTML = '';
        if (catalogCountText) catalogCountText.textContent = "Cargando canciones...";

        // Detener audio previo si sonaba
        if (activeCatalogAudio) {
            activeCatalogAudio.pause();
            activeCatalogAudio = null;
        }

        try {
            const res = await fetch(`/api/catalog/${encodeURIComponent(folder)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al obtener catálogo");

            currentCatalogSongs = data.songs || [];
            if (catalogLoading) catalogLoading.style.display = 'none';
            renderCatalog(catalogSearchInput ? catalogSearchInput.value.trim() : '');
        } catch (err) {
            if (catalogLoading) catalogLoading.style.display = 'none';
            if (catalogGrid) catalogGrid.innerHTML = `<div style="color: var(--accent-red); padding: 20px; text-align: center;">❌ ${err.message}</div>`;
            if (catalogCountText) catalogCountText.textContent = "Error al cargar canciones";
            showToast("Error: " + err.message, "error");
        }
    }

    function renderCatalog(filter = '') {
        if (!catalogGrid) return;
        catalogGrid.innerHTML = '';

        let filtered = currentCatalogSongs;
        if (filter) {
            const q = filter.toLowerCase();
            filtered = currentCatalogSongs.filter(s => 
                (s.title && s.title.toLowerCase().includes(q)) ||
                (s.subtitle && s.subtitle.toLowerCase().includes(q)) ||
                (s.id && s.id.toString().includes(q))
            );
        }

        if (catalogCountText) {
            catalogCountText.textContent = `${currentCatalogSongs.length} canciones registradas`;
        }

        if (catalogFilterText) {
            if (filter) {
                catalogFilterText.style.display = 'inline';
                catalogFilterText.textContent = `(Filtrando: ${filtered.length} coincidentes)`;
            } else {
                catalogFilterText.style.display = 'none';
            }
        }

        if (currentCatalogSongs.length === 0) {
            if (catalogEmpty) catalogEmpty.style.display = 'block';
            return;
        }

        if (filtered.length === 0) {
            catalogGrid.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: 8px;">
                    🔍 No se encontraron canciones que coincidan con "<strong>${filter}</strong>".
                </div>
            `;
            return;
        }

        filtered.forEach(song => {
            const item = document.createElement('div');
            item.className = 'catalog-item';
            item.dataset.id = song.id;

            // Miniatura o icono
            const imgHtml = song.has_poster && song.poster_url ?
                `<img src="${song.poster_url}?t=${Date.now()}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.1);" />` :
                `<div style="width: 50px; height: 50px; border-radius: 6px; background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; color: var(--text-muted); flex-shrink: 0; border: 1px dashed rgba(255,255,255,0.15);">🎵</div>`;

            // Badge de estado
            let badgeHtml = '';
            if (!song.has_audio) {
                badgeHtml = `<span class="catalog-badge danger" title="No hay audio registrado">⚠️ Sin audio</span>`;
            } else if (song.audio_source === 'local') {
                badgeHtml = `<span class="catalog-badge success" title="Archivo MP3 guardado en tu disco local">💾 Local</span>`;
            } else if (song.audio_source === 'cdn') {
                badgeHtml = `<span class="catalog-badge" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);" title="Audio disponible en la nube (CDN)">🌐 En la Nube (CDN)</span>`;
            }

            if (!song.has_poster) {
                badgeHtml += ` <span class="catalog-badge warning" title="No tiene portada asignada">📷 Sin portada</span>`;
            }

            // Reproductor
            const audioBtnHtml = song.has_audio ? 
                `<button type="button" class="btn btn-secondary catalog-play-btn" style="padding: 0.45rem 0.8rem; font-size: 0.85rem;" title="Reproducir / Pausar">▶️</button>` :
                `<button type="button" class="btn btn-secondary" disabled style="opacity: 0.4; padding: 0.45rem 0.8rem; font-size: 0.85rem;" title="Audio físico no disponible">🚫</button>`;

            item.innerHTML = `
                ${imgHtml}
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.72rem; color: var(--accent-cyan); background: rgba(56, 189, 248, 0.1); padding: 1px 6px; border-radius: 4px; font-weight: 600;">#${song.id}</span>
                        <strong style="color: #fff; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${song.title || 'Sin Título'}</strong>
                        ${badgeHtml}
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${song.subtitle || 'Sin Artista'} ${song.audio_size_kb > 0 ? `• <span style="font-size: 0.72rem; color: #94a3b8;">${song.audio_size_kb} KB</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    ${audioBtnHtml}
                    <button type="button" class="btn btn-secondary catalog-edit-btn" style="padding: 0.45rem 0.8rem; font-size: 0.82rem;" title="Editar metadatos y portada">✏️ Editar</button>
                    <button type="button" class="btn btn-danger catalog-delete-btn" style="padding: 0.45rem 0.75rem; font-size: 0.82rem;" title="Eliminar de la lista">🗑️</button>
                </div>
                <audio class="catalog-audio-el" src="${song.audio_url || ''}" preload="none" style="display: none;"></audio>
            `;

            // Evento: Reproducir / Pausar
            const playBtn = item.querySelector('.catalog-play-btn');
            const audioEl = item.querySelector('.catalog-audio-el');
            if (playBtn && audioEl) {
                playBtn.addEventListener('click', () => {
                    if (audioEl.paused) {
                        // Detener cualquier otro reproductor activo
                        if (activeCatalogAudio && activeCatalogAudio !== audioEl) {
                            activeCatalogAudio.pause();
                            const prevBtn = activeCatalogAudio.parentElement.querySelector('.catalog-play-btn');
                            if (prevBtn) prevBtn.textContent = '▶️';
                        }
                        audioEl.play();
                        playBtn.textContent = '⏸️';
                        activeCatalogAudio = audioEl;
                    } else {
                        audioEl.pause();
                        playBtn.textContent = '▶️';
                        activeCatalogAudio = null;
                    }
                });

                audioEl.addEventListener('ended', () => {
                    playBtn.textContent = '▶️';
                    activeCatalogAudio = null;
                });
            }

            // Evento: Editar
            const editBtn = item.querySelector('.catalog-edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => openEditModal(song));
            }

            // Evento: Eliminar
            const delBtn = item.querySelector('.catalog-delete-btn');
            if (delBtn) {
                delBtn.addEventListener('click', () => openDeleteModal(song));
            }

            catalogGrid.appendChild(item);
        });
    }

    // --- MODAL DE EDICIÓN ---
    function openEditModal(song) {
        currentEditingSong = song;
        editingImageData = null;
        editingRemoveImage = false;

        if (editModalSongId) editModalSongId.textContent = `(ID: #${song.id})`;
        if (editSongTitleInput) editSongTitleInput.value = song.title || '';
        if (editSongSubtitleInput) editSongSubtitleInput.value = song.subtitle || '';
        
        // Reset foto
        if (song.has_poster && song.poster_url) {
            editImgThumb.src = `${song.poster_url}?t=${Date.now()}`;
            editImgThumb.style.display = 'block';
            editNoImgText.style.display = 'none';
            editImgStatusText.textContent = song.posterPath || "Foto actual asignada";
            editRemoveImgBtn.style.display = 'inline-flex';
        } else {
            editImgThumb.src = '';
            editImgThumb.style.display = 'none';
            editNoImgText.style.display = 'block';
            editImgStatusText.textContent = "Sin foto actual";
            editRemoveImgBtn.style.display = 'none';
        }

        if (editImgFileInput) editImgFileInput.value = '';
        if (editSongModal) editSongModal.style.display = 'flex';
    }

    function closeEditModal() {
        if (editSongModal) editSongModal.style.display = 'none';
        currentEditingSong = null;
        editingImageData = null;
        editingRemoveImage = false;
    }

    if (closeEditModalX) closeEditModalX.addEventListener('click', closeEditModal);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);

    // Selección y recorte de foto en Modal de Edición
    if (editImgPreviewBox) {
        editImgPreviewBox.addEventListener('click', () => {
            if (editImgFileInput) editImgFileInput.click();
        });
    }

    if (editImgFileInput) {
        editImgFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                return showToast("Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP).", "error");
            }

            const reader = new FileReader();
            reader.onload = (ev) => {
                const tempImg = new Image();
                tempImg.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 512;
                    canvas.height = 512;
                    const ctx = canvas.getContext('2d');

                    const minSide = Math.min(tempImg.naturalWidth, tempImg.naturalHeight);
                    const sx = (tempImg.naturalWidth - minSide) / 2;
                    const sy = (tempImg.naturalHeight - minSide) / 2;

                    ctx.drawImage(tempImg, sx, sy, minSide, minSide, 0, 0, 512, 512);
                    const dataUrl = canvas.toDataURL('image/png');

                    editingImageData = dataUrl;
                    editingRemoveImage = false;
                    editImgThumb.src = dataUrl;
                    editImgThumb.style.display = 'block';
                    editNoImgText.style.display = 'none';
                    editImgStatusText.textContent = `✅ Nueva foto 512×512 lista para guardar`;
                    editRemoveImgBtn.style.display = 'inline-flex';
                };
                tempImg.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    if (editRemoveImgBtn) {
        editRemoveImgBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            editingImageData = null;
            editingRemoveImage = true;
            editImgThumb.src = '';
            editImgThumb.style.display = 'none';
            editNoImgText.style.display = 'block';
            editImgStatusText.textContent = "🗑️ La portada será eliminada al guardar";
            editRemoveImgBtn.style.display = 'none';
            if (editImgFileInput) editImgFileInput.value = '';
        });
    }

    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', async () => {
            if (!currentEditingSong) return;
            const newTitle = editSongTitleInput.value.trim();
            const newSubtitle = editSongSubtitleInput.value.trim();

            if (!newTitle) {
                return showToast("El título de la canción no puede estar vacío.", "warning");
            }

            try {
                saveEditBtn.disabled = true;
                saveEditBtn.textContent = "Guardando...";

                const folder = catalogFolderSelect.value;
                const payload = {
                    title: newTitle,
                    subtitle: newSubtitle,
                    image_data: editingImageData || "",
                    remove_image: editingRemoveImage
                };

                const res = await fetch(`/api/catalog/${encodeURIComponent(folder)}/${encodeURIComponent(currentEditingSong.id)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Error al actualizar canción");

                showToast(`✅ Canción #${currentEditingSong.id} actualizada con éxito`, "success");
                closeEditModal();
                await loadCatalog(folder);
            } catch (err) {
                showToast("Error: " + err.message, "error");
            } finally {
                saveEditBtn.disabled = false;
                saveEditBtn.textContent = "💾 Guardar Cambios";
            }
        });
    }

    // --- MODAL DE ELIMINACIÓN ---
    function openDeleteModal(song) {
        currentDeletingSong = song;
        if (deleteModalSongTitle) deleteModalSongTitle.textContent = song.title || `Canción #${song.id}`;
        if (deleteModalSongSubtitle) deleteModalSongSubtitle.textContent = song.subtitle || song.audioPath || '';
        if (deletePhysicalFilesCheckbox) deletePhysicalFilesCheckbox.checked = true;
        if (deleteSongModal) deleteSongModal.style.display = 'flex';
    }

    function closeDeleteModal() {
        if (deleteSongModal) deleteSongModal.style.display = 'none';
        currentDeletingSong = null;
    }

    if (closeDeleteModalX) closeDeleteModalX.addEventListener('click', closeDeleteModal);
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (!currentDeletingSong) return;
            const folder = catalogFolderSelect.value;
            const deleteFiles = deletePhysicalFilesCheckbox ? deletePhysicalFilesCheckbox.checked : true;

            try {
                confirmDeleteBtn.disabled = true;
                confirmDeleteBtn.textContent = "Eliminando...";

                const res = await fetch(`/api/catalog/${encodeURIComponent(folder)}/${encodeURIComponent(currentDeletingSong.id)}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ delete_files: deleteFiles })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Error al eliminar canción");

                let msg = `🗑️ Canción "${currentDeletingSong.title}" eliminada del catálogo.`;
                if (data.deleted_audio_file) msg += " (Audio borrado de disco)";
                showToast(msg, "success");

                closeDeleteModal();
                await loadCatalog(folder);
            } catch (err) {
                showToast("Error: " + err.message, "error");
            } finally {
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = "🗑️ Sí, Eliminar";
            }
        });
    }

    // Buscador interactivo en Catálogo
    if (catalogSearchInput) {
        catalogSearchInput.addEventListener('input', (e) => {
            const val = e.target.value;
            if (catalogClearSearchBtn) {
                catalogClearSearchBtn.style.display = val ? 'inline-block' : 'none';
            }
            renderCatalog(val.trim());
        });
    }

    if (catalogClearSearchBtn) {
        catalogClearSearchBtn.addEventListener('click', () => {
            if (catalogSearchInput) {
                catalogSearchInput.value = '';
                catalogClearSearchBtn.style.display = 'none';
                catalogSearchInput.focus();
            }
            renderCatalog('');
        });
    }

    if (catalogFolderSelect) {
        catalogFolderSelect.addEventListener('change', (e) => {
            loadCatalog(e.target.value);
        });
    }

    if (catalogRefreshBtn) {
        catalogRefreshBtn.addEventListener('click', () => {
            loadCatalog(catalogFolderSelect.value);
            showToast("Catálogo actualizado desde el disco.", "info");
        });
    }

    // Inicializar Catálogo de Tonos al arrancar
    loadCatalogFolders();

    addTask(); // Init first empty task
});
