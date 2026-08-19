@echo off
setlocal
title LocalFastShares - Uninstaller

echo ==================================================
echo   LocalFastShares (LFS) - Uninstaller
echo ==================================================
echo.

echo [1/3] Stopping running processes...
taskkill /F /IM LocalFastShares.exe >nul 2>&1

echo [2/3] Removing Windows Registry Autostart...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "LocalFastShares" /f >nul 2>&1

echo [3/3] Removing Desktop and Start Menu Shortcuts...
del /F /Q "%USERPROFILE%\Desktop\LocalFastShares.lnk" >nul 2>&1
del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\LocalFastShares.lnk" >nul 2>&1

echo.
echo LocalFastShares shortcuts and startup entries have been removed.
echo You can now delete the folder: %LOCALAPPDATA%\LocalFastShares
echo.
pause
exit /b 0
