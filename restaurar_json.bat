@echo off
cd /d "%~dp0"
echo Restaurando los archivos ringtones.json a su estado original (solo afectara a los JSON)...
git checkout HEAD -- salsa/ringtones.json
echo.
echo ==================================================
echo ¡Restauracion completada!
echo Tus canciones antiguas y su orden han vuelto.
echo (Las canciones que acababas de descargar tendras que procesarlas de nuevo).
echo ==================================================
pause
