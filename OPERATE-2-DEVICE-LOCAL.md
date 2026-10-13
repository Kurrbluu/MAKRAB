# Cara pakai dua laptop secara lokal

Tetap memakai aplikasi web di **browser**, tetapi tidak perlu hosting online atau internet. Laptop A menjalankan server lokal; laptop B mengaksesnya melalui router/Wi-Fi yang sama.

Windows dan Mac dapat dipakai bersama. Gunakan Chrome/Edge terbaru pada Windows 10/11, dan Node.js 24 64-bit pada laptop server Windows. Laptop yang hanya membuka game cukup memakai browser; Node.js diperlukan pada laptop server.

## Persiapan sekali saja

- Pasang Node.js 24 pada laptop A dan salin folder proyek ini.
- Jika folder berasal dari Mac, instal ulang dependensi di Windows; jangan memakai salinan `node_modules` Mac.
- Di terminal dalam folder proyek, jalankan `npm ci`. Langkah instalasi ini memerlukan internet.
- Sambungkan kedua laptop ke jaringan yang sama. Hindari guest Wi-Fi yang memblokir koneksi antarperangkat.

**Shortcut Windows:** jalankan `SETUP-WINDOWS.cmd` sekali saat persiapan, lalu `START-WINDOWS.cmd` saat acara. Alternatif melalui Command Prompt/PowerShell: `npm.cmd ci`, kemudian `npm.cmd run host`. `npm.cmd` dapat dipakai tanpa mengubah execution policy PowerShell.

## Saat acara

1. Di laptop A, buka terminal dalam folder proyek dan jalankan:

   ```sh
   npm run host
   ```

2. Terminal menampilkan alamat seperti `http://192.168.1.20:3000`. Buka **alamat yang sama pada kedua laptop**. `localhost` hanya menunjuk ke laptop yang membukanya.
3. Sambungkan laptop masing-masing ke proyektor dan speaker ruangannya. Aktifkan suara lewat tombol audio pada **kedua browser**, lalu atur volume dan fullscreen sendiri-sendiri.
4. Tentukan satu operator untuk mulai, pause, undian, dan pindah fase. Perintahnya berlaku untuk kedua layar.
5. Biarkan terminal server dan router tetap menyala; matikan sleep otomatis laptop A. Jika diminta firewall, izinkan koneksi Node.js pada jaringan lokal.

Pada Windows, gunakan profil jaringan **Private** untuk jaringan acara yang dipercaya dan izinkan Node.js pada jaringan Private saat Windows Firewall meminta izin.

## Kenapa kedua layar bisa sama?

Server A menyimpan satu sesi: fase, waktu countdown, dan hasil undian. Kedua browser mengambil sesi tersebut dan menghitung timer berdasarkan waktu server. Speaker tetap memutar audio dari laptop masing-masing.

## Kalau koneksi terputus

- Browser menyambung kembali otomatis dan mengambil progres terbaru; hasil undian tidak diacak ulang. Kontrol permainan dinonaktifkan selama terputus.
- Jika program server berhenti, jalankan `npm start` dari folder yang sama. Progres dimuat dari `.game-state/session.json`; waktu yang berlalu tetap dihitung.
- Untuk pindah server ke laptop B, salin proyek **beserta folder `.game-state`**, jalankan di B, lalu buka alamat B pada kedua browser. Ini pemulihan manual, bukan perpindahan otomatis.

Jika B disiapkan sebagai server cadangan, pasang Node.js dan jalankan `npm ci` di B saat persiapan, sebelum hari acara.

Sebelum D-Day, lakukan satu rehearsal dengan dua laptop, proyektor, speaker, dan jaringan venue.
