@echo off
echo ========================================
echo   Starting RoastRumble Development
echo ========================================
echo.

echo [1/2] Starting Backend Server (Port 3001)...
start "RoastRumble Server" cmd /k "cd server && npm start"
timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend (Port 3000)...
start "RoastRumble Frontend" cmd /k "npm run dev"

echo.
echo ========================================
echo   RoastRumble is starting!
echo ========================================
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:3001
echo.
echo Press any key to open browser...
pause >nul

start http://localhost:3000

echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause

