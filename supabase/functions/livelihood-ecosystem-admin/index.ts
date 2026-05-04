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
const githubRepoOwner = Deno.env.get("GITHUB_REPO_OWNER") ?? "tanmaymukherji";
const githubRepoName = Deno.env.get("GITHUB_REPO_NAME") ?? "livelihood-ecosystem-directory";
const githubRepo = Deno.env.get("GITHUB_REPO") ?? `${githubRepoOwner}/${githubRepoName}`;
const githubBranch = Deno.env.get("GITHUB_BRANCH") ?? "main";
const githubToken = Deno.env.get("GITHUB_TOKEN") ?? Deno.env.get("GITHUB_ACTIONS_TOKEN") ?? "";
let supabaseClient: ReturnType<typeof createClient> | null = null;

const PLACE_SPIDER_METRIC_KEYS = [
  "arresting_distress_migration",
  "export_import",
  "income",
  "livelihood_basket",
  "youth_employment",
  "agro_ecology",
  "energy",
  "forest",
  "soil",
  "water",
  "gender_inclusion",
  "nutrition",
  "institution",
  "wash",
] as const;

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
  csr_philanthropy: "csr_philanthropy_entities",
  environmental_expert: "environmental_expert_entities",
  place: "place_entities",
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

const SOTH_STAGE_NAMES = ["Initiate", "Engage", "Action", "Auto Pilot"] as const;
const GRAMEEE_STAGE_NAMES = ["Triggering", "Incubating", "Sustaining"] as const;
const PLACE_ROLE_TO_ENTITY_TYPE: Record<string, string> = {
  cso: "cso",
  mentor: "mentor",
  incubator: "incubation_centre",
  institutes: "institute",
  trader_association: "trader_association",
};

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

function normalizeText(value: unknown) {
  return requireString(value).toLowerCase();
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

function toIsoDateTime(value: unknown, fallback = "") {
  const text = requireString(value);
  if (!text) return fallback;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function toNullableDate(value: unknown) {
  const iso = toIsoDateTime(value);
  return iso ? iso.slice(0, 10) : null;
}

function hasUsableCoordinate(latitude: unknown, longitude: unknown) {
  const lat = toNullableNumber(latitude);
  const lng = toNullableNumber(longitude);
  return lat !== null && lng !== null && (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001);
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

function toRecordArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<string, unknown>[]
    : [];
}

function flattenTypeSpecificValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => flattenTypeSpecificValues(item));
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap((item) => flattenTypeSpecificValues(item));
  return value ? [String(value)] : [];
}

function parseLooseTagList(value: unknown) {
  return String(value || "")
    .split(/\r?\n|,|;|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeUniqueTextArrays(...arrays: string[][]) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const array of arrays) {
    for (const item of array) {
      const text = requireString(item);
      const key = normalizeText(text);
      if (!text || seen.has(key)) continue;
      seen.add(key);
      output.push(text);
    }
  }
  return output;
}

function sanitizeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "document";
}

function buildPlaceDocumentPath(placeName: string, recordedAt: string, fileName: string) {
  const placeSlug = slugify(placeName) || "place";
  const stamp = recordedAt.replace(/[:.]/g, "-");
  return `place-documents/${placeSlug}/${stamp}-${sanitizeFileName(fileName)}`;
}

function ensureGithubUploadConfigured() {
  if (!githubToken) {
    throw new Error("GITHUB_TOKEN is not configured for document uploads.");
  }
}

async function uploadFileToGithub(path: string, contentBase64: string, message: string) {
  ensureGithubUploadConfigured();
  const response = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "livelihood-ecosystem-directory",
    },
    body: JSON.stringify({
      message,
      branch: githubBranch,
      content: contentBase64,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(requireString(data?.message) || `GitHub upload failed (${response.status})`);
  }
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return {
    sha: requireString(data?.content?.sha) || null,
    filePath: path,
    fileUrl: `https://cdn.jsdelivr.net/gh/${githubRepo}@${githubBranch}/${encodedPath}`,
  };
}

function normalizePlaceMetrics(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return Object.fromEntries(PLACE_SPIDER_METRIC_KEYS.map((key) => {
    const raw = source[key] && typeof source[key] === "object" && !Array.isArray(source[key])
      ? source[key] as Record<string, unknown>
      : {};
    const score = Math.max(0, toNullableNumber(raw.score) ?? 0);
    const maxScore = Math.max(1, toNullableNumber(raw.max_score) ?? 5);
    return [key, { score, max_score: maxScore }];
  }));
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

function normalizeStatusObject(input: unknown, stages: readonly string[]) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  return Object.fromEntries(stages.map((stage) => {
    const raw = requireString(source[stage]);
    const value = raw === "mature" || raw === "in_progress" ? raw : "not_started";
    return [stage, value];
  }));
}

