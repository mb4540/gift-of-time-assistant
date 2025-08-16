import { neon } from "@neondatabase/serverless"

export default async () => {
  const env = {
    NEON_DATABASE_URL: !!process.env.NEON_DATABASE_URL,
    LLAMA_CLOUD_API_KEY: !!process.env.LLAMA_CLOUD_API_KEY,
    VOYAGE_API_KEY: !!process.env.VOYAGE_API_KEY
  }

  let neon_ok = false, now = null
  try {
    const sql = neon(process.env.NEON_DATABASE_URL)
    const r = await sql`select now() as now`
    neon_ok = true
    now = r?.[0]?.now
  } catch (e) {}

  return new Response(JSON.stringify({
    runtime: 'netlify-functions',
    env, neon_ok, now
  }), { headers: { "content-type": "application/json" } })
}
