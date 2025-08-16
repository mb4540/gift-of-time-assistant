export async function extractDoc({ fileBytes, filename }) {
  // LlamaParse (LlamaIndex Cloud) — standard parsing
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(fileBytes)], { type: 'application/octet-stream' }), filename);

  // Standard parsing endpoint (layout-aware). You can add params via query if needed.
  const res = await fetch('https://api.cloud.llamaindex.ai/api/parsing/standard', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.LLAMAPARSE_API_KEY}` },
    body: fd
  });
  if (!res.ok) throw new Error(`llamaparse ${res.status}`);
  const json = await res.json();
  return normalizeLlamaParse(json);
}

function normalizeLlamaParse(json) {
  // Normalize into: [{ text, metadata:{ page_number, section, title } }, ...]
  const out = [];
  const pages = json?.pages || [];
  for (const p of pages) {
    const pageNum = p.page ?? p.page_num ?? null;
    let currentSection = null;
    for (const b of (p.blocks || [])) {
      if (b.type === 'heading' && b.text) currentSection = b.text;
      if (b.text && b.text.trim()) {
        out.push({
          text: b.text.trim(),
          metadata: { page_number: pageNum, section: currentSection, title: currentSection }
        });
      }
    }
  }
  return out;
}
