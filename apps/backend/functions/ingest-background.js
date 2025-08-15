import { getStore } from "@netlify/blobs";
import { neon } from "@neondatabase/serverless";

// Simple chunker
function chunkText(text, size = 1200, overlap = 200) {
  const chunks = [];
  for (let i = 0; i < text.length; i += (size - overlap)) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

const sql = neon(process.env.NEON_DATABASE_URL);

export default async (req) => {
  try {
    const { blobKey, filename, tenantId } = await req.json();
    if (!blobKey || !filename || !tenantId) {
      return new Response(JSON.stringify({ error: "blobKey, filename, tenantId required" }), { status: 400 });
    }

    // 1) Read from Blobs
    const store = getStore({ name: "uploads" });
    const fileBuf = await store.get(blobKey, { type: "arrayBuffer" });
    if (!fileBuf) return new Response(JSON.stringify({ error: "blob not found" }), { status: 404 });

    // 2) Unstructured Partition API (auto strategy; accepts PDF/EPUB/DOCX/CSV)
    const fd = new FormData();
    fd.append("files", new Blob([new Uint8Array(fileBuf)], { type: "application/octet-stream" }), filename);
    fd.append("strategy", "auto");
    const ures = await fetch(process.env.UNSTRUCTURED_API_URL, {
      method: "POST",
      headers: {
        ...(process.env.UNSTRUCTURED_API_KEY ? { "unstructured-api-key": process.env.UNSTRUCTURED_API_KEY } : {})
      },
      body: fd
    });
    if (!ures.ok) return new Response(JSON.stringify({ error: `Unstructured ${ures.status}` }), { status: 502 });
    const elements = await ures.json();
    // Unstructured's Partition picks strategy automatically for common formats. :contentReference[oaicite:6]{index=6}

    // 3) Build chunks with metadata
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

    // 4) Voyage embeddings (REST)
    // POST https://api.voyageai.com/v1/embeddings with {input[], model}
    const embRes = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${process.env.VOYAGE_API_KEY}`
      },
      body: JSON.stringify({
        input: payloads.map(p => p.text),
        model: process.env.VOYAGE_EMBED_MODEL || "voyage-3.5",
        input_type: "document"
      })
    });
    if (!embRes.ok) return new Response(JSON.stringify({ error: `Voyage embeddings ${embRes.status}` }), { status: 502 });
    const embJson = await embRes.json();
    if (!Array.isArray(embJson.data) || embJson.data.length !== payloads.length) {
      return new Response(JSON.stringify({ error: "embedding mismatch" }), { status: 500 });
    }

    // 5) Upsert into Neon (pgvector). Cast to ::vector on SQL side.
    await sql`BEGIN`;
    try {
      for (let i = 0; i < payloads.length; i++) {
        await sql`
          INSERT INTO documents (tenant_id, source, page, section, chunk, embedding, meta)
          VALUES (${tenantId}, ${payloads[i].meta.source}, ${payloads[i].meta.page}, ${payloads[i].meta.section},
                  ${payloads[i].text}, ${embJson.data[i].embedding}::vector, ${payloads[i].meta});
        `;
      }
      await sql`COMMIT`;
    } catch (e) {
      await sql`ROLLBACK`; throw e;
    }

    return new Response(JSON.stringify({ ok: true, inserted: payloads.length, source: filename }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
