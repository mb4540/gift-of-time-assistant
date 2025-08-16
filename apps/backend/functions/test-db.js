import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL);

export default async (req) => {
  try {
    // Simple test to check if documents exist
    const rows = await sql`
      SELECT COUNT(*) as count, tenant_id 
      FROM documents 
      GROUP BY tenant_id
      LIMIT 10;
    `;
    
    return new Response(JSON.stringify({ 
      ok: true, 
      document_counts: rows,
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
