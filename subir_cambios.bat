@echo off
rem Sube a GitHub todos los cambios del proyecto (doble clic o desde una tarea programada).
cd /d "%~dp0"

git add -A
git diff --cached --quiet && (
    echo No hay cambios para subir.
    goto :traer
)
git commit -m "Cambios del %date% %time:~0,5%"

:traer
git pull --rebase --autostash origin main || (
    echo.
    echo Hubo un conflicto con los cambios de GitHub. Revisalo antes de volver a subir.
    pause
    exit /b 1
)
git push origin main && echo Listo: cambios subidos a GitHub.
if "%1"=="" pause
