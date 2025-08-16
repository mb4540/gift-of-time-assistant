// Minimal upload test function
export default async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), { 
        status: 405,
        headers: { "content-type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      message: "Upload test working",
      timestamp: new Date().toISOString()
    }), {
      status: 200,
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
