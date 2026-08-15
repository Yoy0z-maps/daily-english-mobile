import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = {
  'Content-Type': 'application/json; charset=utf-8'
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Supabase service configuration is missing' }), {
      status: 500,
      headers
    });
  }

  if (!authorization?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Authentication is required' }), {
      status: 401,
      headers
    });
  }

  const accessToken = authorization.slice('Bearer '.length);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error: userError } = await admin.auth.getUser(accessToken);

  if (userError || !data.user) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers
    });
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);

  if (deleteError) {
    console.error('Account deletion failed', deleteError);
    return new Response(JSON.stringify({ error: 'Account deletion failed' }), {
      status: 500,
      headers
    });
  }

  return new Response(JSON.stringify({ deleted: true }), { status: 200, headers });
});
