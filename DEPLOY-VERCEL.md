# Online: Vercel + Supabase

Kode sudah disiapkan. Website belum dipublikasikan atau terhubung ke akun cloud.

Vercel menampilkan game dan menerima perintah GM. Supabase menyimpan timer, undian, dan catatan; pembaruan dikirim ke kedua ruangan. Semua perangkat membuka **URL website yang sama**. Laptop Windows/macOS dan HP cukup memakai browser serta internet.

## Yang perlu disiapkan

1. **Akun Supabase:** buat project, pilih region Singapore bila tersedia. Jalankan seluruh [supabase/schema.sql](supabase/schema.sql) di **SQL Editor**. SQL juga menyalakan Realtime untuk tabel layar publik.
2. **Akun Vercel:** import repository proyek, pilih **Vite**, Node.js **24.x**. Build dan routing sudah ada di `vercel.json`; tidak perlu menjalankan `npm start` di Vercel.
3. Masukkan environment berikut di **Vercel → Settings → Environment Variables**, lalu deploy/redeploy:

| Nama | Isi |
| --- | --- |
| `SUPABASE_URL` | Project URL dari Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key `sb_publishable_…`; boleh diterima browser |
| `SUPABASE_SECRET_KEY` | Secret key `sb_secret_…`; hanya untuk backend |
| `MAKRAB_GM_PIN` | PIN **6 digit** pilihan operator |
| `MAKRAB_SESSION_KEY` | Misalnya `makrab-big-game`; sama untuk seluruh perangkat |

Kunci tersedia di pengaturan **API Keys** Supabase. Project dengan kunci lama dapat memakai `SUPABASE_ANON_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` sebagai pengganti. Jangan memberi awalan `VITE_` pada secret atau PIN. Jangan unggah `.env` maupun `.game-state` ke repository.

Gunakan environment **Production** untuk acara. Untuk Preview, gunakan Supabase project atau `MAKRAB_SESSION_KEY` berbeda supaya rehearsal tidak mengubah permainan acara. Setelah mengubah environment, **redeploy**. Mengganti PIN juga mengakhiri login GM lama.

## Cara memakai

- Dua laptop proyektor: buka `https://alamatmu.vercel.app/#/game`, fullscreen, aktifkan suara **di masing-masing browser**. Layar tanpa login hanya menampilkan game.
- Operator dan GM: buka `/#/gm`, isi nama serta PIN. Operator kembali ke game untuk Start, pause, pindah fase, atau drag timer. GM di HP dapat mencatat poin pada URL yang sama.
- Ranking tanpa angka poin muncul setelah Exchange selesai dan **8 catatan dari kedua ruangan lengkap**. Jika belum lengkap, layar menunggu input; lalu berganti otomatis.

Sebelum D-Day, uji kedua laptop + HP: mulai/ubah timer, input di kedua ruangan bersamaan, koreksi/clear, ranking otomatis, refresh, putus-sambung internet, dan suara dari kedua speaker. Pastikan project Supabase aktif dan URL Production dapat dibuka tanpa login akun Vercel.

## Biaya dan backup

Bisa mulai dengan paket gratis sesuai kuota. [Vercel Hobby](https://vercel.com/docs/plans/hobby) untuk penggunaan pribadi nonkomersial; [Supabase Free](https://supabase.com/pricing) dapat pause setelah seminggu tidak aktif dan tidak menyertakan backup otomatis. Cek dashboard sebelum acara; domain berbayar tidak wajib. Ketentuan diperiksa 12 Oktober 2026.

Server lokal tetap dapat dijalankan lewat `npm run host`. **Sesi lokal dan online terpisah; perpindahan progres belum otomatis.** Website baru mulai dengan sesi baru. Untuk acara, pilih satu sesi yang dipakai seluruh perangkat dan siapkan [backup lokal](BACKUP-ONLINE.md).

## Verifikasi kode

`npm test` menguji database PostgreSQL lokal (PGlite), pembaruan bersamaan, login antar-instance, izin publik, ranking, dan regresi server lokal. `npm run build` memeriksa TypeScript dan membangun situs. Koneksi ke Supabase/Vercel sebenarnya tetap perlu diuji setelah environment dipasang.