function getThematicFieldKey(typeSlug: string) {
  switch (typeSlug) {
    case "mentor":
      return "domain_expertise";
    case "community_steward":
      return "support_areas";
    case "volunteer":
      return "cause_areas";
    case "intern":
      return "preferred_domains";
    case "incubation_centre":
    case "accelerator":
    case "institute":
      return "thematic_areas";
    case "trader_association":
      return "key_services";
    case "cso":
      return "areas_of_work";
    case "csr_philanthropy":
      return "focus_areas";
    case "environmental_expert":
      return "domain_expertise";
    default:
      return "";
  }
}

function getGeographyFieldKey(typeSlug: string) {
  switch (typeSlug) {
    case "volunteer":
    case "intern":
      return "preferred_geography";
    case "mentor":
    case "community_steward":
    case "incubation_centre":
    case "accelerator":
    case "institute":
    case "trader_association":
    case "cso":
    case "csr_philanthropy":
    case "environmental_expert":
      return "geography_served";
    default:
      return "";
  }
}

function dedupeLocations(values: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    const text = requireString(value);
    const key = normalizeText(text);
    if (!text || seen.has(key)) continue;
    seen.add(key);
    deduped.push(text);
  }
  return deduped;
}

function normalizeGeocodeQuery(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/[|]+/g, ", ")
    .replace(/[;]+/g, ", ")
    .replace(/\bregistered office source also lists\b/gi, ", ")
    .replace(/\bregistered office\b/gi, ", ")
    .trim();
}

function buildGeocodeQueries(input: Record<string, unknown>) {
  const address = normalizeGeocodeQuery(requireString(input.primary_address));
  const locationLabel = normalizeGeocodeQuery(requireString(input.location_label));
  const district = normalizeGeocodeQuery(requireString(input.district));
  const state = normalizeGeocodeQuery(requireString(input.state));
  const country = normalizeGeocodeQuery(requireString(input.country) || "India");
  const officeLocations = toJsonArray(input.office_locations).map((item) => normalizeGeocodeQuery(String(item || ""))).filter(Boolean);
  const baseQueries = [
    [address, district, state, country].filter(Boolean).join(", "),
    [address, state, country].filter(Boolean).join(", "),
    [locationLabel, state, country].filter(Boolean).join(", "),
    [district, state, country].filter(Boolean).join(", "),
    ...officeLocations.map((office) => [office, state, country].filter(Boolean).join(", ")),
    [state, country].filter(Boolean).join(", "),
  ];
  return dedupeLocations(baseQueries);
}

function buildGeocodeHints(input: Record<string, unknown>) {
  const locationLabel = requireString(input.location_label).split(",")[0];
  return dedupeLocations([
    requireString(input.district),
    requireString(input.state),
    locationLabel,
  ]).map((value) => normalizeText(value));
}

function geocodeMatchLooksRelevant(match: Record<string, unknown> | null, hints: string[]) {
  if (!match) return false;
  if (!hints.length) return true;
  const displayName = normalizeText(match.display_name);
  return hints.some((hint) => hint && displayName.includes(hint));
}

async function geocodeEntityFallback(input: Record<string, unknown>) {
  const queries = buildGeocodeQueries(input);
  const hints = buildGeocodeHints(input);
  for (const query of queries) {
    if (!query) continue;
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Livelihood Ecosystem Directory/1.0",
        },
      });
      if (!response.ok) continue;
      const data = await response.json() as Array<Record<string, unknown>>;
      const match = Array.isArray(data) ? data[0] : null;
      if (!geocodeMatchLooksRelevant(match, hints)) continue;
      const latitude = toNullableNumber(match?.lat);
      const longitude = toNullableNumber(match?.lon);
      if (hasUsableCoordinate(latitude, longitude)) {
        return { latitude, longitude };
      }
    } catch {
      continue;
    }
  }
  return { latitude: null, longitude: null };
}

function buildPlaceLocationQuery(location: Record<string, unknown>) {
  return [
    requireString(location.village_name),
    requireString(location.block_name),
    requireString(location.district_name),
    requireString(location.state_name),
    "India",
  ].filter(Boolean).join(", ");
}

