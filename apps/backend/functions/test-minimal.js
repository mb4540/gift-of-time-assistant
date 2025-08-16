export default async (req) => {
  return new Response(JSON.stringify({ 
    ok: true, 
    message: "Minimal function working",
    method: req.method,
    timestamp: new Date().toISOString()
  }), {
    headers: { "content-type": "application/json" }
  });
};
