import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const adminEmail = Deno.env.get("ECOSYSTEM_ADMIN_EMAIL") ?? "tanmay@greenruraleconomy.in";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? adminEmail;
let supabaseClient: ReturnType<typeof createClient> | null = null;

const ENTITY_TABLES: Record<string, string> = {
  mentor: "mentor_entities",
  community_steward: "community_steward_entities",
  volunteer: "volunteer_entities",
  intern: "intern_entities",
  incubation_centre: "incubation_centre_entities",
  accelerator: "accelerator_entities",
  institute: "institute_entities",
  trader_association: "trader_association_entities",
  cso: "cso_entities",
};

const EDITABLE_FIELDS = [
  "entity_type_slug",
  "entity_name",
  "summary",
  "description",
  "location_label",
  "primary_address",
  "district",
  "state",
  "country",
  "contact_email",
  "contact_phone",
  "website_url",
  "social_media",
  "office_locations",
  "tags",
  "keywords",
  "latitude",
  "longitude",
  "source_label",
  "source_url",
  "type_specific_data",
  "admin_notes",
] as const;

type EntityInput = Record<string, unknown>;

function getSupabaseAdmin() {
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Function secrets are not configured.");
  if (supabaseClient) return supabaseClient;
  supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  return supabaseClient;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

function requireString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "-");
}

function toNullableNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function toTextArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => requireString(item)).filter(Boolean);
  return [];
}

function toJsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toJsonArray(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function flattenTypeSpecificValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => flattenTypeSpecificValues(item));
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap((item) => flattenTypeSpecificValues(item));
  return value ? [String(value)] : [];
}

function buildSearchText(input: Record<string, unknown>) {
  return [
    requireString(input.entity_name),
    requireString(input.summary),
    requireString(input.description),
    requireString(input.location_label),
    requireString(input.primary_address),
    requireString(input.district),
    requireString(input.state),
    requireString(input.country),
    requireString(input.contact_email),
    requireString(input.contact_phone),
    requireString(input.website_url),
    toTextArray(input.tags).join(" "),
    toTextArray(input.keywords).join(" "),
    flattenTypeSpecificValues(input.type_specific_data).join(" "),
  ].filter(Boolean).join(" ");
}

function getEntityTable(typeSlug: string) {
  const table = ENTITY_TABLES[typeSlug];
  if (!table) throw new Error("Unknown entity type.");
  return table;
}

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validateSession(token: string) {
  const supabase = getSupabaseAdmin();
  const tokenHash = await hashToken(token);
  const { data, error } = await supabase.from("grameee_admin_sessions").select("id, username, expires_at").eq("token_hash", tokenHash).maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) {
    await supabase.from("grameee_admin_sessions").delete().eq("id", data.id);
    return null;
  }
  await supabase.from("grameee_admin_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return data;
}

async function verifyAdminPassword(username: string, password: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("grameee_admin_password_matches", { p_username: username, p_password: password });
  if (error) throw new Error(`Admin password verification failed: ${error.message}`);
  return Boolean(data);
}

async function handleLogin(password: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("grameee_admin_accounts").select("username, password_hash").eq("username", "admin").maybeSingle();
  if (error) return errorResponse(`Admin account lookup failed: ${error.message}`, 500);
  if (!data?.username) return errorResponse("Common admin account does not exist yet.", 401);
  const validPassword = await verifyAdminPassword("admin", password).catch(() => false);
  if (!validPassword) return errorResponse("Invalid admin password.", 401);
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("grameee_admin_sessions").delete().eq("username", "admin");
  const { error: sessionError } = await supabase.from("grameee_admin_sessions").insert({ username: "admin", token_hash: tokenHash, expires_at: expiresAt });
  if (sessionError) return errorResponse("Admin session could not be created.", 500);
  return jsonResponse({ token, username: "admin", expires_at: expiresAt });
}

async function handleVerify(token: string) {
  const session = await validateSession(token);
  return jsonResponse({ valid: Boolean(session), username: session?.username ?? null, expires_at: session?.expires_at ?? null });
}

async function handleLogout(token: string) {
  const supabase = getSupabaseAdmin();
  const tokenHash = await hashToken(token);
  await supabase.from("grameee_admin_sessions").delete().eq("token_hash", tokenHash);
  return jsonResponse({ ok: true });
}

