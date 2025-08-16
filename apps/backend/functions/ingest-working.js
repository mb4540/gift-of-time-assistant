import { getStore } from "@netlify/blobs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL);

export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), { 
        status: 405,
        headers: { "content-type": "application/json" }
      });
    }

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

    // 2) Extract text
    const fileBytes = await blob.bytes();
    const text = new TextDecoder().decode(fileBytes);
    
    if (!text.trim()) {
      return new Response(JSON.stringify({ error: "No text content found" }), { 
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    // 3) Generate embeddings via Voyage API
    const embRes = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { 
        "content-type": "application/json", 
        "authorization": `Bearer ${process.env.VOYAGE_API_KEY}` 
      },
      body: JSON.stringify({
        input: text.trim(),
        model: process.env.VOYAGE_EMBED_MODEL || "voyage-3.5",
        input_type: "document"
      })
    });

    if (!embRes.ok) {
      return new Response(JSON.stringify({ error: `Voyage embeddings failed: ${embRes.status}` }), { 
        status: 502,
        headers: { "content-type": "application/json" }
      });
    }

    const embJson = await embRes.json();
    const embedding = embJson.data[0].embedding;

    // 4) Store in database
    await sql`
      INSERT INTO documents (tenant_id, source, page, section, chunk, embedding, meta)
      VALUES (${tenantId}, ${filename}, 1, ${filename}, ${text.trim()}, ${JSON.stringify(embedding)}, ${JSON.stringify({ source: filename })})
    `;

    return new Response(JSON.stringify({ 
      ok: true, 
      inserted: 1,
      message: "Document ingested successfully",
      textLength: text.length,
      timestamp: new Date().toISOString()
    }), {
      headers: { "content-type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};
