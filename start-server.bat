@echo off
title PawSpace - Expo dev server
cd /d "%~dp0"

where node >nul 2>&1 || (
    echo Node.js is not installed or not on PATH. Install it from https://nodejs.org
    goto :end
)

if not exist node_modules (
    echo Installing dependencies - first run only...
    call npm install || goto :error
)

echo Starting Expo dev server...
echo Scan the QR code with Expo Go on your phone, or press "w" to open in the browser.
echo.
call npx expo start
goto :end

:error
echo.
echo npm install failed - check the messages above.

:end
pause
