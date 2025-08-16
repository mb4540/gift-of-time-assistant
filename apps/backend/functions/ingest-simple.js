import { getStore } from "@netlify/blobs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL);

export default async (req) => {
  try {
    const { blobKey, filename, tenantId } = await req.json();
    if (!blobKey || !filename || !tenantId) {
      return new Response(JSON.stringify({ error: "blobKey, filename, tenantId required" }), { 
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    // 1) Read file from Blobs
    const store = getStore({ name: "uploads", consistency: "strong" });
    const blob = await store.get(blobKey);
    if (!blob) {
      return new Response(JSON.stringify({ error: "File not found in blobs" }), { 
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }

    // 2) Simple text extraction (no LlamaParse)
    const fileBytes = await blob.arrayBuffer();
    const text = new TextDecoder().decode(new Uint8Array(fileBytes));
    
    // 3) Simple embedding (mock for now)
    const mockEmbedding = new Array(1024).fill(0).map(() => Math.random() - 0.5);

    // 4) Store in database
    await sql`
      INSERT INTO documents (tenant_id, source, page, section, chunk, embedding, meta)
      VALUES (${tenantId}, ${filename}, 1, ${filename}, ${text.trim()}, ${JSON.stringify(mockEmbedding)}, ${JSON.stringify({ source: filename })})
    `;

    return new Response(JSON.stringify({ 
      ok: true, 
      inserted: 1,
      message: "Simple ingestion completed",
      timestamp: new Date().toISOString()
    }), {
      headers: { "content-type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};
