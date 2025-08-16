import { getStore } from "@netlify/blobs";
import { searchPassages, loadTEKSByCodes } from "../lib/retrieval.js";
import { chatJSON } from "../lib/llm.js";
import { systemMsg, gradingUserMsg, gradingSchema } from "../prompt/teksPrompts.js";
import { extractDoc } from "../lib/extract.js";

export default async (req) => {
  try {
    const payload = await req.json();
    const { tenantId, gradeLevel, teksCodes = [], rubric, submissionText, submissionBlobKey, submissionFilename } = payload || {};
    if (!tenantId || !gradeLevel || !Array.isArray(rubric) || rubric.length === 0) {
      return new Response(JSON.stringify({ error: "tenantId, gradeLevel, rubric[] required" }), { status: 400 });
    }
    if (!submissionText && !(submissionBlobKey && submissionFilename)) {
      return new Response(JSON.stringify({ error: "Provide submissionText or submissionBlobKey+submissionFilename" }), { status: 400 });
    }

    // 1) ensure submission text
    let submission = submissionText || "";
    if (!submission && submissionBlobKey) {
      const uploads = getStore({ name: "uploads" });
      const fileBuf = await uploads.get(submissionBlobKey, { type: "arrayBuffer" });
      if (!fileBuf) return new Response(JSON.stringify({ error: "submission blob not found" }), { status: 404 });

      // LlamaParse → normalized elements → join
      const elements = await extractDoc({ fileBytes: fileBuf, filename: submissionFilename });
      submission = elements.map(el => el.text).join("\n").trim();
    }
    if (!submission) return new Response(JSON.stringify({ error: "No submission text extracted" }), { status: 400 });

    // 2) load TEKS if provided
    const teks = teksCodes.length ? await loadTEKSByCodes({ tenantId, codes: teksCodes }) : [];

    // 3) retrieval query
    const rubricQuery = rubric.map(r => `${r.criterion} ${r.description}`).join(" ");
    const teksQuery = teks.map(t => `${t.code} ${t.strand}`).join(" ");
    const composedQuery = `${rubricQuery} ${teksQuery}`.trim() || "reading comprehension evidence textual analysis";
    const { context } = await searchPassages({ tenantId, query: composedQuery });

    // 4) LLM (JSON schema)
    const system = systemMsg();
    const user = gradingUserMsg({
      gradeLevel,
      teks,
      rubric,
      submissionText: submission.slice(0, 5000),
      context
    });
    const result = await chatJSON({ system, user, jsonSchema: gradingSchema });

    // 5) store output
    const outputs = getStore({ name: "outputs", consistency: "strong" });
    const key = `outputs/${tenantId}/grading-${crypto.randomUUID()}.json`;
    await outputs.set(key, JSON.stringify({
      input: { tenantId, gradeLevel, teksCodes, rubric, submissionInfo: submissionText ? "inline" : submissionFilename },
      result
    }, null, 2), { contentType: "application/json" });

    return new Response(JSON.stringify({ ok: true, blobKey: key }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
