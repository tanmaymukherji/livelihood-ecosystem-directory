const { esc } = window.EcosystemForms;

const placeState = {
  entityTypes: [],
  entities: [],
  placeInitiatives: [],
  placeLocations: [],
  placePartners: [],
  placeRoleTypes: [],
  selectedPlaceUid: '',
  adminToken: '',
  adminEnabled: false,
  map: null,
  mapReady: false,
  mapLoadPromise: null,
  mapPopup: null,
  mapFeatures: null,
  roleDragState: null,
  locationHierarchy: null,
  flatLocationEntries: [],
  pendingLocationSuggestion: null,
  pendingLeadSuggestion: null,
  pendingPartnerSuggestions: new Map(),
  calloutPositions: {},
  roleBoxesVisible: false,
  calloutPlaceUid: '',
  isRebalancingCallouts: false,
};

const INDIA_CENTER = { lat: 22.9734, lng: 78.6569 };
const ADMIN_SESSION_KEY = 'livelihood-ecosystem-admin-session';
const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not Started', color: '#d74c4c' },
  { value: 'in_progress', label: 'In Progress', color: '#f39c12' },
  { value: 'mature', label: 'Mature', color: '#2f9d63' },
];
const SOTH_STAGES = ['Initiate', 'Engage', 'Action', 'Auto Pilot'];
const GRAMEEE_STAGES = ['Triggering', 'Incubating', 'Sustaining'];
const LOCATION_DATA_URL = 'https://cdn.jsdelivr.net/gh/pranshumaheshwari/indian-cities-and-villages@master/data.json';
const STATE_DISTRICT_URL = 'https://cdn.jsdelivr.net/gh/aharnish-infotech/india-state-district-json@main/India-State-District.json';

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
  callouts: document.getElementById('place-role-callouts'),
  toggleRoleBoxes: document.getElementById('toggle-role-boxes'),
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
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

function getRoleLabel(roleSlug, roleLabel) {
  const found = placeState.placeRoleTypes.find((role) => role.slug === roleSlug);
  return roleLabel || found?.label || roleSlug || 'Unassigned';
}

function getStatusMeta(value) {
  return STATUS_OPTIONS.find((item) => item.value === value) || STATUS_OPTIONS[0];
}

function getCurrentMapZoom() {
  return Number(placeState.map?.getZoom?.() || 4.7);
}

function getCalloutScale() {
  const zoom = getCurrentMapZoom();
  return Math.max(0.58, Math.min(1.08, 0.58 + ((zoom - 4.5) * 0.11)));
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
  if (item.block_name) return 'block';
  if (item.district_name) return 'district';
  return 'state';
}

function locationDisplayLabel(item) {
  return item.display_label || item.location_name || [item.village_name, item.block_name, item.district_name, item.state_name].filter(Boolean).join(', ');
}

function getPlaceStates(locations) {
  return Array.from(new Set(locations.map((item) => item.state_name).filter(Boolean))).sort((left, right) => left.localeCompare(right));
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
      <div class="place-partner-head">
        <div class="place-partner-summary">
          <strong data-partner-summary-name>${esc(summary.name)}</strong>
          <small data-partner-summary-role>${esc(summary.roleLabel)}</small>
        </div>
        <div class="btn-group place-partner-actions">
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
  const villageName = names.village_name || names.village || '';
  return {
    location_kind: kind,
    location_name: names.location_name || villageName || blockName || districtName || stateName,
    state_name: stateName || null,
    district_name: districtName || null,
    block_name: blockName || null,
    village_name: villageName || null,
    display_label: names.display_label || [villageName, blockName, districtName, stateName].filter(Boolean).join(', ') || stateName,
    latitude: names.latitude ?? null,
    longitude: names.longitude ?? null,
  };
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
}

