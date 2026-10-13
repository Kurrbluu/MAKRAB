export function supabaseProjectUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Alamat project Supabase tidak valid.')
  // The SDK adds rest/v1 and realtime/v1 itself. Match the server's root-based URLs,
  // including when setup accidentally contains a copied REST endpoint.
  return url.origin
}
