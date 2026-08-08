@echo off
echo ==============================================
echo REPARANDO HISTORIAL DE GITHUB
echo ==============================================
echo.
echo GitHub bloqueo la subida para proteger tus contrasenas de Airtable.
echo Vamos a limpiar esos archivos del historial para que puedas subir todo seguro...
echo.
git reset origin/main
git rm --cached profiles.json
git rm --cached Scripts/config.py
echo.
echo Listo. Los archivos confidenciales (como profiles.json y config.py) 
echo ahora estan protegidos y no se subiran a internet publicamente.
echo.
echo Por favor, vuelve a tu aplicacion web y presiona el boton de "Subir a GitHub" nuevamente.
pause
