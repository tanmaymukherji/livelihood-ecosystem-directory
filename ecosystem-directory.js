const directoryState = {
  entityTypes: [],
  entities: [],
  fieldDefinitions: [],
  filteredEntities: [],
  currentPage: 1,
  pageSize: 12,
  hasSearched: false,
  geocodeCache: new Map(),
  map: null,
  mapReady: false,
  mapLoadPromise: null,
  markers: [],
  selectedEntityUid: null,
};

const INDIA_CENTER = { lat: 22.9734, lng: 78.6569 };
const SEARCH_STATE_KEY = 'livelihood_ecosystem_search_state_v2';
const searchEls = {
  keyword: document.getElementById('search-keyword'),
  location: document.getElementById('search-location'),
};
const resultsEl = document.getElementById('entity-results');
const mapListEl = document.getElementById('map-results-list');
const statusEl = document.getElementById('directory-status');
const resultsSummaryEl = document.getElementById('results-summary');
const submissionStatusEl = document.getElementById('submission-status');
const submissionDynamicFieldsEl = document.getElementById('submission-dynamic-fields');
const submissionTypeEl = document.getElementById('submission-entity-type');
const submissionFieldGroups = {
  name: document.getElementById('submission-name-group'),
  location: document.getElementById('submission-location-group'),
  email: document.getElementById('submission-email-group'),
  phone: document.getElementById('submission-phone-group'),
  website: document.getElementById('submission-website-group'),
  summary: document.getElementById('submission-summary-group'),
  social: document.getElementById('submission-social-links-group'),
  office: document.getElementById('submission-office-locations-group'),
};
const submissionPlaceToolsEl = document.getElementById('submission-place-tools');
const submissionAddPlaceDocumentEl = document.getElementById('submission-add-place-document');
const submissionPlaceDocumentBlockEl = document.getElementById('submission-place-document-block');
const submissionAddPlaceSpiderEl = document.getElementById('submission-add-place-spider');
const submissionPlaceSpiderBlockEl = document.getElementById('submission-place-spider-block');
const submissionPlaceMetricGridEl = document.getElementById('submission-place-metric-grid');
const submissionAddPlaceNeedsEl = document.getElementById('submission-add-place-needs');
const submissionPlaceNeedsBlockEl = document.getElementById('submission-place-needs-block');
const paginationEls = [
  document.getElementById('results-pagination-top'),
  document.getElementById('results-pagination-bottom'),
];

const {
  esc,
  parseSocialLinks,
  parseOfficeLocations,
  renderDynamicFields,
  collectDynamicFieldValues,
} = window.EcosystemForms;

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
const PLACE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function tokenize(value) {
  return normalizeText(value).split(/[^a-z0-9]+/).filter(Boolean);
}

function flattenTypeSpecificValues(value) {
  if (Array.isArray(value)) return value.flatMap((item) => flattenTypeSpecificValues(item));
  if (value && typeof value === 'object') return Object.values(value).flatMap((item) => flattenTypeSpecificValues(item));
  return value ? [String(value)] : [];
}

function setStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = message || '';
  element.classList.toggle('error', Boolean(isError));
}

function getEntityTypeMap() {
  return new Map(directoryState.entityTypes.map((type) => [type.type_slug, type]));
}

function getEntityTypeMeta(typeSlug) {
  return getEntityTypeMap().get(typeSlug) || {
    type_slug: typeSlug,
    label: typeSlug,
    color_hex: '#1f4b6e',
    entity_kind: 'organisation',
  };
}

function buildTypeCheckboxes() {
  const container = document.getElementById('entity-type-filters');
  if (!container || !submissionTypeEl) return;
  container.innerHTML = '';
  submissionTypeEl.innerHTML = '';
  const sortedTypes = [...directoryState.entityTypes].sort((left, right) => String(left.label || left.type_slug || '').localeCompare(String(right.label || right.type_slug || ''), undefined, { sensitivity: 'base' }));
  sortedTypes.forEach((type) => {
    const checkbox = document.createElement('label');
    checkbox.className = 'checkbox-card';
    checkbox.innerHTML = `
      <input type="checkbox" value="${esc(type.type_slug)}" />
      <span class="checkbox-card-meta">
        <span class="type-swatch" style="background:${esc(type.color_hex || '#1f4b6e')}"></span>
        <span><strong>${esc(type.label)}</strong><small>${esc(type.entity_kind || 'entity')}</small></span>
      </span>
    `;
    container.appendChild(checkbox);

    const option = document.createElement('option');
    option.value = type.type_slug;
    option.textContent = type.label;
    submissionTypeEl.appendChild(option);
  });
}

function renderSubmissionDynamicFields() {
  renderDynamicFields(
    submissionDynamicFieldsEl,
    directoryState.fieldDefinitions,
    submissionTypeEl.value,
    {},
    'submission-dynamic'
  );
  syncSubmissionFormForType();
}

