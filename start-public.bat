@echo off
echo 🌐 Subsidi Tepat LPG - Web Server Setup
echo ======================================

echo.
echo 📡 Network Information:
echo ----------------------

REM Show IP configuration
ipconfig | findstr /C:"IPv4" | findstr /V "127.0.0.1"

echo.
echo 🚀 Starting web server on all network interfaces...
echo The server will be accessible from:
echo    - Local: http://localhost:3000
echo    - Network: http://YOUR_IP:3000
echo.
echo ⚠️  SECURITY NOTE:
echo    The server will be accessible from your network.
echo    Make sure your firewall allows port 3000 if needed.
echo.
echo Press Ctrl+C to stop the server
echo.

REM Set environment variable and start server
set HOST=0.0.0.0
pnpm web
