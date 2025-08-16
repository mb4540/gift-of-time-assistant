import { neon } from "@neondatabase/serverless"

export default async () => {
  try {
    const sql = neon(process.env.NEON_DATABASE_URL)
    
    // Check foreign key constraints on documents table
    const constraints = await sql`
      SELECT 
        conname as constraint_name,
        conrelid::regclass as table_name,
        confrelid::regclass as referenced_table,
        a.attname as column_name,
        af.attname as referenced_column
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
      JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY(c.confkey)
      WHERE c.contype = 'f' AND conrelid::regclass::text = 'documents'
    `
    
    // Check if tenants table exists
    const tenants = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tenants'
      ) as tenants_exists
    `
    
    // Check existing tenant_ids in documents
    const existingTenants = await sql`
      SELECT DISTINCT tenant_id FROM documents LIMIT 5
    `
    
    return new Response(JSON.stringify({
      ok: true,
      constraints,
      tenants_table_exists: tenants[0].tenants_exists,
      existing_tenant_ids: existingTenants.map(t => t.tenant_id)
    }), { headers: { "content-type": "application/json" } })
    
  } catch (e) {
    return new Response(JSON.stringify({ 
      ok: false, 
      error: String(e?.message || e) 
    }), { status: 500 })
  }
}
