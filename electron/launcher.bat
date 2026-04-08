@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
mode con: cols=120 lines=35
color 0F
cls

set "APPDIR=%LOCALAPPDATA%\NexansAffiche"
set "SRC=%~dp0Nexans Affiche-win32-x64"
set "LIBRARY=%~dp0library"
set "VERSION_FILE=%APPDIR%\.version"
set "VERSION=1.0.21"

echo.
if exist "%APPDIR%\app\resources\nexans-ascii.txt" (
    type "%APPDIR%\app\resources\nexans-ascii.txt"
) else if exist "%~dp0Nexans Affiche-win32-x64\resources\nexans-ascii.txt" (
    type "%~dp0Nexans Affiche-win32-x64\resources\nexans-ascii.txt"
)
echo.
echo  -------------------------------------------------------------------------------
echo    Editeur d'affiche de ligne de production                          v%VERSION%
echo  -------------------------------------------------------------------------------
echo.

:: Dossier library partage
if not exist "%LIBRARY%" (
    echo   [1/3]  Initialisation du dossier library...
    mkdir "%LIBRARY%" >nul 2>&1
) else (
    echo   [1/3]  Dossier library OK
)

:: Lecture version locale
if exist "%VERSION_FILE%" (
    set /p LOCAL_VER=<"%VERSION_FILE%"
) else (
    set "LOCAL_VER="
)

:: Mise a jour si necessaire
if not "!LOCAL_VER!"=="%VERSION%" (
    echo.
    echo   [2/3]  Mise a jour  !LOCAL_VER! -^> %VERSION%
    echo          Fermeture de l'application...
    taskkill /F /IM "Nexans Affiche.exe" >nul 2>&1
    echo          Copie des fichiers...
    mkdir "%APPDIR%\app" >nul 2>&1
    robocopy "%SRC%" "%APPDIR%\app" /MIR /NP /NFL /NDL /NJH /NJS >nul

    if errorlevel 8 (
        echo.
        echo   [!]  ERREUR lors de la copie des fichiers.
        echo        Verifiez que vous avez les droits necessaires.
        echo.
        pause
        exit /b 1
    )

    echo %VERSION%> "%VERSION_FILE%"
    echo          Mise a jour terminee avec succes.
) else (
    echo   [2/3]  Application a jour  ^(v%VERSION%^)
)

:: Lancement
echo.
echo   [3/3]  Demarrage en cours...
echo.
echo         L'application va s'ouvrir dans quelques secondes.
echo         Cette fenetre se fermera automatiquement.
echo.

set ELECTRON_RUN_AS_NODE=
start "" "%APPDIR%\app\Nexans Affiche.exe" "--library=%LIBRARY%"
endlocal