async function geocodePlaceLocation(location: Record<string, unknown>) {
  if (hasUsableCoordinate(location.latitude, location.longitude)) {
    return {
      latitude: toNullableNumber(location.latitude),
      longitude: toNullableNumber(location.longitude),
    };
  }
  const query = buildPlaceLocationQuery(location) || requireString(location.display_label) || requireString(location.location_name);
  if (!query) return { latitude: null, longitude: null };
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Livelihood Ecosystem Directory/1.0",
      },
    });
    if (!response.ok) return { latitude: null, longitude: null };
    const data = await response.json() as Array<Record<string, unknown>>;
    const match = Array.isArray(data) ? data[0] : null;
    return {
      latitude: toNullableNumber(match?.lat),
      longitude: toNullableNumber(match?.lon),
    };
  } catch {
    return { latitude: null, longitude: null };
  }
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
  const [entityTypes, entities, fieldDefinitions, submissions, contactRequests, placeDocumentSubmissions, placeSpiderSubmissions, placeDocuments, placeSpiderSnapshots] = await Promise.all([
    fetchAllRows("ecosystem_entity_types", "sort_order"),
    fetchAllRows("ecosystem_directory_entities_all", "entity_name"),
    fetchAllRows("ecosystem_entity_field_definitions", "sort_order"),
    fetchAllRows("ecosystem_entity_submissions", "created_at"),
    fetchAllRows("ecosystem_contact_requests", "created_at"),
    fetchAllRows("place_document_submissions", "created_at"),
    fetchAllRows("place_spider_chart_submissions", "created_at"),
    fetchAllRows("place_document_records", "recorded_at"),
    fetchAllRows("place_spider_chart_snapshots", "recorded_at"),
  ]);
  return jsonResponse({
    entityTypes,
    entities: entities.filter((item) => !item.is_deleted),
    fieldDefinitions,
    submissions: submissions.filter((item) => item.status === "pending"),
    contactRequests,
    placeDocumentSubmissions: placeDocumentSubmissions.filter((item) => item.status === "pending"),
    placeSpiderSubmissions: placeSpiderSubmissions.filter((item) => item.status === "pending"),
    placeDocuments: placeDocuments.filter((item) => !item.is_deleted),
    placeSpiderSnapshots: placeSpiderSnapshots.filter((item) => !item.is_deleted),
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

async function buildApprovedEntityPayload(typeSlug: string, input: EntityInput, adminUsername: string) {
  const entityName = requireString(input.entity_name);
  if (!entityName) throw new Error("Entity name is required.");
  const entityUid = requireString(input.entity_uid) || `${typeSlug}-${slugify(entityName)}-${crypto.randomUUID().slice(0, 8)}`;
  const typeSpecificData = toJsonObject(input.type_specific_data);

  const payload: Record<string, unknown> = {
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
    type_specific_data: typeSpecificData,
    created_by_name: requireString(input.created_by_name) || adminUsername || null,
    created_by_email: requireString(input.created_by_email) || null,
    admin_notes: requireString(input.admin_notes) || null,
    approval_status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: adminUsername,
    is_deleted: false,
    updated_at: new Date().toISOString(),
  };

  if (typeSlug === "place") {
    const placeKind = requireString(typeSpecificData.place_kind);
    const villageName = requireString(typeSpecificData.village_name);
    const gramPanchayatName = requireString(typeSpecificData.gram_panchayat_name);
    const blockName = requireString(typeSpecificData.block_name);
    const districtName = requireString(typeSpecificData.district_name);
    const stateName = requireString(typeSpecificData.state_name);
    payload.district = requireString(payload.district) || districtName || null;
    payload.state = requireString(payload.state) || stateName || null;
    payload.location_label = requireString(payload.location_label) || [entityName, placeKind].filter(Boolean).join(" | ") || entityName;
    payload.primary_address = requireString(payload.primary_address) || [
      villageName,
      gramPanchayatName,
      blockName,
      districtName,
      stateName,
      "India",
    ].filter(Boolean).join(", ");
    payload.keywords = mergeUniqueTextArrays(
      toTextArray(payload.keywords),
      [placeKind, villageName, gramPanchayatName, blockName, districtName, stateName],
    );
  }

  if (!hasUsableCoordinate(payload.latitude, payload.longitude)) {
    const geocoded = await geocodeEntityFallback(payload);
    payload.latitude = geocoded.latitude;
    payload.longitude = geocoded.longitude;
  }

  payload.search_text = buildSearchText(payload);
  return payload;
}

async function upsertEntity(typeSlug: string, input: EntityInput, adminUsername: string) {
  const supabase = getSupabaseAdmin();
  const table = getEntityTable(typeSlug);
  const payload = await buildApprovedEntityPayload(typeSlug, input, adminUsername);
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
  const { data: existing, error: loadError } = await supabase.from(table).select("*").eq("entity_uid", entityUid).single();
  if (loadError) return errorResponse(`Entity load failed: ${loadError.message}`, 500);
  const nextPayload = await buildApprovedEntityPayload(nextTypeSlug, { ...existing, ...cleanUpdates, entity_uid: entityUid }, session.username);

  if (nextTypeSlug !== typeSlug) {
    await upsertEntity(nextTypeSlug, nextPayload, session.username);
    await supabase.from(table).update({ is_deleted: true, updated_at: new Date().toISOString() }).eq("entity_uid", entityUid);
    return jsonResponse({ ok: true });
  }

  const { error } = await supabase.from(table).update(nextPayload).eq("entity_uid", entityUid);
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

async function handleSubmitPlaceSpider(submission: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const placeUid = requireString(submission.place_uid);
  const placeName = requireString(submission.place_name);
  const submittedByName = requireString(submission.submitted_by_name);
  const submittedByEmail = requireString(submission.submitted_by_email);
  const recordedAt = toIsoDateTime(submission.recorded_at, new Date().toISOString());
  if (!placeUid || !placeName || !submittedByName || !submittedByEmail) {
    return errorResponse("Place, submitter name, and submitter email are required.", 400);
  }
  const row = {
    place_uid: placeUid,
    place_name: placeName,
    recorded_at: recordedAt,
    title: requireString(submission.title) || null,
    notes: requireString(submission.notes) || null,
    metrics_json: normalizePlaceMetrics(submission.metrics_json),
    submitted_by_name: submittedByName,
    submitted_by_email: submittedByEmail,
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("place_spider_chart_submissions").insert(row).select("*").single();
  if (error) return errorResponse(`Place spider chart submission failed: ${error.message}`, 500);
  return jsonResponse({ ok: true, item: data });
}

async function handleApprovePlaceSpider(token: string, submissionId: string) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);
  const { data, error } = await supabase.from("place_spider_chart_submissions").select("*").eq("id", submissionId).maybeSingle();
  if (error || !data) return errorResponse("Place spider chart submission not found.", 404);
  const snapshotUid = `place-spider-${slugify(requireString(data.place_name))}-${crypto.randomUUID().slice(0, 8)}`;
  const payload = {
    snapshot_uid: snapshotUid,
    place_uid: requireString(data.place_uid),
    place_name: requireString(data.place_name),
    recorded_at: toIsoDateTime(data.recorded_at, new Date().toISOString()),
    title: requireString(data.title) || null,
    notes: requireString(data.notes) || null,
    metrics_json: normalizePlaceMetrics(data.metrics_json),
    created_by_name: requireString(data.submitted_by_name) || session.username,
    created_by_email: requireString(data.submitted_by_email) || null,
    admin_notes: requireString(data.admin_notes) || null,
    approval_status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: session.username,
    is_deleted: false,
    updated_at: new Date().toISOString(),
  };
  const { error: insertError } = await supabase.from("place_spider_chart_snapshots").insert(payload);
  if (insertError) return errorResponse(`Place spider chart approval failed: ${insertError.message}`, 500);
  await supabase.from("place_spider_chart_submissions").update({
    status: "approved",
    admin_notes: `Approved by ${session.username} on ${new Date().toISOString()}`,
    updated_at: new Date().toISOString(),
  }).eq("id", submissionId);
  return jsonResponse({ ok: true });
}

async function handleRejectPlaceSpider(token: string, submissionId: string) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);
  const { error } = await supabase.from("place_spider_chart_submissions").update({
    status: "rejected",
    admin_notes: `Rejected by ${session.username} on ${new Date().toISOString()}`,
    updated_at: new Date().toISOString(),
  }).eq("id", submissionId);
  if (error) return errorResponse(`Place spider chart rejection failed: ${error.message}`, 500);
  return jsonResponse({ ok: true });
}

