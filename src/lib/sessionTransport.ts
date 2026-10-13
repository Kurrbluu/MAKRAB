import type { SharedGame } from './sharedGame'

export type SessionMetadata = { transport: 'sse'; online: false; authRequired: false }
  | { transport: 'supabase'; online: true; authRequired: true; url: string; publishableKey: string; sessionKey: string }

export async function readSessionMetadata(): Promise<SessionMetadata> {
  const response = await fetch('/api/meta', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
  // An already-running local host from the previous version can keep using SSE.
  if (response.status === 404) return { transport: 'sse', online: false, authRequired: false }
  if (!response.ok) throw new Error('Pengaturan sesi belum tersedia.')
  const metadata = await response.json()
  if (metadata.transport === 'sse') return { transport: 'sse', online: false, authRequired: false }
  if (metadata.transport !== 'supabase' || metadata.online !== true || metadata.authRequired !== true
    || typeof metadata.url !== 'string' || typeof metadata.publishableKey !== 'string'
    || typeof metadata.sessionKey !== 'string') throw new Error('Pengaturan sesi tidak valid.')
  return metadata
}

export async function subscribeCloud(metadata: Extract<SessionMetadata, { transport: 'supabase' }>,
  onState: (state: SharedGame) => void, onStatus: (ready: boolean) => void) {
  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient(metadata.url, metadata.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } },
  })
  const channel = client.channel(`makrab:${metadata.sessionKey}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'makrab_public_sessions', filter: `session_key=eq.${metadata.sessionKey}` },
      payload => { if ('state' in payload.new) onState(payload.new.state as SharedGame) })
    .subscribe(status => onStatus(status === 'SUBSCRIBED'))
  return () => { void client.removeChannel(channel) }
}
