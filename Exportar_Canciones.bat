@echo off
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] No se encontro el entorno virtual en Github\.venv
    echo Por favor, ejecuta primero: instalar.bat
    pause
    exit /b 1
)

:: Ejecutar el script y esperar a que el usuario presione una tecla al terminar (si hay error)
".venv\Scripts\python.exe" exportar_catalogo.py
pause
exit /b
