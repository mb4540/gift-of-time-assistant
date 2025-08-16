// Vector search + TEKS lookup using Neon + Voyage embeddings
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL);
const VOYAGE_KEY = process.env.VOYAGE_API_KEY;
const EMBED_MODEL = process.env.VOYAGE_EMBED_MODEL || "voyage-3.5";

async function embed(text) {
  const r = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${VOYAGE_KEY}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!r.ok) throw new Error(`Voyage embed failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.data[0].embedding; // number[]
}

export async function searchPassages({ tenantId, query, topK = Number(process.env.TOP_K) || 8 }) {
  const v = await embed(query);
  const vec = `[${v.join(",")}]`;
  const rows = await sql`
    SELECT id, source, page, section, chunk,
           1 - (embedding <=> ${vec}::vector) AS score
    FROM documents
    WHERE tenant_id = ${tenantId}
    ORDER BY embedding <-> ${vec}::vector
    LIMIT ${topK};
  `;
  return rows;
}

export async function loadTEKSByCodes({ tenantId, codes = [] }) {
  if (!codes.length) return [];
  const rows = await sql`
    SELECT code, strand, description, grade_level
    FROM teks_standards
    WHERE tenant_id = ${tenantId} AND code = ANY(${codes});
  `;
  return rows;
}
