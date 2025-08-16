import { getStore } from "@netlify/blobs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL);

export default async (req) => {
  const logs = [];
  
  try {
    const { blobKey, filename, tenantId } = JSON.parse(await req.text());
    logs.push(`Starting ingestion: ${filename} for tenant ${tenantId}`);

    // 1) Get file from blobs
    logs.push("Step 1: Getting file from blobs");
    const store = getStore({ name: "uploads", consistency: "strong" });
    const blob = await store.get(blobKey);
    if (!blob) {
      logs.push("ERROR: File not found in blobs");
      return new Response(JSON.stringify({ error: "File not found", logs }), { 
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }
    logs.push("✓ File retrieved from blobs");

    // 2) Extract text
    logs.push("Step 2: Extracting text");
    const fileBytes = await blob.bytes();
    const text = new TextDecoder().decode(fileBytes);
    logs.push(`✓ Text extracted, length: ${text.length}`);
    
    if (!text.trim()) {
      logs.push("ERROR: No text content found");
      return new Response(JSON.stringify({ error: "No text content", logs }), { 
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    // 3) Generate embeddings
    logs.push("Step 3: Generating embeddings via Voyage API");
    const embRes = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.VOYAGE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: [text.trim()],
        model: process.env.VOYAGE_EMBED_MODEL || "voyage-3.5"
      })
    });

    if (!embRes.ok) {
      const errorText = await embRes.text();
      logs.push(`ERROR: Voyage API failed: ${embRes.status} ${errorText}`);
      return new Response(JSON.stringify({ error: "Embedding failed", logs, voyageError: errorText }), { 
        status: 500,
        headers: { "content-type": "application/json" }
      });
    }

    const embJson = await embRes.json();
    const embedding = embJson.data[0].embedding;
    logs.push(`✓ Embedding generated, dimensions: ${embedding.length}`);

    // 4) Store in database
    logs.push("Step 4: Storing in database");
    const result = await sql`
      INSERT INTO documents (tenant_id, source, page, section, chunk, embedding, meta)
      VALUES (${tenantId}, ${filename}, 1, ${filename}, ${text.trim()}, ${embedding}, ${JSON.stringify({ source: filename })})
      RETURNING id
    `;
    logs.push(`✓ Document stored with ID: ${result[0].id}`);

    return new Response(JSON.stringify({ 
      ok: true, 
      inserted: 1,
      documentId: result[0].id,
      logs,
      timestamp: new Date().toISOString()
    }), {
      headers: { "content-type": "application/json" }
    });

  } catch (error) {
    logs.push(`FATAL ERROR: ${error.message}`);
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack,
      logs,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};
