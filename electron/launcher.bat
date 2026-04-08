@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
mode con: cols=120 lines=35
color 0F
cls

:: ─────────────────────────────────────────────
set "LOCAL=%LOCALAPPDATA%\NexansAffiche"
set "SRC=%~dp0Nexans Affiche-win32-x64"
set "LIBRARY=%~dp0library"
set "VERSION_FILE=%LOCAL%\.version"
set "VERSION=1.0.21"
:: ─────────────────────────────────────────────

echo.
type "%~dp0nexans-ascii.txt"
echo.
echo  ════════════════════════════════════════════════════════════════════════════
echo    Editeur d'affiche de ligne de production                        v%VERSION%
echo  ════════════════════════════════════════════════════════════════════════════
echo.

:: ── Dossier library ──────────────────────────────────────────────────────────
if not exist "%LIBRARY%" (
    echo   [1/3]  Initialisation du dossier library partagé...
    mkdir "%LIBRARY%" >nul 2>&1
) else (
    echo   [1/3]  Dossier library OK
)

:: ── Lecture de la version locale ─────────────────────────────────────────────
if exist "%VERSION_FILE%" (
    set /p LOCAL_VER=<"%VERSION_FILE%"
) else (
    set "LOCAL_VER="
)

:: ── Mise à jour si nécessaire ────────────────────────────────────────────────
if not "!LOCAL_VER!"=="%VERSION%" (
    echo.
    echo   [2/3]  Mise à jour  !LOCAL_VER! → %VERSION%
    echo          Fermeture de l'application en cours...
    taskkill /F /IM "Nexans Affiche.exe" >nul 2>&1
    echo          Copie des fichiers de l'application...
    mkdir "%LOCAL%\app" >nul 2>&1
    robocopy "%SRC%" "%LOCAL%\app" /MIR /NP /NFL /NDL /NJH /NJS >nul

    if errorlevel 8 (
        echo.
        echo   [!]  ERREUR lors de la copie des fichiers.
        echo        Vérifiez que vous avez les droits nécessaires.
        echo.
        pause
        exit /b 1
    )

    echo %VERSION%> "%VERSION_FILE%"
    echo          Mise à jour terminée avec succès.
) else (
    echo   [2/3]  Application à jour  ^(v%VERSION%^)
)

:: ── Lancement ────────────────────────────────────────────────────────────────
echo.
echo   [3/3]  Démarrage en cours...
echo.
echo  ┌──────────────────────────────────────────────────────────────────────┐
echo  │   L'application va s'ouvrir dans quelques secondes.                  │
echo  │   Cette fenêtre se fermera automatiquement.                          │
echo  └──────────────────────────────────────────────────────────────────────┘
echo.

set ELECTRON_RUN_AS_NODE=
start "" "%LOCAL%\app\Nexans Affiche.exe" "--library=%LIBRARY%"
endlocal