async function handleSubmitPlaceDocument(submission: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const placeUid = requireString(submission.place_uid);
  const placeName = requireString(submission.place_name);
  const submittedByName = requireString(submission.submitted_by_name);
  const submittedByEmail = requireString(submission.submitted_by_email);
  const fileName = requireString(submission.file_name);
  const fileContentBase64 = requireString(submission.file_content_base64);
  const recordedAt = toIsoDateTime(submission.recorded_at, new Date().toISOString());
  if (!placeUid || !placeName || !submittedByName || !submittedByEmail || !fileName || !fileContentBase64) {
    return errorResponse("Place, submitter, and file fields are required.", 400);
  }
  const row = {
    place_uid: placeUid,
    place_name: placeName,
    title: requireString(submission.title) || fileName,
    description: requireString(submission.description) || null,
    recorded_at: recordedAt,
    document_date: toNullableDate(submission.document_date),
    file_name: fileName,
    mime_type: requireString(submission.mime_type) || null,
    file_size_bytes: toNullableNumber(submission.file_size_bytes),
    file_content_base64: fileContentBase64,
    submitted_by_name: submittedByName,
    submitted_by_email: submittedByEmail,
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("place_document_submissions").insert(row).select("*").single();
  if (error) return errorResponse(`Place document submission failed: ${error.message}`, 500);
  return jsonResponse({ ok: true, item: data });
}

async function handleApprovePlaceDocument(token: string, submissionId: string) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);
  const { data, error } = await supabase.from("place_document_submissions").select("*").eq("id", submissionId).maybeSingle();
  if (error || !data) return errorResponse("Place document submission not found.", 404);
  const recordedAt = toIsoDateTime(data.recorded_at, new Date().toISOString());
  const documentPath = buildPlaceDocumentPath(requireString(data.place_name), recordedAt, requireString(data.file_name));
  const uploaded = await uploadFileToGithub(
    documentPath,
    requireString(data.file_content_base64),
    `Add place document for ${requireString(data.place_name)}`
  );
  const payload = {
    document_uid: `place-doc-${slugify(requireString(data.place_name))}-${crypto.randomUUID().slice(0, 8)}`,
    place_uid: requireString(data.place_uid),
    place_name: requireString(data.place_name),
    title: requireString(data.title) || requireString(data.file_name),
    description: requireString(data.description) || null,
    recorded_at: recordedAt,
    document_date: toNullableDate(data.document_date),
    file_name: requireString(data.file_name),
    file_path: uploaded.filePath,
    file_url: uploaded.fileUrl,
    mime_type: requireString(data.mime_type) || null,
    github_sha: uploaded.sha,
    created_by_name: requireString(data.submitted_by_name) || session.username,
    created_by_email: requireString(data.submitted_by_email) || null,
    admin_notes: requireString(data.admin_notes) || null,
    approval_status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: session.username,
    is_deleted: false,
    updated_at: new Date().toISOString(),
  };
  const { error: insertError } = await supabase.from("place_document_records").insert(payload);
  if (insertError) return errorResponse(`Place document approval failed: ${insertError.message}`, 500);
  await supabase.from("place_document_submissions").update({
    status: "approved",
    admin_notes: `Approved by ${session.username} on ${new Date().toISOString()}`,
    updated_at: new Date().toISOString(),
  }).eq("id", submissionId);
  return jsonResponse({ ok: true });
}

