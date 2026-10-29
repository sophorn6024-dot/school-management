// Supabase Edge Function: chat-push
// ផ្ញើ Web Push ទៅឧបករណ៍គ្រូ/Admin ពេលមានសារថ្មីក្នុង chat_messages
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

const clean = (g: string) => String(g || "").replace(/^ថ្នាក់ទី\s*/, "").trim();

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("PUSH_WEBHOOK_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const m = body.record || body;
  if (!m || !m.room_id) return new Response("no record", { status: 400 });

  const isClass = String(m.room_id).startsWith("class_");
  const cls = isClass ? clean(String(m.room_id).slice(6)) : "";

  const { data: subs, error } = await sb.from("push_subscriptions").select("*");
  if (error) return new Response(error.message, { status: 500 });

  const sender = String(m.sender_code || "").toLowerCase();
  const targets = (subs || []).filter((s) => {
    if (String(s.user_code || "").toLowerCase() === sender) return false;      // មិនផ្ញើទៅអ្នកផ្ញើ
    if (!isClass) return true;                                                  // បន្ទប់ក្រុមធំ → ទាំងអស់
    if (String(s.role || "").toLowerCase() === "admin") return true;            // Admin ឃើញគ្រប់ថ្នាក់
    return String(s.classes || "").split(/[,;،]+/).map(clean).includes(cls);   // គ្រូថ្នាក់នោះ
  });

  const snippet = m.type === "image" ? "🖼️ រូបភាព" : m.type === "audio" ? "🎙️ សំឡេង" : m.type === "video" ? "🎬 វីដេអូ"
    : String(m.content || m.caption || "").replace(/\s+/g, " ").slice(0, 120);
  const payload = JSON.stringify({
    title: isClass ? `សិស្ស · ថ្នាក់ទី${cls}` : "ជជែកគ្រូ",
    body: `${m.sender_name ? String(m.sender_name).trim() + "៖ " : ""}${snippet}`,
    tag: String(m.room_id),
    url: "./#chat",
  });

  const dead: string[] = [];
  await Promise.all(targets.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.endpoint);                 // ឧបករណ៍លែងមាន → លុប
    }
  }));
  if (dead.length) await sb.from("push_subscriptions").delete().in("endpoint", dead);

  return new Response(JSON.stringify({ sent: targets.length - dead.length, removed: dead.length }), { headers: { "Content-Type": "application/json" } });
});
