# Backup lokal dan online

Status: server lokal tersedia dan backend Vercel + Supabase sudah disiapkan. Versi online belum dipublikasikan; progres lokal dan online belum saling menyalin otomatis. Panduan konfigurasi ada di [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md).

## Pilihan dan biaya

| Pilihan | Biaya | Cara pakai |
| --- | --- | --- |
| Laptop B sebagai server cadangan | Tanpa biaya hosting | Salin proyek + `.game-state`, jalankan di B, buka alamat B pada kedua browser |
| Vercel + Supabase | Bisa mulai gratis sesuai kuota dan ketentuan paket | Semua perangkat membuka satu URL; database dan sinkronisasi memakai Supabase |
| Server online di Railway | Hobby mulai US$5/bulan; termasuk US$5 pemakaian, lebihnya dikenakan biaya | Kedua laptop membuka URL online yang sama; keduanya perlu internet |
| Railway Free | US$0, dengan US$1 kredit resource per bulan | Untuk percobaan; kebutuhan pemakaian aplikasi perlu diukur dahulu |

Harga Railway diperiksa 12 Oktober 2026 dari [dokumentasi Railway](https://docs.railway.com/pricing). [Vercel Hobby](https://vercel.com/docs/plans/hobby) membatasi penggunaan pada proyek pribadi nonkomersial. [Supabase Free](https://supabase.com/pricing) dapat pause setelah seminggu tidak aktif dan tidak menyediakan backup otomatis. URL bawaan layanan dapat digunakan; membeli domain sendiri tidak wajib. Jangan menganggap paket gratis tanpa batas.

## Kalau memilih Vercel

Ikuti [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md): buat Supabase project, jalankan SQL, lalu isi environment di Vercel. Kode API menyimpan data di database; tidak memerlukan volume file atau satu server Node yang terus berjalan. Layar publik hanya menerima timer, target, dan ranking. GM masuk dengan nama serta PIN untuk mengubah timer atau mencatat poin.

**Online merupakan sesi terpisah, belum menjadi failover otomatis dari laptop.** Memindahkan progres permainan yang sedang berjalan memerlukan prosedur migrasi tersendiri. Upload file `.game-state/session.json` ke hosting publik bukan cara memulihkan sesi.

## Alternatif: server Node di Railway

1. Simpan proyek ke repository GitHub, lalu hubungkan ke satu layanan Node.js di Railway.
2. Build: `npm ci && npm run build`. Gunakan Node.js 24.
3. Tambahkan satu volume penyimpanan pada `/data`, agar `session.json` tetap ada setelah restart.
4. Set `MAKRAB_PORT=3000`; start command: `npm start -- --state-dir /data`. Gunakan satu instance server.
5. Buat domain bawaan Railway yang menuju port 3000, lalu uji dua browser, timer, audio, dan reconnect sebelum acara.

Volume menyimpan file di cloud, tetapi **tidak mengambil progres laptop A otomatis**. Agar melanjutkan permainan yang sama, `session.json` terbaru perlu dipindahkan ke volume server online dengan prosedur pemulihan yang diuji. Prosedur transfer itu belum dibuat menjadi tombol di aplikasi; upload hasil build saja tidak cukup.

Langkah di atas mengikuti [volume Railway](https://docs.railway.com/volumes) dan [domain serta target port](https://docs.railway.com/networking/domains/working-with-domains). Akun, publikasi, serta biaya layanan belum diaktifkan.

## Saran untuk D-Day

Pakai **server lokal sebagai utama dan laptop B sebagai cadangan gratis**. Siapkan online sebagai opsi tambahan bila memang perlu, dengan internet yang sudah diuji. Saat beralih server, hentikan kendali pada sesi lama, pulihkan progres yang tersedia, lalu arahkan kedua laptop ke server yang sama.