async function handleRejectPlaceDocument(token: string, submissionId: string) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);
  const { error } = await supabase.from("place_document_submissions").update({
    status: "rejected",
    admin_notes: `Rejected by ${session.username} on ${new Date().toISOString()}`,
    updated_at: new Date().toISOString(),
  }).eq("id", submissionId);
  if (error) return errorResponse(`Place document rejection failed: ${error.message}`, 500);
  return jsonResponse({ ok: true });
}

function buildPlaceLocationTags(locations: Record<string, unknown>[]) {
  return mergeUniqueTextArrays(
    locations.map((item) => requireString(item.village_name)).filter(Boolean),
    locations.map((item) => requireString(item.block_name)).filter(Boolean),
    locations.map((item) => requireString(item.district_name)).filter(Boolean),
    locations.map((item) => requireString(item.state_name)).filter(Boolean),
  );
}

function buildPlaceLocationLabel(locations: Record<string, unknown>[]) {
  const labels = mergeUniqueTextArrays(locations.map((item) => requireString(item.display_label)).filter(Boolean));
  return labels.slice(0, 3).join(" | ");
}

function buildParticipantTypeSpecificData(
  typeSlug: string,
  existing: Record<string, unknown>,
  thematicTags: string[],
  locationTags: string[]
) {
  const next = {
    ...toJsonObject(existing.type_specific_data),
  } as Record<string, unknown>;
  const thematicFieldKey = getThematicFieldKey(typeSlug);
  if (thematicFieldKey) {
    next[thematicFieldKey] = mergeUniqueTextArrays(
      toTextArray(next[thematicFieldKey]),
      thematicTags,
    );
  }
  const geographyFieldKey = getGeographyFieldKey(typeSlug);
  if (geographyFieldKey) {
    next[geographyFieldKey] = mergeUniqueTextArrays(
      toTextArray(next[geographyFieldKey]),
      locationTags,
    );
  }
  return next;
}

