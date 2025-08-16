import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.NEON_DATABASE_URL);

export default async (req) => {
  try {
    // Check documents table schema
    const schema = await sql`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'documents' 
      ORDER BY ordinal_position;
    `;

    // Check if pgvector extension is enabled
    const extensions = await sql`
      SELECT extname FROM pg_extension WHERE extname = 'vector';
    `;

    return new Response(JSON.stringify({ 
      ok: true,
      schema,
      extensions,
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
