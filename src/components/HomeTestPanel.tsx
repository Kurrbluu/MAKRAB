// Temporary development shortcut; remove this component when the main game flow is ready.
export default function HomeTestPanel() {
  return (
    <aside className="home-test-panel" aria-label="Panel uji sementara">
      <div>
        <span className="home-test-label">PANEL UJI</span>
        <strong>Randomizer</strong>
      </div>
      <a href="#/randomizer" className="home-test-link" aria-label="Buka layar Randomizer">
        Buka layar <span aria-hidden="true">↗</span>
      </a>
    </aside>
  )
}
