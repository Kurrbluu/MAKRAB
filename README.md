# Pindahkan Aku Plsss!

Home dan layar permainan, menggunakan React, TypeScript, Vite, dan CSS. Tersedia mode mandiri, sesi bersama melalui server lokal, serta backend online Vercel + Supabase untuk dua ruangan dan GM di HP.

Panduan singkat dua laptop dengan proyektor dan speaker masing-masing ada di [OPERATE-2-DEVICE-LOCAL.md](OPERATE-2-DEVICE-LOCAL.md). Sinkronisasi, pemulihan progres lokal, GM Access, koreksi/clear, dan ranking otomatis tanpa angka poin sudah diimplementasikan. Rencana awal berada di [DDAY-PLAN.md](DDAY-PLAN.md).

Pilihan backup gratis melalui laptop kedua dan langkah persiapan server online, termasuk biaya, ada di [BACKUP-ONLINE.md](BACKUP-ONLINE.md).

Panduan deploy, daftar environment, serta cara memakai URL yang sama pada proyektor dan HP ada di [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md). Backend online menyimpan sesi dan login GM di PostgreSQL, memakai pembaruan dengan pemeriksaan versi agar input bersamaan tidak menimpa data. Realtime hanya mengirim state publik dan ranking; catatan poin serta identitas GM berada pada tabel privat. Timer berjalan memakai deadline absolut dan diselesaikan lewat request saat deadline tercapai, tanpa proses Node yang perlu hidup terus-menerus. Website belum dipublikasikan; sesi lokal dan cloud terpisah.

## Menjalankan

Aplikasi dan server lokal mendukung Windows serta macOS. Untuk server pada Windows 10/11 64-bit, gunakan Node.js 24 dan Chrome/Edge terbaru. Kedua ruangan boleh memakai sistem operasi yang berbeda; laptop yang hanya membuka browser tidak perlu memasang Node.js.

Pada Windows, jalankan `SETUP-WINDOWS.cmd` sekali saat persiapan dan `START-WINDOWS.cmd` saat acara. Jika menyalin proyek dari Mac, instal dependensi di Windows dengan `npm.cmd ci`; `node_modules` mempunyai komponen khusus sistem operasi. Command `npm.cmd` juga dapat digunakan langsung melalui Command Prompt atau PowerShell.

Workflow `.github/workflows/compatibility.yml` menyiapkan build dan tes pada Windows/macOS, dengan folder proyek yang mengandung spasi; workflow berjalan setelah proyek dimasukkan ke GitHub. Verifikasi sesi ini dilakukan di macOS. Pengujian langsung pada Windows tetap perlu dilakukan saat rehearsal. Penyimpanan progres memakai handle dengan akses tulis sesuai [ketentuan Windows](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers).

Gunakan Node.js 24.

```sh
npm install
npm run dev
```

Buka alamat lokal yang ditampilkan Vite. Server development hanya mendengarkan di laptop ini.

```sh
npm run build
npm run preview
```

Build menjalankan pemeriksaan TypeScript lalu menghasilkan situs statis di `dist/`. Folder tersebut dapat digunakan untuk hosting statis ketika situs siap dipublikasikan. Sesi bersama juga membutuhkan server; hosting `dist/` saja menjalankan mode mandiri.

## Sesi bersama untuk dua ruangan

Setelah `npm ci`, jalankan pada laptop server:

```sh
npm run host
```

Perintah ini membangun aplikasi dan menjalankan server pada port 3000, menerima koneksi LAN. Buka alamat jaringan yang dicetak terminal pada kedua laptop; keduanya perlu terhubung ke router yang sama. Internet tidak diperlukan setelah instalasi. Aktifkan suara pada masing-masing browser sebelum mulai. Jika membuka `/#/game` langsung pada sesi baru, layar menunggu operator menekan Play.

Server menentukan fase, countdown, hasil target, dan jadwal roulette satu kali. Pembaruan diterima melalui Server-Sent Events; perintah operator dikirim lewat HTTP. Browser menyesuaikan waktu terhadap server supaya perbedaan jam laptop tidak mengubah countdown. Volume, mute, fullscreen, proyektor, dan output speaker tetap lokal. UI pada kedua laptop sama; tentukan satu operator aktif. Perintah dari keadaan lama ditolak dan ID perintah mencegah pengulangan klik/request yang sama.

