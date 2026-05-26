const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || text || `HTTP ${res.status}`);
  return data;
}

function normalizeTime(value: string) {
  return String(value || "").slice(0, 5);
}
function timeToMin(value: string) {
  const [h, m] = normalizeTime(value).split(":").map(Number);
  return h * 60 + (m || 0);
}
function minToTime(value: number) {
  return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
}
function addMinutes(value: string, minutes: number) {
  return minToTime(timeToMin(value) + Number(minutes || 0));
}
function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dateDay(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
function parsePeriods(settings: any) {
  const raw = String(settings?.working_periods || `${settings?.start_time || "08:00"}-${settings?.end_time || "20:00"}`);
  return raw.split(",").map((item) => item.trim()).filter(Boolean).map((item) => {
    const [start, end] = item.split("-").map((part) => part.trim());
    return { start, end };
  }).filter((p) => /^\d{2}:\d{2}$/.test(p.start) && /^\d{2}:\d{2}$/.test(p.end) && timeToMin(p.start) < timeToMin(p.end));
}
function periodMatches(start: string, period: string) {
  const p = String(period || "all").toLowerCase();
  const m = timeToMin(start);
  if (p === "manha") return m < 12 * 60;
  if (p === "tarde") return m >= 12 * 60 && m < 18 * 60;
  if (p === "noite") return m >= 18 * 60;
  return true;
}

async function context() {
  const rows = await rest("services?select=id,name,duration_minutes,appointment_mode,active&active=eq.true&order=name.asc");
  return { services: rows || [] };
}

function buildSlots(service: any, settings: any, appointments: any[], period: string) {
  const duration = Number(service.duration_minutes || 45);
  const step = Number(settings.slot_interval_minutes || 30);
  const max = Number(service.max_patients || settings.max_patients_per_slot || 4);
  const individual = String(service.appointment_mode || "grupo") === "individual";
  const workingDays = new Set(String(settings.working_days || "1,2,3,4,5,6").split(",").map((item) => item.trim()));
  const periods = parsePeriods(settings);
  const today = new Date();
  const slots: any[] = [];

  for (let offset = 0; offset < 21; offset++) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    const date = isoDate(day);
    if (!workingDays.has(String(dateDay(date)))) continue;
    const dayRows = appointments.filter((a) => String(a.appointment_date) === date && a.status !== "cancelado");
    for (const workPeriod of periods) {
      for (let minute = timeToMin(workPeriod.start); minute + duration <= timeToMin(workPeriod.end); minute += step) {
        const start = minToTime(minute);
        if (!periodMatches(start, period)) continue;
        const end = addMinutes(start, duration);
        if (new Date(`${date}T${start}:00`).getTime() <= Date.now()) continue;
        const overlaps = dayRows.filter((a) => timeToMin(normalizeTime(a.start_time)) < timeToMin(end) && timeToMin(normalizeTime(a.end_time)) > timeToMin(start));
        const hasIndividual = overlaps.some((a) => String(a.services?.appointment_mode || "grupo") === "individual");
        if (individual && overlaps.length) continue;
        if (!individual && (hasIndividual || overlaps.length >= max)) continue;
        const occupied = overlaps.length;
        const optimized = !individual && occupied > 0;
        slots.push({
          appointment_date: date,
          start_time: start,
          end_time: end,
          duration_minutes: duration,
          reason: optimized ? "optimized" : "open",
          rank: individual ? 50 : (optimized ? 100 + occupied * 10 : 10),
        });
      }
    }
  }

  return slots.sort((a, b) => b.rank - a.rank || a.appointment_date.localeCompare(b.appointment_date) || a.start_time.localeCompare(b.start_time)).slice(0, 12);
}

async function suggest(body: any) {
  const [serviceRows, settingsRows] = await Promise.all([
    rest(`services?select=*&id=eq.${encodeURIComponent(body.service_id || "")}&active=eq.true&limit=1`),
    rest("schedule_settings?select=*&limit=1"),
  ]);
  const service = serviceRows?.[0];
  if (!service) throw new Error("Servico indisponivel.");
  const today = isoDate(new Date());
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 21);
  const appointments = await rest(`appointments?select=*,services(appointment_mode)&appointment_date=gte.${today}&appointment_date=lte.${isoDate(horizon)}&order=appointment_date.asc,start_time.asc`);
  return { slots: buildSlots(service, settingsRows?.[0] || {}, appointments || [], body.period || "all") };
}

async function requestAppointment(body: any) {
  const patientName = String(body.patient_name || "").trim();
  const patientWhatsapp = String(body.patient_whatsapp || "").trim();
  if (!patientName) throw new Error("Informe o nome do paciente.");
  if (patientWhatsapp.replace(/\D/g, "").length < 10) throw new Error("Informe um WhatsApp valido.");
  if (!body.slot?.appointment_date || !body.slot?.start_time || !body.slot?.end_time) throw new Error("Horario invalido.");

  const serviceRows = await rest(`services?select=*&id=eq.${encodeURIComponent(body.service_id || "")}&active=eq.true&limit=1`);
  const service = serviceRows?.[0];
  if (!service) throw new Error("Servico indisponivel.");

  const payload = {
    patient_name: patientName,
    patient_whatsapp: patientWhatsapp,
    service_id: service.id,
    appointment_date: body.slot.appointment_date,
    start_time: normalizeTime(body.slot.start_time),
    end_time: normalizeTime(body.slot.end_time),
    duration_minutes: Number(body.slot.duration_minutes || service.duration_minutes || 45),
    preferred_period: String(body.preferred_period || "all"),
    origin: "public_scheduler",
    status: "pendente",
  };
  const inserted = await rest("appointment_requests", { method: "POST", body: JSON.stringify(payload) });
  return { request: inserted?.[0] || null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Function sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.");
    const body = await req.json();
    if (body.action === "context") return json(await context());
    if (body.action === "suggest") return json(await suggest(body));
    if (body.action === "request") return json(await requestAppointment(body));
    throw new Error("Acao invalida.");
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro no agendamento." }, 400);
  }
});
