import type { SharedGame } from './sharedGame'

export type SessionMetadata = { transport: 'sse'; online: false; authRequired: false }
  | { transport: 'supabase'; online: true; authRequired: true; url: string; publishableKey: string; sessionKey: string }

export async function readSessionMetadata(): Promise<SessionMetadata> {
  const response = await fetch('/api/meta', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
  // An already-running local host from the previous version can keep using SSE.
  if (response.status === 404) return { transport: 'sse', online: false, authRequired: false }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(typeof body?.error === 'string' ? body.error : 'Pengaturan sesi belum tersedia.')
  }
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
  const channel = client.channel(`makrab:${metadata.sessionKey}`, {
    config: { postgres_changes_options: { wait: true } },
  })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'makrab_public_sessions', filter: `session_key=eq.${metadata.sessionKey}` },
      payload => { if ('state' in payload.new) onState(payload.new.state as SharedGame) })
    .subscribe(status => onStatus(status === 'SUBSCRIBED'))
  return () => {
    // Close the owned socket immediately, including a join still waiting for database readiness.
    client.realtime.disconnect()
    void client.removeChannel(channel)
  }
}
