import { DEFAULT_ROUND_COUNT, GAME_PHASES } from './gamePhases'

export type Faction = {
  id: string
  name: string
  initials: string
  color: string
  boxColor: string
  boxBaseColor: string
  chineseName?: string
  logoSrc?: string
}

export const gameName = 'Pindahkan Aku Plsss!'

// Supplied faction artwork is shared by the Home and game screens.
export const factions: Faction[] = [
  { id: 'azure-dragon', name: 'Azure Dragon', chineseName: '青龍', initials: 'AD', color: '#88aaca', boxColor: '#3c80cb', boxBaseColor: '#101d2e', logoSrc: `${import.meta.env.BASE_URL}factions/azure-dragon.webp?v=phase-display-1` },
  { id: 'vermilion-bird', name: 'Vermilion Bird', chineseName: '朱雀', initials: 'VB', color: '#cf9186', boxColor: '#bd5360', boxBaseColor: '#251b22', logoSrc: `${import.meta.env.BASE_URL}factions/vermilion-bird.webp?v=phase-display-1` },
  { id: 'white-tiger', name: 'White Tiger', chineseName: '白虎', initials: 'WT', color: '#d6d2c9', boxColor: '#d5d7db', boxBaseColor: '#22272b', logoSrc: `${import.meta.env.BASE_URL}factions/white-tiger.webp?v=phase-display-1` },
  { id: 'black-tortoise', name: 'Black Tortoise', chineseName: '玄武', initials: 'BT', color: '#8aaf9b', boxColor: '#3f8767', boxBaseColor: '#111f19', logoSrc: `${import.meta.env.BASE_URL}factions/black-tortoise.webp?v=phase-display-1` },
]

export const preparationSteps = [
  { id: 'roles', label: 'Kartu role sudah dibagikan dan diverifikasi.', detail: 'Verifikasi mengikuti pengaturan panitia.' },
  { id: 'missions', label: 'Setiap faction sudah menerima daftar misi.' },
  { id: 'rooms', label: 'Anggota setiap faction sudah dibagi ke kedua ruangan.' },
  { id: 'leaders', label: 'Satu Leader per faction, per ruangan sudah dipilih.', detail: 'Leader tidak menerima kartu role dan tidak dapat dipindahkan.' },
  { id: 'briefing', label: 'Briefing aturan sudah selesai.', detail: 'Termasuk Terawang, pilihan Leader, dan Exchange serentak.' },
]

export const gameFlow = GAME_PHASES.filter(phase => (phase.round ?? 0) <= DEFAULT_ROUND_COUNT).map(phase => [
  phase.title,
  `Menit ${phase.startMs / 60_000}–${phase.endMs / 60_000}. Durasi ${phase.durationMs / 60_000} menit.`,
] as const)
