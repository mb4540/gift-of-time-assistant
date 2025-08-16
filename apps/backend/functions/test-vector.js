import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL);

export default async (req) => {
  try {
    // Test simple vector insertion
    const testVector = Array(1024).fill(0.1); // Simple test vector
    
    await sql`
      INSERT INTO documents (tenant_id, source, page, section, chunk, embedding, meta)
      VALUES ('test-vector', 'test.txt', 1, 'test', 'test content', ${testVector}, '{"test": true}')
    `;

    // Count documents
    const count = await sql`SELECT COUNT(*) as count FROM documents WHERE tenant_id = 'test-vector'`;

    return new Response(JSON.stringify({ 
      ok: true,
      message: "Vector insertion successful",
      count: count[0].count,
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