Progres ditulis secara atomik ke `.game-state/session.json` sebelum perintah dikonfirmasi. Setelah server berhenti, `npm start` memuat file tersebut dan menjalankan build yang sudah tersedia. Waktu yang berlalu tetap dihitung. Browser melakukan reconnect otomatis; perubahan permainan diblokir selama terputus, dan pengumuman fase lama tidak diputar ulang saat bergabung kembali. File progres yang rusak ditolak tanpa menimpanya. Pemindahan server memerlukan salinan folder progres dan perubahan alamat secara manual; belum ada failover otomatis.

Server hanya menyajikan file dalam `dist/`. Kode server dan file progres tidak disajikan ke browser. Implementasi berada di `server/host.mjs`, `src/lib/sharedGame.ts`, dan `src/hooks/SharedSession.tsx`.

## Home

- Nama station **Pindahkan Aku Plsss!**, dengan keempat logo faction dari aset yang disediakan.
- Home bertema empat penjaga China, dengan ilustrasi taman malam berwarna jade dan biru, pegunungan, paviliun, pinus dan bambu di kedua sisi, lentera merah, serta cap nama China pada faction. Tiga lapisan kabut bergerak perlahan dan logo melayang lembut; semua animasi mengikuti pengaturan reduced motion.
- Latar menggunakan `public/scenery/celestial-garden-v2.webp` (412 KB); sumber PNG dan prompt lengkap disimpan bersama proyek. Arah visual berada di `design/celestial-garden-art-direction.md`.
- Home selalu muat dalam satu layar tanpa scroll. Ukuran judul, logo, dan jarak menyesuaikan tinggi layar; layar pendek menggunakan empat faction dalam satu baris.
- Hanya dua tombol utama: **Mulai Permainan** dan **Mainkan Video Tutorial**.
- **Mulai Permainan** membuka satu timer untuk fase saat ini di `/#/game`, dalam satu viewport tanpa scroll.
- **Mainkan Video Tutorial** membuka demo 5:30 dengan voiceover di tab baru. Demo video berada terpisah di `tutorial-demo/`.
- Randomizer berjalan otomatis pada tiga fase Terawang sebelum perpindahan faction. Empat guliran logo faction membuka hasil satu per satu dengan selisih 0,18 detik, dengan panel roulette berukir di tengah dan jeda hasil sebelum countdown muncul. Ikon kanan atas menyiapkan permainan baru dan fullscreen.
- Tampilan untuk laptop dan HP, kontrol keyboard, dan dukungan reduced motion.

Role pemain adalah **Gambler, Warden, Civilian, VIP, dan Pretender**. Leader memilih pemain langsung. GM memeriksa kartu role dan mencatat skor faction pemilih melalui GM Access: VIP +3, Pretender −3, Civilian −1, dan Warden +1. Gambler dan Leader tidak dapat dipilih pada catatan Exchange biasa. Catatan kedua ruangan digabung dan dikelompokkan otomatis per 8; tersedia koreksi, hapus satu catatan, clear semua catatan, serta total poin khusus GM. Ranking publik hanya menampilkan urutan faction dan muncul otomatis setelah Exchange serta catatan kedua ruangan lengkap. Pencatatan dapat dinonaktifkan tanpa menghapus catatan.

## Timer permainan

Pemilih fase paling atas menampilkan nama kegiatan rata tengah di dalam bingkai berujung miring, dengan ornamen simetris dan aksen mengikuti warna fase. Kontrol tetap memakai dropdown dan keyboard yang sama. Label nama ruangan dihapus dari header target dan roulette. Panel faction menambahkan motif rasi bintang samar yang berbeda untuk tiap pemilih, aksen bintang pada judul target, serta bingkai kecil pada panah; motif rasi disembunyikan pada layar sempit atau pendek.

Layar permainan menampilkan **satu countdown untuk fase yang sedang dipilih**, dengan nama kegiatan, kategori, dan pemilih fase di atasnya. **Exchange** memakai amber hangat dengan panel bronze gelap, **Terawang** memakai aqua dengan panel slate, dan **Diskusi** memakai lavender dengan panel violet gelap. Warna mengikuti fase pada badge, bingkai, tombol, latar, dan preview sound cue. Panel fase memakai warna berbeda dari kotak faction. Badge hasil **Terpilih**, panah target, dan penanda konfirmasi memakai warna netral agar tidak terkesan sebagai identitas Black Tortoise. Terawang dan Diskusi memiliki countdown terpisah, masing-masing **01:30** di semua ronde. Penjelasan, persiapan, buffer, serta pengumuman pemenang berada di luar timer permainan.

