const { esc } = window.EcosystemForms;

const placeState = {
  entityTypes: [],
  entities: [],
  placeInitiatives: [],
  placeLocations: [],
  placePartners: [],
  placeRoleTypes: [],
  placeDocuments: [],
  placeSpiderSnapshots: [],
  placeThematicNeeds: [],
  selectedPlaceUid: '',
  adminToken: '',
  adminEnabled: false,
  map: null,
  mapReady: false,
  mapLoadPromise: null,
  mapPopup: null,
  mapFeatures: null,
  roleDragState: null,
  locationManifest: null,
  locationBuckets: new Map(),
  flatLocationEntries: [],
  pendingLocationSuggestion: null,
  pendingLeadSuggestion: null,
  pendingPartnerSuggestions: new Map(),
  calloutPositions: {},
  pendingLocationSelectionKey: '',
  roleBoxesVisible: false,
  calloutPlaceUid: '',
  isRebalancingCallouts: false,
  detailHydrationInFlight: new Set(),
  needPartnerCache: new Map(),
  potentialPartnerCache: new Map(),
  aiNeedMatchCache: new Map(),
  aiNeedMatchInFlight: new Set(),
  locationLookupMode: 'unknown',
  partnerMatchCache: new Map(),
};

const INDIA_CENTER = { lat: 22.9734, lng: 78.6569 };
const ADMIN_SESSION_KEY = 'livelihood-ecosystem-admin-session';
const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started', color: '#d74c4c' },
  { value: 'in_progress', label: 'In Progress', color: '#f39c12' },
  { value: 'mature', label: 'Mature', color: '#2f9d63' },
];
const PLACE_SPIDER_METRICS = [
  { key: 'arresting_distress_migration', label: 'Arresting Distress Migration', defaultMax: 5 },
  { key: 'export_import', label: 'Export Import', defaultMax: 5 },
  { key: 'income', label: 'Income', defaultMax: 5 },
  { key: 'livelihood_basket', label: 'Livelihood Basket', defaultMax: 5 },
  { key: 'youth_employment', label: 'Youth Employment', defaultMax: 5 },
  { key: 'agro_ecology', label: 'Agro Ecology', defaultMax: 5 },
  { key: 'energy', label: 'Energy', defaultMax: 5 },
  { key: 'forest', label: 'Forest', defaultMax: 5 },
  { key: 'soil', label: 'Soil', defaultMax: 5 },
  { key: 'water', label: 'Water', defaultMax: 5 },
  { key: 'gender_inclusion', label: 'Gender Inclusion', defaultMax: 5 },
  { key: 'nutrition', label: 'Nutrition', defaultMax: 5 },
  { key: 'institution', label: 'Institution', defaultMax: 5 },
  { key: 'wash', label: 'Water / Sanitation / Hygiene', defaultMax: 5 },
];
const SOTH_STAGES = ['Initiate', 'Engage', 'Action', 'Auto Pilot'];
const GRAMEEE_STAGES = ['Triggering', 'Incubating', 'Sustaining'];
const LGD_MANIFEST_URL = './data/lgd/manifest.json';
const LGD_BUCKET_BASE_URL = './data/lgd/buckets';
const SPIDER_SERIES_COLORS = ['#2f7d73', '#d97a2b', '#405de6', '#b23a48', '#6a4c93', '#0081a7'];
const INDIA_STATE_CENTERS = {
  'andaman and nicobar islands': { lat: 11.7401, lng: 92.6586 },
  'andhra pradesh': { lat: 15.9129, lng: 79.74 },
  'arunachal pradesh': { lat: 28.218, lng: 94.7278 },
  'assam': { lat: 26.2006, lng: 92.9376 },
  'bihar': { lat: 25.0961, lng: 85.3131 },
  'chandigarh': { lat: 30.7333, lng: 76.7794 },
  'chhattisgarh': { lat: 21.2787, lng: 81.8661 },
  'dadra and nagar haveli and daman and diu': { lat: 20.4283, lng: 72.8397 },
  'delhi': { lat: 28.7041, lng: 77.1025 },
  'goa': { lat: 15.2993, lng: 74.124 },
  'gujarat': { lat: 22.2587, lng: 71.1924 },
  'haryana': { lat: 29.0588, lng: 76.0856 },
  'himachal pradesh': { lat: 31.1048, lng: 77.1734 },
  'jammu and kashmir': { lat: 33.7782, lng: 76.5762 },
  'jharkhand': { lat: 23.6102, lng: 85.2799 },
  'karnataka': { lat: 15.3173, lng: 75.7139 },
  'kerala': { lat: 10.8505, lng: 76.2711 },
  'ladakh': { lat: 34.1526, lng: 77.5771 },
  'lakshadweep': { lat: 10.5667, lng: 72.6417 },
  'madhya pradesh': { lat: 22.9734, lng: 78.6569 },
  'maharashtra': { lat: 19.7515, lng: 75.7139 },
  'manipur': { lat: 24.6637, lng: 93.9063 },
  'meghalaya': { lat: 25.467, lng: 91.3662 },
  'mizoram': { lat: 23.1645, lng: 92.9376 },
  'nagaland': { lat: 26.1584, lng: 94.5624 },
  'odisha': { lat: 20.9517, lng: 85.0985 },
  'puducherry': { lat: 11.9416, lng: 79.8083 },
  'punjab': { lat: 31.1471, lng: 75.3412 },
  'rajasthan': { lat: 27.0238, lng: 74.2179 },
  'sikkim': { lat: 27.533, lng: 88.5122 },
  'tamil nadu': { lat: 11.1271, lng: 78.6569 },
  'telangana': { lat: 18.1124, lng: 79.0193 },
  'tripura': { lat: 23.9408, lng: 91.9882 },
  'uttar pradesh': { lat: 26.8467, lng: 80.9462 },
  'uttarakhand': { lat: 30.0668, lng: 79.0193 },
  'west bengal': { lat: 22.9868, lng: 87.855 }
};

const els = {
  mapStatus: document.getElementById('place-map-status'),
  editorMode: document.getElementById('place-editor-mode'),
  adminBadge: document.getElementById('place-admin-badge'),
  detailStatus: document.getElementById('place-detail-status'),
  saveStatus: document.getElementById('place-save-status'),
  form: document.getElementById('place-editor-form'),
  placeId: document.getElementById('place-id'),
  placeUid: document.getElementById('place-uid'),
  placeName: document.getElementById('place-name'),
  locationSearch: document.getElementById('place-location-search'),
  locationSuggestions: document.getElementById('place-location-suggestions'),
  locationList: document.getElementById('place-location-list'),
  leadOrgSearch: document.getElementById('lead-org-search'),
  leadOrgSuggestions: document.getElementById('lead-org-suggestions'),
  leadOrgName: document.getElementById('lead-org-name'),
  leadOrgRole: document.getElementById('lead-org-role'),
  leadRoleCustomGroup: document.getElementById('lead-role-custom-group'),
  leadRoleCustom: document.getElementById('lead-org-role-custom'),
  leadOrgWebsite: document.getElementById('lead-org-website'),
  leadOrgTheme: document.getElementById('lead-org-theme'),
  leadCard: document.getElementById('place-lead-card'),
  leadSummaryName: document.getElementById('lead-summary-name'),
  leadSummaryRole: document.getElementById('lead-summary-role'),
  toggleLeadCard: document.getElementById('toggle-lead-card'),
  partnerList: document.getElementById('partner-list'),
  sothGrid: document.getElementById('soth-status-grid'),
  grameeeGrid: document.getElementById('grameee-status-grid'),
  detailContent: document.getElementById('place-detail-content'),
  adminPanel: document.getElementById('admin-sync-panel'),
  adminStatus: document.getElementById('place-admin-status'),
  adminPassword: document.getElementById('place-admin-password'),
  matchSyncStatus: document.getElementById('place-match-sync-status'),
  callouts: document.getElementById('place-role-callouts'),
  toggleRoleBoxes: document.getElementById('toggle-role-boxes'),
  spiderModal: document.getElementById('place-spider-modal'),
  spiderModalTitle: document.getElementById('place-spider-modal-title'),
  spiderModalBody: document.getElementById('place-spider-modal-body'),
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function toCoordinate(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '-');
}

function setStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = message || '';
  element.classList.toggle('error', Boolean(isError));
}

function getStoredToken() {
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) || '';
}

function setStoredToken(token) {
  if (token) window.sessionStorage.setItem(ADMIN_SESSION_KEY, token);
  else window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function formatDateTime(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatDate(value) {
  if (!value) return 'Not listed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
}

function formatCompactDate(value) {
  if (!value) return 'Not listed';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function getRoleLabel(roleSlug, roleLabel) {
  const found = placeState.placeRoleTypes.find((role) => role.slug === roleSlug);
  return roleLabel || found?.label || roleSlug || 'Unassigned';
}

function getEntityDetailHref(entityUid) {
  const uid = String(entityUid || '').trim();
  return uid ? `./entity-detail.html?entity=${encodeURIComponent(uid)}` : '';
}

function renderEntityNameLink(entityUid, label, className = '') {
  const href = getEntityDetailHref(entityUid);
  const text = esc(label || 'Not listed');
  if (!href) return text;
  return `<a${className ? ` class="${esc(className)}"` : ''} href="${href}" target="_blank" rel="noreferrer">${text}</a>`;
}

function getStateCenter(stateName) {
  const key = normalizeText(stateName)
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\but\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return INDIA_STATE_CENTERS[key] || null;
}

function parseStateNameFromLabel(label) {
  const parts = String(label || '').split(',').map((item) => item.trim()).filter(Boolean);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (getStateCenter(parts[index])) return parts[index];
  }
  return '';
}

function hasUsableCoordinatePair(item) {
  const latitude = toCoordinate(item?.latitude);
  const longitude = toCoordinate(item?.longitude);
  return latitude !== null && longitude !== null;
}

function getStatusMeta(value) {
  return STATUS_OPTIONS.find((item) => item.value === value) || STATUS_OPTIONS[0];
}

function getCurrentMapZoom() {
  return Number(placeState.map?.getZoom?.() || 4.7);
}

function getCalloutScale() {
  const zoom = getCurrentMapZoom();
  return Math.max(0.68, Math.min(1.04, 0.72 + ((zoom - 4.7) * 0.08)));
}

function updateRoleBoxToggleLabel() {
  if (!els.toggleRoleBoxes) return;
  const hasPlace = Boolean(placeState.selectedPlaceUid);
  els.toggleRoleBoxes.textContent = placeState.roleBoxesVisible ? 'Hide Role Boxes' : 'Show Role Boxes';
  els.toggleRoleBoxes.disabled = !hasPlace;
}

function clearAutoCalloutPositions(placeUid) {
  Object.keys(placeState.calloutPositions).forEach((key) => {
    if (!key.startsWith(`${placeUid}:`)) return;
    if (placeState.calloutPositions[key]?.manual) return;
    delete placeState.calloutPositions[key];
  });
  delete placeState.calloutPositions[`${placeUid}:summary`];
}

function forceMapRepaint(options = {}) {
  const map = placeState.map;
  if (!map) return;
  const preserveIndiaView = options.preserveIndiaView !== false;
  const refresh = () => {
    map.resize?.();
    if (preserveIndiaView && !placeState.selectedPlaceUid) {
      map.setCenter?.(INDIA_CENTER);
      map.setZoom?.(4.7);
    }
    map.triggerRepaint?.();
  };
  refresh();
  [120, 350, 700, 1200].forEach((delay) => {
    setTimeout(refresh, delay);
  });
}

async function preparePrintView() {
  document.body.classList.add('is-print-prep');
  forceMapRepaint({ preserveIndiaView: false });
  renderRoleCallouts();
  await new Promise((resolve) => setTimeout(resolve, 500));
  forceMapRepaint({ preserveIndiaView: false });
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function buildStatusEditor(container, stages, prefix) {
  container.innerHTML = stages.map((stage) => {
    return `<div class="place-status-card"><label for="${esc(prefix + '-' + slugify(stage))}">${esc(stage)}</label><select id="${esc(prefix + '-' + slugify(stage))}" data-status-group="${esc(prefix)}" data-status-stage="${esc(stage)}">${STATUS_OPTIONS.map((option) => `<option value="${esc(option.value)}">${esc(option.label)}</option>`).join('')}</select></div>`;
  }).join('');
}

function getDefaultStatus(stages) {
  return Object.fromEntries(stages.map((stage) => [stage, 'not_started']));
}

function readStatusGroup(prefix, stages) {
  const output = {};
  stages.forEach((stage) => {
    const input = document.getElementById(`${prefix}-${slugify(stage)}`);
    output[stage] = input?.value || 'not_started';
  });
  return output;
}

function fillStatusGroup(prefix, stages, values) {
  stages.forEach((stage) => {
    const input = document.getElementById(`${prefix}-${slugify(stage)}`);
    if (input) input.value = values?.[stage] || 'not_started';
  });
}

function getEntityTheme(entity) {
  const tags = Array.isArray(entity?.tags) ? entity.tags.filter(Boolean) : [];
  const typeSpecific = entity?.type_specific_data && typeof entity.type_specific_data === 'object'
    ? Object.values(entity.type_specific_data).flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean)
    : [];
  return [...tags, ...typeSpecific].slice(0, 8).join(', ');
}

function flattenTypeSpecificValues(value) {
  if (Array.isArray(value)) return value.flatMap((item) => flattenTypeSpecificValues(item));
  if (value && typeof value === 'object') return Object.values(value).flatMap((item) => flattenTypeSpecificValues(item));
  return value == null ? [] : [String(value)];
}

function normalizePlaceMetricSet(metricsJson) {
  const source = metricsJson && typeof metricsJson === 'object' ? metricsJson : {};
  return PLACE_SPIDER_METRICS.map((metric) => {
    const entry = source[metric.key] && typeof source[metric.key] === 'object' ? source[metric.key] : {};
    const score = Math.max(0, Number(entry.score || 0));
    const maxScore = Math.max(1, Number(entry.max_score || metric.defaultMax || 5));
    const normalized = Math.max(0, Math.min(100, (score / maxScore) * 100));
    return { ...metric, score, maxScore, normalized };
  });
}

function splitSpiderLabel(label, maxChars = 16, maxLines = 3) {
  const parts = String(label || '').replace(/\//g, ' / ').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const part of parts) {
    const next = current ? `${current} ${part}` : part;
    if (next.length <= maxChars || !current || part === '/') {
      current = next;
      continue;
    }
    lines.push(current);
    current = part;
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const compact = lines.slice(0, maxLines - 1);
  compact.push(lines.slice(maxLines - 1).join(' '));
  return compact;
}

function buildSpiderChartSvgBase(placeName, subtitle, series) {
  const metrics = normalizePlaceMetricSet(series?.[0]?.metricsJson || {});
  const width = 980;
  const height = 760;
  const centerX = width / 2;
  const centerY = 390;
  const radius = 210;
  const labelRadius = 300;
  const lineHeight = 18;
  const labelPoints = metrics.map((metric, index) => {
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / metrics.length);
    const lines = splitSpiderLabel(metric.label);
    return {
      ...metric,
      x: centerX + Math.cos(angle) * labelRadius,
      y: centerY + Math.sin(angle) * labelRadius,
      lines,
      textAnchor: Math.cos(angle) > 0.22 ? 'start' : Math.cos(angle) < -0.22 ? 'end' : 'middle',
    };
  });
  const rings = [25, 50, 75, 100];
  const ringPolygons = rings.map((ring) => {
    const points = metrics.map((metric, index) => {
      const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / metrics.length);
      const pointRadius = radius * (ring / 100);
      return `${centerX + Math.cos(angle) * pointRadius},${centerY + Math.sin(angle) * pointRadius}`;
    }).join(' ');
    return `<polygon points="${points}" fill="none" stroke="#d7dfeb" stroke-width="1"></polygon>`;
  }).join('');
  const axisLines = metrics.map((metric, index) => {
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / metrics.length);
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    return `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="#d7dfeb" stroke-width="1"></line>`;
  }).join('');
  const polygons = (Array.isArray(series) ? series : []).map((entry, seriesIndex) => {
    const entryMetrics = normalizePlaceMetricSet(entry.metricsJson);
    const color = entry.color || SPIDER_SERIES_COLORS[seriesIndex % SPIDER_SERIES_COLORS.length];
    const polygonPoints = entryMetrics.map((metric, index) => {
      const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / metrics.length);
      const pointRadius = radius * (metric.normalized / 100);
      return [centerX + Math.cos(angle) * pointRadius, centerY + Math.sin(angle) * pointRadius];
    });
    const dataPolygon = polygonPoints.map((point) => point.join(',')).join(' ');
    const dataDots = polygonPoints.map((point) => `<circle cx="${point[0]}" cy="${point[1]}" r="4" fill="${esc(color)}" stroke="#ffffff" stroke-width="2"></circle>`).join('');
    return `<polygon points="${dataPolygon}" fill="${esc(color)}22" stroke="${esc(color)}" stroke-width="3"></polygon>${dataDots}`;
  }).join('');
  const labels = labelPoints.map((metric) => {
    const startY = metric.y - (((metric.lines.length - 1) * lineHeight) / 2);
    const tspans = metric.lines.map((line, index) => `<tspan x="${metric.x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`).join('');
    return `<text x="${metric.x}" y="${startY}" font-size="14" font-weight="600" text-anchor="${metric.textAnchor}" fill="#28435c">${tspans}</text>`;
  }).join('');
  const ringLabels = rings.map((ring) => `<text x="${centerX + 12}" y="${centerY - ((radius * ring) / 100) + 5}" font-size="12" font-weight="600" fill="#688099">${ring}</text>`).join('');
  const legend = (Array.isArray(series) ? series : []).length > 1
    ? `<g transform="translate(116, 94)">${series.map((entry, index) => {
      const color = entry.color || SPIDER_SERIES_COLORS[index % SPIDER_SERIES_COLORS.length];
      const y = index * 24;
      return `<rect x="0" y="${y}" width="14" height="14" rx="4" fill="${esc(color)}"></rect><text x="22" y="${y + 12}" font-size="13" font-weight="600" fill="#385064">${esc(entry.legend)}</text>`;
    }).join('')}</g>`
    : '';
  return `
    <svg viewBox="0 0 ${width} ${height}" class="place-radar-svg" role="img" aria-label="Spider chart for ${esc(placeName)}" preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#fbfcfe"></rect>
      <text x="${centerX}" y="48" text-anchor="middle" font-size="28" font-weight="700" fill="#16324f">${esc(placeName)}</text>
      <text x="${centerX}" y="78" text-anchor="middle" font-size="15" fill="#5f7388">${esc(subtitle)}</text>
      ${ringPolygons}
      ${axisLines}
      ${ringLabels}
      ${polygons}
      ${labels}
      ${legend}
    </svg>
  `;
}

