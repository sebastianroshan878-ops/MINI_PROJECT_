@echo off
cd /d "%~dp0"
echo ========================================================
echo   RestaurantPro - Dependency Installer
echo ========================================================
echo.
echo [1/2] Installing Backend Dependencies...
cd /d "%~dp0backend"
call npm install
echo.
echo [2/2] Installing Frontend Dependencies...
cd /d "%~dp0frontend"
call npm install
echo.
echo ========================================================
echo   All dependencies installed successfully!
echo ========================================================
pause
