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
echo Menyiapkan aplikasi untuk Windows. Internet diperlukan untuk instalasi ini.
call npm.cmd ci
if errorlevel 1 goto failed
call npm.cmd run build
if errorlevel 1 goto failed
echo Selesai. Untuk menjalankan game, buka START-WINDOWS.cmd.
pause
exit /b 0
:failed
echo Setup belum berhasil. Periksa pesan di atas, lalu jalankan setup lagi.
pause
exit /b 1
