import { neon } from "@neondatabase/serverless"

export default async () => {
  try {
    const sql = neon(process.env.NEON_DATABASE_URL)
    const a = await sql`select version()`
    const b = await sql`select current_user as user, current_database() as db`
    const c = await sql`select extname from pg_extension where extname='vector'`
    return new Response(JSON.stringify({
      ok: true,
      version: a?.[0]?.version,
      user: b?.[0]?.user,
      db: b?.[0]?.db,
      pgvector: !!c?.length
    }), { headers: { "content-type": "application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error: String(e?.message||e) }), { status: 500 })
  }
}