async function syncPlaceParticipantToDirectory(
  participant: Record<string, unknown>,
  roleSlug: string,
  normalizedLocations: Record<string, unknown>[],
  sessionUsername: string
) {
  const participantName = requireString(participant.partner_name) || requireString(participant.name);
  if (!participantName) {
    return {
      entity_uid: requireString(participant.entity_uid) || null,
      entity_type_slug: requireString(participant.entity_type_slug) || null,
    };
  }

  let entityUid = requireString(participant.entity_uid);
  let entityTypeSlug = requireString(participant.entity_type_slug);
  let existing: Record<string, unknown> | null = null;
  let table = "";

  if (entityUid) {
    try {
      const found = await findEntityRow(entityUid);
      entityTypeSlug = found.typeSlug;
      table = found.table;
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.from(table).select("*").eq("entity_uid", entityUid).maybeSingle();
      existing = data ?? null;
    } catch {
      existing = null;
    }
  }

  if (!entityTypeSlug) {
    entityTypeSlug = PLACE_ROLE_TO_ENTITY_TYPE[roleSlug] || "";
  }

  if (!entityTypeSlug || !ENTITY_TABLES[entityTypeSlug]) {
    return {
      entity_uid: entityUid || null,
      entity_type_slug: entityTypeSlug || null,
    };
  }

  const thematicTags = parseLooseTagList(participant.thematic_area);
  const locationTags = buildPlaceLocationTags(normalizedLocations);
  const firstState = requireString(normalizedLocations[0]?.state_name) || "India";
  const locationLabel = buildPlaceLocationLabel(normalizedLocations) || firstState;

  const baseRecord = existing || {};
  const nextPayload = {
    ...baseRecord,
    entity_uid: entityUid || requireString(baseRecord.entity_uid) || undefined,
    entity_name: participantName,
    location_label: requireString(baseRecord.location_label) || locationLabel || null,
    state: requireString(baseRecord.state) || (firstState !== "India" ? firstState : null),
    country: requireString(baseRecord.country) || "India",
    website_url: requireString(participant.website_url) || requireString(baseRecord.website_url) || null,
    tags: mergeUniqueTextArrays(
      toTextArray(baseRecord.tags),
      thematicTags,
      locationTags,
    ),
    keywords: mergeUniqueTextArrays(
      toTextArray(baseRecord.keywords),
      thematicTags,
      locationTags,
    ),
    type_specific_data: buildParticipantTypeSpecificData(entityTypeSlug, baseRecord, thematicTags, locationTags),
  };

  const synced = await upsertEntity(entityTypeSlug, nextPayload, sessionUsername);
  return {
    entity_uid: requireString(synced?.entity_uid) || null,
    entity_type_slug: entityTypeSlug,
    entity_name: requireString(synced?.entity_name) || participantName,
    website_url: requireString(synced?.website_url) || requireString(participant.website_url) || null,
  };
}

async function ensurePlaceRoleType(roleSlug: string, roleLabel: string) {
  const normalizedLabel = requireString(roleLabel);
  const normalizedSlug = requireString(roleSlug) || slugify(normalizedLabel);
  if (!normalizedSlug || !normalizedLabel || normalizedSlug === "others") {
    return { roleSlug: roleSlug || "others", roleLabel: normalizedLabel || null };
  }
  const supabase = getSupabaseAdmin();
  await supabase.from("place_role_types").upsert({
    slug: normalizedSlug,
    label: normalizedLabel,
    is_system: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "slug" });
  return { roleSlug: normalizedSlug, roleLabel: normalizedLabel };
}

function buildPlaceSearchText(
  initiativeName: string,
  statesCovered: string[],
  locations: Record<string, unknown>[],
  lead: Record<string, unknown>,
  partners: Record<string, unknown>[]
) {
  return [
    initiativeName,
    statesCovered.join(" "),
    locations.flatMap((item) => [
      requireString(item.location_name),
      requireString(item.display_label),
      requireString(item.state_name),
      requireString(item.district_name),
      requireString(item.block_name),
      requireString(item.village_name),
    ]).join(" "),
    requireString(lead.name),
    requireString(lead.role_slug),
    requireString(lead.role_label),
    requireString(lead.website_url),
    requireString(lead.thematic_area),
    partners.flatMap((item) => [
      requireString(item.partner_name),
      requireString(item.role_slug),
      requireString(item.role_label),
      requireString(item.website_url),
      requireString(item.thematic_area),
    ]).join(" "),
  ].filter(Boolean).join(" ");
}

