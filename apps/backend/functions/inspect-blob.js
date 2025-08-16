import { getStore } from "@netlify/blobs"

export default async (req) => {
  const url = new URL(req.url)
  const blobKey = url.searchParams.get("blobKey")
  if (!blobKey) return new Response(JSON.stringify({ error:"blobKey required"}), { status:400 })

  try {
    const store = getStore({ name: "uploads" })
    const head = await store.getMetadata(blobKey)
    const len = head?.size
    const slice = await store.get(blobKey, { type: "text", range: { bytes: [0, Math.min(200, (len||1)-1)] } })
    return new Response(JSON.stringify({ ok:true, size: len, head, preview: slice }), { headers: { "content-type":"application/json" } })
  } catch (e) {
    return new Response(JSON.stringify({ ok:false, error:String(e?.message||e) }), { status: 500 })
  }
}
