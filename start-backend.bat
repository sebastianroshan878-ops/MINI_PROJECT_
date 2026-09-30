@echo off
cd /d "%~dp0backend"
echo ========================================================
echo   Starting RestaurantPro Backend Server (Port 5000)
echo ========================================================
echo.
call npm run dev
pause