async function handleUpsertPlaceInitiative(token: string, placeInput: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);

  const initiativeName = requireString(placeInput.initiative_name);
  if (!initiativeName) return errorResponse("Place initiative name is required.", 400);

  const inputLocations = toRecordArray(placeInput.locations);
  if (!inputLocations.length) return errorResponse("At least one place location is required.", 400);

  const leadInput = placeInput.lead && typeof placeInput.lead === "object" && !Array.isArray(placeInput.lead)
    ? placeInput.lead as Record<string, unknown>
    : {};
  const leadName = requireString(leadInput.name);
  if (!leadName) return errorResponse("Lead organisation or individual is required.", 400);

  const customLeadRole = await ensurePlaceRoleType(requireString(leadInput.role_slug), requireString(leadInput.role_label));
  const normalizedLocations = await Promise.all(inputLocations.map(async (location, index) => {
    const geocoded = await geocodePlaceLocation(location);
    const stateName = requireString(location.state_name);
    const districtName = requireString(location.district_name);
    const blockName = requireString(location.block_name);
    const villageName = requireString(location.village_name);
    const locationName = requireString(location.location_name) || villageName || blockName || districtName || stateName;
    const displayLabel = requireString(location.display_label) || [villageName, blockName, districtName, stateName].filter(Boolean).join(", ") || locationName;
    const locationKind = requireString(location.location_kind) || (villageName ? "village" : blockName ? "block" : districtName ? "district" : "state");
    return {
      location_kind: locationKind,
      location_name: locationName,
      display_label: displayLabel,
      state_name: stateName || null,
      district_name: districtName || null,
      block_name: blockName || null,
      village_name: villageName || null,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      sort_order: Number(location.sort_order || index + 1),
      updated_at: new Date().toISOString(),
    };
  }));

  const partnerInputs = toRecordArray(placeInput.partners);
  const syncedLeadEntity = await syncPlaceParticipantToDirectory(leadInput, customLeadRole.roleSlug || "", normalizedLocations, session.username);
  const normalizedPartners = await Promise.all(partnerInputs.map(async (partner, index) => {
    const customRole = await ensurePlaceRoleType(requireString(partner.role_slug), requireString(partner.role_label));
    const syncedEntity = await syncPlaceParticipantToDirectory(partner, customRole.roleSlug || "", normalizedLocations, session.username);
    return {
      partner_kind: "partner",
      entity_uid: syncedEntity.entity_uid || requireString(partner.entity_uid) || null,
      entity_type_slug: syncedEntity.entity_type_slug || requireString(partner.entity_type_slug) || null,
      partner_name: requireString(partner.partner_name),
      role_slug: customRole.roleSlug || null,
      role_label: customRole.roleLabel || null,
      website_url: syncedEntity.website_url || requireString(partner.website_url) || null,
      thematic_area: requireString(partner.thematic_area) || null,
      sort_order: Number(partner.sort_order || index + 1),
      updated_at: new Date().toISOString(),
    };
  })).then((rows) => rows.filter((row) => row.partner_name));

  const statesCovered = Array.from(new Set(normalizedLocations.map((item) => requireString(item.state_name)).filter(Boolean)));
  const placeUid = requireString(placeInput.place_uid) || `place-${slugify(initiativeName)}-${crypto.randomUUID().slice(0, 8)}`;
  const payload = {
    place_uid: placeUid,
    slug: slugify(initiativeName) || placeUid,
    initiative_name: initiativeName,
    lead_entity_uid: syncedLeadEntity.entity_uid || requireString(leadInput.entity_uid) || null,
    lead_entity_type_slug: syncedLeadEntity.entity_type_slug || requireString(leadInput.entity_type_slug) || null,
    lead_name: leadName,
    lead_role_slug: customLeadRole.roleSlug || null,
    lead_role_label: customLeadRole.roleLabel || null,
    lead_website_url: syncedLeadEntity.website_url || requireString(leadInput.website_url) || null,
    lead_thematic_area: requireString(leadInput.thematic_area) || null,
    states_covered: statesCovered,
    soth_status: normalizeStatusObject(placeInput.soth_status, SOTH_STAGE_NAMES),
    grameee_status: normalizeStatusObject(placeInput.grameee_status, GRAMEEE_STAGE_NAMES),
    search_text: buildPlaceSearchText(initiativeName, statesCovered, normalizedLocations, leadInput, normalizedPartners),
    created_by_name: session.username,
    approval_status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: session.username,
    is_deleted: false,
    updated_at: new Date().toISOString(),
  };

  const { error: placeError } = await supabase.from("place_initiatives").upsert(payload, { onConflict: "place_uid" });
  if (placeError) return errorResponse(`Place initiative save failed: ${placeError.message}`, 500);

  await supabase.from("place_initiative_locations").delete().eq("place_uid", placeUid);
  if (normalizedLocations.length) {
    const { error: locationError } = await supabase.from("place_initiative_locations").insert(
      normalizedLocations.map((item) => ({ ...item, place_uid: placeUid }))
    );
    if (locationError) return errorResponse(`Place locations save failed: ${locationError.message}`, 500);
  }

  await supabase.from("place_initiative_partners").delete().eq("place_uid", placeUid);
  const leadRow = {
    place_uid: placeUid,
    partner_kind: "lead",
    entity_uid: syncedLeadEntity.entity_uid || requireString(leadInput.entity_uid) || null,
    entity_type_slug: syncedLeadEntity.entity_type_slug || requireString(leadInput.entity_type_slug) || null,
    partner_name: leadName,
    role_slug: customLeadRole.roleSlug || null,
    role_label: customLeadRole.roleLabel || null,
    website_url: syncedLeadEntity.website_url || requireString(leadInput.website_url) || null,
    thematic_area: requireString(leadInput.thematic_area) || null,
    sort_order: 0,
    updated_at: new Date().toISOString(),
  };
  const partnerRows = [leadRow, ...normalizedPartners.map((item) => ({ ...item, place_uid: placeUid }))];
  const { error: partnerError } = await supabase.from("place_initiative_partners").insert(partnerRows);
  if (partnerError) return errorResponse(`Place partner save failed: ${partnerError.message}`, 500);

  return jsonResponse({ ok: true, place_uid: placeUid });
}

