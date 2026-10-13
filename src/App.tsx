import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { factions, gameFlow, gameName } from './data/game'
import type { Faction } from './data/game'
import BackgroundDecoration from './components/BackgroundDecoration'
import CelestialBackdrop from './components/CelestialBackdrop'
import FactionEmblem from './components/FactionEmblem'
import RandomizerScreen from './RandomizerScreen'
import GameScreen from './GameScreen'
import GameMasterScreen from './GameMasterScreen'
import { unlockPhaseCueAudio } from './lib/phaseCueAudio'
import { SharedSessionProvider, useSharedSession } from './hooks/SharedSession'

function currentScreen() {
  if (window.location.hash === '#/gm') return 'gm'
  if (window.location.hash === '#/game') return 'game'
  return window.location.hash === '#/randomizer' ? 'randomizer' : 'home'
}

function FactionIdentity({ faction, index }: { faction: Faction; index: number }) {
  return (
    <li className={`faction faction--${faction.id}`} style={{ '--faction-color': faction.color, '--faction-delay': `${index * -1.7}s` } as CSSProperties}>
      <div className="faction-presence">
        <span className="faction-aura" aria-hidden="true" />
        <FactionEmblem faction={faction} />
        <span className="faction-seal" lang="zh-Hant" aria-hidden="true">{faction.chineseName}</span>
      </div>
      <span className="faction-name">{faction.name}</span>
    </li>
  )
}