function getLocationSuggestionMatches(query) {
  const normalized = normalizeText(query);
  if (!normalized) return [];
  const matches = [];
  const pushMatch = (item) => {
    const key = normalizeText(`${item.location_kind}|${item.display_label}`);
    if (!key || matches.some((entry) => normalizeText(`${entry.location_kind}|${entry.display_label}`) === key)) return;
    matches.push(item);
  };

  placeState.flatLocationEntries
    .filter((item) => normalizeText(item.display_label).includes(normalized))
    .slice(0, 12)
    .forEach(pushMatch);

  if (matches.length < 12 && placeState.locationHierarchy && typeof placeState.locationHierarchy === 'object') {
    for (const [stateName, districts] of Object.entries(placeState.locationHierarchy)) {
      if (matches.length >= 12) break;
      for (const [districtName, blocks] of Object.entries(districts || {})) {
        if (matches.length >= 12) break;
        for (const [blockName, villages] of Object.entries(blocks || {})) {
          if (normalizeText(blockName).includes(normalized)) {
            pushMatch(buildLocationEntry('block', {
              state_name: stateName,
              district_name: districtName,
              block_name: blockName,
              location_name: blockName,
              display_label: [blockName, districtName, stateName].filter(Boolean).join(', '),
            }));
          }
          const villageNames = Array.isArray(villages) ? villages : Object.keys(villages || {});
          for (const villageName of villageNames) {
            if (matches.length >= 12) break;
            if (!normalizeText(villageName).includes(normalized)) continue;
            pushMatch(buildLocationEntry('village', {
              state_name: stateName,
              district_name: districtName,
              block_name: blockName,
              village_name: villageName,
              location_name: villageName,
              display_label: [villageName, blockName, districtName, stateName].filter(Boolean).join(', '),
            }));
          }
          if (matches.length >= 12) break;
        }
      }
    }
  }

  return matches.slice(0, 12);
}