Saat target faction tampil pada layar lebar, countdown berada di panel tengah dengan angka terang, ring, dan bingkai berwarna lembut sesuai fase. Dua pasangan faction tampil di sebelah kiri dan dua pasangan di sebelah kanan, dengan tepi atas dan bawah yang sejajar dengan panel timer. Semua panel berada di dalam bingkai luar dengan jarak aman. Tampilan memakai permukaan matte dan aksen warna tanpa glow neon. Logo dan nama target berukuran besar agar mudah dilihat peserta; faction pemilih dan arah target tercantum pada tiap pasangan. Selama undian, panel tengah menampilkan roulette berukir dengan empat emblem faction dan nomor Exchange. Empat guliran kartu memakai kecepatan yang sama dan membuka target tersimpan berurutan dengan selisih 0,18 detik. Semua hasil ditahan dua detik sebelum countdown muncul. Pada layar yang lebih sempit, panel tengah berada di atas papan target; HP memakai dua kolom. Saat fase tidak memakai target, hanya countdown fase saat ini yang tampil. Seluruh tampilan tetap satu layar tanpa scroll.

Timer mencakup **15 menit permainan aktif**, di luar roulette dan kegiatan pembuka atau penutup.

Dial countdown memakai ukiran garis, penanda arah, serta simbol mata untuk Terawang, percakapan untuk Diskusi, dan dua arah perpindahan untuk Exchange. Panel memiliki ornamen sudut dan garis hias; latar menambahkan siluet pegunungan serta lengkungan celestial yang samar. Dekorasi statis, warna fase tetap lembut, dan logo faction asli dipertahankan. Dalam 15 detik terakhir, garis bingkai dan ring diperjelas tanpa berkedip. Detail dial disederhanakan pada panel horizontal layar kecil supaya angka tetap terbaca.

| Waktu aktif | Kegiatan | Durasi |
| --- | --- | --- |
| 00:00–01:30 | Terawang 1 | 01:30 |
| 01:30–03:00 | Diskusi 1 | 01:30 |
| 03:00–05:00 | Exchange 1 | 02:00 |
| 05:00–06:30 | Terawang 2 | 01:30 |
| 06:30–08:00 | Diskusi 2 | 01:30 |
| 08:00–09:00 | Exchange 2 · Gambler | 01:00 |
| 09:00–11:00 | Exchange 2 · pemain lainnya | 02:00 |
| 11:00–12:30 | Terawang 3 | 01:30 |
| 12:30–14:00 | Diskusi 3 | 01:30 |
| 14:00–15:00 | Exchange 3 | 01:00 |

**Mulai Permainan** mengacak target ronde pertama, menahan hasil terakhir selama **2 detik**, lalu otomatis menjalankan **Terawang 1 (01:30)** tanpa menekan Play. Permainan baru mengikuti alur yang sama; hasil pertama yang sudah tersimpan dipakai kembali saat timer belum pernah dimulai. Pemilih fase menampilkan nama kegiatan tanpa rentang waktu. Panel timer menampilkan nama fase dan countdown tanpa keterangan “Fase X dari 10”. Penyimpanan rundown lama tidak dapat mengembalikan fase briefing, persiapan, buffer, atau durasi lama. Setelah Exchange terakhir habis, GM mengumumkan pemenang tanpa timer penutup.

Saat countdown habis, GM menekan **›** untuk memulai fase berikutnya. Jika pencatatan aktif, Exchange menampilkan ranking otomatis setelah catatan lengkap; **Lanjut** membuka fase berikutnya atau layar selesai setelah ranking terakhir. Tanpa pencatatan, Exchange 3 langsung membuka **Permainan selesai**. Layar akhir memakai empat kotak faction glass dan pesan kecil **Hasil akhir segera diumumkan.** Selesai tersimpan setelah refresh; **Permainan baru** membuka konfirmasi reset. Shortcut Space dan R tidak memulai ulang timer dari layar selesai. Tampilan berada di `src/components/GameEndScreen.tsx` dan `game-end-screen.css`.

