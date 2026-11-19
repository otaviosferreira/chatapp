import { createSupabaseContext } from "npm:@supabase/server@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const handler = {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const { data: ctx, error: authError } = await createSupabaseContext(req, { auth: "user" });
    if (authError) return json({ error: authError.message }, authError.status);
    const actorId = ctx.userClaims?.id;
    if (!actorId) return json({ error: "unauthorized" }, 401);

    const { data: profile, error: profileError } = await ctx.supabase
      .from("profiles").select("id,status").eq("id", actorId).maybeSingle();
    if (profileError || profile?.status !== "active") return json({ error: "forbidden" }, 403);
    const { data: role, error: roleError } = await ctx.supabase
      .from("profile_roles").select("roles!inner(code)").eq("profile_id", actorId)
      .eq("roles.code", "it_admin").maybeSingle();
    if (roleError || !role) return json({ error: "forbidden" }, 403);

    let payload: { email?: unknown; full_name?: unknown };
    try { payload = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const fullName = typeof payload.full_name === "string" ? payload.full_name.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2 || fullName.length > 120) {
      return json({ error: "invalid_input" }, 400);
    }

    const allowedDomains = (Deno.env.get("ALLOWED_EMAIL_DOMAINS") ?? "")
      .split(",").map((domain) => domain.trim().toLowerCase()).filter(Boolean);
    if (allowedDomains.length === 0) return json({ error: "domain_allowlist_not_configured" }, 503);
    const domain = email.split("@")[1];
    if (!allowedDomains.includes(domain)) return json({ error: "email_domain_not_allowed" }, 422);

    const appBaseUrl = Deno.env.get("APP_BASE_URL") ?? "https://chatapp-git-feat-foundatio-a9e755-otavioferreira-5984s-projects.vercel.app";
    const { data, error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo: new URL("/auth/complete?next=/update-password", appBaseUrl).toString(),
    });
    if (error || !data.user) return json({ error: "invite_failed" }, 400);

    const { error: auditError } = await ctx.supabase.rpc("admin_record_invitation", {
      _invited_profile_id: data.user.id,
      _email_domain: domain,
    });
    if (auditError) return json({ error: "audit_write_failed" }, 500);
    return json({ ok: true, profile_id: data.user.id });
  },
};

export default handler;
