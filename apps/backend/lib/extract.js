export async function extractDoc({ fileBytes, filename }) {
  const KEY = process.env.LLAMAPARSE_API_KEY || process.env.LLAMA_CLOUD_API_KEY;
  if (!KEY) {
    console.log("Missing LLAMA_CLOUD_API_KEY / LLAMAPARSE_API_KEY, using fallback");
    return extractTextFallback({ fileBytes, filename });
  }

  try {
    // 1) Upload and start the parsing job
    const form = new FormData();
    form.append("file", new Blob([fileBytes], { type: "application/pdf" }), filename);

    const up = await fetch("https://api.cloud.llamaindex.ai/api/v1/parsing/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}` },
      body: form,
    });
    if (!up.ok) throw new Error(`Upload failed: ${up.status} ${await up.text()}`);
    const { job_id } = await up.json();

    // 2) Poll until done
    for (let i = 0; i < 20; i++) { // Max 30 seconds
      await new Promise(r => setTimeout(r, 1500));
      const st = await fetch(`https://api.cloud.llamaindex.ai/api/v1/parsing/job/${job_id}`, {
        headers: { Authorization: `Bearer ${KEY}` },
      });
      const js = await st.json();
      if (js.status === "succeeded") break;
      if (js.status === "failed") throw new Error(`Parse failed: ${JSON.stringify(js)}`);
    }

    // 3) Fetch markdown results
    const out = await fetch(`https://api.cloud.llamaindex.ai/api/v1/parsing/job/${job_id}/result/markdown`, {
      headers: { Authorization: `Bearer ${KEY}` }
    });
    if (!out.ok) throw new Error(`Result fetch failed: ${out.status} ${await out.text()}`);
    
    const text = await out.text();
    return [{
      text: text.trim(),
      metadata: { page_number: 1, section: filename, title: filename, job_id }
    }];

  } catch (error) {
    console.log('LlamaParse failed, using fallback extraction:', error.message);
    return extractTextFallback({ fileBytes, filename });
  }
}

function extractTextFallback({ fileBytes, filename }) {
  // Simple fallback for text files
  const text = new TextDecoder().decode(new Uint8Array(fileBytes));
  return [{
    text: text.trim(),
    metadata: { page_number: 1, section: filename, title: filename }
  }];
}