Pada fase undian, countdown baru dimulai setelah roulette selesai; fase lain dimulai langsung. Tombol **‹** dan pemilih fase menyiapkan fase tujuan dalam keadaan jeda, termasuk setelah undian selesai. Setiap perpindahan fase mengambil durasinya sendiri: perpindahan Gambler dan perpindahan terakhir memakai 01:00, sedangkan dua perpindahan lainnya memakai 02:00. Tombol play, reset, dan edit hanya mengendalikan timer untuk fase yang terlihat.

Tombol ikon timer: **▶ / pause**, **reset**, dan **pensil** untuk mengubah menit/detik. Ring terluar juga dapat di-drag: searah jarum jam menambah waktu, berlawanan mengurangi; satu putaran = satu menit. Drag menjeda timer lalu menyimpan saat dilepas; tekan Play untuk melanjutkan. Ring mengikuti sisa waktu terhadap durasi timer. Durasi dibatasi konfigurasi fase. Input dari keadaan lama ditolak jika perangkat lain sudah mengubah timer.

Shortcut: **→** lanjut dan mulai fase berikutnya, **←** kembali ke fase sebelumnya dalam keadaan jeda, **Space** play/pause timer aktif, **R** reset timer aktif, **F** fullscreen, **Esc** keluar fullscreen atau batal mengedit. Shortcut panah tetap bekerja setelah tombol diklik; saat mengedit durasi atau memilih fase pada dropdown, panah mengikuti kontrol tersebut. Menahan tombol panah tidak melewati beberapa fase sekaligus. Ikon kiri atas kembali ke Home; kanan atas membuka fullscreen.

Timer memakai batas waktu absolut agar tab di background atau refresh tidak menambah waktu countdown yang berjalan. Mode mandiri menyimpan fase, sisa waktu, dan durasi pada browser; mode bersama menyimpannya pada server. Kembali ke Home dari layar timer menjeda semua clock. Undian tampil sebelum countdown Terawang sehingga durasi fase tetap penuh. Waktu roulette berada di luar durasi countdown pada tabel; GM tetap mengendalikan pergantian fase. Mengulang animasi menjeda countdown sementara dan melanjutkan sisa waktunya setelah reveal.

Edit urutan dan durasi fase pada `phaseDefinitions` di **`src/data/gamePhases.ts`**. Rentang menit dihitung otomatis dari durasinya. `RUNDOWN_CONFIG.initialPhaseId` memilih fase awal; `autoAdvance` dapat diaktifkan untuk melanjutkan fase otomatis saat countdown habis. Mode default menunggu GM. Nama kategori dan warnanya berada di **`src/data/timers.ts`**. Tampilan berada di **`src/GameScreen.tsx`** dan **`src/game-screen.css`**, logika fase di **`src/lib/gameRundown.ts`**, dan logika countdown di **`src/lib/gameTimer.ts`**. Demo tutorial tetap terpisah di `tutorial-demo/`.

## Sound cue fase

Cue memakai voiceover yang disediakan, dengan efek pendek yang berbeda untuk tiap fase:

| Fase | Voiceover | Efek | Durasi |
| --- | --- | --- | --- |
| Terawang | `audio/Fase Terawang.wav` | Crystal chime | 2,80 detik |
| Diskusi | `audio/Fase Diskusi.wav` | Double bell | 2,54 detik |
| Exchange / Perpindahan | `audio/Fase perpindahan.wav` | Whoosh dan impact | 2,99 detik |

Cue otomatis berbunyi satu kali saat countdown fase mulai. Terawang menunggu roulette dan jeda hasil dua detik. Pause/resume, reset clock, replay roulette, dan refresh fase yang sudah berjalan tidak mengulang pengumuman. Pertukaran Gambler dan Exchange pemain lainnya masing-masing memiliki cue karena merupakan tahap yang berbeda.

Ikon speaker di kanan atas membuka pengaturan suara: coba setiap cue, atur volume, atau matikan cue otomatis. Klik **Mulai Permainan** mengaktifkan audio browser sebelum undian, sehingga Safari dapat memutar cue otomatis setelahnya. Jika membuka URL game langsung, coba cue atau klik salah satu kontrol untuk mengaktifkan audio. Volume dan pilihan aktif disimpan lokal.

