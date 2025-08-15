import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL);

// POST { tenantId, query, k?, topN? }
export default async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });
  const { tenantId, query, k = 24, topN = 6 } = await req.json() || {};
  if (!tenantId || !query) return new Response(JSON.stringify({ error: "tenantId and query required" }), { status: 400 });

  // 1) Embed query
  const embRes = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({
      input: query,
      model: process.env.VOYAGE_EMBED_MODEL || "voyage-3.5",
      input_type: "query"
    })
  });
  if (!embRes.ok) return new Response(JSON.stringify({ error: `Voyage embeddings ${embRes.status}` }), { status: 502 });
  const embJson = await embRes.json();
  const qvec = embJson.data[0].embedding;

  // 2) Vector search (cosine)
  const rows = await sql`
    SELECT id, source, page, section, chunk,
           1 - (embedding <=> ${qvec}::vector) AS score
    FROM documents
    WHERE tenant_id = ${tenantId}
    ORDER BY embedding <=> ${qvec}::vector
    LIMIT ${k};
  `;

  // 3) Rerank with Voyage
  const rrRes = await fetch("https://api.voyageai.com/v1/rerank", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": `Bearer ${process.env.VOYAGE_API_KEY}` },
    body: JSON.stringify({
      model: process.env.VOYAGE_RERANK_MODEL || "rerank-2.5",
      query,
      documents: rows.map(r => r.chunk),
      top_k: topN
    })
  });
  if (!rrRes.ok) return new Response(JSON.stringify({ error: `Voyage rerank ${rrRes.status}` }), { status: 502 });
  const rr = await rrRes.json();

  const ranked = rr.data.map(item => {
    const row = rows[item.index];
    return {
      score: item.relevance_score,
      source: row.source,
      page: row.page,
      section: row.section,
      passage: row.chunk
    };
  });

  return new Response(JSON.stringify({ ok: true, results: ranked }), {
    headers: { "content-type": "application/json" }
  });
};