function isPlaceSubmissionType() {
  return String(submissionTypeEl?.value || '') === 'place';
}

function updateRequiredState(input, required) {
  if (!input) return;
  if (required) input.setAttribute('required', 'required');
  else input.removeAttribute('required');
}

function renderPlaceMetricInputs() {
  if (!submissionPlaceMetricGridEl) return;
  submissionPlaceMetricGridEl.innerHTML = PLACE_SPIDER_METRICS.map((metric) => `
    <div class="place-metric-row">
      <div>
        <strong>${esc(metric.label)}</strong>
        <small>Normalized later to 100 using score / max score.</small>
      </div>
      <input type="number" min="0" step="any" data-submission-place-score="${esc(metric.key)}" placeholder="Score" />
      <input type="number" min="1" step="any" data-submission-place-max="${esc(metric.key)}" value="${esc(metric.defaultMax)}" placeholder="Max score" />
    </div>
  `).join('');
}

function parseLineList(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function syncSubmissionFormForType() {
  const isPlace = isPlaceSubmissionType();
  Object.values(submissionFieldGroups).forEach((group) => {
    if (group) group.hidden = isPlace;
  });
  if (submissionPlaceToolsEl) submissionPlaceToolsEl.hidden = !isPlace;
  updateRequiredState(document.getElementById('submission-name'), !isPlace);
  updateRequiredState(document.getElementById('submission-location'), !isPlace);
  if (!isPlace) {
    if (submissionAddPlaceDocumentEl) submissionAddPlaceDocumentEl.checked = false;
    if (submissionAddPlaceSpiderEl) submissionAddPlaceSpiderEl.checked = false;
    if (submissionAddPlaceNeedsEl) submissionAddPlaceNeedsEl.checked = false;
  }
  if (submissionPlaceDocumentBlockEl) submissionPlaceDocumentBlockEl.hidden = !isPlace || !submissionAddPlaceDocumentEl?.checked;
  if (submissionPlaceSpiderBlockEl) submissionPlaceSpiderBlockEl.hidden = !isPlace || !submissionAddPlaceSpiderEl?.checked;
  if (submissionPlaceNeedsBlockEl) submissionPlaceNeedsBlockEl.hidden = !isPlace || !submissionAddPlaceNeedsEl?.checked;
}

function buildPlaceSubmissionValues(typeSpecificData) {
  const placeKind = String(typeSpecificData.place_kind || '').trim();
  const villageName = String(typeSpecificData.village_name || '').trim();
  const gramPanchayatName = String(typeSpecificData.gram_panchayat_name || '').trim();
  const blockName = String(typeSpecificData.block_name || '').trim();
  const districtName = String(typeSpecificData.district_name || '').trim();
  const stateName = String(typeSpecificData.state_name || '').trim();
  const baseName = villageName || gramPanchayatName || blockName || districtName || stateName;
  return {
    entity_name: baseName ? [baseName, placeKind].filter(Boolean).join(' | ') : '',
    location_label: [baseName, placeKind].filter(Boolean).join(' | '),
    primary_address: [villageName, gramPanchayatName, blockName, districtName, stateName, 'India'].filter(Boolean).join(', '),
    contact_email: '',
    contact_phone: '',
    website_url: '',
    summary: '',
    social_media: {},
    office_locations: [],
  };
}

function collectPlaceSpiderMetricsFromSubmission() {
  return Object.fromEntries(PLACE_SPIDER_METRICS.map((metric) => {
    const scoreInput = document.querySelector(`[data-submission-place-score="${metric.key}"]`);
    const maxInput = document.querySelector(`[data-submission-place-max="${metric.key}"]`);
    return [metric.key, {
      score: Number(scoreInput?.value || 0),
      max_score: Number(maxInput?.value || metric.defaultMax || 5),
    }];
  }));
}

async function readFileAsBase64(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
}

function getSelectedTypeSlugs() {
  return Array.from(document.querySelectorAll('#entity-type-filters input[type="checkbox"]:checked')).map((input) => input.value);
}

function persistSearchState() {
  const snapshot = {
    search: {
      keyword: searchEls.keyword.value,
      location: searchEls.location.value,
      types: getSelectedTypeSlugs(),
    },
    currentPage: directoryState.currentPage,
    hasSearched: directoryState.hasSearched,
    selectedEntityUid: directoryState.selectedEntityUid,
  };
  try {
    window.sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(snapshot));
  } catch {}
}

