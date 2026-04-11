@echo off
REM ─── bjnhPOS: Local build script for Windows ─────────────────────────────
REM Run this from the repo root on your local Windows machine.
REM After it finishes, the backend\ folder is ready to upload to cPanel.

echo [1/4] Installing frontend dependencies...
cd frontend
call npm install --no-audit --no-fund
if errorlevel 1 ( echo ERROR: npm install failed & pause & exit /b 1 )

echo [2/4] Building frontend...
set GENERATE_SOURCEMAP=false
set CI=false
call npm run build
if errorlevel 1 ( echo ERROR: build failed & pause & exit /b 1 )

echo [3/4] Copying build output to backend\public\...
cd ..
if exist backend\public rmdir /s /q backend\public
xcopy /E /I /Y frontend\build backend\public

echo [4/4] Done.
echo.
echo Upload the entire backend\ folder to your cPanel Application Root.
echo See DEPLOY.md for exact cPanel steps.
pause
