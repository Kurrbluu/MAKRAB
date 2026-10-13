# Pindahkan Aku Plsss! — tutorial

The tutorial follows the new supplied voiceover from **8 October 2026, 13:10**. The complete recording and video run **5:30.040**, across twenty chapters. Open `index.html` or the homepage tutorial button. The top corner brand and chapter labels remain removed.

The source WAV keeps its original pace. No silence, repeated sentences, word replacements, or speed changes are added. The encoded web track is `assets/tutorial-narration.m4a` and uses a new cache version so the old recording does not remain in playback.

## Recorded sequence

Five role cards are drawn and turned over as their names are spoken. The setup shows equal room populations, a same-faction Gambler in each room, faction corners, tape boundaries, and the GM's whistle and sound cues. The phase overview leads into Terawang, one challenge per Gambler per phase, best-of-three suit, private reveal on a win, a closed-card alternative on a loss, then faction discussion.

The ordinary Exchange is **one example** split around the narrated GM contingency: shared target draw, eligible Leader selection, final choice, GM fallback if no choice was made, role verification and point recording, then one simultaneous transfer. Leader and Gambler are excluded from ordinary selection and the GM's eligible pool. Gamblers exchange with partners of the same faction during Exchange 2, before the other players, with no points.

The four point values are highlighted at their recorded cues: **VIP +3, Pretender −3, Warden +1, Civilian −1**. The following VIP example shows GM crediting the selecting faction, without replaying movement. Highest accumulated points wins. The remaining voiceover explains card secrecy, permitted disclosure to a successful Gambler or GM, no cross-room communication, information carried through Exchange, and the closing.

## Chapters

| Frame | Scene ID | Chapter | Recording time |
| --- | --- | --- | --- |
| 1 | `intro` | Empat faksi, dua ruangan | 00:00.000–00:09.240 |
| 2 | `leaders` | Pilih dua Leader | 00:09.240–00:16.280 |
| 3 | `leader-protection` | Leader dilindungi | 00:16.280–00:20.800 |
| 4 | `ribbons` | Pita kepala dan pergelangan tangan | 00:20.800–00:30.720 |
| 5 | `roles` | Kenali lima role | 00:30.720–00:38.200 |
| 6 | `card-pickup` | Pilih dan rahasiakan kartu | 00:38.200–00:45.800 |
| 7 | `rooms` | Bagi anggota dan Gambler secara rata | 00:45.800–00:57.800 |
| 8 | `faction-spots` | Empat sudut dan batas tape | 00:57.800–01:12.240 |
| 9 | `gm-cues` | Peluit, sound cue, dan timer GM | 01:12.240–01:25.140 |
| 10 | `loop` | Terawang, Diskusi, dan Exchange | 01:25.140–01:34.140 |
| 11 | `inspection` | Terawang dan suit best of three | 01:34.140–02:19.700 |
| 12 | `discussion` | Bagikan informasi saat Diskusi | 02:19.700–02:36.800 |
| 13 | `exchange` | Target Exchange dan pilihan Leader | 02:36.800–03:16.160 |
| 14 | `gm-selection` | Jika Leader belum memilih | 03:16.160–03:28.560 |
| 15 | `exchange-completion` | GM cek kartu, lalu pindah serentak | 03:28.560–03:53.080 |
| 16 | `gambler-exchange` | Exchange kedua: Gambler satu faksi | 03:53.080–04:16.600 |
| 17 | `final` | Poin dan penentuan pemenang | 04:16.600–04:57.660 |
| 18 | `card-safety` | Rahasiakan kartu role | 04:57.660–05:10.740 |
| 19 | `room-communication` | Informasi antar ruangan | 05:10.740–05:20.340 |
| 20 | `end` | Siap bermain? | 05:20.340–05:30.040 |

Chapter shortcuts follow this order. Existing review filenames retain their routes, with updated visible frame numbers. Additional review pages cover `gm-cues`, `discussion`, `exchange-completion`, `card-safety`, and `room-communication`. Legacy `leader-rules` and `anchor` links open the ordinary selection chapter.

## Audio and playback

The source is `audio/Generated Audio October 08, 2026 - 1_10PM.wav` (330.040 seconds, mono PCM16 at 24 kHz). `audio/narration-sync.json` records contiguous source and video cuts. `voice-over.txt` provides the timed transcript of the recording currently installed. `audio/tutorial-script-revised.txt` is updated to that recording's wording.

The Pretender inspection reveal uses separate front and back rotations, with only one face visible. Neither visible face rotates beyond its edge, preventing mirrored text during the flip in WebKit and MP4 snapshots.

The narration clock drives the animation clock. Play, pause, seeking, chapter jumps, and replay control both together. Muting retains timing. If automatic sound is blocked, playback waits for **Aktifkan suara**. Audio errors preserve the silent playback fallback.

Rebuild on macOS with `python3 scripts/sync-tutorial-audio.py`. For a lossless intermediate, use `--wav-only /path/to/output.wav`. The rebuilt PCM data is identical to the supplied recording.

## Review

- Full video: `index.html?v=voiceover-1310-sync-1`
- Terawang: `index.html?scene=inspection&v=voiceover-1310-sync-1`
- Selection: `index.html?scene=exchange&v=voiceover-1310-sync-1`
- GM fallback: `index.html?scene=gm-selection&v=voiceover-1310-sync-1`
- Verification and transfer: `index.html?scene=exchange-completion&v=voiceover-1310-sync-1`
- Gambler swap: `index.html?scene=gambler-exchange&v=voiceover-1310-sync-1`
- Point values: `index.html?scene=final&v=voiceover-1310-sync-1`
- GM point example: `index.html?scene=final&cue=gm-example&v=voiceover-1310-sync-1`

Reviews open paused. Space plays or pauses; arrows change chapters; R restarts; F opens fullscreen. `?autoplay` starts at zero; `?autoplay&record` also hides controls.

## MP4 export

`scripts/export-tutorial.swift` renders the actual tutorial timeline into **1920 × 1080, 30 fps H.264 MP4**, then embeds the synchronized AAC voiceover. It captures the tutorial through a private WebKit view; desktop content, player controls, chapter shortcuts, and the end-screen replay button are excluded. Each video frame uses its exact playback timestamp, so rendering speed does not alter narration timing.

Start the Vite server on port 5173 and run these commands from the project root on macOS:

```sh
xcrun swiftc scripts/export-tutorial.swift -o /private/tmp/pindahkan-export-tutorial
/private/tmp/pindahkan-export-tutorial --output exports/Pindahkan-Aku-Plsss-Tutorial.mp4
```

The default audio source is `tutorial-demo/assets/tutorial-narration.m4a`. Optional `--start` and `--duration` arguments render a short review clip; `--url` and `--audio` select another preview or narration file. Existing output files are preserved; choose a new output filename to export another version.

## Verification

Run `node tutorial-demo/tests/playback.cjs` for the full timeline, recorded visual cue timings, protected roles, shared targets, one ordinary transfer, same-faction zero-point Gambler exchange, true-role scoring, narration-clock synchronization, pause/rewind, review links, and autoplay recovery. `npm run build` ships all tutorial assets and review pages into `dist/tutorial-demo/`.