function restoreSearchState() {
  try {
    const raw = window.sessionStorage.getItem(SEARCH_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function applySearchSnapshot(snapshot) {
  if (!snapshot?.search) return;
  searchEls.keyword.value = String(snapshot.search.keyword || '');
  searchEls.location.value = String(snapshot.search.location || '');
  const selected = new Set(Array.isArray(snapshot.search.types) ? snapshot.search.types : []);
  document.querySelectorAll('#entity-type-filters input[type="checkbox"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
  directoryState.currentPage = Number(snapshot.currentPage || 1);
  directoryState.selectedEntityUid = snapshot.selectedEntityUid || null;
}

function getPrimaryLocationLabel(entity) {
  return entity.location_label || entity.primary_address || [entity.district, entity.state, entity.country].filter(Boolean).join(', ') || 'Location not listed';
}

function hasUsableCoordinate(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001);
}

function buildSearchIndex(entity) {
  return {
    type: normalizeText(entity.entity_type_label || entity.entity_type_slug),
    keyword: [
      entity.entity_name,
      entity.summary,
      entity.description,
      entity.location_label,
      entity.primary_address,
      entity.district,
      entity.state,
      entity.country,
      entity.contact_email,
      entity.contact_phone,
      entity.website_url,
      (entity.tags || []).join(' '),
      (entity.keywords || []).join(' '),
      flattenTypeSpecificValues(entity.type_specific_data || {}).join(' '),
      entity.search_text,
    ].map(normalizeText).join(' '),
    location: [
      entity.location_label,
      entity.primary_address,
      entity.district,
      entity.state,
      entity.country,
      ...(entity.office_locations || []),
      ...flattenTypeSpecificValues((entity.type_specific_data || {}).geography_served || []),
    ].map(normalizeText).join(' '),
  };
}

function scoreAgainstTokens(haystack, tokens, weight) {
  if (!tokens.length) return 0;
  let score = 0;
  for (const token of tokens) {
    if (!haystack.includes(token)) return null;
    score += haystack === token ? weight * 3 : haystack.startsWith(token) ? weight * 2 : weight;
  }
  return score;
}

function getFilters() {
  const keyword = normalizeText(searchEls.keyword.value);
  const location = normalizeText(searchEls.location.value);
  return {
    keywordPhrase: keyword,
    locationPhrase: location,
    keywordTokens: tokenize(keyword),
    locationTokens: tokenize(location),
    typeSlugs: getSelectedTypeSlugs(),
  };
}

function hasAnyFilter(filters) {
  return Boolean(filters.keywordTokens.length || filters.locationTokens.length || filters.typeSlugs.length);
}

function scoreEntity(entity, filters) {
  const index = entity._searchIndex || (entity._searchIndex = buildSearchIndex(entity));
  let score = 0;
  if (filters.typeSlugs.length && !filters.typeSlugs.includes(entity.entity_type_slug)) return null;
  const locationScore = scoreAgainstTokens(index.location, filters.locationTokens, 12);
  if (locationScore === null) return null;
  score += locationScore;
  const keywordScore = scoreAgainstTokens(index.keyword, filters.keywordTokens, 10);
  if (keywordScore === null) return null;
  score += keywordScore;
  if (filters.keywordPhrase && index.keyword.includes(filters.keywordPhrase)) score += 30;
  if (filters.locationPhrase && index.location.includes(filters.locationPhrase)) score += 18;
  if (entity.contact_email) score += 2;
  if (entity.contact_phone) score += 2;
  if (entity.latitude && entity.longitude) score += 4;
  return score;
}

function setCounts() {
  document.getElementById('entity-total-count').textContent = String(directoryState.entities.length);
  document.getElementById('type-total-count').textContent = String(directoryState.entityTypes.length);
  document.getElementById('filtered-entity-count').textContent = String(directoryState.filteredEntities.length);
}

function getPageCount() {
  return Math.max(1, Math.ceil(directoryState.filteredEntities.length / directoryState.pageSize));
}

function getPageResults() {
  const start = (directoryState.currentPage - 1) * directoryState.pageSize;
  return directoryState.filteredEntities.slice(start, start + directoryState.pageSize);
}

function setSelectedEntity(entityUid) {
  directoryState.selectedEntityUid = entityUid || null;
  document.querySelectorAll('[data-entity-card]').forEach((card) => {
    card.classList.toggle('active', card.dataset.entityCard === entityUid);
  });
  document.querySelectorAll('[data-focus-entity]').forEach((item) => {
    item.classList.toggle('active', item.dataset.focusEntity === entityUid);
  });
}

function focusEntity(entityUid, options = {}) {
  if (!entityUid) return;
  setSelectedEntity(entityUid);
  persistSearchState();
  if (!options.scroll) return;
  const escapedId = window.CSS?.escape ? window.CSS.escape(entityUid) : entityUid.replace(/"/g, '\\"');
  const card = document.querySelector(`[data-entity-card="${escapedId}"]`);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function ensureMapCss() {
  if (document.getElementById('mappls-web-sdk-css')) return;
  const link = document.createElement('link');
  link.id = 'mappls-web-sdk-css';
  link.rel = 'stylesheet';
  link.href = 'https://apis.mappls.com/vector_map/assets/v3.5/mappls-glob.css';
  document.head.appendChild(link);
}

async function loadMapSdk() {
  const key = String(window.APP_CONFIG?.MAPMYINDIA_MAP_KEY || '').trim();
  if (!key) {
    document.getElementById('results-map').innerHTML = '<div class="vendor-map-placeholder">Update `MAPMYINDIA_MAP_KEY` in `config.js` to enable the map.</div>';
    return false;
  }
  if (window.mappls?.Map) return true;
  ensureMapCss();
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
  document.getElementById('results-map').innerHTML = '<div class="vendor-map-placeholder">The MapmyIndia SDK could not be loaded for this page.</div>';
  return false;
}

async function ensureMap() {
  if (directoryState.mapReady && directoryState.map) return true;
  if (directoryState.map) {
    directoryState.mapReady = true;
    return true;
  }
  if (directoryState.mapLoadPromise) return directoryState.mapLoadPromise;
  const loaded = await loadMapSdk();
  if (!loaded || !window.mappls?.Map) return false;
  directoryState.mapLoadPromise = Promise.resolve().then(() => {
    directoryState.map = new window.mappls.Map('results-map', {
      center: INDIA_CENTER,
      zoom: 4.8,
      zoomControl: true,
      geolocation: false,
      location: false,
    });
    enableMapInteractions(directoryState.map);
    directoryState.mapReady = true;
    return true;
  });
  return directoryState.mapLoadPromise;
}

async function geocodeEntity(entity) {
  const cacheKey = entity.entity_uid;
  if (directoryState.geocodeCache.has(cacheKey)) return directoryState.geocodeCache.get(cacheKey);
  const lat = Number(entity.latitude);
  const lng = Number(entity.longitude);
  if (hasUsableCoordinate(lat, lng)) {
    const point = { lat, lng };
    directoryState.geocodeCache.set(cacheKey, point);
    return point;
  }
  // Public browser geocoding is intentionally disabled because third-party
  // geocoders are blocked by CORS in production. Coordinates should be
  // backfilled and persisted via admin/import workflows instead.
  directoryState.geocodeCache.set(cacheKey, null);
  return null;
}

function clearMapMarkers() {
  directoryState.markers.forEach((marker) => marker?.remove?.());
  directoryState.markers = [];
}

function enableMapInteractions(mapInstance) {
  if (!mapInstance) return;
  mapInstance.dragPan?.enable?.();
  mapInstance.scrollZoom?.enable?.();
  mapInstance.doubleClickZoom?.enable?.();
  mapInstance.keyboard?.enable?.();
  mapInstance.touchZoomRotate?.enable?.();

  const mapElement = document.getElementById('results-map');
  if (!mapElement || mapElement.dataset.interactionsBound === 'true') return;
  mapElement.dataset.interactionsBound = 'true';
  mapElement.classList.add('is-map-interactive');
  mapElement.addEventListener('mousedown', () => {
    mapElement.classList.add('is-map-dragging');
  });
  window.addEventListener('mouseup', () => {
    mapElement.classList.remove('is-map-dragging');
  });
}

function buildMarkerHtml(entity) {
  const typeMeta = getEntityTypeMeta(entity.entity_type_slug);
  return `<div class="map-dot" style="background:${esc(typeMeta.color_hex || '#1f4b6e')}"></div>`;
}

function buildPopupHtml(entity) {
  const typeMeta = getEntityTypeMeta(entity.entity_type_slug);
  return `<div class="vendor-map-popup"><div><strong>${esc(entity.entity_name)}</strong><br/>${esc(typeMeta.label)}<br/>${esc(getPrimaryLocationLabel(entity))}<br/><a href="./entity-detail.html?entity=${encodeURIComponent(entity.entity_uid)}">View Details</a></div></div>`;
}

function buildMarkerStyle(entity, compact = false) {
  const typeMeta = getEntityTypeMeta(entity.entity_type_slug);
  const fill = String(typeMeta.color_hex || '#1f4b6e');
  return {
    background: fill,
    boxShadow: compact
      ? '0 0 0 5px rgba(31,75,110,.14),0 8px 18px rgba(31,75,110,.24)'
      : '0 0 0 6px rgba(31,75,110,.14),0 8px 18px rgba(31,75,110,.24)',
  };
}

function applyMarkerVisualStyle(marker, entity, compact = false) {
  const markerElement = marker?.getElement?.() || marker?._element || null;
  if (!markerElement) return;
  const markerStyle = buildMarkerStyle(entity, compact);
  markerElement.style.backgroundImage = 'none';
  markerElement.style.backgroundColor = markerStyle.background;
  markerElement.style.background = markerStyle.background;
  markerElement.style.border = '3px solid #ffffff';
  markerElement.style.borderRadius = '999px';
  markerElement.style.boxShadow = markerStyle.boxShadow;
  markerElement.style.display = 'block';
}

function attachMarkerInteractions(marker, entity) {
  marker.on?.('click', () => focusEntity(entity.entity_uid));
  marker.addListener?.('click', () => focusEntity(entity.entity_uid));
}

function createMapMarker(entity, point, compact = false) {
  const popupHtml = buildPopupHtml(entity);
  const markerSize = compact ? 18 : 20;
  const marker = new window.mappls.Marker({
    map: directoryState.map,
    position: point,
    width: markerSize,
    height: markerSize,
    popupHtml,
    fitbounds: false,
  });
  applyMarkerVisualStyle(marker, entity, compact);
  attachMarkerInteractions(marker, entity);
  return marker;
}

function groupMapPoints(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const lat = Number(entry.point?.lat);
    const lng = Number(entry.point?.lng);
    const locationKey = normalizeText(getPrimaryLocationLabel(entry.entity));
    const key = locationKey || `${lat.toFixed(4)}|${lng.toFixed(4)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return Array.from(groups.values());
}

function createRingPoints(point, count) {
  if (count <= 1) return [point];
  const radius = Math.min(0.14, 0.02 + (count * 0.004));
  return Array.from({ length: count }, (_, index) => {
    const angle = (Math.PI * 2 * index) / count;
    const latOffset = Math.sin(angle) * radius;
    const lngOffset = Math.cos(angle) * radius / Math.max(Math.cos((point.lat * Math.PI) / 180), 0.35);
    return {
      lat: point.lat + latOffset,
      lng: point.lng + lngOffset,
    };
  });
}

async function renderMapMarkers(entities) {
  const ready = await ensureMap();
  if (!ready) return;
  clearMapMarkers();
  const points = [];
  for (const entity of entities) {
    const point = await geocodeEntity(entity);
    if (point) points.push({ entity, point });
  }
  if (!points.length) {
    mapListEl.innerHTML = entities.length
      ? '<div class="vendor-map-status">Matching entities were found, but no usable coordinates are available yet.</div>'
      : '<div class="vendor-map-status">Run a search to see matching entities on the map.</div>';
    directoryState.map?.setCenter?.(INDIA_CENTER);
    directoryState.map?.setZoom?.(4.8);
    return;
  }

  const groupedPoints = groupMapPoints(points);
  groupedPoints.forEach((entries) => {
    const basePoint = entries.length === 1
      ? entries[0].point
      : {
          lat: entries.reduce((sum, entry) => sum + Number(entry.point.lat || 0), 0) / entries.length,
          lng: entries.reduce((sum, entry) => sum + Number(entry.point.lng || 0), 0) / entries.length,
        };
    const ringPoints = createRingPoints(basePoint, entries.length);
    entries.forEach((entry, index) => {
      const marker = createMapMarker(entry.entity, ringPoints[index], entries.length > 1);
      directoryState.markers.push(marker);
    });
  });

  const indiaPoints = points.filter(({ point }) => point.lat >= 6 && point.lat <= 38 && point.lng >= 68 && point.lng <= 98);
  const first = indiaPoints[0]?.point || points[0]?.point;
  if (first) {
    directoryState.map?.setCenter?.(first);
    directoryState.map?.setZoom?.(5.5);
  }
}

function renderPagination(totalPages, totalMatches) {
  paginationEls.forEach((container) => {
    if (!container) return;
    container.innerHTML = '';
    if (!directoryState.hasSearched || !totalMatches) return;
    container.insertAdjacentHTML('beforeend', `<div class="vendor-page-summary">Showing ${getPageResults().length} of ${totalMatches} results</div>`);
    const prevDisabled = directoryState.currentPage === 1 ? 'disabled' : '';
    container.insertAdjacentHTML('beforeend', `<button class="btn btn-small btn-pagination" data-page-nav="prev" ${prevDisabled}>Prev</button>`);
    const start = Math.max(1, directoryState.currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let page = start; page <= end; page += 1) {
      container.insertAdjacentHTML('beforeend', `<button class="btn btn-small btn-pagination ${page === directoryState.currentPage ? 'active' : ''}" data-page-number="${page}">${page}</button>`);
    }
    const nextDisabled = directoryState.currentPage === totalPages ? 'disabled' : '';
    container.insertAdjacentHTML('beforeend', `<button class="btn btn-small btn-pagination" data-page-nav="next" ${nextDisabled}>Next</button>`);
  });
}

async function renderResults() {
  const totalMatches = directoryState.filteredEntities.length;
  const totalPages = getPageCount();
  const pageEntities = getPageResults();
  const mapEntities = directoryState.hasSearched ? directoryState.filteredEntities : [];
  resultsEl.innerHTML = '';
  if (mapListEl) mapListEl.innerHTML = '';
  renderPagination(totalPages, totalMatches);
  setCounts();

  if (!directoryState.hasSearched) {
    resultsSummaryEl.textContent = 'Enter a keyword, place, or one or more entity types to search the directory.';
    resultsEl.innerHTML = '<div class="vendor-empty-state">The directory is ready. Search for mentors, organisations, or support institutions using the filters on the left.</div>';
    await renderMapMarkers([]);
    return;
  }

  if (!totalMatches) {
    resultsSummaryEl.textContent = 'No entities matched the current filters.';
    resultsEl.innerHTML = '<div class="vendor-empty-state">No results match this search yet. Try a broader location, a shorter keyword, or fewer type filters.</div>';
    await renderMapMarkers([]);
    return;
  }

  resultsSummaryEl.textContent = `${totalMatches} result${totalMatches === 1 ? '' : 's'} found. Page ${directoryState.currentPage} of ${totalPages}.`;
  if (mapListEl) {
    mapEntities.forEach((entity, index) => {
      const typeMeta = getEntityTypeMeta(entity.entity_type_slug);
      mapListEl.insertAdjacentHTML('beforeend', `<div class="vendor-map-list-item" data-focus-entity="${esc(entity.entity_uid)}"><span class="vendor-flag" style="background:${esc(typeMeta.color_hex || '#1f4b6e')}">${index + 1}</span><span><strong>${esc(entity.entity_name)}</strong><br /><small>${esc(typeMeta.label)}</small><br /><small>${esc(getPrimaryLocationLabel(entity))}</small></span><div class="btn-group"><a class="btn btn-small" href="./entity-detail.html?entity=${encodeURIComponent(entity.entity_uid)}">View Details</a></div></div>`);
    });
  }

  pageEntities.forEach((entity) => {
    const typeMeta = getEntityTypeMeta(entity.entity_type_slug);
    const tags = Array.isArray(entity.tags) ? entity.tags.slice(0, 4).join(', ') : '';
    resultsEl.insertAdjacentHTML('beforeend', `<article class="vendor-result-card" data-entity-card="${esc(entity.entity_uid)}"><div class="vendor-result-top"><div><h4>${esc(entity.entity_name)}</h4><p>${esc(getPrimaryLocationLabel(entity))}</p></div><span class="admin-badge" style="background:${esc(typeMeta.color_hex || '#1f4b6e')}22;color:${esc(typeMeta.color_hex || '#1f4b6e')};border:1px solid ${esc(typeMeta.color_hex || '#1f4b6e')}44">${esc(typeMeta.label)}</span></div><p>${esc(entity.summary || entity.description || 'No summary available.')}</p><p><strong>Contact:</strong> ${esc(entity.contact_email || 'No email')} | ${esc(entity.contact_phone || 'No phone')}</p><p><strong>Website:</strong> ${entity.website_url ? `<a href="${esc(entity.website_url)}" target="_blank" rel="noreferrer">${esc(entity.website_url)}</a>` : 'Not listed'}</p><p><strong>Tags:</strong> ${esc(tags || 'Not listed')}</p><div class="btn-group"><a class="btn btn-small" href="./entity-detail.html?entity=${encodeURIComponent(entity.entity_uid)}">View Details</a></div></article>`);
  });

  const selectedEntity = directoryState.selectedEntityUid && mapEntities.some((entity) => entity.entity_uid === directoryState.selectedEntityUid)
    ? directoryState.selectedEntityUid
    : mapEntities[0]?.entity_uid || null;
  setSelectedEntity(selectedEntity);
  persistSearchState();
  await renderMapMarkers(mapEntities);
}

function applyFilters() {
  const filters = getFilters();
  if (!hasAnyFilter(filters)) {
    directoryState.hasSearched = false;
    directoryState.filteredEntities = [];
    directoryState.currentPage = 1;
    statusEl.textContent = `Loaded ${directoryState.entities.length} approved entities across ${directoryState.entityTypes.length} types.`;
    renderResults();
    return;
  }
  const scored = directoryState.entities
    .map((entity) => ({ entity, score: scoreEntity(entity, filters) }))
    .filter((entry) => entry.score !== null)
    .sort((left, right) => right.score - left.score || left.entity.entity_name.localeCompare(right.entity.entity_name))
    .map((entry) => entry.entity);
  directoryState.hasSearched = true;
  directoryState.filteredEntities = scored;
  directoryState.currentPage = 1;
  persistSearchState();
  renderResults();
}

function clearFilters() {
  searchEls.keyword.value = '';
  searchEls.location.value = '';
  document.querySelectorAll('#entity-type-filters input[type="checkbox"]').forEach((input) => {
    input.checked = false;
  });
  directoryState.selectedEntityUid = null;
  try { window.sessionStorage.removeItem(SEARCH_STATE_KEY); } catch {}
  applyFilters();
}

function initializeSidebarTabs() {
  const buttons = Array.from(document.querySelectorAll('[data-sidebar-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-sidebar-panel]'));
  if (!buttons.length || !panels.length) return;
  const activate = (tabName) => {
    buttons.forEach((button) => {
      const active = button.dataset.sidebarTab === tabName;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.sidebarPanel !== tabName;
    });
  };
  buttons.forEach((button) => {
    button.addEventListener('click', () => activate(button.dataset.sidebarTab));
  });
  activate(buttons.find((button) => button.classList.contains('is-active'))?.dataset.sidebarTab || buttons[0].dataset.sidebarTab);
}

async function handleSubmission(event) {
  event.preventDefault();
  setStatus(submissionStatusEl, 'Sending submission...');
  try {
    const typeSpecificData = collectDynamicFieldValues(submissionDynamicFieldsEl);
    const isPlace = isPlaceSubmissionType();
    const placeValues = isPlace ? buildPlaceSubmissionValues(typeSpecificData) : null;
    if (isPlace && !placeValues?.entity_name) {
      throw new Error('For a Place submission, please fill the place granularity fields first.');
    }
    const submitterName = document.getElementById('submission-contact-name').value;
    const submitterEmail = document.getElementById('submission-contact-email').value;
    const placeDocumentFile = submissionAddPlaceDocumentEl?.checked
      ? document.getElementById('submission-place-document-file').files?.[0]
      : null;
    if (isPlace && submissionAddPlaceDocumentEl?.checked && !placeDocumentFile) {
      throw new Error('Choose an initial place document file or untick the document option.');
    }
    if (isPlace && placeDocumentFile && placeDocumentFile.size > PLACE_DOCUMENT_MAX_BYTES) {
      throw new Error('Please keep place document uploads under 10 MB.');
    }
    const entityResponse = await EcosystemStore.adminRequest('submitEntity', {
      submission: {
        entity_type_slug: submissionTypeEl.value,
        entity_name: placeValues?.entity_name || document.getElementById('submission-name').value,
        location_label: placeValues?.location_label || document.getElementById('submission-location').value,
        primary_address: placeValues?.primary_address || document.getElementById('submission-location').value,
        contact_email: placeValues?.contact_email || document.getElementById('submission-email').value,
        contact_phone: placeValues?.contact_phone || document.getElementById('submission-phone').value,
        website_url: placeValues?.website_url || document.getElementById('submission-website').value,
        summary: placeValues?.summary || document.getElementById('submission-summary').value,
        social_media: placeValues?.social_media || parseSocialLinks(document.getElementById('submission-social-links').value),
        office_locations: placeValues?.office_locations || parseOfficeLocations(document.getElementById('submission-office-locations').value),
        type_specific_data: typeSpecificData,
        submitted_by_name: submitterName,
        submitted_by_email: submitterEmail,
      },
    });
    const linkedPlaceSubmissionId = entityResponse?.item?.id || '';
    const artifactErrors = [];
    if (isPlace && submissionAddPlaceDocumentEl?.checked && placeDocumentFile) {
      try {
        const fileContentBase64 = await readFileAsBase64(placeDocumentFile);
        await EcosystemStore.adminRequest('submitPlaceDocument', {
          submission: {
            linked_place_submission_id: linkedPlaceSubmissionId,
            place_name: placeValues?.entity_name || '',
            title: document.getElementById('submission-place-document-title').value || placeDocumentFile.name,
            description: document.getElementById('submission-place-document-description').value,
            document_date: document.getElementById('submission-place-document-date').value,
            recorded_at: document.getElementById('submission-place-document-recorded-at').value || new Date().toISOString().slice(0, 16),
            file_name: placeDocumentFile.name,
            mime_type: placeDocumentFile.type,
            file_size_bytes: placeDocumentFile.size,
            file_content_base64: fileContentBase64,
            submitted_by_name: submitterName,
            submitted_by_email: submitterEmail,
          },
        });
      } catch (error) {
        artifactErrors.push(`document: ${error.message || 'upload failed'}`);
      }
    }
    if (isPlace && submissionAddPlaceSpiderEl?.checked) {
      try {
        await EcosystemStore.adminRequest('submitPlaceSpider', {
          submission: {
            linked_place_submission_id: linkedPlaceSubmissionId,
            place_name: placeValues?.entity_name || '',
            title: document.getElementById('submission-place-spider-title').value || `${placeValues?.entity_name || 'Place'} Spider Chart`,
            recorded_at: document.getElementById('submission-place-spider-recorded-at').value || new Date().toISOString().slice(0, 16),
            notes: document.getElementById('submission-place-spider-notes').value,
            metrics_json: collectPlaceSpiderMetricsFromSubmission(),
            submitted_by_name: submitterName,
            submitted_by_email: submitterEmail,
          },
        });
      } catch (error) {
        artifactErrors.push(`spider chart: ${error.message || 'submission failed'}`);
      }
    }
    if (isPlace && submissionAddPlaceNeedsEl?.checked) {
      const thematicNeeds = parseLineList(document.getElementById('submission-place-needs-thematics').value);
      const updatedByOrg = document.getElementById('submission-place-needs-org').value;
      if (!thematicNeeds.length) {
        artifactErrors.push('thematic needs: add at least one thematic need');
      } else if (!updatedByOrg.trim()) {
        artifactErrors.push('thematic needs: organisation name is required');
      } else {
        try {
          await EcosystemStore.adminRequest('submitPlaceThematicNeed', {
            submission: {
              linked_place_submission_id: linkedPlaceSubmissionId,
              place_name: placeValues?.entity_name || '',
              thematic_needs: thematicNeeds,
              details: document.getElementById('submission-place-needs-details').value,
              updated_by_org: updatedByOrg,
              updated_by_name: submitterName,
              updated_by_email: submitterEmail,
              recorded_at: document.getElementById('submission-place-needs-recorded-at').value || new Date().toISOString().slice(0, 16),
            },
          });
        } catch (error) {
          artifactErrors.push(`thematic needs: ${error.message || 'submission failed'}`);
        }
      }
    }
    event.target.reset();
    renderPlaceMetricInputs();
    renderSubmissionDynamicFields();
    if (artifactErrors.length) {
      setStatus(submissionStatusEl, `Place submission was received, but the following item(s) did not save: ${artifactErrors.join('; ')}.`, true);
      return;
    }
    setStatus(submissionStatusEl, 'Submission received. It will appear after admin approval.');
  } catch (error) {
    setStatus(submissionStatusEl, error.message || 'Submission failed.', true);
  }
}

async function initializeDirectory() {
  statusEl.textContent = 'Loading approved directory records from Supabase...';
  try {
    const { entityTypes, entities, fieldDefinitions } = await EcosystemStore.loadDirectory();
    directoryState.entityTypes = entityTypes;
    directoryState.entities = entities;
    directoryState.fieldDefinitions = fieldDefinitions;
    buildTypeCheckboxes();
    renderSubmissionDynamicFields();
    statusEl.textContent = `Loaded ${entities.length} approved entities across ${entityTypes.length} types.`;
    const snapshot = restoreSearchState();
    if (snapshot?.hasSearched) {
      applySearchSnapshot(snapshot);
      const filters = getFilters();
      directoryState.hasSearched = true;
      directoryState.filteredEntities = directoryState.entities
        .map((entity) => ({ entity, score: scoreEntity(entity, filters) }))
        .filter((entry) => entry.score !== null)
        .sort((left, right) => right.score - left.score || left.entity.entity_name.localeCompare(right.entity.entity_name))
        .map((entry) => entry.entity);
      directoryState.currentPage = Math.min(Math.max(1, directoryState.currentPage), Math.max(1, Math.ceil(directoryState.filteredEntities.length / directoryState.pageSize)));
    }
    await renderResults();
  } catch (error) {
    statusEl.textContent = error.message || 'Directory could not be loaded.';
    resultsEl.innerHTML = `<article class="admin-card"><p>${esc(statusEl.textContent)}</p></article>`;
  }
}

document.getElementById('run-search').addEventListener('click', applyFilters);
document.getElementById('clear-search').addEventListener('click', clearFilters);
document.getElementById('submission-form').addEventListener('submit', handleSubmission);
submissionTypeEl.addEventListener('change', renderSubmissionDynamicFields);
submissionAddPlaceDocumentEl?.addEventListener('change', syncSubmissionFormForType);
submissionAddPlaceSpiderEl?.addEventListener('change', syncSubmissionFormForType);
submissionAddPlaceNeedsEl?.addEventListener('change', syncSubmissionFormForType);
renderPlaceMetricInputs();
Object.values(searchEls).forEach((input) => {
  input.addEventListener('keypress', (event) => { if (event.key === 'Enter') applyFilters(); });
  input.addEventListener('input', persistSearchState);
});
document.getElementById('entity-type-filters').addEventListener('change', persistSearchState);
mapListEl?.addEventListener('click', (event) => {
  if (event.target.closest('a')) return;
  const target = event.target.closest('[data-focus-entity]');
  if (target) focusEntity(target.dataset.focusEntity);
});
resultsEl.addEventListener('click', (event) => {
  if (event.target.closest('a')) return;
  const target = event.target.closest('[data-entity-card]');
  if (target) {
    setSelectedEntity(target.dataset.entityCard);
    persistSearchState();
  }
});
paginationEls.forEach((container) => container?.addEventListener('click', (event) => {
  const pageButton = event.target.closest('[data-page-number]');
  if (pageButton) {
    directoryState.currentPage = Number(pageButton.dataset.pageNumber);
    persistSearchState();
    renderResults();
    return;
  }
  const navButton = event.target.closest('[data-page-nav]');
  if (!navButton) return;
  const direction = navButton.dataset.pageNav;
  if (direction === 'prev' && directoryState.currentPage > 1) directoryState.currentPage -= 1;
  if (direction === 'next' && directoryState.currentPage < getPageCount()) directoryState.currentPage += 1;
  persistSearchState();
  renderResults();
}));

initializeSidebarTabs();
initializeDirectory();