async function fetchAllRows(table: string, orderColumn: string) {
  const supabase = getSupabaseAdmin();
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select("*").order(orderColumn).range(from, to);
    if (error) throw new Error(`${table} load failed: ${error.message}`);
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function handleLoadAdminData(token: string) {
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);
  const [entityTypes, entities, fieldDefinitions, submissions, contactRequests] = await Promise.all([
    fetchAllRows("ecosystem_entity_types", "sort_order"),
    fetchAllRows("ecosystem_directory_entities_all", "entity_name"),
    fetchAllRows("ecosystem_entity_field_definitions", "sort_order"),
    fetchAllRows("ecosystem_entity_submissions", "created_at"),
    fetchAllRows("ecosystem_contact_requests", "created_at"),
  ]);
  return jsonResponse({
    entityTypes,
    entities: entities.filter((item) => !item.is_deleted),
    fieldDefinitions,
    submissions: submissions.filter((item) => item.status === "pending"),
    contactRequests,
  });
}

async function sendEmailNotification(subject: string, text: string) {
  if (!resendApiKey) return { status: "not_configured", response: "RESEND_API_KEY not configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [adminEmail],
      subject,
      text,
    }),
  });
  const rawText = await response.text().catch(() => "");
  if (!response.ok) throw new Error(rawText || `Email request failed (${response.status})`);
  return { status: "sent", response: rawText };
}