Saat membuka timer langsung atau setelah refresh, tombol **Aktifkan suara** tampil jika browser belum mengizinkan audio. Klik tombol tersebut untuk menyambungkan suara ke posisi roulette yang sedang berjalan. Pengumuman fase yang sempat menunggu audio dibunyikan satu kali saat audio aktif dan fase tersebut masih berjalan. Timer dan target undian tetap mengikuti alur yang sama. Pengaturan menjelaskan volume 0% atau kegagalan pemuatan file, dengan tombol untuk mencoba kembali. Pengacakan manual juga menggunakan pengaturan suara yang sama; kecepatannya mengikuti animasi kartu.

Randomizer memiliki suara sendiri: klik kayu mengikuti percepatan dan perlambatan roulette selama 4,8 detik, bunyi konfirmasi saat empat target muncul berurutan, lalu gong pendek setelah target terakhir. Suara mengikuti ketiga undian dan **Ulangi animasi**. Saat berpindah fase atau kembali ke Home, suara dibatalkan; mematikan suara otomatis juga menghentikannya. Bunyi hasil mengikuti reveal yang sebenarnya, sedangkan cue Terawang tetap menunggu jeda hasil dua detik. Audio yang terlambat dimuat bergabung pada posisi putaran saat ini.

Preview **Randomizer** berada di pengaturan speaker, dengan volume dan mute yang sama seperti cue fase. File utuh untuk didengarkan terdapat di `exports/Pindahkan-Aku-Plsss-Randomizer.wav` (6,86 detik). Komponen spin, konfirmasi, dan penutup berada di `public/audio/randomizer/`, dibuat melalui `scripts/generate-randomizer-cues.py`. Generator membaca durasi dari `src/lib/exchangePresentation.ts` supaya suara tetap mengikuti timing animasi.

Audio siap pakai berada di `public/audio/phase-cues/`. Paket tiga cue terdapat di `exports/Pindahkan-Aku-Plsss-Sound-Cues.zip`. Efek dibuat melalui `scripts/generate-phase-cues.py`, lalu dicampur dengan voiceover; efek diturunkan selama ucapan agar nama fase jelas. Sumber voiceover asli tidak diubah.

Pemetaan dan pencegahan cue ganda berada di `src/lib/phaseCues.ts`, pemutaran Web Audio di `src/lib/phaseCueAudio.ts`, dan preview di `src/components/PhaseCueSettings.tsx`.
Aktivasi dan status audio memakai `src/hooks/useGameSound.ts`; penyesuaian spin dan reveal memakai `src/hooks/useRandomizerSound.ts`.

## Randomizer

**Terawang 1**, **Terawang 2**, dan **Terawang 3** menyiapkan target untuk tiga perpindahan faction berikutnya. Target tetap tampil selama Diskusi dan Exchange pada ronde yang sama. Fase Gambler tidak mengacak atau menampilkan target faction; target kedua yang sudah disiapkan digunakan kembali saat perpindahan lainnya 2. Setiap fase dapat dibuka lewat **→**, tombol berikutnya, atau pemilih fase. Empat kartu besar menjalankan roulette otomatis pada fase persiapan undian. Hasil berlaku sama untuk **Room A dan Room B**. Diskusi, Exchange, dan perpindahan Gambler tidak memicu undian baru.

Setiap satu dari sembilan susunan yang valid memiliki peluang sama; reciprocal pairs diperbolehkan. Tidak ada target diri sendiri, dan setiap faction menjadi target tepat satu kali. Setiap undian diacak secara independen sehingga hasil yang sama boleh terulang. Leader memilih pemain secara langsung. Halaman randomizer manual tetap memiliki lima slot hasil.

Hasil disimpan dan ditetapkan sebelum animasi dimulai. Refresh, menjeda timer, mereset clock, atau kembali ke ronde yang sama mempertahankan targetnya. Masuk kembali ke fase persiapan undian mengulang animasi dengan hasil yang sama. Refresh setelah undian selesai langsung menampilkan hasil; refresh saat countdown menunggu undian melanjutkan reveal dengan target tersimpan, lalu memulai countdown. Saat masuk perpindahan faction, hasil tetap tampil tanpa animasi ulang. Jika operator langsung memilih perpindahan faction dan belum ada target tersimpan, aplikasi menyiapkan target tanpa animasi. Target mendatang hanya terlihat setelah fase persiapannya dimasuki.

