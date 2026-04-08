@echo off
setlocal
set "LOCAL=%LOCALAPPDATA%\NexansAffiche"
set "SRC=%~dp0Nexans Affiche-win32-x64"
set "LIBRARY=%~dp0library"
set "VERSION_FILE=%LOCAL%\.version"
set "VERSION=1.0.20"

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
    mkdir "%LOCAL%\app" >nul 2>&1
    robocopy "%SRC%" "%LOCAL%\app" /MIR /NP /NFL /NDL /NJH /NJS >nul
    echo %VERSION%> "%VERSION_FILE%"
    echo Installation terminee.
    echo  Demarrage de l'application en cours, veuillez patienter...
)

set ELECTRON_RUN_AS_NODE=
start "" "%LOCAL%\app\Nexans Affiche.exe" "--library=%LIBRARY%"
endlocal
