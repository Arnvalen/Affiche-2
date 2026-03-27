@echo off
setlocal
set "LOCAL=%LOCALAPPDATA%\NexansAffiche"
set "SRC=%~dp0Nexans Affiche-win32-x64"
set "LIBRARY=%~dp0library"
set "VERSION_FILE=%LOCAL%\.version"
set "VERSION=1.0.3"

:: Creer le dossier library partage s'il n'existe pas
if not exist "%LIBRARY%" mkdir "%LIBRARY%"

:: Lire la version locale si elle existe
if exist "%VERSION_FILE%" (
    set /p LOCAL_VER=<"%VERSION_FILE%"
) else (
    set "LOCAL_VER="
)

:: Copier si pas a jour
if not "%LOCAL_VER%"=="%VERSION%" (
    echo Installation Nexans Affiche v%VERSION%...
    taskkill /F /IM "Nexans Affiche.exe" >nul 2>&1
    if exist "%LOCAL%" rmdir /s /q "%LOCAL%" >nul 2>&1
    mkdir "%LOCAL%" >nul 2>&1
    xcopy /s /e /i /q /y "%SRC%" "%LOCAL%\app" >nul
    echo %VERSION%> "%VERSION_FILE%"
    echo Installation terminee.
)

set ELECTRON_RUN_AS_NODE=
start "" "%LOCAL%\app\Nexans Affiche.exe" "--library=%LIBRARY%"
endlocal
