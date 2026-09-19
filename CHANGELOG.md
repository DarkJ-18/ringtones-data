# Registro de Cambios (Changelog)

Todas las modificaciones notables de este proyecto serán documentadas en este archivo.

## [Pendiente] - 2026-09-19

### Cambios Realizados
- **Interfaz (index.html):** Se eliminaron las 3 tarjetas de "Herramientas de Mantenimiento" (Exportar Catálogo, Purgar Caché CDN, Limpiar Caché).
- **Interfaz (index.html):** La pestaña de herramientas ahora solo contiene la "Sincronización en la Nube (GitHub)" y la "Consola de Herramientas".
- **Servidor (app.py):** Se activó el modo `debug=True` y la variable `TEMPLATES_AUTO_RELOAD = True` en Flask para permitir ver cambios en HTML al instante solo recargando el navegador (sin reiniciar el servidor).
- **Funcionalidad Nueva:** Se agregó una nueva tarjeta en Herramientas llamada "Explorador de Archivos", que lista automáticamente las carpetas del proyecto ('base', 'loud', etc) y permite abrirlas directamente en el explorador de Windows con un click.
- **Commit `f3e6cce`:** Se guardaron formalmente todos estos cambios en el repositorio local bajo el mensaje *"Mejora de interfaz: limpieza de herramientas y nueva función de Explorador de Archivos"*.
- **Backend (CDN):** Se mejoró el script de subida a GitHub (`SubidaAutomaticaGit.ps1` y `purgar_cdn.py`) para detectar dinámicamente el usuario/repositorio actual. Ahora, si otro usuario usa el proyecto en otra PC, purgará su propia caché en lugar de fallar. (Commits `2e45e62`, `debc9ac`).
- **Mejoras UI/UX:** Se aplicaron principios de *Design Engineering*. Se añadieron estados vacíos ("Empty States") en la cola de tareas, las tarjetas ahora tienen un panel desplegable ("Ajustes Avanzados") para limpiar la jerarquía visual, y todas las animaciones de la web son más reactivas, con físicas de rebote (`scale: 0.97`) en botones y tooltips suaves.
- **Commits `5528824`, `d009190`:** Se confirmaron localmente todas estas actualizaciones de interfaz de usuario.
