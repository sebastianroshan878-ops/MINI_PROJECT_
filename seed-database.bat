@echo off
cd /d "%~dp0backend"
echo ========================================================
echo   Seeding RestaurantPro Demo Data
echo ========================================================
echo.
call npm run seed
pause
