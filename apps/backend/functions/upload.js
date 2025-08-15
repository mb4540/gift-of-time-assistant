import { getStore } from "@netlify/blobs";

// Accepts multipart/form-data { file, tenantId }
export default async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });

  // Netlify Functions support standard web APIs, including formData()
  const form = await req.formData();
  const file = form.get("file");
  const tenantId = form.get("tenantId");
  if (!tenantId) return new Response(JSON.stringify({ error: "tenantId required" }), { status: 400 });
  if (!file) return new Response(JSON.stringify({ error: "file required" }), { status: 400 });

  // Store file in Netlify Blobs
  const key = `uploads/${tenantId}/${crypto.randomUUID()}-${file.name}`;
  const store = getStore({ name: "uploads", consistency: "strong" });
  await store.set(key, file); // accepts Blob/File/ArrayBuffer

  // Fire-and-forget background ingestion (send only metadata)
  const base = process.env.PUBLIC_BASE_URL || "http://localhost:8888";
  await fetch(new URL("/.netlify/functions/ingest-background", base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blobKey: key, filename: file.name, tenantId })
  });

  return new Response(JSON.stringify({ ok: true, blobKey: key }), {
    status: 202, headers: { "content-type": "application/json" }
  });
};
