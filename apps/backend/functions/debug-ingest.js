import { getStore } from "@netlify/blobs"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.NEON_DATABASE_URL)
const DIM = parseInt(process.env.EMBED_DIM || "1024", 10)

const fetchWithTimeout = (url, opts={}, ms=8000) =>
  Promise.race([
    fetch(url, opts),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(`timeout after ${ms}ms`)), ms))
  ])

export default async (req) => {
  const started = Date.now()
  try {
    const { blobKey, filename = 'unknown', tenantId } = await req.json()
    const logs = []
    const push = (m) => logs.push(`[${new Date().toISOString()}] ${m}`)

    if (!blobKey || !tenantId) {
      return new Response(JSON.stringify({ ok:false, error:"blobKey and tenantId required" }), { status: 400 })
    }

    // 1) Blob exists?
    push(`checking blob ${blobKey}`)
    const store = getStore({ name: "uploads" })
    const meta = await store.getMetadata(blobKey)
    if (!meta) return new Response(JSON.stringify({ ok:false, step:"blob", error:"blob not found" }), { status:404 })
    push(`blob size=${meta.size}`)

    // 2) Neon reachable?
    try {
      await sql`select 1`
      push("neon ok")
    } catch (e) {
      push(`neon error: ${e.message}`)
      return new Response(JSON.stringify({ ok:false, step:"neon", error:String(e.message||e), logs }))
    }

    // 3) Minimal vector insert sanity (no external APIs)
    const vec = new Array(DIM).fill(0); vec[0]=1
    try {
      await sql`BEGIN`
      await sql`
        INSERT INTO documents (tenant_id, source, page, section, chunk, embedding, meta)
        VALUES (${tenantId}, ${filename}, ${1}, ${'debug'}, ${'hello'},
                ${vec}::vector, ${ { debug:true } })
      `
      await sql`ROLLBACK`
      push(`vector insert ok (dim=${DIM})`)
    } catch (e) {
      await sql`ROLLBACK`
      push(`vector insert error: ${e.message}`)
      return new Response(JSON.stringify({ ok:false, step:"vector", error:String(e.message||e), logs }))
    }

    // 4) Done — DO NOT call Llama/Voyage here; keep under 28s
    push(`success; elapsed=${Date.now()-started}ms`)
    return new Response(JSON.stringify({ ok:true, logs }), { headers:{ "content-type":"application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error:String(e?.message||e) }), { status:500 })
  }
}
