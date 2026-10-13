@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Pasang Node.js 24 dari https://nodejs.org lalu buka file ini lagi.
  pause
  exit /b 1
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm belum tersedia. Pasang ulang Node.js, lalu buka file ini lagi.
  pause
  exit /b 1
)
node -e "const [major, minor] = process.versions.node.split('.').map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)"
if errorlevel 1 (
  echo Node.js terlalu lama. Pasang Node.js 24 lalu buka file ini lagi.
  pause
  exit /b 1
)
if not exist "node_modules\" (
  echo Jalankan SETUP-WINDOWS.cmd sekali sebelum mulai memakai aplikasi.
  pause
  exit /b 1
)
echo Menjalankan server lokal. Biarkan jendela ini terbuka selama game.
call npm.cmd run host
if errorlevel 1 (
  echo Server berhenti karena error. Periksa pesan di atas.
  echo Jika folder berasal dari Mac atau dependensi belum siap, jalankan SETUP-WINDOWS.cmd.
  pause
  exit /b 1
)
exit /b 0