function buildSpiderChartSvg(placeName, recordedAt, metricsJson) {
  return buildSpiderChartSvgBase(placeName, formatDateTime(recordedAt), [{
    metricsJson,
    color: SPIDER_SERIES_COLORS[0],
    legend: formatCompactDate(recordedAt),
  }]);
}

function buildSpiderChartOverlaySvg(placeName, snapshots) {
  const series = asArray(snapshots)
    .slice()
    .sort((left, right) => new Date(right.recorded_at || 0).getTime() - new Date(left.recorded_at || 0).getTime())
    .map((snapshot, index) => ({
      metricsJson: snapshot.metrics_json,
      color: SPIDER_SERIES_COLORS[index % SPIDER_SERIES_COLORS.length],
      legend: `${formatCompactDate(snapshot.recorded_at)}${snapshot.place_name ? ` | ${snapshot.place_name}` : ''}`,
    }));
  const subtitle = series.length > 1
    ? `${series.length} spider chart snapshots overlaid`
    : formatDateTime(snapshots?.[0]?.recorded_at || '');
  return buildSpiderChartSvgBase(placeName, subtitle, series);
}

function getPlaceIdentityTokens(place) {
  if (!place) return [];
  return [
    normalizeText(place.place_uid),
    place.slug,
    place.initiative_name,
  ].map((value) => normalizeText(value)).filter(Boolean);
}

function getPlaceLocationMatchTokens(placeUid) {
  const locations = getPlaceLocations(placeUid);
  const tokens = [];
  const push = (value) => {
    const text = normalizeText(value);
    if (!text) return;
    tokens.push(text);
  };
  locations.forEach((item) => {
    push(item.location_name);
    push(item.display_label);
    push(item.village_name);
    push(item.block_name);
    push(item.district_name);
    push(item.state_name);
  });
  return Array.from(new Set(tokens.filter((item) => item.length > 2)));
}

function recordMatchesPlaceContext(placeUid, record, extraValues = []) {
  const place = getPlaceByUid(placeUid);
  const values = [
    record?.place_uid,
    record?.place_name,
    record?.title,
    record?.notes,
    record?.description,
    ...extraValues,
  ].map((value) => normalizeText(value)).filter(Boolean);
  if (!values.length) return false;
  if (record?.place_uid === placeUid) return true;
  if (itemMatchesPlaceIdentity(place, values)) return true;
  const locationTokens = getPlaceLocationMatchTokens(placeUid);
  if (!locationTokens.length) return false;
  const haystack = values.join(' | ');
  return locationTokens.some((token) => haystack.includes(token));
}

function itemMatchesPlaceIdentity(place, values = []) {
  const tokens = getPlaceIdentityTokens(place);
  if (!tokens.length) return false;
  const haystack = values.map((value) => normalizeText(value)).filter(Boolean).join(' | ');
  return tokens.some((token) => haystack.includes(token));
}

function getPlaceTopThematicNeeds(placeUid) {
  const items = asArray(placeState.placeThematicNeeds)
    .filter((item) => recordMatchesPlaceContext(placeUid, item, asArray(item.thematic_needs)))
    .sort((left, right) => new Date(right.recorded_at || 0).getTime() - new Date(left.recorded_at || 0).getTime());
  const seen = new Set();
  const orderedNeeds = [];
  items.forEach((item) => {
    asArray(item.thematic_needs).forEach((need) => {
      const label = String(need || '').trim();
      const key = normalizeText(label);
      if (!label || seen.has(key)) return;
      seen.add(key);
      orderedNeeds.push(label);
    });
  });
  return {
    labels: orderedNeeds,
    latestRecordedAt: items[0]?.recorded_at || '',
    records: items,
  };
}

function getPlaceSpiderSnapshots(placeUid) {
  return dedupeBy(
    asArray(placeState.placeSpiderSnapshots)
      .filter((item) => recordMatchesPlaceContext(placeUid, item))
      .sort((left, right) => new Date(right.recorded_at || 0).getTime() - new Date(left.recorded_at || 0).getTime()),
    (item) => normalizeText([item.place_uid, item.title, item.recorded_at].join('|'))
  );
}

function getPlaceDocuments(placeUid) {
  return dedupeBy(
    asArray(placeState.placeDocuments)
      .filter((item) => recordMatchesPlaceContext(placeUid, item))
      .sort((left, right) => new Date(right.recorded_at || 0).getTime() - new Date(left.recorded_at || 0).getTime()),
    (item) => normalizeText([item.place_uid, item.title, item.recorded_at, item.file_url].join('|'))
  );
}

function getSpiderChartNeedIdentifiers(placeUid) {
  const latestSnapshot = getPlaceSpiderSnapshots(placeUid)[0];
  if (!latestSnapshot) return { labels: [], recordedAt: '' };
  const labels = normalizePlaceMetricSet(latestSnapshot.metrics_json)
    .filter((metric) => metric.key === 'arresting_distress_migration' ? metric.normalized > 50 : metric.normalized < 50)
    .map((metric) => `${metric.label} (${Math.round(metric.normalized)} / 100)`);
  return { labels, recordedAt: latestSnapshot.recorded_at || '' };
}

function extractNeedKeywords(placeUid, options = {}) {
  const thematicRecords = getPlaceTopThematicNeeds(placeUid).records;
  const thematic = options.placeName
    ? thematicRecords
      .filter((item) => normalizeText(item.place_name) === normalizeText(options.placeName))
      .flatMap((item) => asArray(item.thematic_needs))
    : getPlaceTopThematicNeeds(placeUid).labels;
  const snapshots = getPlaceSpiderSnapshots(placeUid)
    .filter((item) => !options.placeName || normalizeText(item.place_name) === normalizeText(options.placeName));
  const latestSnapshot = snapshots[0] || null;
  const spider = latestSnapshot
    ? normalizePlaceMetricSet(latestSnapshot.metrics_json)
      .filter((metric) => metric.key === 'arresting_distress_migration' ? metric.normalized > 50 : metric.normalized < 50)
      .map((metric) => metric.label)
    : [];
  return Array.from(new Set([...thematic, ...spider].map((item) => String(item).trim()).filter(Boolean)));
}

function getVillageNeedPartnerGroups(placeUid) {
  const aiMatch = placeState.aiNeedMatchCache.get(placeUid);
  if (aiMatch?.groups?.length) return aiMatch.groups;
  const records = getPlaceTopThematicNeeds(placeUid).records;
  if (!records.length) return [];
  const locations = getPlaceLocations(placeUid);
  const partners = getPlacePartners(placeUid);
  const linkedEntityIds = new Set(partners.map((item) => String(item.entity_uid || '').trim()).filter(Boolean));
  const linkedEntityNames = new Set(partners.map((item) => normalizeText(item.partner_name)).filter(Boolean));
  const sourceGroups = new Map();

  records.forEach((record) => {
    const sourceName = String(record.place_name || record.place_uid || 'Place').trim();
    if (!sourceGroups.has(sourceName)) sourceGroups.set(sourceName, new Set());
    asArray(record.thematic_needs).forEach((need) => {
      const text = String(need || '').trim();
      if (text) sourceGroups.get(sourceName).add(text);
    });
  });

  const commonIndex = new Map();
  Array.from(sourceGroups.entries()).forEach(([sourceName, needSet]) => {
    needSet.forEach((need) => {
      const key = normalizeText(need);
      if (!commonIndex.has(key)) commonIndex.set(key, { needLabel: need, sources: [] });
      commonIndex.get(key).sources.push(sourceName);
    });
  });

  const commonNeeds = Array.from(commonIndex.values()).filter((item) => item.sources.length > 1);
  const uniqueGroups = Array.from(sourceGroups.entries()).map(([sourceName, needSet]) => {
    const needs = Array.from(needSet).filter((need) => (commonIndex.get(normalizeText(need))?.sources.length || 0) === 1);
    return { sourceName, needs };
  }).filter((item) => item.needs.length);

  const resolveEntities = (needKeywords) => placeState.entities
    .filter((entity) => entity.entity_type_slug !== 'place')
    .filter((entity) => geographyMatchesPlace(entity, locations))
    .filter((entity) => {
      const entityUid = String(entity.entity_uid || '').trim();
      const entityName = normalizeText(entity.entity_name);
      if (entityUid && linkedEntityIds.has(entityUid)) return false;
      if (entityName && linkedEntityNames.has(entityName)) return false;
      return true;
    })
    .filter((entity) => thematicMatchesNeed(entity, needKeywords))
    .slice(0, 9);

  const output = [];
  if (commonNeeds.length) {
    output.push({
      sourceName: 'Common Across Covered Villages',
      items: commonNeeds.map((item) => ({
        needLabel: `${item.needLabel} (${item.sources.join(', ')})`,
        entities: resolveEntities([item.needLabel]),
      })).filter((item) => item.entities.length),
    });
  }
  uniqueGroups.forEach((group) => {
    output.push({
      sourceName: group.sourceName,
      items: group.needs.map((need) => ({
        needLabel: need,
        entities: resolveEntities([need, ...extractNeedKeywords(placeUid, { placeName: group.sourceName })]),
      })).filter((item) => item.entities.length),
    });
  });
  return output.filter((group) => group.items.length);
}

