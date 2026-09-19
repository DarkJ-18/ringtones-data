# Registro de Cambios (Changelog)

Todas las modificaciones notables de este proyecto serán documentadas en este archivo.

## [Pendiente] - 2026-09-19

### Cambios Realizados
- **Interfaz (index.html):** Se eliminaron las 3 tarjetas de "Herramientas de Mantenimiento" (Exportar Catálogo, Purgar Caché CDN, Limpiar Caché).
- **Interfaz (index.html):** La pestaña de herramientas ahora solo contiene la "Sincronización en la Nube (GitHub)" y la "Consola de Herramientas".
- **Servidor (app.py):** Se activó el modo `debug=True` y la variable `TEMPLATES_AUTO_RELOAD = True` en Flask para permitir ver cambios en HTML al instante solo recargando el navegador (sin reiniciar el servidor).
