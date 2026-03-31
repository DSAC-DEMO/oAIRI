// Simple authentication check
export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await request.json();

    // Get admin password from environment variable
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'admin123'; // Default for local dev

    if (password === ADMIN_PASSWORD) {
      // Generate a simple session token (in production, use proper JWT)
      const token = btoa(`admin:${Date.now()}`);

      return new Response(
        JSON.stringify({ success: true, token }),
        { status: 200, headers: corsHeaders }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid password' }),
        { status: 401, headers: corsHeaders }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: 'Authentication failed' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
