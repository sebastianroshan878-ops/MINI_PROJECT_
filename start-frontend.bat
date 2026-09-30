@echo off
cd /d "%~dp0frontend"
echo ========================================================
echo   Starting RestaurantPro Frontend Client (Port 5173)
echo ========================================================
echo.
call npm run dev
pause