async function upsertEntity(typeSlug: string, input: EntityInput, adminUsername: string) {
  const supabase = getSupabaseAdmin();
  const table = getEntityTable(typeSlug);
  const entityName = requireString(input.entity_name);
  if (!entityName) throw new Error("Entity name is required.");
  const entityUid = requireString(input.entity_uid) || `${typeSlug}-${slugify(entityName)}-${crypto.randomUUID().slice(0, 8)}`;
  const payload = {
    entity_uid: entityUid,
    entity_name: entityName,
    summary: requireString(input.summary) || null,
    description: requireString(input.description) || null,
    location_label: requireString(input.location_label) || null,
    primary_address: requireString(input.primary_address) || null,
    district: requireString(input.district) || null,
    state: requireString(input.state) || null,
    country: requireString(input.country) || "India",
    contact_email: requireString(input.contact_email) || null,
    contact_phone: requireString(input.contact_phone) || null,
    website_url: requireString(input.website_url) || null,
    social_media: toJsonObject(input.social_media),
    office_locations: toJsonArray(input.office_locations),
    tags: toTextArray(input.tags),
    keywords: toTextArray(input.keywords),
    latitude: toNullableNumber(input.latitude),
    longitude: toNullableNumber(input.longitude),
    source_label: requireString(input.source_label) || null,
    source_url: requireString(input.source_url) || null,
    type_specific_data: toJsonObject(input.type_specific_data),
    created_by_name: requireString(input.created_by_name) || adminUsername || null,
    created_by_email: requireString(input.created_by_email) || null,
    admin_notes: requireString(input.admin_notes) || null,
    approval_status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: adminUsername,
    is_deleted: false,
    search_text: buildSearchText(input),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from(table).upsert(payload, { onConflict: "entity_uid" }).select("*").single();
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  return data;
}

async function handleSubmitEntity(submission: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const typeSlug = requireString(submission.entity_type_slug);
  getEntityTable(typeSlug);
  const entityName = requireString(submission.entity_name);
  const submittedByEmail = requireString(submission.submitted_by_email);
  if (!entityName || !submittedByEmail) return errorResponse("Submission name and submitter email are required.", 400);
  const row = {
    entity_type_slug: typeSlug,
    entity_name: entityName,
    summary: requireString(submission.summary) || null,
    description: requireString(submission.description) || null,
    location_label: requireString(submission.location_label) || null,
    primary_address: requireString(submission.primary_address) || null,
    district: requireString(submission.district) || null,
    state: requireString(submission.state) || null,
    country: requireString(submission.country) || "India",
    contact_email: requireString(submission.contact_email) || null,
    contact_phone: requireString(submission.contact_phone) || null,
    website_url: requireString(submission.website_url) || null,
    social_media: toJsonObject(submission.social_media),
    office_locations: toJsonArray(submission.office_locations),
    tags: toTextArray(submission.tags),
    keywords: toTextArray(submission.keywords),
    latitude: toNullableNumber(submission.latitude),
    longitude: toNullableNumber(submission.longitude),
    source_label: requireString(submission.source_label) || "Public submission",
    source_url: requireString(submission.source_url) || null,
    type_specific_data: toJsonObject(submission.type_specific_data),
    submitted_by_name: requireString(submission.submitted_by_name) || null,
    submitted_by_email: submittedByEmail,
    submitted_by_phone: requireString(submission.submitted_by_phone) || null,
    payload: submission,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("ecosystem_entity_submissions").insert(row).select("*").single();
  if (error) return errorResponse(`Submission failed: ${error.message}`, 500);
  return jsonResponse({ ok: true, item: data });
}

async function handleApproveSubmission(token: string, submissionId: string) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);
  const { data, error } = await supabase.from("ecosystem_entity_submissions").select("*").eq("id", submissionId).maybeSingle();
  if (error || !data) return errorResponse("Submission not found.", 404);
  await upsertEntity(requireString(data.entity_type_slug), {
    ...data,
    created_by_name: data.submitted_by_name,
    created_by_email: data.submitted_by_email,
  }, session.username);
  await supabase.from("ecosystem_entity_submissions").update({
    status: "approved",
    reviewed_by: session.username,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", submissionId);
  return jsonResponse({ ok: true });
}

async function handleRejectSubmission(token: string, submissionId: string) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);
  const { error } = await supabase.from("ecosystem_entity_submissions").update({
    status: "rejected",
    reviewed_by: session.username,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", submissionId);
  if (error) return errorResponse(`Submission rejection failed: ${error.message}`, 500);
  return jsonResponse({ ok: true });
}

async function findEntityRow(entityUid: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("ecosystem_directory_entities_all").select("entity_type_slug").eq("entity_uid", entityUid).maybeSingle();
  if (error || !data?.entity_type_slug) throw new Error("Entity not found.");
  return { table: getEntityTable(requireString(data.entity_type_slug)), typeSlug: requireString(data.entity_type_slug) };
}

async function handleUpdateEntity(token: string, entityUid: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);
  if (!entityUid) return errorResponse("Missing entity id.", 400);
  const { table, typeSlug } = await findEntityRow(entityUid);
  const nextTypeSlug = requireString(updates.entity_type_slug) || typeSlug;
  const cleanUpdates: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (!(field in updates)) continue;
    if (field === "entity_type_slug") continue;
    if (field === "tags" || field === "keywords") cleanUpdates[field] = toTextArray(updates[field]);
    else if (field === "social_media") cleanUpdates[field] = toJsonObject(updates[field]);
    else if (field === "office_locations") cleanUpdates[field] = toJsonArray(updates[field]);
    else if (field === "type_specific_data") cleanUpdates[field] = toJsonObject(updates[field]);
    else if (field === "latitude" || field === "longitude") cleanUpdates[field] = toNullableNumber(updates[field]);
    else cleanUpdates[field] = requireString(updates[field]) || null;
  }
  cleanUpdates.search_text = buildSearchText({ ...updates, ...cleanUpdates });
  cleanUpdates.updated_at = new Date().toISOString();

  if (nextTypeSlug !== typeSlug) {
    const { data: existing, error: loadError } = await supabase.from(table).select("*").eq("entity_uid", entityUid).single();
    if (loadError) return errorResponse(`Entity load failed: ${loadError.message}`, 500);
    await upsertEntity(nextTypeSlug, { ...existing, ...cleanUpdates, entity_uid: entityUid }, session.username);
    await supabase.from(table).update({ is_deleted: true, updated_at: new Date().toISOString() }).eq("entity_uid", entityUid);
    return jsonResponse({ ok: true });
  }

  const { error } = await supabase.from(table).update(cleanUpdates).eq("entity_uid", entityUid);
  if (error) return errorResponse(`Entity update failed: ${error.message}`, 500);
  return jsonResponse({ ok: true });
}

async function handleDeleteEntity(token: string, entityUid: string) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);
  const { table } = await findEntityRow(entityUid);
  const { error } = await supabase.from(table).update({
    is_deleted: true,
    admin_notes: `Deleted by ${session.username} on ${new Date().toISOString()}`,
    updated_at: new Date().toISOString(),
  }).eq("entity_uid", entityUid);
  if (error) return errorResponse(`Entity delete failed: ${error.message}`, 500);
  return jsonResponse({ ok: true });
}

