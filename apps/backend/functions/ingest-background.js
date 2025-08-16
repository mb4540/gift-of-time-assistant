import { getStore } from "@netlify/blobs";
import { neon } from "@neondatabase/serverless";
import { extractDoc } from "../lib/extract.js";

const VOYAGE_MODEL = process.env.VOYAGE_EMBED_MODEL || "voyage-3.5";
const EMBED_DIM = parseInt(process.env.EMBED_DIM || "1024", 10);
const sql = neon(process.env.NEON_DATABASE_URL);

function chunkText(text, size = 1200, overlap = 200) {
  const chunks = [];
  for (let i = 0; i < text.length; i += (size - overlap)) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export default async (req) => {
  try {
    const { blobKey, filename, tenantId } = await req.json();
    if (!blobKey || !filename || !tenantId) {
      return new Response(JSON.stringify({ error: "blobKey, filename, tenantId required" }), { status: 400 });
    }

    // 1) read bytes from Blobs
    const store = getStore({ name: "uploads" });
    const fileBuf = await store.get(blobKey, { type: "arrayBuffer" });
    if (!fileBuf) return new Response(JSON.stringify({ error: "blob not found" }), { status: 404 });

    // 2) LlamaParse → normalized elements
    const elements = await extractDoc({ fileBytes: fileBuf, filename });

    // 3) make chunks with metadata
    const payloads = [];
    for (const el of elements) {
      const text = (el.text || "").trim();
      if (!text) continue;
      const page = el?.metadata?.page_number ?? null;
      const section = el?.metadata?.section ?? el?.metadata?.title ?? null;
      for (const c of chunkText(text)) {
        payloads.push({ text: c, meta: { source: filename, page, section } });
      }
    }
    if (payloads.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0, note: "no text" }), { status: 200 });
    }

    // 4) embeddings (Voyage REST API)
    const inputs = payloads.map(p => p.text);
    const embRes = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": `Bearer ${process.env.VOYAGE_API_KEY}` },
      body: JSON.stringify({
        input: inputs,
        model: VOYAGE_MODEL,
        input_type: "document"
      })
    });
    if (!embRes.ok) {
      return new Response(JSON.stringify({ error: `Voyage embeddings ${embRes.status}` }), { status: 502 });
    }
    const emb = await embRes.json();
    if (!emb.data || emb.data.length !== inputs.length) {
      return new Response(JSON.stringify({ error: "embedding mismatch" }), { status: 500 });
    }

    // 5) upsert to Neon (pgvector)
    await sql`BEGIN`;
    try {
      for (let i = 0; i < inputs.length; i++) {
        await sql`
          INSERT INTO documents (tenant_id, source, page, section, chunk, embedding, meta)
          VALUES (${tenantId}, ${payloads[i].meta.source}, ${payloads[i].meta.page}, ${payloads[i].meta.section},
                  ${payloads[i].text}, ${emb.data[i].embedding}::vector, ${payloads[i].meta});
        `;
      }
      await sql`COMMIT`;
    } catch (e) {
      await sql`ROLLBACK`; throw e;
    }

    return new Response(JSON.stringify({ ok: true, inserted: inputs.length, source: filename }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