async function handleDeletePlaceInitiative(token: string, placeUid: string) {
  const supabase = getSupabaseAdmin();
  const session = await validateSession(token);
  if (!session) return errorResponse("Invalid admin session.", 401);
  if (!placeUid) return errorResponse("Missing place id.", 400);
  const { error } = await supabase.from("place_initiatives").update({
    is_deleted: true,
    admin_notes: `Deleted by ${session.username} on ${new Date().toISOString()}`,
    updated_at: new Date().toISOString(),
  }).eq("place_uid", placeUid);
  if (error) return errorResponse(`Place delete failed: ${error.message}`, 500);
  return jsonResponse({ ok: true });
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
  const placeSubmissionId = requireString(body.placeSubmissionId);
  const entityUid = requireString(body.entityUid);
  const placeUid = requireString(body.placeUid);
  const submission = body.submission && typeof body.submission === "object" && !Array.isArray(body.submission)
    ? body.submission as Record<string, unknown>
    : {};
  const contactRequest = body.request && typeof body.request === "object" && !Array.isArray(body.request)
    ? body.request as Record<string, unknown>
    : {};
  const updates = body.updates && typeof body.updates === "object" && !Array.isArray(body.updates)
    ? body.updates as Record<string, unknown>
    : {};
  const place = body.place && typeof body.place === "object" && !Array.isArray(body.place)
    ? body.place as Record<string, unknown>
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
      case "submitPlaceSpider":
        return await handleSubmitPlaceSpider(submission);
      case "approvePlaceSpider":
        return await handleApprovePlaceSpider(token, placeSubmissionId);
      case "rejectPlaceSpider":
        return await handleRejectPlaceSpider(token, placeSubmissionId);
      case "submitPlaceDocument":
        return await handleSubmitPlaceDocument(submission);
      case "approvePlaceDocument":
        return await handleApprovePlaceDocument(token, placeSubmissionId);
      case "rejectPlaceDocument":
        return await handleRejectPlaceDocument(token, placeSubmissionId);
      case "upsertPlaceInitiative":
        return await handleUpsertPlaceInitiative(token, place);
      case "deletePlaceInitiative":
        return await handleDeletePlaceInitiative(token, placeUid);
      default:
        return errorResponse("Unknown admin action.", 400);
    }
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
});
