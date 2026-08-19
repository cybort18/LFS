@echo off
setlocal enabledelayedexpansion
title LocalFastShares - Windows Setup Installer

echo ==================================================
echo   LocalFastShares (LFS) - Permanent Setup Installer
echo ==================================================
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\LocalFastShares"
set "SRC_DIR=%~dp0"
if exist "%SRC_DIR%dist\LFS.exe" set "SRC_DIR=%SRC_DIR%dist\"
if exist "%SRC_DIR%dist\LocalFastShares.exe" set "SRC_DIR=%SRC_DIR%dist\"

set "EXE_NAME=LFS.exe"
if exist "%SRC_DIR%LFS.exe" (
    set "EXE_NAME=LFS.exe"
) else (
    set "EXE_NAME=LocalFastShares.exe"
)

echo [1/4] Stopping any existing LocalFastShares process...
taskkill /F /IM LFS.exe >nul 2>&1
taskkill /F /IM LocalFastShares.exe >nul 2>&1

echo [2/4] Installing application to: %INSTALL_DIR%
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

copy /Y "%SRC_DIR%*.exe" "%INSTALL_DIR%\" >nul
copy /Y "%SRC_DIR%tray-bundle.cjs" "%INSTALL_DIR%\" >nul 2>&1
xcopy /E /I /Y "%SRC_DIR%engine" "%INSTALL_DIR%\engine" >nul 2>&1
xcopy /E /I /Y "%SRC_DIR%public" "%INSTALL_DIR%\public" >nul
xcopy /E /I /Y "%SRC_DIR%assets" "%INSTALL_DIR%\assets" >nul
xcopy /E /I /Y "%SRC_DIR%traybin" "%INSTALL_DIR%\traybin" >nul
copy /Y "%~dp0uninstall.bat" "%INSTALL_DIR%\" >nul 2>&1

echo [3/4] Creating Desktop and Start Menu Shortcuts...

set "DESKTOP_LNK=%USERPROFILE%\Desktop\LocalFastShares.lnk"
set "STARTMENU_LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\LocalFastShares.lnk"
set "TARGET_EXE=%INSTALL_DIR%\%EXE_NAME%"
set "TARGET_ICON=%INSTALL_DIR%\assets\icon.ico"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP_LNK%'); $s.TargetPath = '%TARGET_EXE%'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.IconLocation = '%TARGET_ICON%'; $s.Description = 'LocalFastShares (LFS) - High-Speed Local File Transfer'; $s.Save()"
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTMENU_LNK%'); $s.TargetPath = '%TARGET_EXE%'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.IconLocation = '%TARGET_ICON%'; $s.Description = 'LocalFastShares (LFS) - High-Speed Local File Transfer'; $s.Save()"

echo [4/4] Registering Windows Startup (Autostart)...
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "LocalFastShares" /t REG_SZ /d "\"%TARGET_EXE%\"" /f >nul

echo.
echo ==================================================
echo   INSTALLATION COMPLETED SUCCESSFULLY!
echo ==================================================
echo - Installed to:  %INSTALL_DIR%
echo - Desktop Icon:  Created (with official logo)
echo - Start Menu:    Created
echo - Windows Boot:  Enabled (can be toggled in tray)
echo ==================================================
echo.
echo Launching LocalFastShares...
start "" "%TARGET_EXE%"
timeout /t 3 >nul
exit /b 0