function renderLocationSuggestions(matches) {
  renderSuggestionBox(els.locationSuggestions, matches, (item, index) => {
    return `<button type="button" class="place-suggestion-item" data-location-suggestion="${index}"><strong>${esc(item.location_name)}</strong><small>${esc(item.location_kind)} | ${esc(item.display_label)}</small></button>`;
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
  const points = locations.filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
  if (!points.length) return { lat: INDIA_CENTER.lat, lng: INDIA_CENTER.lng };
  return {
    lat: points.reduce((sum, item) => sum + Number(item.latitude), 0) / points.length,
    lng: points.reduce((sum, item) => sum + Number(item.longitude), 0) / points.length,
  };
}

function buildPlaceGeoJson() {
  const polygonFeatures = [];
  const centroidFeatures = [];
  placeState.placeInitiatives.forEach((place) => {
    const locations = getPlaceLocations(place.place_uid);
    const color = getPlaceColor(place.place_uid);
    const centroid = getPlaceCentroid(locations);
    locations.forEach((location, index) => {
      const lat = Number(location.latitude);
      const lng = Number(location.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
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
  const linkedEntityIds = new Set(
    partners
      .map((item) => String(item.entity_uid || '').trim())
      .filter(Boolean)
  );
  const linkedEntityNames = new Set(
    partners
      .map((item) => normalizeText(item.partner_name))
      .filter(Boolean)
  );
  const potentialPartners = placeState.entities
    .filter((entity) => !states.length || states.includes(entity.state))
    .filter((entity) => {
      const entityUid = String(entity.entity_uid || '').trim();
      const entityName = normalizeText(entity.entity_name);
      if (entityUid && linkedEntityIds.has(entityUid)) return false;
      if (entityName && linkedEntityNames.has(entityName)) return false;
      return true;
    })
    .slice(0, 150)
    .reduce((acc, entity) => {
      const key = entity.entity_type_label || entity.entity_type_slug || 'Other';
      if (!acc[key]) acc[key] = [];
      acc[key].push(entity);
      return acc;
    }, {});

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
        <p><strong>${esc(lead?.partner_name || place.lead_name || 'Not listed')}</strong></p>
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
      ${partnerRows.length ? partnerRows.map((partner) => `<article class="place-detail-card place-detail-card-compact"><strong>${esc(partner.partner_name)}</strong><small>${esc(getRoleLabel(partner.role_slug, partner.role_label))}</small><p>${esc(partner.thematic_area || 'No thematic area listed')}</p></article>`).join('') : '<article class="place-detail-card place-detail-card-compact"><p class="section-note">No partner organisations have been linked yet.</p></article>'}
    </section>
    <section class="place-detail-row place-detail-row-potential">
      <article class="place-detail-row-header">
        <h4>Potential Partners By State</h4>
      </article>
      ${Object.entries(potentialPartners).map(([group, entities]) => `<article class="place-detail-card place-detail-card-compact"><h4>${esc(group)}</h4><div class="place-inline-list">${entities.slice(0, 8).map((entity) => `<span class="innovation-chip innovation-chip-muted">${esc(entity.entity_name)}</span>`).join('') || '<span class="section-note">No entities listed.</span>'}</div></article>`).join('') || '<article class="place-detail-card place-detail-card-compact"><p class="section-note">No potential partners were found for the selected state set.</p></article>'}
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
  const centroid = getPlaceCentroid(getPlaceLocations(placeUid));
  const anchor = placeState.map.project([centroid.lng, centroid.lat]);
  const scale = getCalloutScale();
  const roles = placeState.placeRoleTypes.filter((role) => role.slug !== 'others');
  const partners = getPlacePartners(placeUid);
  const cards = roles.map((role, index) => {
    const matching = partners.filter((item) => item.role_slug === role.slug || normalizeText(item.role_label) === normalizeText(role.label));
    const hasData = Boolean(matching.length);
    const key = `${placeUid}:${role.slug}`;
    const fallback = { x: 18 + ((index % 2) * 240), y: 24 + (Math.floor(index / 2) * 86) };
    const pos = placeState.calloutPositions[key] || fallback;
    const boxWidth = 220 * scale;
    const boxHeight = 64 * scale;
    const dx = anchor.x - (pos.x + (boxWidth / 2));
    const dy = anchor.y - (pos.y + (boxHeight / 2));
    const length = Math.max(Math.sqrt((dx * dx) + (dy * dy)), 20);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    return `
      <div class="place-callout ${hasData ? 'is-filled' : 'is-empty'}" data-callout-key="${esc(key)}" style="left:${pos.x}px;top:${pos.y}px;transform:scale(${scale})">
        <div class="place-callout-line" style="width:${length}px;transform:rotate(${angle}deg)"></div>
        <div class="place-callout-body">
          <strong>${esc(role.label)}</strong>
          <div class="place-callout-scroll">${hasData ? matching.map((item) => `<span>${esc(item.partner_name)}</span>`).join('') : '<span>Role missing</span>'}</div>
        </div>
      </div>
    `;
  }).join('');
  els.callouts.innerHTML = cards;
  updateRoleBoxToggleLabel();
  rebalanceCallouts(placeUid);
}

function rebalanceCallouts(placeUid) {
  if (placeState.isRebalancingCallouts || !placeUid) return;
  placeState.isRebalancingCallouts = true;
  requestAnimationFrame(() => {
    try {
      const container = els.callouts;
      const cards = Array.from(container.querySelectorAll('[data-callout-key]'));
      if (!cards.length) return;
      const containerRect = container.getBoundingClientRect();
      const gap = 14;
      const margin = 18;
      const scale = getCalloutScale();
      const fallbackWidth = 220 * scale;
      const leftCards = [];
      const rightCards = [];

      cards.forEach((card, index) => {
        const key = card.dataset.calloutKey;
        const existing = placeState.calloutPositions[key];
        if (existing?.manual) return;
        const roleIndex = cards.findIndex((item) => item.dataset.calloutKey === key);
        if (roleIndex % 2 === 0) leftCards.push(card);
        else rightCards.push(card);
      });

      let leftY = 24;
      let rightY = 24;
      const nextPositions = {};

      leftCards.forEach((card) => {
        const key = card.dataset.calloutKey;
        const rect = card.getBoundingClientRect();
        const width = rect.width || fallbackWidth;
        nextPositions[key] = { x: margin, y: leftY, manual: false };
        leftY += (rect.height || 72) + gap;
        if (width > fallbackWidth) {
          nextPositions[key].x = margin;
        }
      });

      rightCards.forEach((card) => {
        const key = card.dataset.calloutKey;
        const rect = card.getBoundingClientRect();
        const width = rect.width || fallbackWidth;
        nextPositions[key] = {
          x: Math.max(margin, containerRect.width - width - margin),
          y: rightY,
          manual: false,
        };
        rightY += (rect.height || 72) + gap;
      });

      let changed = false;
      Object.entries(nextPositions).forEach(([key, value]) => {
        const current = placeState.calloutPositions[key];
        if (!current || current.manual || Math.abs((current.x || 0) - value.x) > 1 || Math.abs((current.y || 0) - value.y) > 1) {
          placeState.calloutPositions[key] = value;
          changed = true;
        }
      });

      if (changed) {
        placeState.isRebalancingCallouts = false;
        renderRoleCallouts();
        return;
      }
    } finally {
      placeState.isRebalancingCallouts = false;
    }
  });
}

function fitToPlace(placeUid) {
  const locations = getPlaceLocations(placeUid).filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
  if (!placeState.map || !placeState.map.fitBounds || !locations.length) return;
  const bounds = locations.reduce((acc, item) => {
    acc.minLng = Math.min(acc.minLng, Number(item.longitude));
    acc.maxLng = Math.max(acc.maxLng, Number(item.longitude));
    acc.minLat = Math.min(acc.minLat, Number(item.latitude));
    acc.maxLat = Math.max(acc.maxLat, Number(item.latitude));
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

async function loadLocationDatasets() {
  const [stateDistrictResponse, hierarchyResponse] = await Promise.allSettled([
    fetch(STATE_DISTRICT_URL),
    fetch(LOCATION_DATA_URL),
  ]);
  if (stateDistrictResponse.status === 'fulfilled' && stateDistrictResponse.value.ok) {
    const json = await stateDistrictResponse.value.json();
    const flat = [];
    (Array.isArray(json) ? json : []).forEach((item) => {
      const stateName = item.state || item.name || item.State || '';
      if (stateName) {
        flat.push(buildLocationEntry('state', { state_name: stateName, location_name: stateName, display_label: stateName }));
      }
      const districts = Array.isArray(item.districts) ? item.districts : [];
      districts.forEach((district) => {
        flat.push(buildLocationEntry('district', {
          state_name: stateName,
          district_name: district,
          location_name: district,
          display_label: [district, stateName].filter(Boolean).join(', '),
        }));
      });
    });
    placeState.flatLocationEntries = dedupeBy(flat, (item) => normalizeText(item.display_label));
  }
  if (hierarchyResponse.status === 'fulfilled' && hierarchyResponse.value.ok) {
    placeState.locationHierarchy = await hierarchyResponse.value.json();
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

  els.locationSearch.addEventListener('input', () => {
    const matches = getLocationSuggestionMatches(els.locationSearch.value);
    placeState.pendingLocationSuggestion = matches;
    renderLocationSuggestions(matches);
  });
  els.locationSuggestions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-location-suggestion]');
    if (!button) return;
    const item = placeState.pendingLocationSuggestion?.[Number(button.dataset.locationSuggestion)];
    addLocationFromSelection(item);
  });
  document.getElementById('add-place-location').addEventListener('click', () => {
    const item = placeState.pendingLocationSuggestion?.[0];
    if (item) {
      addLocationFromSelection(item);
      return;
    }
    const raw = els.locationSearch.value.trim();
    if (!raw) return;
    addLocationFromSelection(buildLocationEntry('village', { village_name: raw, location_name: raw, display_label: raw }));
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
    const button = event.target.closest('[data-open-place]');
    if (!button) return;
    selectPlace(button.dataset.openPlace, { fit: true });
    document.querySelector('.place-editor-shell')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
