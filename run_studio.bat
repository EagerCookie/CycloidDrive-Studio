@echo off
chcp 65001 >nul
echo ===================================================
echo   Запуск CycloidDrive Studio (Web-приложение)
echo ===================================================
echo Открытие в браузере: http://localhost:8080
echo Для остановки закройте это окно.
echo.

start "" "http://localhost:8080"
python -m http.server 8080
pause
