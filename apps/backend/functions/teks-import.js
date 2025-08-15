import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL);

// Accepts multipart/form-data with file (CSV: grade_level,code,strand,description) and tenantId
export default async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });
  const form = await req.formData();
  const file = form.get("file");
  const tenantId = form.get("tenantId");
  if (!tenantId || !file) return new Response(JSON.stringify({ error: "tenantId and file required" }), { status: 400 });

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  // naive CSV split; use a CSV parser for production; expects header
  const [header, ...rows] = lines;
  const idx = header.split(",").map(h => h.trim().toLowerCase());
  const gi = {
    grade_level: idx.indexOf("grade_level"),
    code: idx.indexOf("code"),
    strand: idx.indexOf("strand"),
    description: idx.indexOf("description")
  };
  await sql`BEGIN`;
  try {
    for (const r of rows) {
      const cols = r.split(",").map(s => s.trim());
      if (cols.length < 4) continue;
      await sql`
        INSERT INTO teks_standards (tenant_id, grade_level, code, strand, description)
        VALUES (${tenantId}, ${parseInt(cols[gi.grade_level], 10)}, ${cols[gi.code]}, ${cols[gi.strand]}, ${cols[gi.description]});
      `;
    }
    await sql`COMMIT`;
  } catch (e) {
    await sql`ROLLBACK`; return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, inserted: rows.length }), { status: 200 });
};