function getNeedToPotentialPartnerGroups(placeUid) {
  return getVillageNeedPartnerGroups(placeUid);
}

function getStoredPartnerMatchCache(placeUid) {
  return placeState.partnerMatchCache.get(placeUid) || null;
}

function getCachedNeedPartnerGroups(placeUid) {
  const cached = getStoredPartnerMatchCache(placeUid);
  return Array.isArray(cached?.need_groups) ? cached.need_groups : [];
}

function getCachedPotentialPartnerGroups(placeUid) {
  const cached = getStoredPartnerMatchCache(placeUid);
  const groups = cached?.potential_partner_groups;
  return groups && typeof groups === 'object' && !Array.isArray(groups) ? groups : {};
}

function hydratePlaceDetailCaches(placeUid) {
  if (!placeUid) return;
  const needGroups = getNeedToPotentialPartnerGroups(placeUid);
  const potentialPartners = groupPartnersByType(getPotentialPartnersForPlace(placeUid, { limit: 180 }));
  placeState.needPartnerCache.set(placeUid, needGroups);
  placeState.potentialPartnerCache.set(placeUid, potentialPartners);
}

function schedulePlaceDetailHydration(placeUid) {
  if (!placeUid || placeState.detailHydrationInFlight.has(placeUid)) return;
  placeState.detailHydrationInFlight.add(placeUid);
  window.setTimeout(async () => {
    try {
      hydratePlaceDetailCaches(placeUid);
      await ensureAiNeedMatch(placeUid);
      hydratePlaceDetailCaches(placeUid);
      if (placeState.selectedPlaceUid === placeUid) renderDetail(placeUid);
    } finally {
      placeState.detailHydrationInFlight.delete(placeUid);
    }
  }, 0);
}

function normalizeGeographyText(value) {
  return normalizeText(String(value || '').replace(/[|;/]+/g, ', ').replace(/\s+/g, ' ').trim());
}