Roulette berlangsung sekitar tujuh detik pada setiap ronde dan replay, termasuk jeda dua detik sebelum countdown. Empat guliran hanya menampilkan faction target yang sah dan langsung mendarat pada hasil tersimpan. Kartu yang mendarat tetap berada di tempat saat dikonfirmasi, sehingga faction tidak berganti atau berkedip saat hasil dikunci. Guliran mempercepat dan memperlambat secara halus. Hasil tersimpan muncul satu per satu dengan selisih 0,18 detik, sehingga keempat hasil terbuka dalam 0,54 detik. Panel tengah menampilkan nomor Exchange, empat emblem faction, dan bingkai berukir yang bergerak selama undian. Setelah hasil terakhir terlihat, jeda dua detik berlaku untuk semua ronde sebelum timer dimulai. Randomizer manual memakai urutan dan selisih pembukaan hasil yang sama.

Tombol **Ulangi animasi** pada fase Terawang memutar guliran dengan target yang sama. Tombol lewati animasi dihapus dari layar game dan randomizer manual. Perubahan ukuran layar mempertahankan guliran; perubahan fase membatalkan presentasi sebelumnya. Durasi dan kandidat memakai `src/lib/exchangePresentation.ts`, gerakan memakai animasi transform bawaan browser pada `src/hooks/useRouletteMotion.ts`, dengan fallback yang mengubah transform langsung saat API animasi tidak tersedia, dan jeda hasil memakai `src/hooks/useTargetReveal.ts`. Panel tengah berada di `src/components/RouletteDisplay.tsx`. Halaman Randomizer manual kembali memakai animasi kartu berkumpul, diacak, dibagikan, lalu dibuka melalui `CardDrawAnimation.tsx`, dengan lima slot hasil tetap tersedia.

Untuk sesi berikutnya, klik ikon **Permainan baru** di kanan atas, kemudian konfirmasi. Timer dan semua hasil target dikosongkan bersama; rundown kembali ke Terawang pertama. Pada sesi server, reset berlaku untuk kedua ruangan. Mesin undian berada di `src/lib/randomizer.ts`, pengaturan undian otomatis di `src/lib/exchangeFlow.ts`, dan tampilan yang menyatu dengan timer di `src/components/ExchangeDraw.tsx` serta `exchange-draw.css`. Halaman manual di `/#/randomizer` tersedia pada mode mandiri; sesi server menggunakan undian bersama di layar game.

Jalankan pemeriksaan aturan pengacakan dan penyimpanan dengan:

```sh
npm test
```

## Logo faction

Nama station (`gameName`) dan data identitas ada di `src/data/game.ts`. Empat logo asli berada di `public/factions/`: `azure-dragon.png`, `vermilion-bird.png`, `white-tiger.png`, dan `black-tortoise.png`. Aplikasi memakai salinan WebP dengan alpha yang sama untuk mempercepat pemuatan animasi; sumber PNG tetap tersedia. Path logo mengikuti base URL Vite agar tetap bekerja saat situs dipasang di subfolder. Gambar menggunakan `object-fit: contain`; inisial menjadi fallback jika gambar gagal dimuat. Home dan papan target memakai ilustrasi yang sama dalam ukuran besar.

`makrab-home-mockup.png` adalah referensi visual awal. Gambar tersebut tidak digunakan oleh halaman yang sudah disederhanakan.

Kotak besar yang membungkus faction pemilih dan hasil randomizer memakai tinta indigo gelap dengan bingkai tipis emas antik. Warna ini mengikuti nuansa taman malam celestial dan tetap berbeda dari background fase. Ornamen sudut geometris, motif awan samar, dan tekstur halus memberi karakter pada pembungkus; seluruh dekorasi statis dan berada di belakang isi kotak. Pada HP, ornamen lebih kecil dan motif awan disembunyikan. Komponen bersama `src/components/FactionFrame.tsx` dipakai pada layar game dan randomizer manual. Kotak logo pemilih dan kartu hasil memakai warna faction yang tetap di semua fase: Dragon navy, Bird burgundy, Tiger abu mutiara, dan Tortoise hijau hutan. `boxColor` dan `boxBaseColor` pada `src/data/game.ts` mengatur warna bidang dan bingkai kartu, sementara `color` mengatur aksen teks. Warna fase hanya mengikuti background layar dan panel timer. Kotak pemilih memakai warna lebih tipis; kartu target yang terpilih sedikit lebih tegas. Bidang warna tetap lembut agar tidak terlalu kuat secara visual, dengan nama faction tetap terang. Kotak sudut faction pada tutorial mengikuti perlakuan yang sama. Logo asli tetap digunakan.
