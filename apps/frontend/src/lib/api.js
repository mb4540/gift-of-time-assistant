const base = import.meta.env.VITE_API_BASE || '/'

// RAG query
export async function askRag({ tenantId, query, k = 24, topN = 6 }) {
  const r = await fetch(`${base}.netlify/functions/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenantId, query, k, topN })
  })
  if (!r.ok) throw new Error(`query failed: ${r.status}`)
  return r.json()
}

// Upload a file for ingestion
export async function uploadFile({ tenantId, file }) {
  const fd = new FormData()
  fd.append('tenantId', tenantId)
  fd.append('file', file)
  const r = await fetch(`${base}.netlify/functions/upload`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(`upload failed: ${r.status}`)
  return r.json()
}

// Import TEKS CSV
export async function importTeks({ tenantId, file }) {
  const fd = new FormData()
  fd.append('tenantId', tenantId)
  fd.append('file', file)
  const r = await fetch(`${base}.netlify/functions/teks-import`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(`teks import failed: ${r.status}`)
  return r.json()
}
