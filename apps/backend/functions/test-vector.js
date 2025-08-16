import { neon } from "@neondatabase/serverless"

const DIM = parseInt(process.env.EMBED_DIM || "1024", 10)

function unitVector(n=DIM) {
  const v = new Array(n).fill(0)
  v[0] = 1
  return v
}

export default async (req) => {
  try {
    const sql = neon(process.env.NEON_DATABASE_URL)
    const tenantId = "test-tenant-final-fix" // use existing tenant
    const source = "vector_smoke_test"
    const vec = unitVector()

    await sql`BEGIN`
    try {
      const r = await sql`
        INSERT INTO documents (tenant_id, source, page, section, chunk, embedding, meta)
        VALUES (${tenantId}, ${source}, ${1}, ${'smoke'}, ${'hello world'},
                ${JSON.stringify(vec)}, ${ { smoke:true } })
        RETURNING id;
      `
      await sql`ROLLBACK`  // change to COMMIT if you want it to persist
      return new Response(JSON.stringify({ ok: true, inserted_id: r?.[0]?.id, dim: vec.length }))
    } catch (e) {
      await sql`ROLLBACK`
      throw e
    }
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error: String(e?.message||e) }), { status: 500 })
  }
}