function GameGuide() {
  return (
    <div className="guide">
      <p className="dialog-description">
        Game sosial dua ruangan. Cari informasi, susun strategi, dan atur perpindahan pemain untuk mengumpulkan poin.
      </p>
      <section className="guide-section">
        <h3>Alur permainan</h3>
        <ol className="game-flow">
          {gameFlow.map(([title, description]) => (
            <li key={title}>
              <h4>{title}</h4>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="guide-section">
        <h3>Exchange</h3>
        <ul className="rule-list">
          <li>Faction tidak boleh menargetkan dirinya sendiri. Setiap faction ditargetkan tepat satu kali dalam setiap hasil pengacakan.</li>
          <li>Hasil target berlaku sama di kedua ruangan.</li>
          <li>Leader memilih satu pemain dari faction target di ruangannya sendiri. Leader tidak dapat dipilih untuk dipindahkan.</li>
          <li>Jika Leader belum memilih saat waktu memilih habis, GM memilih satu pemain biasa secara acak dari faction target tersebut.</li>
          <li>Pemain terpilih dari kedua ruangan berpindah serentak, satu pemain per faction di setiap arah. Jumlah pemain di kedua ruangan tetap seimbang.</li>
          <li>Pemain lain tetap duduk selama Exchange supaya suasana tetap tertib dan kondusif.</li>
          <li>Pada Exchange ke-2, Gambler bertukar dengan Gambler dari faksi yang sama di ruangan sebelah, sebelum perpindahan pemain lainnya. Pertukaran Gambler tidak menambah atau mengurangi poin.</li>
          <li>Durasi perpindahan mengikuti rundown. Target faction diacak kembali untuk perpindahan berikutnya; target sebelumnya boleh terulang.</li>
        </ul>
      </section>
      <section className="guide-section">
        <h3>Leader & Terawang</h3>
        <p>Role pemain: Gambler, Warden, Civilian, VIP, dan Pretender.</p>
        <p>Setiap faction memilih satu Leader per ruangan. Leader tidak menerima kartu role, tidak dapat dipindahkan saat Exchange, dan tidak bisa diterawang. Gambler menantang satu anggota biasa suit best of tiga, satu kali per fase Terawang. Jika Gambler menang, lawan membuka kartu secara privat kepada Gambler.</p>
        <p>Leader memakai pita di kepala sebagai headband. Anggota biasa memakai pita di pergelangan tangan.</p>
        <p>Setiap ruangan memiliki empat spot di sudut kelas, sesuai warna dan logo faction. Tape di lantai memisahkan keempat area tersebut. Setiap faction harus tetap di areanya dan tidak boleh melewati garis tape.</p>
      </section>
      <section className="guide-section">
        <h3>Poin Exchange</h3>
        <p>Sebelum pemain terpilih keluar ruangan, GM memeriksa kartu role aslinya dan memperbarui skor faction yang memilih pemain tersebut: VIP +3 poin, Pretender −3 poin, Civilian −1 poin, dan Warden +1 poin. Setelah skor dicatat, pemain berpindah atas aba-aba GM. Poin selama permainan dijumlahkan. Faction dengan total poin tertinggi menang.</p>
      </section>
      <p className="guide-note">Timer mengikuti fase Terawang, Diskusi, dan Exchange. GM mengendalikan pergantian fase. Perpindahan Gambler berlangsung pada Exchange kedua, sebelum pemain lainnya berpindah.</p>
    </div>
  )
}

function AppContents() {
  const shared = useSharedSession()
  const [screen, setScreen] = useState(currentScreen)
  const [guideOpen, setGuideOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!shared?.snapshot || shared.connection !== 'connected') return
    // A GM navigation can arrive before the hashchange updates screen state.
    if (screen === 'gm' || currentScreen() === 'gm') return
    if (shared.snapshot.state.active) window.location.hash = '#/game'
    else if (!shared.snapshot.state.active && window.location.hash === '#/game' && shared.snapshot.state.revision > 0) window.location.hash = '#/'
  }, [screen, shared?.snapshot?.state.active, shared?.snapshot?.state.revision, shared?.connection])

  useEffect(() => {
    const handleHashChange = () => setScreen(currentScreen())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    document.title = screen === 'gm' ? `GM · ${gameName}` : screen === 'game' ? `Permainan · ${gameName}` : screen === 'randomizer' ? `Randomizer · ${gameName}` : gameName
  }, [screen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (guideOpen && !dialog.open) dialog.showModal()
    if (!guideOpen && dialog.open) dialog.close()
  }, [guideOpen])

  return (
    <>
      {screen === 'gm' ? <GameMasterScreen /> : screen === 'game' || (shared && screen === 'randomizer') ? <GameScreen /> : screen === 'randomizer' ? <RandomizerScreen onOpenGuide={() => setGuideOpen(true)} /> : (
      <main className="home home--landing home--welcome" aria-labelledby="game-title">
        <BackgroundDecoration variant="landing" />
        <CelestialBackdrop />
        <div className="home-content">
          <h1 id="game-title" className="game-title">
            <span className="game-title-main">{gameName}</span>
          </h1>
          <p className="welcome-description">Empat faction. Dua ruangan. Satu permainan.</p>

          <ul className="factions" aria-label="Empat faction">
            {factions.map((faction, index) => <FactionIdentity key={faction.id} faction={faction} index={index} />)}
          </ul>

          <div className="home-actions">
            <a className="button button-primary" href={shared?.online && !shared.canControl ? '#/gm' : '#/game'} onClick={event => {
              void unlockPhaseCueAudio()
              if (shared?.online && !shared.canControl) return
              if (shared) { event.preventDefault(); void shared.send({ type: 'begin' }) }
            }}>
              {shared?.online && !shared.canControl ? 'Masuk GM untuk mulai' : 'Mulai Permainan'} <span className="button-arrow" aria-hidden="true">→</span>
            </a>
            <a
              className="button button-tutorial"
              href={`${import.meta.env.BASE_URL}tutorial-demo/index.html?autoplay&v=voiceover-1310-sync-1`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Mainkan Video Tutorial, 5 menit 30 detik, buka di tab baru"
            >
              <span aria-hidden="true">▶</span>
              Mainkan Video Tutorial
            </a>
          </div>
          <a className="welcome-gm-access" href="#/gm">GM Access <span aria-hidden="true">↗</span></a>
          {shared && shared.connection !== 'connected' && <p className="shared-home-status" role="status">{shared.snapshot ? 'Koneksi terputus. Menyambungkan kembali…' : 'Menghubungkan kedua ruangan…'}</p>}
          {shared?.error && <p className="shared-home-status" role="status">{shared.error}</p>}
        </div>
      </main>
      )}

      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby="dialog-title"
        onClose={() => setGuideOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setGuideOpen(false)
        }}
      >
        <div className="dialog-card">
          <header className="dialog-header">
            <div>
              <p className="dialog-eyebrow">{gameName}</p>
              <h2 id="dialog-title">Panduan game</h2>
            </div>
            <button className="close-button" aria-label="Tutup" onClick={() => setGuideOpen(false)} autoFocus>
              <span aria-hidden="true">×</span>
            </button>
          </header>

          {guideOpen && <GameGuide />}
        </div>
      </dialog>
    </>
  )
}

export default function App() {
  return <SharedSessionProvider><AppContents /></SharedSessionProvider>
}