function getEntityGeographyTokens(entity) {
  const values = [];
  const push = (value) => {
    const text = String(value || '').trim();
    if (!text) return;
    values.push(text);
  };
  push(entity.state);
  push(entity.location_label);
  asArray(entity.office_locations).forEach(push);
  if (entity.type_specific_data && typeof entity.type_specific_data === 'object') {
    const typeSpecific = entity.type_specific_data;
    [
      typeSpecific.geography_served,
      typeSpecific.preferred_geography,
      typeSpecific.service_locations,
    ].flatMap((value) => flattenTypeSpecificValues(value)).forEach(push);
  }
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function buildPlaceCoverageContext(locations) {
  const enriched = locations.map((item) => {
    const inferred = inferLocationHierarchyMatch(item);
    return {
      ...item,
      state_name: item.state_name || inferred?.state_name || parseStateNameFromLabel(item.display_label || item.location_name) || null,
      district_name: item.district_name || inferred?.district_name || null,
      block_name: item.block_name || inferred?.block_name || null,
      village_name: item.village_name || inferred?.village_name || null,
    };
  });
  return {
    states: new Set(enriched.map((item) => normalizeGeographyText(item.state_name)).filter(Boolean)),
    districts: new Set(enriched.map((item) => normalizeGeographyText(item.district_name)).filter(Boolean)),
    blocks: new Set(enriched.map((item) => normalizeGeographyText(item.block_name)).filter(Boolean)),
    villages: new Set(enriched.map((item) => normalizeGeographyText(item.village_name)).filter(Boolean)),
    labels: new Set(enriched.map((item) => normalizeGeographyText(locationDisplayLabel(item))).filter(Boolean)),
  };
}

function geographyMatchesPlace(entity, locations) {
  const tokens = getEntityGeographyTokens(entity);
  if (!tokens.length) return false;
  const context = buildPlaceCoverageContext(locations);
  return tokens.some((value) => {
    const token = normalizeGeographyText(value);
    if (!token) return false;
    if (/\b(india|pan india|pan-india|india wide|india-wide|nationwide|all india)\b/.test(token)) return true;
    if (context.labels.has(token) || context.states.has(token) || context.districts.has(token) || context.blocks.has(token) || context.villages.has(token)) return true;
    if ([...context.states].some((state) => token.includes(state))) return true;
    if ([...context.districts].some((district) => token.includes(district))) return true;
    if ([...context.blocks].some((block) => token.includes(block))) return true;
    if ([...context.villages].some((village) => token.includes(village))) return true;
    return false;
  });
}

function getEntityThematicTokens(entity) {
  return flattenTypeSpecificValues(entity.type_specific_data || {})
    .concat(asArray(entity.tags))
    .concat(asArray(entity.keywords))
    .concat([entity.summary, entity.description])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function thematicMatchesNeed(entity, needKeywords) {
  if (!needKeywords.length) return false;
  const haystack = normalizeText(getEntityThematicTokens(entity).join(' | '));
  if (!haystack) return false;
  return needKeywords.some((keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) return false;
    return haystack.includes(normalizedKeyword)
      || normalizedKeyword.split(/\s+/).some((part) => part.length > 3 && haystack.includes(part));
  });
}

function getPotentialPartnersForPlace(placeUid, options = {}) {
  const locations = getPlaceLocations(placeUid);
  const partners = getPlacePartners(placeUid);
  const linkedEntityIds = new Set(partners.map((item) => String(item.entity_uid || '').trim()).filter(Boolean));
  const linkedEntityNames = new Set(partners.map((item) => normalizeText(item.partner_name)).filter(Boolean));
  const needKeywords = options.needKeywords || [];
  return placeState.entities
    .filter((entity) => entity.entity_type_slug !== 'place')
    .filter((entity) => geographyMatchesPlace(entity, locations))
    .filter((entity) => {
      const entityUid = String(entity.entity_uid || '').trim();
      const entityName = normalizeText(entity.entity_name);
      if (entityUid && linkedEntityIds.has(entityUid)) return false;
      if (entityName && linkedEntityNames.has(entityName)) return false;
      return true;
    })
    .filter((entity) => !options.requireThematicMatch || thematicMatchesNeed(entity, needKeywords))
    .slice(0, options.limit || 200);
}

function getRolePartnerSummary(placeUid) {
  const partners = getPlacePartners(placeUid);
  return placeState.placeRoleTypes
    .filter((role) => role.slug !== 'others')
    .map((role) => {
      const matching = partners.filter((item) => item.role_slug === role.slug || normalizeText(item.role_label) === normalizeText(role.label));
      return {
        role,
        matching,
      };
    });
}

function groupPartnersByType(entities) {
  return entities.reduce((acc, entity) => {
    const key = entity.entity_type_label || entity.entity_type_slug || 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(entity);
    return acc;
  }, {});
}

function openSpiderChartModal(place, snapshotOrSnapshots) {
  if (!els.spiderModal || !els.spiderModalBody || !snapshotOrSnapshots) return;
  const snapshots = Array.isArray(snapshotOrSnapshots) ? snapshotOrSnapshots.filter(Boolean) : [snapshotOrSnapshots];
  if (!snapshots.length) return;
  const latest = snapshots[0];
  const titleName = latest.place_name || place.initiative_name;
  const isOverlay = snapshots.length > 1;
  els.spiderModalTitle.textContent = isOverlay
    ? `${titleName} | Combined Spider Charts`
    : `${titleName} | ${formatCompactDate(latest.recorded_at)}`;
  els.spiderModalBody.innerHTML = `
    <div class="place-modal-chart">${isOverlay ? buildSpiderChartOverlaySvg(titleName, snapshots) : buildSpiderChartSvg(titleName, latest.recorded_at, latest.metrics_json)}</div>
    <div class="place-modal-summary">
      ${isOverlay
        ? `<p><strong>Overlay:</strong> ${esc(String(snapshots.length))} spider chart snapshots are shown on the same radar map.</p>
           <div class="place-spider-legend-list">${snapshots.map((snapshot, index) => `<div class="place-spider-legend-item"><span class="place-spider-legend-swatch" style="background:${esc(SPIDER_SERIES_COLORS[index % SPIDER_SERIES_COLORS.length])}"></span><span>${esc(formatDateTime(snapshot.recorded_at))}${snapshot.place_name ? ` | ${esc(snapshot.place_name)}` : ''}</span></div>`).join('')}</div>`
        : `<p><strong>Recorded:</strong> ${esc(formatDateTime(latest.recorded_at))}</p>
           <p><strong>Title:</strong> ${esc(latest.title || `${titleName} Spider Chart`)}</p>
           <p>${esc(latest.notes || 'No notes provided.')}</p>`}
    </div>
  `;
  els.spiderModal.hidden = false;
  els.spiderModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('place-modal-open');
}

function closeSpiderChartModal() {
  if (!els.spiderModal) return;
  els.spiderModal.hidden = true;
  els.spiderModal.setAttribute('aria-hidden', 'true');
  if (els.spiderModalBody) els.spiderModalBody.innerHTML = '';
  document.body.classList.remove('place-modal-open');
}

function getPlaceByUid(placeUid) {
  return placeState.placeInitiatives.find((item) => item.place_uid === placeUid) || null;
}

function getPlaceLocations(placeUid) {
  return placeState.placeLocations
    .filter((item) => item.place_uid === placeUid)
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
}

function getPlacePartners(placeUid) {
  return placeState.placePartners
    .filter((item) => item.place_uid === placeUid)
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
}

function guessLocationKind(item) {
  if (item.location_kind) return item.location_kind;
  if (item.village_name) return 'village';
  if (item.gram_panchayat_name) return 'panchayat';
  if (item.block_name) return 'block';
  if (item.district_name) return 'district';
  return 'state';
}

function locationDisplayLabel(item) {
  return item.display_label || item.location_name || [item.village_name, item.gram_panchayat_name, item.block_name, item.district_name, item.state_name].filter(Boolean).join(', ');
}

function getPlaceStates(locations) {
  return Array.from(new Set(locations.map((item) => item.state_name || inferLocationHierarchyMatch(item)?.state_name || parseStateNameFromLabel(item.display_label || item.location_name)).filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function inferLocationHierarchyMatch(item) {
  const candidates = [
    item.display_label,
    item.location_name,
    item.village_name,
    item.gram_panchayat_name,
    item.block_name,
    item.district_name,
  ].map((value) => String(value || '').trim()).filter(Boolean);
  if (!candidates.length || !Array.isArray(placeState.flatLocationEntries) || !placeState.flatLocationEntries.length) return null;
  const matches = placeState.flatLocationEntries.filter((entry) => {
    if (entry.location_kind !== guessLocationKind(item)) return false;
    const entryTokens = [
      entry.display_label,
      entry.location_name,
      entry.village_name,
      entry.gram_panchayat_name,
      entry.block_name,
      entry.district_name,
      entry.state_name,
    ].map((value) => normalizeText(value));
    return candidates.some((candidate) => entryTokens.includes(normalizeText(candidate)));
  }).slice(0, 12);
  if (!matches.length) return null;
  const stateNames = Array.from(new Set(matches.map((entry) => entry.state_name).filter(Boolean)));
  const districtNames = Array.from(new Set(matches.map((entry) => entry.district_name).filter(Boolean)));
  const blockNames = Array.from(new Set(matches.map((entry) => entry.block_name).filter(Boolean)));
  const panchayatNames = Array.from(new Set(matches.map((entry) => entry.gram_panchayat_name).filter(Boolean)));
  const villageNames = Array.from(new Set(matches.map((entry) => entry.village_name).filter(Boolean)));
  return {
    state_name: stateNames.length === 1 ? stateNames[0] : null,
    district_name: districtNames.length === 1 ? districtNames[0] : null,
    block_name: blockNames.length === 1 ? blockNames[0] : null,
    gram_panchayat_name: panchayatNames.length === 1 ? panchayatNames[0] : null,
    village_name: villageNames.length === 1 ? villageNames[0] : null,
  };
}

function dedupeBy(values, keyFn) {
  const seen = new Set();
  return values.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getRawVillageNeedGroups(placeUid) {
  const records = getPlaceTopThematicNeeds(placeUid).records;
  const groups = new Map();
  records.forEach((record) => {
    const sourceName = String(record.place_name || record.place_uid || 'Place').trim();
    if (!groups.has(sourceName)) groups.set(sourceName, new Set());
    asArray(record.thematic_needs).forEach((need) => {
      const text = String(need || '').trim();
      if (text) groups.get(sourceName).add(text);
    });
  });
  return Array.from(groups.entries()).map(([sourceName, needSet]) => ({
    sourceName,
    needs: Array.from(needSet),
  })).filter((group) => group.needs.length);
}

function buildCandidateEntityPool(placeUid) {
  const locations = getPlaceLocations(placeUid);
  const partners = getPlacePartners(placeUid);
  const linkedEntityIds = new Set(partners.map((item) => String(item.entity_uid || '').trim()).filter(Boolean));
  const linkedEntityNames = new Set(partners.map((item) => normalizeText(item.partner_name)).filter(Boolean));
  return placeState.entities
    .filter((entity) => entity.entity_type_slug !== 'place')
    .filter((entity) => geographyMatchesPlace(entity, locations))
    .filter((entity) => {
      const entityUid = String(entity.entity_uid || '').trim();
      const entityName = normalizeText(entity.entity_name);
      if (entityUid && linkedEntityIds.has(entityUid)) return false;
      if (entityName && linkedEntityNames.has(entityName)) return false;
      return true;
    })
    .slice(0, 120);
}

function buildAiNeedMatchPayload(placeUid) {
  const place = getPlaceByUid(placeUid);
  const locations = getPlaceLocations(placeUid);
  const rawGroups = getRawVillageNeedGroups(placeUid);
  const candidates = buildCandidateEntityPool(placeUid).map((entity) => ({
    entity_uid: entity.entity_uid || '',
    entity_name: entity.entity_name || '',
    entity_type_slug: entity.entity_type_slug || '',
    entity_type_label: entity.entity_type_label || entity.entity_type_slug || 'Entity',
    summary: entity.summary || '',
    description: entity.description || '',
    location_label: entity.location_label || '',
    state: entity.state || '',
    themes: getEntityThematicTokens(entity).slice(0, 30),
    geography: getEntityGeographyTokens(entity).slice(0, 20),
  }));
  return {
    place_uid: placeUid,
    initiative_name: place?.initiative_name || '',
    locations: locations.map((item) => ({
      display_label: locationDisplayLabel(item),
      state_name: item.state_name || null,
      district_name: item.district_name || null,
      block_name: item.block_name || null,
      village_name: item.village_name || null,
    })),
    need_groups: rawGroups,
    candidate_entities: candidates,
  };
}

async function ensureAiNeedMatch(placeUid) {
  if (!placeUid || placeState.aiNeedMatchCache.has(placeUid) || placeState.aiNeedMatchInFlight.has(placeUid)) return;
  const payload = buildAiNeedMatchPayload(placeUid);
  if (!payload.need_groups.length || !payload.candidate_entities.length) {
    placeState.aiNeedMatchCache.set(placeUid, { groups: [], provider: 'none' });
    return;
  }
  placeState.aiNeedMatchInFlight.add(placeUid);
  try {
    const data = await window.EcosystemStore.adminRequest('matchPlaceNeeds', { context: payload });
    placeState.aiNeedMatchCache.set(placeUid, data || { groups: [], provider: 'none' });
    if (placeState.selectedPlaceUid === placeUid) renderDetail(placeUid);
  } catch {
    placeState.aiNeedMatchCache.set(placeUid, { groups: [], provider: 'none' });
  }
  finally {
    placeState.aiNeedMatchInFlight.delete(placeUid);
  }
}

function ensureRoleOptions() {
  const optionsHtml = placeState.placeRoleTypes.map((role) => `<option value="${esc(role.slug)}">${esc(role.label)}</option>`).join('');
  els.leadOrgRole.innerHTML = optionsHtml;
  document.querySelectorAll('[data-partner-role]').forEach((selectEl) => {
    const previous = selectEl.value;
    selectEl.innerHTML = optionsHtml;
    selectEl.value = previous || placeState.placeRoleTypes[0]?.slug || '';
  });
}

async function ensureMapCss() {
  const existing = document.getElementById('mappls-web-sdk-css');
  if (existing) {
    if (existing.dataset.loaded === 'true') return;
    await new Promise((resolve) => {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 1200);
    });
    return;
  }
  await new Promise((resolve) => {
    const link = document.createElement('link');
    link.id = 'mappls-web-sdk-css';
    link.rel = 'stylesheet';
    link.href = 'https://apis.mappls.com/vector_map/assets/v3.5/mappls-glob.css';
    link.addEventListener('load', () => {
      link.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    link.addEventListener('error', resolve, { once: true });
    document.head.appendChild(link);
    setTimeout(resolve, 1200);
  });
}

async function loadMapSdk() {
  const key = String(window.APP_CONFIG?.MAPMYINDIA_MAP_KEY || '').trim();
  if (!key) {
    document.getElementById('place-map').innerHTML = '<div class="vendor-map-placeholder">Update `MAPMYINDIA_MAP_KEY` in `config.js` to enable the map.</div>';
    return false;
  }
  if (window.mappls?.Map) return true;
  await ensureMapCss();
  const urls = [
    `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(key)}`,
    `https://sdk.mappls.com/map/sdk/web?v=3.0&layer=vector&access_token=${encodeURIComponent(key)}`,
    `https://apis.mappls.com/advancedmaps/api/${encodeURIComponent(key)}/map_sdk?layer=vector&v=3.0`,
  ];
  for (const src of urls) {
    try {
      await new Promise((resolve, reject) => {
        document.querySelectorAll('script[data-mappls-sdk="true"]').forEach((node) => node.remove());
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.dataset.mapplsSdk = 'true';
        script.onload = () => window.mappls?.Map ? resolve() : reject(new Error('Mappls SDK unavailable'));
        script.onerror = reject;
        document.head.appendChild(script);
      });
      return true;
    } catch {}
  }
  document.getElementById('place-map').innerHTML = '<div class="vendor-map-placeholder">The MapmyIndia SDK could not be loaded for this page.</div>';
  return false;
}

async function ensureMap() {
  if (placeState.mapReady && placeState.map) return true;
  if (placeState.mapLoadPromise) return placeState.mapLoadPromise;
  placeState.mapLoadPromise = (async () => {
    const loaded = await loadMapSdk();
    if (!loaded || !window.mappls?.Map) return false;
    await new Promise((resolve) => {
      placeState.map = new window.mappls.Map('place-map', {
        center: INDIA_CENTER,
        zoom: 4.7,
        zoomControl: true,
        geolocation: false,
        location: false,
      });
      placeState.map.on?.('load', resolve);
      setTimeout(resolve, 1800);
    });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    forceMapRepaint({ preserveIndiaView: true });
    placeState.mapReady = true;
    bindMapInteractionClasses();
    return true;
  })();
  return placeState.mapLoadPromise;
}

function bindMapInteractionClasses() {
  const mapElement = document.getElementById('place-map');
  if (!mapElement || mapElement.dataset.interactionsBound === 'true') return;
  mapElement.dataset.interactionsBound = 'true';
  mapElement.classList.add('is-map-interactive');
  mapElement.addEventListener('mousedown', () => mapElement.classList.add('is-map-dragging'));
  window.addEventListener('mouseup', () => mapElement.classList.remove('is-map-dragging'));
}

function getEntitySuggestionMatches(query) {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  return placeState.entities
    .filter((entity) => normalizeText(entity.entity_name).includes(normalized) || normalizeText(entity.state).includes(normalized))
    .slice(0, 8);
}

function renderSuggestionBox(container, items, renderer) {
  if (!items.length) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  container.hidden = false;
  container.innerHTML = items.map(renderer).join('');
}

function renderLeadSuggestions(matches) {
  renderSuggestionBox(els.leadOrgSuggestions, matches, (entity) => {
    return `<button type="button" class="place-suggestion-item" data-lead-entity="${esc(entity.entity_uid)}"><strong>${esc(entity.entity_name)}</strong><small>${esc(entity.entity_type_label || entity.entity_type_slug)} | ${esc(entity.state || entity.location_label || 'India')}</small></button>`;
  });
}

function getPartnerSummaryLabel(values = {}) {
  const name = String(values.partner_name || '').trim() || 'New Partner';
  const roleLabel = getRoleLabel(values.role_slug || '', values.role_label || '') || 'Role not set';
  return { name, roleLabel };
}

function updatePartnerCardSummary(row) {
  if (!row) return;
  const name = row.querySelector('[data-partner-name]')?.value.trim() || 'New Partner';
  const roleSelect = row.querySelector('[data-partner-role]');
  const roleCustom = row.querySelector('[data-partner-role-custom]')?.value.trim() || '';
  const roleLabel = getRoleLabel(roleSelect?.value || '', roleCustom) || 'Role not set';
  const nameEl = row.querySelector('[data-partner-summary-name]');
  const roleEl = row.querySelector('[data-partner-summary-role]');
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = roleLabel;
}

function setPartnerCardExpanded(row, expanded) {
  if (!row) return;
  row.classList.toggle('is-expanded', expanded);
  const button = row.querySelector('[data-toggle-partner]');
  if (button) button.textContent = expanded ? 'Collapse' : 'Expand';
}

function syncPartnerActionVisibility() {
  els.partnerList.querySelectorAll('[data-remove-partner]').forEach((button) => {
    button.hidden = !placeState.adminEnabled;
  });
}

function addPartnerRow(values = {}, options = {}) {
  const rowId = `partner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const expanded = options.expanded ?? !values.partner_name;
  const summary = getPartnerSummaryLabel(values);
  const html = `
    <article class="place-partner-card ${expanded ? 'is-expanded' : ''}" data-partner-row="${esc(rowId)}">
      <div class="place-form-block-header place-partner-head" style="display:flex;width:100%;justify-content:space-between;align-items:flex-start;gap:.8rem;flex-wrap:nowrap;">
        <div class="place-partner-summary" style="display:grid;gap:.12rem;min-width:0;">
          <strong data-partner-summary-name>${esc(summary.name)}</strong>
          <small data-partner-summary-role>${esc(summary.roleLabel)}</small>
        </div>
        <div class="btn-group place-partner-actions" style="display:flex;flex-wrap:nowrap;justify-content:flex-end;align-items:flex-start;margin-left:auto;">
          <button class="btn btn-small" type="button" data-toggle-partner="${esc(rowId)}">${expanded ? 'Collapse' : 'Expand'}</button>
          <button class="btn btn-small btn-danger" type="button" data-remove-partner="${esc(rowId)}"${placeState.adminEnabled ? '' : ' hidden'}>Remove</button>
        </div>
      </div>
      <input type="hidden" data-partner-entity-uid value="${esc(values.entity_uid || '')}" />
      <input type="hidden" data-partner-entity-type value="${esc(values.entity_type_slug || '')}" />
      <div class="place-partner-fields">
      <div class="form-group">
        <label>Search Existing Entity</label>
        <input type="search" data-partner-search="${esc(rowId)}" placeholder="Search master directory" autocomplete="off" value="" />
        <div class="place-suggestions" data-partner-suggestions="${esc(rowId)}" hidden></div>
      </div>
      <div class="form-group">
        <label>Name</label>
        <input type="text" data-partner-name value="${esc(values.partner_name || '')}" placeholder="Partner organisation or individual" />
      </div>
      <div class="form-group">
        <label>Role</label>
        <select data-partner-role>${placeState.placeRoleTypes.map((role) => `<option value="${esc(role.slug)}"${role.slug === (values.role_slug || '') ? ' selected' : ''}>${esc(role.label)}</option>`).join('')}</select>
      </div>
      <div class="form-group" data-partner-custom-group hidden>
        <label>Add New Role Label</label>
        <input type="text" data-partner-role-custom value="${esc(values.role_label || '')}" placeholder="Custom role label" />
      </div>
      <div class="form-group">
        <label>Website</label>
        <input type="url" data-partner-website value="${esc(values.website_url || '')}" placeholder="https://..." />
      </div>
      <div class="form-group">
        <label>Thematic Area</label>
        <textarea rows="2" data-partner-theme placeholder="Theme or support area">${esc(values.thematic_area || '')}</textarea>
      </div>
      </div>
    </article>
  `;
  els.partnerList.insertAdjacentHTML('beforeend', html);
  const row = els.partnerList.querySelector(`[data-partner-row="${CSS.escape(rowId)}"]`);
  const roleSelect = row.querySelector('[data-partner-role]');
  if (!roleSelect.value) roleSelect.value = placeState.placeRoleTypes[0]?.slug || 'cso';
  syncCustomRoleVisibility(roleSelect, row.querySelector('[data-partner-custom-group]'));
  updatePartnerCardSummary(row);
  setPartnerCardExpanded(row, expanded);
  syncPartnerActionVisibility();
}

function syncCustomRoleVisibility(selectEl, groupEl) {
  const isCustom = selectEl?.value === 'others';
  if (groupEl) groupEl.hidden = !isCustom;
}

function getEditorLocations() {
  return Array.from(els.locationList.querySelectorAll('[data-location-item]')).map((item, index) => safeJsonParse(item.dataset.locationItem, {})).map((item, index) => ({ ...item, sort_order: index + 1 }));
}

function renderLocationList(locations) {
  const items = Array.isArray(locations) ? locations : [];
  els.locationList.innerHTML = items.length
    ? items.map((item, index) => `<article class="place-location-chip" data-location-item="${esc(JSON.stringify(item))}"><div><strong>${esc(locationDisplayLabel(item))}</strong><small>${esc(guessLocationKind(item))}</small></div>${placeState.adminEnabled ? `<button class="btn btn-small btn-danger" type="button" data-remove-location="${index}">Delete</button>` : ''}</article>`).join('')
    : '<div class="vendor-map-status">No covered locations have been added yet.</div>';
}

function buildLocationEntry(kind, names) {
  const stateName = names.state_name || names.state || '';
  const districtName = names.district_name || names.district || '';
  const blockName = names.block_name || names.block || '';
  const gramPanchayatName = names.gram_panchayat_name || names.panchayat || '';
  const villageName = names.village_name || names.village || '';
  return {
    location_kind: kind,
    location_name: names.location_name || villageName || gramPanchayatName || blockName || districtName || stateName,
    state_name: stateName || null,
    district_name: districtName || null,
    block_name: blockName || null,
    gram_panchayat_name: gramPanchayatName || null,
    village_name: villageName || null,
    lgd_entry_uid: names.lgd_entry_uid || null,
    lgd_state_code: names.lgd_state_code || null,
    lgd_district_code: names.lgd_district_code || null,
    lgd_subdistrict_code: names.lgd_subdistrict_code || null,
    lgd_local_body_code: names.lgd_local_body_code || null,
    lgd_village_code: names.lgd_village_code || null,
    display_label: names.display_label || [villageName, gramPanchayatName, blockName, districtName, stateName].filter(Boolean).join(', ') || stateName,
    latitude: names.latitude ?? null,
    longitude: names.longitude ?? null,
  };
}

function buildLocationEntryFromSupabase(row) {
  return buildLocationEntry(row.location_kind || 'state', {
    state_name: row.state_name || '',
    district_name: row.district_name || '',
    block_name: row.block_name || '',
    gram_panchayat_name: row.gram_panchayat_name || '',
    village_name: row.village_name || '',
    location_name: row.village_name || row.gram_panchayat_name || row.block_name || row.district_name || row.state_name || '',
    display_label: row.display_label || '',
    lgd_entry_uid: row.entry_uid || null,
    lgd_state_code: row.state_code || null,
    lgd_district_code: row.district_code || null,
    lgd_subdistrict_code: row.subdistrict_code || null,
    lgd_local_body_code: row.local_body_code || null,
    lgd_village_code: row.village_code || null,
  });
}

function normalizeLocationBucketKey(value) {
  const cleaned = normalizeText(value).replace(/[^a-z0-9]/g, '');
  return cleaned[0] || '_';
}

function buildLocationEntryFromLgdRow(row) {
  const kind = row?.[0] || 'state';
  if (kind === 'state') {
    return buildLocationEntry('state', {
      state_name: row[1],
      location_name: row[1],
      display_label: row[2] || row[1],
      lgd_entry_uid: `state-${row[3] || slugify(row[1])}`,
      lgd_state_code: row[3] || null,
    });
  }
  if (kind === 'district') {
    return buildLocationEntry('district', {
      district_name: row[1],
      state_name: row[2],
      location_name: row[1],
      display_label: [row[1], row[2]].filter(Boolean).join(', '),
      lgd_entry_uid: `district-${row[4] || slugify(`${row[1]}-${row[2]}`)}`,
      lgd_state_code: row[3] || null,
      lgd_district_code: row[4] || null,
    });
  }
  if (kind === 'block') {
    return buildLocationEntry('block', {
      block_name: row[1],
      district_name: row[2],
      state_name: row[3],
      location_name: row[1],
      display_label: [row[1], row[2], row[3]].filter(Boolean).join(', '),
      lgd_entry_uid: `block-${row[6] || slugify(`${row[1]}-${row[2]}-${row[3]}`)}`,
      lgd_state_code: row[4] || null,
      lgd_district_code: row[5] || null,
      lgd_subdistrict_code: row[6] || null,
    });
  }
  if (kind === 'panchayat') {
    return buildLocationEntry('panchayat', {
      gram_panchayat_name: row[1],
      block_name: row[2],
      district_name: row[3],
      state_name: row[4],
      location_name: row[1],
      display_label: [row[1], row[2], row[3], row[4]].filter(Boolean).join(', '),
      lgd_entry_uid: `panchayat-${row[8] || slugify(`${row[1]}-${row[2]}-${row[3]}-${row[4]}`)}`,
      lgd_state_code: row[5] || null,
      lgd_district_code: row[6] || null,
      lgd_subdistrict_code: row[7] || null,
      lgd_local_body_code: row[8] || null,
    });
  }
  return buildLocationEntry('village', {
    village_name: row[1],
    gram_panchayat_name: row[2],
    block_name: row[3],
    district_name: row[4],
    state_name: row[5],
    location_name: row[1],
    display_label: [row[1], row[2], row[3], row[4], row[5]].filter(Boolean).join(', '),
    lgd_entry_uid: `village-${row[10] || slugify(`${row[1]}-${row[4]}-${row[5]}`)}`,
    lgd_state_code: row[6] || null,
    lgd_district_code: row[7] || null,
    lgd_subdistrict_code: row[8] || null,
    lgd_local_body_code: row[9] || null,
    lgd_village_code: row[10] || null,
  });
}

async function ensureLocationManifest() {
  if (placeState.locationManifest) return placeState.locationManifest;
  const response = await fetch(LGD_MANIFEST_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`LGD manifest could not be loaded (${response.status}).`);
  placeState.locationManifest = await response.json();
  return placeState.locationManifest;
}

async function ensureLocationBucket(bucketKey) {
  if (placeState.locationBuckets.has(bucketKey)) return placeState.locationBuckets.get(bucketKey);
  const response = await fetch(`${LGD_BUCKET_BASE_URL}/${bucketKey}.json`, { cache: 'no-store' });
  if (!response.ok) {
    placeState.locationBuckets.set(bucketKey, []);
    return [];
  }
  const json = await response.json();
  const entries = (Array.isArray(json) ? json : []).map(buildLocationEntryFromLgdRow);
  placeState.locationBuckets.set(bucketKey, entries);
  placeState.flatLocationEntries = dedupeBy(
    [...placeState.flatLocationEntries, ...entries],
    (item) => normalizeText(item.lgd_entry_uid || `${item.location_kind}|${item.display_label}`),
  );
  return entries;
}

function cacheLocationEntries(entries) {
  placeState.flatLocationEntries = dedupeBy(
    [...placeState.flatLocationEntries, ...(Array.isArray(entries) ? entries : [])],
    (item) => normalizeText(item.lgd_entry_uid || `${item.location_kind}|${item.display_label}`),
  );
}

async function useLocalLocationFallback() {
  const manifest = await ensureLocationManifest();
  if (!manifest?.bucket_files?.length) {
    throw new Error('Official LGD place dataset could not be loaded from Supabase or local fallback.');
  }
  placeState.locationLookupMode = 'fallback';
  return manifest;
}

async function probeSupabaseLocationSearch() {
  const probeRows = await window.EcosystemStore.searchLgdGeography('a', 1);
  if (probeRows.length) {
    placeState.locationLookupMode = 'supabase';
    cacheLocationEntries(probeRows.map(buildLocationEntryFromSupabase));
    return true;
  }
  return false;
}

function addLocationFromSelection(item) {
  if (!item) return;
  const current = getEditorLocations();
  const next = dedupeBy([...current, item], (entry) => normalizeText(`${entry.location_kind}|${locationDisplayLabel(entry)}`));
  renderLocationList(next);
  els.locationSearch.value = '';
  els.locationSuggestions.hidden = true;
  els.locationSuggestions.innerHTML = '';
  placeState.pendingLocationSuggestion = null;
  placeState.pendingLocationSelectionKey = '';
}

async function getLocationSuggestionMatches(query) {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  const bucketKey = normalizeLocationBucketKey(normalized);
  let bucketEntries = [];
  if (placeState.locationLookupMode !== 'fallback') {
    try {
      const remoteRows = await window.EcosystemStore.searchLgdGeography(query, 12);
      bucketEntries = remoteRows.map(buildLocationEntryFromSupabase);
      cacheLocationEntries(bucketEntries);
      if (bucketEntries.length) {
        placeState.locationLookupMode = 'supabase';
      } else if (placeState.locationLookupMode === 'unknown') {
        await useLocalLocationFallback();
        bucketEntries = await ensureLocationBucket(bucketKey);
      }
    } catch {
      await useLocalLocationFallback();
      bucketEntries = await ensureLocationBucket(bucketKey);
    }
  } else {
    bucketEntries = await ensureLocationBucket(bucketKey);
  }
  const matches = [];
  const matchKeys = new Set();
  const pushMatch = (item) => {
    const key = normalizeText(item.lgd_entry_uid || `${item.location_kind}|${item.display_label}`);
    if (!key || matchKeys.has(key)) return;
    matchKeys.add(key);
    matches.push(item);
  };

  bucketEntries
    .filter((item) => {
      const name = normalizeText(item.location_name);
      const label = normalizeText(item.display_label);
      return name.startsWith(normalized) || label.includes(normalized);
    })
    .slice(0, 12)
    .forEach(pushMatch);
  return matches.slice(0, 12);
}

function renderLocationSuggestions(matches) {
  renderSuggestionBox(els.locationSuggestions, matches, (item, index) => {
    return `<button type="button" class="place-suggestion-item" data-location-suggestion="${index}" data-location-selection-key="${esc(normalizeText(`${item.location_kind}|${item.display_label}`))}"><strong>${esc(item.display_label)}</strong><small>${esc(item.location_kind.toUpperCase())} | ${esc(item.location_name)}</small></button>`;
  });
}

function getSelectedLeadPayload() {
  return {
    entity_uid: els.leadOrgName.dataset.entityUid || null,
    entity_type_slug: els.leadOrgName.dataset.entityTypeSlug || null,
    name: els.leadOrgName.value.trim(),
    role_slug: els.leadOrgRole.value,
    role_label: els.leadOrgRole.value === 'others' ? els.leadRoleCustom.value.trim() : '',
    website_url: els.leadOrgWebsite.value.trim(),
    thematic_area: els.leadOrgTheme.value.trim(),
  };
}

function updateLeadCardSummary() {
  const name = els.leadOrgName.value.trim() || 'Lead Organisation';
  const roleLabel = getRoleLabel(els.leadOrgRole.value || '', els.leadRoleCustom.value.trim() || '') || 'Role not set';
  if (els.leadSummaryName) els.leadSummaryName.textContent = name;
  if (els.leadSummaryRole) els.leadSummaryRole.textContent = roleLabel;
}

function setLeadCardExpanded(expanded) {
  els.leadCard?.classList.toggle('is-expanded', expanded);
  if (els.toggleLeadCard) els.toggleLeadCard.textContent = expanded ? 'Collapse' : 'Expand';
}

function getPartnerPayloads() {
  return Array.from(els.partnerList.querySelectorAll('[data-partner-row]')).map((row, index) => {
    const roleSelect = row.querySelector('[data-partner-role]');
    return {
      entity_uid: row.querySelector('[data-partner-entity-uid]')?.value || null,
      entity_type_slug: row.querySelector('[data-partner-entity-type]')?.value || null,
      partner_name: row.querySelector('[data-partner-name]')?.value.trim() || '',
      role_slug: roleSelect?.value || '',
      role_label: roleSelect?.value === 'others' ? row.querySelector('[data-partner-role-custom]')?.value.trim() || '' : '',
      website_url: row.querySelector('[data-partner-website]')?.value.trim() || '',
      thematic_area: row.querySelector('[data-partner-theme]')?.value.trim() || '',
      sort_order: index + 1,
    };
  }).filter((item) => item.partner_name);
}

function clearLeadSelection() {
  delete els.leadOrgName.dataset.entityUid;
  delete els.leadOrgName.dataset.entityTypeSlug;
  updateLeadCardSummary();
}

function fillLeadFromEntity(entity) {
  els.leadOrgName.value = entity.entity_name || '';
  els.leadOrgName.dataset.entityUid = entity.entity_uid || '';
  els.leadOrgName.dataset.entityTypeSlug = entity.entity_type_slug || '';
  els.leadOrgWebsite.value = entity.website_url || '';
  els.leadOrgTheme.value = getEntityTheme(entity);
  els.leadOrgSearch.value = entity.entity_name || '';
  els.leadOrgSuggestions.hidden = true;
  els.leadOrgSuggestions.innerHTML = '';
  placeState.pendingLeadSuggestion = null;
  updateLeadCardSummary();
}

function fillPartnerFromEntity(rowId, entity) {
  const row = els.partnerList.querySelector(`[data-partner-row="${CSS.escape(rowId)}"]`);
  if (!row) return;
  row.querySelector('[data-partner-entity-uid]').value = entity.entity_uid || '';
  row.querySelector('[data-partner-entity-type]').value = entity.entity_type_slug || '';
  row.querySelector('[data-partner-name]').value = entity.entity_name || '';
  row.querySelector('[data-partner-website]').value = entity.website_url || '';
  row.querySelector('[data-partner-theme]').value = getEntityTheme(entity);
  const searchInput = row.querySelector(`[data-partner-search="${CSS.escape(rowId)}"]`);
  if (searchInput) searchInput.value = entity.entity_name || '';
  const suggestionBox = row.querySelector(`[data-partner-suggestions="${CSS.escape(rowId)}"]`);
  if (suggestionBox) {
    suggestionBox.hidden = true;
    suggestionBox.innerHTML = '';
  }
  placeState.pendingPartnerSuggestions.delete(rowId);
  updatePartnerCardSummary(row);
}

function setEditorEnabled(enabled) {
  placeState.adminEnabled = enabled;
  document.body.classList.toggle('place-read-only', !enabled);
  document.body.classList.toggle('place-admin-enabled', enabled);
  els.adminBadge.textContent = enabled ? 'Edit enabled' : 'Read only';
  els.adminBadge.classList.toggle('approved', enabled);
  els.editorMode.textContent = enabled
    ? 'Admin session is active. Add, edit, delete, and sync place initiatives below.'
    : 'View mode is active. Sign in at the bottom of the page to add or edit records.';
  els.form.querySelectorAll('input, textarea, select, button').forEach((element) => {
    if (element.id === 'print-place-view' || element.id === 'toggle-admin-sync') return;
    if (element.id === 'edit-selected-place') return;
    if (element.closest('#admin-sync-panel')) return;
    element.disabled = !enabled && (element.id === 'save-place' || element.id === 'delete-place' || element.id === 'new-place' || element.id === 'add-partner-row' || element.id === 'add-place-location' || element.dataset.removePartner || element.dataset.removeLocation || element.dataset.partnerSearch || element.id === 'place-location-search' || element.id === 'lead-org-search' || element.dataset.partnerRole !== undefined || element.dataset.partnerName !== undefined || element.dataset.partnerWebsite !== undefined || element.dataset.partnerTheme !== undefined || element.id === 'place-name' || element.id === 'lead-org-name' || element.id === 'lead-org-role' || element.id === 'lead-org-role-custom' || element.id === 'lead-org-website' || element.id === 'lead-org-theme' || element.dataset.statusGroup);
  });
  renderLocationList(getEditorLocations());
  syncPartnerActionVisibility();
}

function getPlaceColor(placeUid) {
  const seed = Array.from(String(placeUid || '')).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palette = ['#1f4b6e', '#2f7d73', '#b56576', '#3a86ff', '#e76f51', '#6a994e', '#8b5cf6'];
  return palette[seed % palette.length];
}

function getLocationRadius(locationKind) {
  switch (locationKind) {
    case 'state': return 1.35;
    case 'district': return 0.46;
    case 'block': return 0.18;
    default: return 0.08;
  }
}

function createCirclePolygon(lat, lng, radiusDegrees, steps = 28) {
  const points = [];
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.25);
  for (let index = 0; index <= steps; index += 1) {
    const angle = (Math.PI * 2 * index) / steps;
    const latOffset = Math.sin(angle) * radiusDegrees;
    const lngOffset = (Math.cos(angle) * radiusDegrees) / cosLat;
    points.push([lng + lngOffset, lat + latOffset]);
  }
  return points;
}

function getPlaceCentroid(locations) {
  const points = locations
    .map((item) => ({ lat: toCoordinate(item.latitude), lng: toCoordinate(item.longitude) }))
    .filter((item) => item.lat !== null && item.lng !== null);
  if (!points.length) {
    const fallback = getPlaceFallbackCentroid(locations);
    return { lat: fallback.lat, lng: fallback.lng };
  }
  return {
    lat: points.reduce((sum, item) => sum + item.lat, 0) / points.length,
    lng: points.reduce((sum, item) => sum + item.lng, 0) / points.length,
  };
}

function getPlaceFallbackCentroid(locations) {
  const states = getPlaceStates(locations);
  for (const stateName of states) {
    const center = getStateCenter(stateName);
    if (center) return center;
  }
  return INDIA_CENTER;
}

function buildPlaceGeoJson() {
  const polygonFeatures = [];
  const centroidFeatures = [];
  placeState.placeInitiatives.forEach((place) => {
    const locations = getPlaceLocations(place.place_uid);
    const color = getPlaceColor(place.place_uid);
    const centroid = getPlaceCentroid(locations);
    locations.forEach((location, index) => {
      const lat = toCoordinate(location.latitude);
      const lng = toCoordinate(location.longitude);
      if (lat === null || lng === null) return;
      polygonFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [createCirclePolygon(lat, lng, getLocationRadius(guessLocationKind(location)))],
        },
        properties: {
          place_uid: place.place_uid,
          initiative_name: place.initiative_name,
          fill: color,
          stroke: color,
          stroke_width: place.place_uid === placeState.selectedPlaceUid ? 3 : 1.5,
          location_label: locationDisplayLabel(location),
          sort_order: index + 1,
        },
      });
    });
    centroidFeatures.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [centroid.lng, centroid.lat] },
      properties: {
        place_uid: place.place_uid,
        initiative_name: place.initiative_name,
        fill: color,
      },
    });
  });
  return {
    polygons: { type: 'FeatureCollection', features: polygonFeatures },
    centroids: { type: 'FeatureCollection', features: centroidFeatures },
  };
}

function buildPopupHtml(feature) {
  return `<div class="vendor-map-popup"><div><strong>${esc(feature.properties?.initiative_name || 'Place initiative')}</strong><br/>${esc(feature.properties?.location_label || 'Covered place')}</div></div>`;
}

function bindLayerEvents() {
  if (!placeState.map || placeState.map.__placeEventsBound) return;
  const map = placeState.map;
  const onHover = (event) => {
    const feature = event?.features?.[0];
    if (!feature) return;
    if (map.getCanvas?.()) map.getCanvas().style.cursor = 'pointer';
    if (window.mappls?.Popup) {
      if (!placeState.mapPopup) placeState.mapPopup = new window.mappls.Popup({ closeButton: false, closeOnClick: false, offset: 16 });
      placeState.mapPopup.setLngLat(event.lngLat).setHTML(buildPopupHtml(feature)).addTo(map);
    }
  };
  const onLeave = () => {
    if (map.getCanvas?.()) map.getCanvas().style.cursor = '';
    placeState.mapPopup?.remove?.();
  };
  const onFillClick = (event) => {
    const feature = event?.features?.[0];
    const placeUid = feature?.properties?.place_uid;
    if (placeUid) {
      placeState.roleBoxesVisible = false;
      placeState.calloutPlaceUid = '';
      selectPlace(placeUid, { fit: true, scroll: false });
    }
  };
  const onCentroidClick = (event) => {
    const feature = event?.features?.[0];
    const placeUid = feature?.properties?.place_uid;
    if (placeUid) {
      placeState.roleBoxesVisible = true;
      placeState.calloutPlaceUid = placeUid;
      selectPlace(placeUid, { fit: true, scroll: false });
    }
  };
  ['place-fill-layer', 'place-centroid-layer'].forEach((layerId) => {
    map.on?.('mousemove', layerId, onHover);
    map.on?.('mouseleave', layerId, onLeave);
  });
  map.on?.('click', 'place-fill-layer', onFillClick);
  map.on?.('click', 'place-centroid-layer', onCentroidClick);
  map.on?.('zoom', () => renderRoleCallouts());
  map.on?.('move', () => renderRoleCallouts());
  map.__placeEventsBound = true;
}

async function renderMap() {
  const ready = await ensureMap();
  if (!ready || !placeState.map) return;
  const map = placeState.map;
  const geo = buildPlaceGeoJson();
  placeState.mapFeatures = geo;
  const hadSelection = Boolean(placeState.selectedPlaceUid);

  if (map.getLayer?.('place-fill-layer')) {
    map.getSource('place-polygons')?.setData?.(geo.polygons);
    map.getSource('place-centroids')?.setData?.(geo.centroids);
  } else if (map.addSource && map.addLayer) {
    map.addSource('place-polygons', { type: 'geojson', data: geo.polygons });
    map.addLayer({
      id: 'place-fill-layer',
      type: 'fill',
      source: 'place-polygons',
      paint: {
        'fill-color': ['get', 'fill'],
        'fill-opacity': 0.22,
      },
    });
    map.addLayer({
      id: 'place-line-layer',
      type: 'line',
      source: 'place-polygons',
      paint: {
        'line-color': ['get', 'stroke'],
        'line-width': ['get', 'stroke_width'],
        'line-opacity': 0.82,
      },
    });
    map.addSource('place-centroids', { type: 'geojson', data: geo.centroids });
    map.addLayer({
      id: 'place-centroid-layer',
      type: 'circle',
      source: 'place-centroids',
      paint: {
        'circle-radius': 5,
        'circle-color': ['get', 'fill'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    });
    bindLayerEvents();
  }

  if (!hadSelection) {
    map.setCenter?.(INDIA_CENTER);
    map.setZoom?.(4.7);
    forceMapRepaint({ preserveIndiaView: true });
  }

  updateRoleBoxToggleLabel();
  renderRoleCallouts();
}

function buildStatusBar(values, stages) {
  const items = stages.map((stage) => {
    const meta = getStatusMeta(values?.[stage] || 'not_started');
    return `
      <div class="place-progress-item" title="${esc(stage)}: ${esc(meta.label)}">
        <div class="place-progress-segment" style="background:${esc(meta.color)}">
          <span class="place-progress-label">${esc(stage)}</span>
        </div>
        <span class="place-progress-state">${esc(meta.label)}</span>
      </div>
    `;
  }).join('');
  return `<div class="place-progress-bar" style="--progress-columns:${esc(String(stages.length))}">${items}</div>`;
}

function renderDetail(placeUid) {
  const place = getPlaceByUid(placeUid);
  if (!place) {
    els.detailStatus.textContent = 'No place initiative selected yet.';
    els.detailContent.innerHTML = '<div class="vendor-empty-state">Select a place on the map to see the detailed view below.</div>';
    return;
  }
  const locations = getPlaceLocations(placeUid);
  const partners = getPlacePartners(placeUid);
  const lead = partners.find((item) => item.partner_kind === 'lead') || null;
  const partnerRows = partners.filter((item) => item.partner_kind !== 'lead');
  const states = getPlaceStates(locations);
  const documents = getPlaceDocuments(placeUid);
  const spiderSnapshots = getPlaceSpiderSnapshots(placeUid);
  const thematicNeeds = getPlaceTopThematicNeeds(placeUid);
  const cachedMatch = getStoredPartnerMatchCache(placeUid);
  const aiMatch = cachedMatch
    ? { provider: cachedMatch.ai_provider || 'none', groups: getCachedNeedPartnerGroups(placeUid) }
    : placeState.aiNeedMatchCache.get(placeUid);
  const needPartnerGroups = getCachedNeedPartnerGroups(placeUid).length
    ? getCachedNeedPartnerGroups(placeUid)
    : placeState.needPartnerCache.get(placeUid) || [];
  const potentialPartners = Object.keys(getCachedPotentialPartnerGroups(placeUid)).length
    ? getCachedPotentialPartnerGroups(placeUid)
    : placeState.potentialPartnerCache.get(placeUid) || {};
  const isHydrating = !cachedMatch && placeState.detailHydrationInFlight.has(placeUid);

  els.detailStatus.textContent = `${place.initiative_name} covers ${locations.length} location${locations.length === 1 ? '' : 's'} across ${states.length || 1} state context${states.length === 1 ? '' : 's'}.`;
  els.detailContent.innerHTML = `
    <section class="place-detail-row place-detail-row-top">
      <article class="place-detail-card">
        <h4>Locations Covered</h4>
        <p><strong>${esc(place.initiative_name)}</strong></p>
        <p>${esc(states.join(', ') || place.states_covered?.join(', ') || 'India')}</p>
        <div class="place-inline-list">${locations.map((location) => `<span class="innovation-chip">${esc(locationDisplayLabel(location))}</span>`).join('') || '<span class="section-note">No locations added.</span>'}</div>
      </article>
      <article class="place-detail-card">
        <h4>Lead Organisation</h4>
        <p><strong>${renderEntityNameLink(lead?.entity_uid || place.lead_entity_uid, lead?.partner_name || place.lead_name || 'Not listed')}</strong></p>
        <p>${esc(getRoleLabel(lead?.role_slug || place.lead_role_slug, lead?.role_label || place.lead_role_label))}</p>
        <p>${esc(lead?.thematic_area || place.lead_thematic_area || 'No thematic area listed')}</p>
        <p>${lead?.website_url || place.lead_website_url ? `<a href="${esc(lead?.website_url || place.lead_website_url)}" target="_blank" rel="noreferrer">${esc(lead?.website_url || place.lead_website_url)}</a>` : 'No website listed'}</p>
      </article>
      <article class="place-detail-card">
        <h4>Status</h4>
        <div class="place-progress-block">
          <div><strong>SoTH</strong>${buildStatusBar(place.soth_status || getDefaultStatus(SOTH_STAGES), SOTH_STAGES)}</div>
          <div><strong>GramEEE</strong>${buildStatusBar(place.grameee_status || getDefaultStatus(GRAMEEE_STAGES), GRAMEEE_STAGES)}</div>
        </div>
        <div class="btn-group">
          <button class="btn btn-small" type="button" data-open-place="${esc(place.place_uid)}">Update Status</button>
        </div>
      </article>
    </section>
    <section class="place-detail-row place-detail-row-partners">
      <article class="place-detail-row-header">
        <h4>Partner Organisations</h4>
      </article>
      ${partnerRows.length ? partnerRows.map((partner) => `<article class="place-detail-card place-detail-card-compact"><strong>${renderEntityNameLink(partner.entity_uid, partner.partner_name)}</strong><small>${esc(getRoleLabel(partner.role_slug, partner.role_label))}</small><p>${esc(partner.thematic_area || 'No thematic area listed')}</p></article>`).join('') : '<article class="place-detail-card place-detail-card-compact"><p class="section-note">No partner organisations have been linked yet.</p></article>'}
    </section>
    <section class="place-detail-row place-detail-row-needs">
      <article class="place-detail-row-header">
        <h4>Potential Partners by Need</h4>
      </article>
      <article class="place-detail-card place-detail-card-compact">
        <h4>Current Needs</h4>
        ${aiMatch?.provider === 'gemini' || aiMatch?.provider === 'openai'
          ? `<p class="section-note">AI-assisted contextual need grouping is active for this place.</p>`
          : aiMatch?.provider === 'rules'
            ? '<p class="section-note">Project-context semantic grouping is active for this place.</p>'
          : aiMatch?.provider === 'none'
            ? `<p class="section-note">${cachedMatch ? 'Precomputed matching is available for this place.' : 'Initial deterministic grouping is shown for this place.'}</p>`
            : '<p class="section-note">Contextual AI review is loading. Initial grouping is shown until that completes.</p>'}
        ${thematicNeeds.records.length
          ? `<div class="place-need-groups">${dedupeBy(thematicNeeds.records, (item) => normalizeText(`${item.place_name}|${item.recorded_at}`)).map((record) => `<div class="place-need-group"><strong>${esc(record.place_name || place.initiative_name)}</strong><p>${esc(asArray(record.thematic_needs).join(', '))}</p><p class="section-note">Updated: ${esc(formatDateTime(record.recorded_at))}</p></div>`).join('')}</div>`
          : '<p class="section-note">No thematic need updates have been recorded yet.</p>'}
        ${spiderSnapshots.length
          ? `<div class="place-need-groups">${spiderSnapshots.map((snapshot) => `<div class="place-need-group"><strong>${esc(snapshot.place_name || place.initiative_name)}</strong><p>${esc(normalizePlaceMetricSet(snapshot.metrics_json).filter((metric) => metric.key === 'arresting_distress_migration' ? metric.normalized > 50 : metric.normalized < 50).map((metric) => `${metric.label} (${Math.round(metric.normalized)} / 100)`).join(', '))}</p><p class="section-note">Spider chart: ${esc(formatDateTime(snapshot.recorded_at))}</p></div>`).join('')}</div>`
          : '<p class="section-note">No spider chart need signals are available yet.</p>'}
        ${documents.length
          ? `<div class="vendor-inline-list">${documents.map((document) => `<a href="${esc(document.file_url || '#')}" target="_blank" rel="noreferrer">Document - ${esc(document.place_name || place.initiative_name)} - ${esc(formatCompactDate(document.recorded_at))}</a>`).join('')}</div>`
          : '<p class="section-note">No approved place documents are available for this Place yet.</p>'}
      </article>
      <article class="place-detail-card place-detail-card-compact">
        <h4>Potential Partners by Need</h4>
        ${needPartnerGroups.length
          ? `<div class="place-need-groups">${needPartnerGroups.map((group) => `<div class="place-need-group"><strong>${esc(group.sourceName)}</strong><div class="place-need-groups">${group.items.map((item) => `<div class="place-need-group"><strong>${esc(item.needLabel)}</strong><div class="place-inline-list">${item.entities.map((entity) => `<span class="innovation-chip innovation-chip-muted">${renderEntityNameLink(entity.entity_uid, entity.entity_name)} | ${esc(entity.entity_type_label || entity.entity_type_slug || 'Entity')}</span>`).join('')}</div></div>`).join('')}</div></div>`).join('')}</div>`
          : isHydrating
            ? '<p class="section-note">Loading matched partners for this place...</p>'
            : '<p class="section-note">No geography-matched partners were found against the current thematic needs.</p>'}
      </article>
      <article class="place-detail-card place-detail-card-compact">
        <h4>Spider Charts</h4>
        ${spiderSnapshots.length
          ? `<div class="vendor-inline-list">
              ${spiderSnapshots.length > 1 ? `<button class="btn btn-small" type="button" data-open-place-spider-combined="true">View Combined Spider Chart</button>` : ''}
              ${spiderSnapshots.map((snapshot, index) => `<button class="btn btn-small" type="button" data-open-place-spider="${esc(String(index))}">${esc(snapshot.place_name || place.initiative_name)} - ${esc(formatCompactDate(snapshot.recorded_at))}</button>`).join('')}
            </div>`
          : '<p class="section-note">No approved spider charts are available for this Place yet.</p>'}
      </article>
    </section>
    <section class="place-detail-row place-detail-row-potential">
      <article class="place-detail-row-header">
        <h4>Potential Partners By State</h4>
      </article>
      ${Object.entries(potentialPartners).map(([group, entities]) => `<article class="place-detail-card place-detail-card-compact"><h4>${esc(group)}</h4><div class="place-inline-list">${entities.slice(0, 8).map((entity) => `<span class="innovation-chip innovation-chip-muted">${renderEntityNameLink(entity.entity_uid, entity.entity_name)}</span>`).join('') || '<span class="section-note">No entities listed.</span>'}</div></article>`).join('') || `<article class="place-detail-card place-detail-card-compact"><p class="section-note">${isHydrating ? 'Loading geography-matched potential partners...' : 'No geography-matched potential partners were found for this Place.'}</p></article>`}
    </section>
  `;
}

function renderRoleCallouts() {
  const placeUid = placeState.selectedPlaceUid;
  const place = getPlaceByUid(placeUid);
  const shouldShow = Boolean(place && placeState.roleBoxesVisible && placeState.calloutPlaceUid === placeUid);
  if (!place || !placeState.mapReady || !placeState.map?.project || !shouldShow) {
    els.callouts.innerHTML = '';
    updateRoleBoxToggleLabel();
    return;
  }
  const scale = getCalloutScale();
  const key = `${placeUid}:summary`;
  const fallback = { x: 24, y: 24, manual: false };
  const pos = placeState.calloutPositions[key] || fallback;
  const roleSummary = getRolePartnerSummary(placeUid);
  els.callouts.innerHTML = `
    <div class="place-callout place-callout-summary" data-callout-key="${esc(key)}" style="left:${pos.x}px;top:${pos.y}px;transform:scale(${scale})">
      <div class="place-callout-body">
        <div class="place-callout-title-row">
          <strong>${esc(place.initiative_name)}</strong>
          <small>${esc(getPlaceStates(getPlaceLocations(placeUid)).join(', ') || 'India')}</small>
        </div>
        <div class="place-callout-scroll">
          ${roleSummary.map(({ role, matching }) => {
            const hasPartners = matching.length > 0;
            return `
              <div class="place-role-summary-row ${hasPartners ? 'is-present' : 'is-missing'}">
                <strong>${esc(role.label)}</strong>
                <span>${hasPartners ? matching.map((item) => renderEntityNameLink(item.entity_uid, item.partner_name)).join(', ') : 'Partner to be Identified'}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
  updateRoleBoxToggleLabel();
}

function fitToPlace(placeUid) {
  const locations = getPlaceLocations(placeUid).filter((item) => hasUsableCoordinatePair(item));
  if (!placeState.map) return;
  if (!locations.length) {
    const fallback = getPlaceCentroid(getPlaceLocations(placeUid));
    placeState.map.setCenter?.(fallback);
    placeState.map.setZoom?.(6);
    return;
  }
  if (!placeState.map.fitBounds) return;
  const bounds = locations.reduce((acc, item) => {
    acc.minLng = Math.min(acc.minLng, toCoordinate(item.longitude));
    acc.maxLng = Math.max(acc.maxLng, toCoordinate(item.longitude));
    acc.minLat = Math.min(acc.minLat, toCoordinate(item.latitude));
    acc.maxLat = Math.max(acc.maxLat, toCoordinate(item.latitude));
    return acc;
  }, { minLng: 180, maxLng: -180, minLat: 90, maxLat: -90 });
  placeState.map.fitBounds([[bounds.minLng - 0.6, bounds.minLat - 0.6], [bounds.maxLng + 0.6, bounds.maxLat + 0.6]], { padding: 84, duration: 700 });
}

function fillEditor(placeUid) {
  const place = getPlaceByUid(placeUid);
  if (!place) return;
  const locations = getPlaceLocations(placeUid);
  const partners = getPlacePartners(placeUid);
  const lead = partners.find((item) => item.partner_kind === 'lead') || null;
  const partnerRows = partners.filter((item) => item.partner_kind !== 'lead');

  els.placeId.value = place.id || '';
  els.placeUid.value = place.place_uid || '';
  els.placeName.value = place.initiative_name || '';
  renderLocationList(locations);

  els.leadOrgSearch.value = lead?.partner_name || place.lead_name || '';
  els.leadOrgName.value = lead?.partner_name || place.lead_name || '';
  els.leadOrgName.dataset.entityUid = lead?.entity_uid || place.lead_entity_uid || '';
  els.leadOrgName.dataset.entityTypeSlug = lead?.entity_type_slug || place.lead_entity_type_slug || '';
  els.leadOrgRole.value = lead?.role_slug || place.lead_role_slug || placeState.placeRoleTypes[0]?.slug || 'cso';
  els.leadRoleCustom.value = lead?.role_label || place.lead_role_label || '';
  syncCustomRoleVisibility(els.leadOrgRole, els.leadRoleCustomGroup);
  els.leadOrgWebsite.value = lead?.website_url || place.lead_website_url || '';
  els.leadOrgTheme.value = lead?.thematic_area || place.lead_thematic_area || '';
  updateLeadCardSummary();
  setLeadCardExpanded(false);

  els.partnerList.innerHTML = '';
  partnerRows.forEach((partner) => addPartnerRow(partner, { expanded: false }));
  if (!partnerRows.length) addPartnerRow({}, { expanded: true });

  fillStatusGroup('soth', SOTH_STAGES, place.soth_status || getDefaultStatus(SOTH_STAGES));
  fillStatusGroup('grameee', GRAMEEE_STAGES, place.grameee_status || getDefaultStatus(GRAMEEE_STAGES));
}

function resetEditor() {
  els.form.reset();
  els.placeId.value = '';
  els.placeUid.value = '';
  clearLeadSelection();
  renderLocationList([]);
  els.partnerList.innerHTML = '';
  addPartnerRow({}, { expanded: true });
  fillStatusGroup('soth', SOTH_STAGES, getDefaultStatus(SOTH_STAGES));
  fillStatusGroup('grameee', GRAMEEE_STAGES, getDefaultStatus(GRAMEEE_STAGES));
  syncCustomRoleVisibility(els.leadOrgRole, els.leadRoleCustomGroup);
  updateLeadCardSummary();
  setLeadCardExpanded(false);
}

function selectPlace(placeUid, options = {}) {
  placeState.selectedPlaceUid = placeUid;
  if (options.resetCalloutLayout) clearAutoCalloutPositions(placeUid);
  renderDetail(placeUid);
  if (!getStoredPartnerMatchCache(placeUid)) schedulePlaceDetailHydration(placeUid);
  fillEditor(placeUid);
  renderMap();
  renderRoleCallouts();
  updateRoleBoxToggleLabel();
  if (options.fit) fitToPlace(placeUid);
}

async function verifySession() {
  const token = getStoredToken();
  if (!token) {
    setEditorEnabled(false);
    return false;
  }
  try {
    const data = await window.EcosystemStore.adminRequest('verify', { token });
    if (!data?.valid) throw new Error('Invalid session');
    placeState.adminToken = token;
    setEditorEnabled(true);
    setStatus(els.adminStatus, 'Admin session is active.');
    return true;
  } catch {
    setStoredToken('');
    placeState.adminToken = '';
    setEditorEnabled(false);
    setStatus(els.adminStatus, 'Admin session expired. Sign in again.', true);
    return false;
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const password = els.adminPassword.value.trim();
  if (!password) {
    setStatus(els.adminStatus, 'Enter the admin password.', true);
    return;
  }
  setStatus(els.adminStatus, 'Signing in...');
  try {
    const data = await window.EcosystemStore.adminRequest('login', { password });
    if (!data?.token) throw new Error('Login failed.');
    setStoredToken(data.token);
    placeState.adminToken = data.token;
    els.adminPassword.value = '';
    setEditorEnabled(true);
    setStatus(els.adminStatus, 'Admin session is active.');
  } catch (error) {
    setStatus(els.adminStatus, error.message || 'Login failed.', true);
  }
}

async function handleAdminLogout() {
  try {
    const token = getStoredToken();
    if (token) await window.EcosystemStore.adminRequest('logout', { token });
  } catch {}
  setStoredToken('');
  placeState.adminToken = '';
  setEditorEnabled(false);
  setStatus(els.adminStatus, 'Signed out.');
}

async function handleSyncPlacePartnerMatches(scope = 'selected') {
  if (!placeState.adminEnabled) {
    setStatus(els.matchSyncStatus, 'Sign in through Admin Sync to refresh partner mapping.', true);
    return;
  }
  if (scope === 'selected' && !placeState.selectedPlaceUid) {
    setStatus(els.matchSyncStatus, 'Select a place first, or use Sync All Places.', true);
    return;
  }
  setStatus(
    els.matchSyncStatus,
    scope === 'all'
      ? 'Refreshing partner mapping cache for all places...'
      : 'Refreshing partner mapping cache for the selected place...'
  );
  try {
    const response = await window.EcosystemStore.adminRequest('syncPlacePartnerMatches', {
      token: placeState.adminToken || getStoredToken(),
      placeUid: scope === 'selected' ? placeState.selectedPlaceUid : '',
      scope,
    });
    const selectedPlaceUid = placeState.selectedPlaceUid;
    await initializePageData();
    if (selectedPlaceUid && getPlaceByUid(selectedPlaceUid)) selectPlace(selectedPlaceUid, { fit: false });
    setStatus(
      els.matchSyncStatus,
      scope === 'all'
        ? `Partner mapping cache refreshed for ${Number(response?.syncedCount || 0)} place${Number(response?.syncedCount || 0) === 1 ? '' : 's'}.`
        : 'Partner mapping cache refreshed for the selected place.'
    );
  } catch (error) {
    setStatus(els.matchSyncStatus, error.message || 'Partner mapping cache refresh failed.', true);
  }
}

async function loadLocationDatasets() {
  try {
    const remoteReady = await probeSupabaseLocationSearch();
    if (!remoteReady) await useLocalLocationFallback();
  } catch (error) {
    try {
      await useLocalLocationFallback();
    } catch {
      setStatus(els.saveStatus, error.message || 'Official LGD place dataset could not be loaded for autocomplete.', true);
    }
  }
}

function readPlacePayload() {
  const initiativeName = els.placeName.value.trim();
  const locations = getEditorLocations();
  const lead = getSelectedLeadPayload();
  return {
    place_uid: els.placeUid.value.trim() || '',
    initiative_name: initiativeName,
    locations,
    lead,
    partners: getPartnerPayloads(),
    soth_status: readStatusGroup('soth', SOTH_STAGES),
    grameee_status: readStatusGroup('grameee', GRAMEEE_STAGES),
  };
}

async function handleSavePlace(event) {
  event.preventDefault();
  if (!placeState.adminEnabled) {
    setStatus(els.saveStatus, 'Sign in through Admin Sync to edit this page.', true);
    return;
  }
  const payload = readPlacePayload();
  if (!payload.initiative_name) {
    setStatus(els.saveStatus, 'Place initiative name is required.', true);
    return;
  }
  if (!payload.locations.length) {
    setStatus(els.saveStatus, 'Add at least one location.', true);
    return;
  }
  if (!payload.lead.name) {
    setStatus(els.saveStatus, 'Lead organisation or individual is required.', true);
    return;
  }
  setStatus(els.saveStatus, 'Saving place initiative...');
  try {
    await window.EcosystemStore.adminRequest('upsertPlaceInitiative', {
      token: placeState.adminToken || getStoredToken(),
      place: payload,
    });
    await initializePageData();
    const selected = payload.place_uid || placeState.placeInitiatives.find((item) => item.initiative_name === payload.initiative_name)?.place_uid || placeState.selectedPlaceUid;
    if (selected) selectPlace(selected, { fit: true, resetCalloutLayout: true });
    setStatus(els.saveStatus, 'Place initiative saved.');
  } catch (error) {
    setStatus(els.saveStatus, error.message || 'Save failed.', true);
  }
}

async function handleDeletePlace() {
  if (!placeState.adminEnabled) {
    setStatus(els.saveStatus, 'Sign in through Admin Sync to edit this page.', true);
    return;
  }
  const placeUid = els.placeUid.value.trim() || placeState.selectedPlaceUid;
  if (!placeUid) {
    setStatus(els.saveStatus, 'Select a place first.', true);
    return;
  }
  setStatus(els.saveStatus, 'Deleting place initiative...');
  try {
    await window.EcosystemStore.adminRequest('deletePlaceInitiative', {
      token: placeState.adminToken || getStoredToken(),
      placeUid,
    });
    resetEditor();
    await initializePageData();
    if (placeState.placeInitiatives[0]?.place_uid) selectPlace(placeState.placeInitiatives[0].place_uid, { fit: true });
    setStatus(els.saveStatus, 'Place initiative deleted.');
  } catch (error) {
    setStatus(els.saveStatus, error.message || 'Delete failed.', true);
  }
}

async function initializePageData() {
  setStatus(els.mapStatus, 'Loading place initiatives, entities, and role metadata...');
  const data = await window.EcosystemStore.loadPlaceInitiativesData();
  placeState.entityTypes = Array.isArray(data.entityTypes) ? data.entityTypes : [];
  placeState.entities = Array.isArray(data.entities) ? data.entities : [];
  placeState.placeInitiatives = Array.isArray(data.placeInitiatives) ? data.placeInitiatives : [];
  placeState.placeLocations = Array.isArray(data.placeLocations) ? data.placeLocations : [];
  placeState.placePartners = Array.isArray(data.placePartners) ? data.placePartners : [];
  placeState.placeRoleTypes = Array.isArray(data.placeRoleTypes) ? data.placeRoleTypes : [];
  placeState.placeDocuments = Array.isArray(data.placeDocuments) ? data.placeDocuments : [];
  placeState.placeSpiderSnapshots = Array.isArray(data.placeSpiderSnapshots) ? data.placeSpiderSnapshots : [];
  placeState.placeThematicNeeds = Array.isArray(data.placeThematicNeeds) ? data.placeThematicNeeds : [];
  placeState.partnerMatchCache = new Map(
    (Array.isArray(data.placePartnerMatchCache) ? data.placePartnerMatchCache : [])
      .filter((item) => item?.place_uid)
      .map((item) => [item.place_uid, item])
  );
  placeState.needPartnerCache.clear();
  placeState.potentialPartnerCache.clear();
  placeState.aiNeedMatchCache.clear();
  placeState.aiNeedMatchInFlight.clear();
  placeState.detailHydrationInFlight.clear();
  placeState.locationLookupMode = 'unknown';
  placeState.placeRoleTypes.sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
  ensureRoleOptions();
  setStatus(els.mapStatus, `Loaded ${placeState.placeInitiatives.length} place initiative${placeState.placeInitiatives.length === 1 ? '' : 's'} across India.`);
}

function bindEvents() {
  buildStatusEditor(els.sothGrid, SOTH_STAGES, 'soth');
  buildStatusEditor(els.grameeeGrid, GRAMEEE_STAGES, 'grameee');
  resetEditor();

  document.getElementById('toggle-admin-sync').addEventListener('click', () => {
    els.adminPanel.hidden = !els.adminPanel.hidden;
  });
  document.getElementById('place-admin-login-form').addEventListener('submit', handleAdminLogin);
  document.getElementById('place-admin-logout').addEventListener('click', handleAdminLogout);
  document.getElementById('sync-selected-place-matches').addEventListener('click', () => handleSyncPlacePartnerMatches('selected'));
  document.getElementById('sync-all-place-matches').addEventListener('click', () => handleSyncPlacePartnerMatches('all'));
  document.getElementById('add-partner-row').addEventListener('click', () => addPartnerRow({}, { expanded: true }));
  document.getElementById('new-place').addEventListener('click', () => {
    placeState.selectedPlaceUid = '';
    resetEditor();
    setStatus(els.saveStatus, '');
  });
  document.getElementById('delete-place').addEventListener('click', handleDeletePlace);
  els.toggleLeadCard.addEventListener('click', () => {
    if (!els.leadCard) return;
    setLeadCardExpanded(!els.leadCard.classList.contains('is-expanded'));
  });
  els.toggleRoleBoxes.addEventListener('click', () => {
    if (!placeState.selectedPlaceUid) return;
    placeState.roleBoxesVisible = !placeState.roleBoxesVisible;
    placeState.calloutPlaceUid = placeState.roleBoxesVisible ? placeState.selectedPlaceUid : '';
    renderRoleCallouts();
  });
  document.getElementById('edit-selected-place').addEventListener('click', () => {
    const placeUid = placeState.selectedPlaceUid;
    if (!placeUid) return;
    fillEditor(placeUid);
    document.querySelector('.place-editor-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('print-place-view').addEventListener('click', async () => {
    await preparePrintView();
    window.print();
  });
  els.form.addEventListener('submit', handleSavePlace);

  els.leadOrgRole.addEventListener('change', () => syncCustomRoleVisibility(els.leadOrgRole, els.leadRoleCustomGroup));
  els.leadOrgName.addEventListener('input', clearLeadSelection);
  ['input', 'change'].forEach((eventName) => {
    els.leadOrgName.addEventListener(eventName, updateLeadCardSummary);
    els.leadOrgRole.addEventListener(eventName, updateLeadCardSummary);
    els.leadRoleCustom.addEventListener(eventName, updateLeadCardSummary);
  });

  els.locationSearch.addEventListener('input', async () => {
    const query = els.locationSearch.value;
    const matches = await getLocationSuggestionMatches(query);
    if (query !== els.locationSearch.value) return;
    placeState.pendingLocationSuggestion = matches;
    placeState.pendingLocationSelectionKey = matches.length === 1 ? normalizeText(`${matches[0].location_kind}|${matches[0].display_label}`) : '';
    renderLocationSuggestions(matches);
  });
  els.locationSuggestions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-location-suggestion]');
    if (!button) return;
    const item = placeState.pendingLocationSuggestion?.[Number(button.dataset.locationSuggestion)];
    placeState.pendingLocationSelectionKey = button.dataset.locationSelectionKey || '';
    addLocationFromSelection(item);
  });
  els.locationSearch.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const item = placeState.pendingLocationSuggestion?.[0];
    const selectionKey = item ? normalizeText(`${item.location_kind}|${item.display_label}`) : '';
    if (item && selectionKey === placeState.pendingLocationSelectionKey) {
      addLocationFromSelection(item);
    }
  });
  document.getElementById('add-place-location').addEventListener('click', () => {
    const item = placeState.pendingLocationSuggestion?.[0];
    const selectionKey = item ? normalizeText(`${item.location_kind}|${item.display_label}`) : '';
    if (item && selectionKey === placeState.pendingLocationSelectionKey) {
      addLocationFromSelection(item);
      return;
    }
    setStatus(els.saveStatus, 'Select an exact location from the suggestion list before adding it.', true);
  });

  els.locationList.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove-location]');
    if (!removeButton) return;
    const index = Number(removeButton.dataset.removeLocation);
    const next = getEditorLocations().filter((_, itemIndex) => itemIndex !== index);
    renderLocationList(next);
  });

  els.leadOrgSearch.addEventListener('input', () => {
    const matches = getEntitySuggestionMatches(els.leadOrgSearch.value);
    placeState.pendingLeadSuggestion = matches;
    renderLeadSuggestions(matches);
  });
  els.leadOrgSuggestions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-lead-entity]');
    if (!button) return;
    const entity = placeState.entities.find((item) => item.entity_uid === button.dataset.leadEntity);
    if (entity) fillLeadFromEntity(entity);
  });

  els.partnerList.addEventListener('click', (event) => {
    const toggleButton = event.target.closest('[data-toggle-partner]');
    if (toggleButton) {
      const row = els.partnerList.querySelector(`[data-partner-row="${CSS.escape(toggleButton.dataset.togglePartner)}"]`);
      if (row) setPartnerCardExpanded(row, !row.classList.contains('is-expanded'));
      return;
    }
    const removeButton = event.target.closest('[data-remove-partner]');
    if (removeButton) {
      els.partnerList.querySelector(`[data-partner-row="${CSS.escape(removeButton.dataset.removePartner)}"]`)?.remove();
      if (!els.partnerList.querySelector('[data-partner-row]')) addPartnerRow({}, { expanded: true });
      return;
    }
    const suggestionButton = event.target.closest('[data-partner-entity]');
    if (suggestionButton) {
      const rowId = suggestionButton.dataset.partnerRow;
      const entity = placeState.entities.find((item) => item.entity_uid === suggestionButton.dataset.partnerEntity);
      if (rowId && entity) fillPartnerFromEntity(rowId, entity);
    }
  });

  els.partnerList.addEventListener('input', (event) => {
    const row = event.target.closest('[data-partner-row]');
    if (row) updatePartnerCardSummary(row);
    const searchInput = event.target.closest('[data-partner-search]');
    if (searchInput) {
      const rowId = searchInput.dataset.partnerSearch;
      const matches = getEntitySuggestionMatches(searchInput.value);
      placeState.pendingPartnerSuggestions.set(rowId, matches);
      const box = els.partnerList.querySelector(`[data-partner-suggestions="${CSS.escape(rowId)}"]`);
      renderSuggestionBox(box, matches, (entity) => `<button type="button" class="place-suggestion-item" data-partner-row="${esc(rowId)}" data-partner-entity="${esc(entity.entity_uid)}"><strong>${esc(entity.entity_name)}</strong><small>${esc(entity.entity_type_label || entity.entity_type_slug)} | ${esc(entity.state || entity.location_label || 'India')}</small></button>`);
      return;
    }
    const roleSelect = event.target.closest('[data-partner-role]');
    if (roleSelect) {
      syncCustomRoleVisibility(roleSelect, roleSelect.closest('[data-partner-row]')?.querySelector('[data-partner-custom-group]'));
      updatePartnerCardSummary(roleSelect.closest('[data-partner-row]'));
    }
  });

  els.detailContent.addEventListener('click', (event) => {
    const combinedSpiderButton = event.target.closest('[data-open-place-spider-combined]');
    if (combinedSpiderButton) {
      const placeUid = placeState.selectedPlaceUid;
      const place = getPlaceByUid(placeUid);
      const snapshots = getPlaceSpiderSnapshots(placeUid);
      if (place && snapshots.length) openSpiderChartModal(place, snapshots);
      return;
    }
    const spiderButton = event.target.closest('[data-open-place-spider]');
    if (spiderButton) {
      const placeUid = placeState.selectedPlaceUid;
      const place = getPlaceByUid(placeUid);
      const snapshot = getPlaceSpiderSnapshots(placeUid)[Number(spiderButton.dataset.openPlaceSpider)];
      if (place && snapshot) openSpiderChartModal(place, snapshot);
      return;
    }
    const button = event.target.closest('[data-open-place]');
    if (!button) return;
    selectPlace(button.dataset.openPlace, { fit: true });
    document.querySelector('.place-editor-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.querySelectorAll('[data-close-place-modal]').forEach((button) => {
    button.addEventListener('click', closeSpiderChartModal);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeSpiderChartModal();
  });

  els.callouts.addEventListener('pointerdown', (event) => {
    const card = event.target.closest('[data-callout-key]');
    if (!card) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const key = card.dataset.calloutKey;
    const left = parseFloat(card.style.left || '0');
    const top = parseFloat(card.style.top || '0');
    placeState.roleDragState = { key, startX, startY, left, top };
    card.setPointerCapture?.(event.pointerId);
  });
  els.callouts.addEventListener('pointermove', (event) => {
    if (!placeState.roleDragState) return;
    const { key, startX, startY, left, top } = placeState.roleDragState;
    placeState.calloutPositions[key] = {
      x: Math.max(0, left + (event.clientX - startX)),
      y: Math.max(0, top + (event.clientY - startY)),
      manual: true,
    };
    renderRoleCallouts();
  });
  els.callouts.addEventListener('pointerup', () => {
    placeState.roleDragState = null;
  });
  els.callouts.addEventListener('pointercancel', () => {
    placeState.roleDragState = null;
  });

  window.addEventListener('resize', () => renderRoleCallouts());
  window.addEventListener('beforeprint', () => {
    preparePrintView();
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('is-print-prep');
    forceMapRepaint({ preserveIndiaView: false });
    renderRoleCallouts();
  });
}

async function init() {
  bindEvents();
  await Promise.allSettled([verifySession(), loadLocationDatasets()]);
  try {
    await initializePageData();
    await renderMap();
    renderDetail('');
    updateRoleBoxToggleLabel();
  } catch (error) {
    setStatus(els.mapStatus, error.message || 'This page could not be loaded.', true);
    els.detailContent.innerHTML = `<article class="admin-card"><p>${esc(els.mapStatus.textContent)}</p></article>`;
  }
}

init();