async function handleBulkUploadEntities(token: string, rows: EntityInput[]) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);
  if (!Array.isArray(rows) || !rows.length) return errorResponse("No upload rows were provided.", 400);
  let upsertedCount = 0;
  for (const row of rows) {
    const typeSlug = requireString(row.entity_type_slug);
    if (!typeSlug) continue;
    await upsertEntity(typeSlug, row, session.username);
    upsertedCount += 1;
  }
  await supabase.from("ecosystem_import_batches").insert({
    uploaded_by: session.username,
    record_count: upsertedCount,
    notes: "Admin bulk upload",
  });
  return jsonResponse({ ok: true, upsertedCount });
}

async function handleSubmitContactRequest(request: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const row = {
    entity_uid: requireString(request.entity_uid),
    request_type: requireString(request.request_type) || "edit",
    requester_name: requireString(request.requester_name),
    requester_email: requireString(request.requester_email),
    requester_phone: requireString(request.requester_phone) || null,
    message: requireString(request.message),
    updated_at: new Date().toISOString(),
  };
  if (!row.entity_uid || !row.requester_name || !row.requester_email || !row.message) {
    return errorResponse("Missing request fields.", 400);
  }
  const { data: entity } = await supabase.from("ecosystem_directory_entities_all").select("entity_name, entity_type_label, location_label").eq("entity_uid", row.entity_uid).maybeSingle();
  const { data, error } = await supabase.from("ecosystem_contact_requests").insert(row).select("*").single();
  if (error) return errorResponse(`Contact request failed: ${error.message}`, 500);
  try {
    const notification = await sendEmailNotification(
      `Directory ${row.request_type} request: ${requireString(entity?.entity_name) || row.entity_uid}`,
      `Entity: ${requireString(entity?.entity_name) || row.entity_uid}\nType: ${requireString(entity?.entity_type_label)}\nLocation: ${requireString(entity?.location_label)}\nRequester: ${row.requester_name}\nEmail: ${row.requester_email}\nPhone: ${row.requester_phone || "Not listed"}\n\nMessage:\n${row.message}`
    );
    await supabase.from("ecosystem_contact_requests").update({
      notification_status: notification.status,
      notification_response: notification.response,
      updated_at: new Date().toISOString(),
    }).eq("id", data.id);
  } catch (notifyError) {
    await supabase.from("ecosystem_contact_requests").update({
      notification_status: "failed",
      notification_response: notifyError instanceof Error ? notifyError.message : "Unknown error",
      updated_at: new Date().toISOString(),
    }).eq("id", data.id);
  }
  return jsonResponse({ ok: true, item: data });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return errorResponse("Method not allowed.", 405);
  if (!supabaseUrl || !serviceRoleKey) return errorResponse("Function secrets are not configured.", 500);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }

  const action = requireString(body.action);
  const token = requireString(body.token);
  const password = requireString(body.password);
  const submissionId = requireString(body.submissionId);
  const entityUid = requireString(body.entityUid);
  const submission = body.submission && typeof body.submission === "object" && !Array.isArray(body.submission)
    ? body.submission as Record<string, unknown>
    : {};
  const contactRequest = body.request && typeof body.request === "object" && !Array.isArray(body.request)
    ? body.request as Record<string, unknown>
    : {};
  const updates = body.updates && typeof body.updates === "object" && !Array.isArray(body.updates)
    ? body.updates as Record<string, unknown>
    : {};
  const rows = Array.isArray(body.rows) ? body.rows as EntityInput[] : [];

  try {
    switch (action) {
      case "login":
        return await handleLogin(password);
      case "verify":
        return await handleVerify(token);
      case "logout":
        return await handleLogout(token);
      case "loadAdminData":
        return await handleLoadAdminData(token);
      case "submitEntity":
        return await handleSubmitEntity(submission);
      case "approveSubmission":
        return await handleApproveSubmission(token, submissionId);
      case "rejectSubmission":
        return await handleRejectSubmission(token, submissionId);
      case "updateEntity":
        return await handleUpdateEntity(token, entityUid, updates);
      case "deleteEntity":
        return await handleDeleteEntity(token, entityUid);
      case "bulkUploadEntities":
        return await handleBulkUploadEntities(token, rows);
      case "submitContactRequest":
        return await handleSubmitContactRequest(contactRequest);
      default:
        return errorResponse("Unknown admin action.", 400);
    }
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
});
