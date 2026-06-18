const bulkUploadStatus = document.getElementById('bulkUploadStatus');
const adminSearchMeta = document.getElementById('adminSearchMeta');
const adminEditStatus = document.getElementById('adminEditStatus');
const submissionQueueMeta = document.getElementById('submissionQueueMeta');
const contactRequestMeta = document.getElementById('contactRequestMeta');
const placeDocumentQueueMeta = document.getElementById('placeDocumentQueueMeta');
const placeSpiderQueueMeta = document.getElementById('placeSpiderQueueMeta');
const submissionQueue = document.getElementById('submissionQueue');
const contactRequestList = document.getElementById('contactRequestList');
const placeDocumentQueue = document.getElementById('placeDocumentQueue');
const placeSpiderQueue = document.getElementById('placeSpiderQueue');
const adminSearchResults = document.getElementById('adminSearchResults');

const adminEditorEmpty = document.getElementById('adminEditorEmpty');
const adminEditorFields = document.getElementById('adminEditorFields');
const editDynamicFieldsEl = document.getElementById('edit-dynamic-fields');
const placeAdminToolsEl = document.getElementById('placeAdminTools');
const placeAdminNeedsListEl = document.getElementById('placeAdminNeedsList');
const placeAdminNeedsStatusEl = document.getElementById('placeAdminNeedsStatus');
const placeAdminSpiderListEl = document.getElementById('placeAdminSpiderList');
const placeAdminDocumentListEl = document.getElementById('placeAdminDocumentList');
const placeAdminDocumentStatusEl = document.getElementById('placeAdminDocumentStatus');

const {
  esc,
  parseTagList,
  parseOfficeLocations,
  formatOfficeLocations,
  parseSocialLinks,
  formatSocialLinks,
  renderDynamicFields,
  collectDynamicFieldValues,
} = window.EcosystemForms;

const state = {
  entityTypes: [],
  entities: [],
  fieldDefinitions: [],
  filteredEntities: [],
  submissions: [],
  contactRequests: [],
  placeDocumentSubmissions: [],
  placeSpiderSubmissions: [],
  placeDocuments: [],
  placeSpiderSnapshots: [],
  placeThematicNeeds: [],
  selectedEntityUid: '',
};

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

const editEls = {
  entityUid: document.getElementById('editEntityUid'),
  entityType: document.getElementById('editEntityType'),
  entityName: document.getElementById('editEntityName'),
  summary: document.getElementById('editSummary'),
  description: document.getElementById('editDescription'),
  locationLabel: document.getElementById('editLocationLabel'),
  address: document.getElementById('editAddress'),
  district: document.getElementById('editDistrict'),
  state: document.getElementById('editState'),
  email: document.getElementById('editEmail'),
  phone: document.getElementById('editPhone'),
  website: document.getElementById('editWebsite'),
  socialMedia: document.getElementById('editSocialMedia'),
  officeLocations: document.getElementById('editOfficeLocations'),
  tags: document.getElementById('editTags'),
  keywords: document.getElementById('editKeywords'),
  latitude: document.getElementById('editLatitude'),
  longitude: document.getElementById('editLongitude'),
  adminNotes: document.getElementById('editAdminNotes'),
};

const ADMIN_SESSION_KEY = 'livelihood-ecosystem-admin-session';
let sharedAdminAccessToken = '';

function getStoredToken() {
  return sharedAdminAccessToken || window.sessionStorage.getItem(ADMIN_SESSION_KEY) || window.localStorage.getItem(ADMIN_SESSION_KEY) || '';
}

function setStoredToken(token) {
  if (token) {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, token);
    window.localStorage.setItem(ADMIN_SESSION_KEY, token);
  } else {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
  }
}

function adminRequest(action, payload = {}) {
  return EcosystemStore.adminRequest(action, { ...payload, token: getStoredToken() });
}

function setStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = message || '';
  element.classList.toggle('error', Boolean(isError));
}

function formatDateTime(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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

function parseLineList(value) {
  return String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSharedAuth(maxWaitMs = 4500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    if (window.grameeeAuth && typeof window.grameeeAuth.getAccessToken === 'function') return window.grameeeAuth;
    await wait(100);
  }
  return window.grameeeAuth || null;
}

async function refreshSharedAdminSession() {
  const auth = await waitForSharedAuth();
  if (!auth) return '';
  let user = null;
  try {
    user = auth.getStoredSummary?.() || null;
    if (!user && typeof auth.hydrateAuthSession === 'function') {
      user = await auth.hydrateAuthSession();
    }
  } catch {}
  let token = '';
  try {
    token = await auth.getAccessToken();
    if (!token && typeof auth.hydrateAuthSession === 'function') {
      await auth.hydrateAuthSession();
      token = await auth.getAccessToken();
    }
  } catch {}
  sharedAdminAccessToken = token || '';
  if (token) setStoredToken(token);
  return sharedAdminAccessToken;
}

function populateTypeOptions() {
  const selectEls = [
    document.getElementById('adminEntityTypeFilter'),
    editEls.entityType,
    document.getElementById('bulkUploadEntityType'),
  ];
  selectEls.forEach((selectEl, index) => {
    if (!selectEl) return;
    const previous = selectEl.value;
    if (index === 1) {
      selectEl.innerHTML = '';
    } else {
      selectEl.innerHTML = '<option value="">All entity types</option>';
    }
    state.entityTypes.forEach((type) => {
      const option = document.createElement('option');
      option.value = type.type_slug;
      option.textContent = type.label;
      selectEl.appendChild(option);
    });
    selectEl.value = previous;
  });
}

function buildSearchText(entity) {
  const typeSpecificText = entity.type_specific_data && typeof entity.type_specific_data === 'object'
    ? Object.values(entity.type_specific_data).flatMap((value) => Array.isArray(value) ? value : [value]).join(' ')
    : '';
  return [
    entity.entity_name,
    entity.entity_type_label,
    entity.summary,
    entity.description,
    entity.location_label,
    entity.primary_address,
    entity.district,
    entity.state,
    entity.contact_email,
    entity.contact_phone,
    entity.website_url,
    (entity.tags || []).join(' '),
    (entity.keywords || []).join(' '),
    typeSpecificText,
  ].map((value) => String(value || '').toLowerCase()).join(' ');
}

function filterEntities() {
  const typeFilter = String(document.getElementById('adminEntityTypeFilter').value || '').trim();
  const query = String(document.getElementById('adminSearchInput').value || '').trim().toLowerCase();
  state.filteredEntities = [...state.entities]
    .filter((entity) => !typeFilter || entity.entity_type_slug === typeFilter)
    .filter((entity) => !query || buildSearchText(entity).includes(query))
    .sort((left, right) => String(left.entity_name || '').localeCompare(String(right.entity_name || '')));
}

function renderSubmissions() {
  submissionQueue.innerHTML = '';
  if (!state.submissions.length) {
    submissionQueue.innerHTML = '<article class="admin-card"><p>No pending submissions.</p></article>';
    submissionQueueMeta.textContent = 'No pending submissions.';
    return;
  }
  submissionQueueMeta.textContent = `${state.submissions.length} pending submission${state.submissions.length === 1 ? '' : 's'}`;
  state.submissions.forEach((item) => {
    const typeLabel = state.entityTypes.find((type) => type.type_slug === item.entity_type_slug)?.label || item.entity_type_slug || 'Unknown type';
    const card = document.createElement('article');
    card.className = 'admin-card';
    card.innerHTML = `<div class="admin-card-header"><h4>${esc(item.entity_name || 'Unnamed submission')}</h4><span class="admin-badge">${esc(typeLabel)}</span></div><p><strong>Location:</strong> ${esc(item.location_label || item.primary_address || 'Not listed')}</p><p><strong>Contact:</strong> ${esc(item.contact_email || 'No email')} | ${esc(item.contact_phone || 'No phone')}</p><p><strong>Submitted By:</strong> ${esc(item.submitted_by_name || 'Unknown')} | ${esc(item.submitted_by_email || 'No email')}</p><p>${esc(item.summary || 'No summary supplied')}</p><div class="btn-group"><button class="btn btn-success btn-small" type="button" data-approve-submission="${esc(item.id)}">Approve</button><button class="btn btn-danger btn-small" type="button" data-reject-submission="${esc(item.id)}">Reject</button></div>`;
    submissionQueue.appendChild(card);
  });
}

function renderContactRequests() {
  contactRequestList.innerHTML = '';
  if (!state.contactRequests.length) {
    contactRequestList.innerHTML = '<article class="admin-card"><p>No edit or delete requests have been submitted yet.</p></article>';
    contactRequestMeta.textContent = 'No edit or delete requests yet.';
    return;
  }
  contactRequestMeta.textContent = `${state.contactRequests.length} request${state.contactRequests.length === 1 ? '' : 's'} recorded`;
  state.contactRequests.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'admin-card';
    card.innerHTML = `<div class="admin-card-header"><h4>${esc(item.entity_name || 'Unknown entity')}</h4><span class="admin-badge">${esc(item.request_type || 'request')}</span></div><p><strong>Requester:</strong> ${esc(item.requester_name || 'Unknown')} | ${esc(item.requester_email || 'No email')}</p><p><strong>Phone:</strong> ${esc(item.requester_phone || 'Not listed')}</p><p><strong>Status:</strong> ${esc(item.status || 'pending')}</p><p>${esc(item.message || 'No message')}</p>`;
    contactRequestList.appendChild(card);
  });
}

function renderPlaceDocumentSubmissions() {
  placeDocumentQueue.innerHTML = '';
  if (!state.placeDocumentSubmissions.length) {
    placeDocumentQueue.innerHTML = '<article class="admin-card"><p>No pending place documents.</p></article>';
    placeDocumentQueueMeta.textContent = 'No pending place documents.';
    return;
  }
  placeDocumentQueueMeta.textContent = `${state.placeDocumentSubmissions.length} pending place document${state.placeDocumentSubmissions.length === 1 ? '' : 's'}`;
  state.placeDocumentSubmissions.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'admin-card';
    card.innerHTML = `
      <div class="admin-card-header"><h4>${esc(item.title || item.file_name || 'Place document')}</h4><span class="admin-badge">${esc(item.place_name || 'Place')}</span></div>
      <p><strong>File:</strong> ${esc(item.file_name || 'Unknown file')}</p>
      <p><strong>Recorded:</strong> ${esc(item.recorded_at || 'Not recorded')}</p>
      <p><strong>Submitted By:</strong> ${esc(item.submitted_by_name || 'Unknown')} | ${esc(item.submitted_by_email || 'No email')}</p>
      <p>${esc(item.description || 'No description supplied')}</p>
      <div class="btn-group">
        <button class="btn btn-success btn-small" type="button" data-approve-place-document="${esc(item.id)}">Approve</button>
        <button class="btn btn-danger btn-small" type="button" data-reject-place-document="${esc(item.id)}">Reject</button>
      </div>
    `;
    placeDocumentQueue.appendChild(card);
  });
}

function renderPlaceSpiderSubmissions() {
  placeSpiderQueue.innerHTML = '';
  if (!state.placeSpiderSubmissions.length) {
    placeSpiderQueue.innerHTML = '<article class="admin-card"><p>No pending place spider charts.</p></article>';
    placeSpiderQueueMeta.textContent = 'No pending place spider charts.';
    return;
  }
  placeSpiderQueueMeta.textContent = `${state.placeSpiderSubmissions.length} pending place spider chart${state.placeSpiderSubmissions.length === 1 ? '' : 's'}`;
  state.placeSpiderSubmissions.forEach((item) => {
    const metricCount = item.metrics_json && typeof item.metrics_json === 'object' ? Object.keys(item.metrics_json).length : 0;
    const card = document.createElement('article');
    card.className = 'admin-card';
    card.innerHTML = `
      <div class="admin-card-header"><h4>${esc(item.title || item.place_name || 'Spider chart')}</h4><span class="admin-badge">${esc(item.place_name || 'Place')}</span></div>
      <p><strong>Recorded:</strong> ${esc(item.recorded_at || 'Not recorded')}</p>
      <p><strong>Metrics:</strong> ${esc(String(metricCount))}</p>
      <p><strong>Submitted By:</strong> ${esc(item.submitted_by_name || 'Unknown')} | ${esc(item.submitted_by_email || 'No email')}</p>
      <p>${esc(item.notes || 'No notes supplied')}</p>
      <div class="btn-group">
        <button class="btn btn-success btn-small" type="button" data-approve-place-spider="${esc(item.id)}">Approve</button>
        <button class="btn btn-danger btn-small" type="button" data-reject-place-spider="${esc(item.id)}">Reject</button>
      </div>
    `;
    placeSpiderQueue.appendChild(card);
  });
}

function renderEntityResults() {
  adminSearchResults.innerHTML = '';
  if (!state.filteredEntities.length) {
    adminSearchResults.innerHTML = '<article class="admin-card"><p>No records matched this filter.</p></article>';
    adminSearchMeta.textContent = 'No matching approved records.';
    return;
  }

  adminSearchMeta.textContent = `${state.filteredEntities.length} approved record${state.filteredEntities.length === 1 ? '' : 's'} found`;

  state.filteredEntities.forEach((entity) => {
    const card = document.createElement('article');
    card.className = `admin-card admin-search-card${entity.entity_uid === state.selectedEntityUid ? ' active' : ''}`;
    card.innerHTML = `<div class="admin-card-header"><h4>${esc(entity.entity_name)}</h4><span class="admin-badge">${esc(entity.entity_type_label || entity.entity_type_slug)}</span></div><p><strong>Location:</strong> ${esc(entity.location_label || entity.primary_address || 'Not listed')}</p><p><strong>Contact:</strong> ${esc(entity.contact_email || 'No email')} | ${esc(entity.contact_phone || 'No phone')}</p><small>${esc(entity.summary || entity.description || 'No summary')}</small>`;
    card.addEventListener('click', () => selectEntity(entity.entity_uid));
    adminSearchResults.appendChild(card);
  });
}

function renderPlaceSpiderMetricRows(snapshot) {
  const metrics = snapshot.metrics_json && typeof snapshot.metrics_json === 'object' ? snapshot.metrics_json : {};
  return PLACE_SPIDER_METRICS.map((metric) => {
    const item = metrics[metric.key] && typeof metrics[metric.key] === 'object' ? metrics[metric.key] : {};
    return `
      <div class="place-spider-admin-row">
        <div>
          <strong>${esc(metric.label)}</strong>
          <small>Saved as score and max score.</small>
        </div>
        <input type="number" step="any" min="0" data-admin-place-score="${esc(metric.key)}" value="${esc(String(item.score ?? 0))}" />
        <input type="number" step="any" min="1" data-admin-place-max="${esc(metric.key)}" value="${esc(String(item.max_score ?? metric.defaultMax))}" />
      </div>
    `;
  }).join('');
}

function renderPlaceAdminCollections(entity) {
  const isPlace = entity?.entity_type_slug === 'place';
  if (!placeAdminToolsEl || !placeAdminSpiderListEl || !placeAdminDocumentListEl || !placeAdminNeedsListEl) return;
  placeAdminToolsEl.hidden = !isPlace;
  placeAdminToolsEl.querySelectorAll('input, textarea, select, button').forEach((element) => {
    if ('disabled' in element) element.disabled = !isPlace;
  });
  if (!isPlace) {
    placeAdminNeedsListEl.innerHTML = '';
    placeAdminSpiderListEl.innerHTML = '';
    placeAdminDocumentListEl.innerHTML = '';
    setStatus(placeAdminNeedsStatusEl, '');
    setStatus(placeAdminDocumentStatusEl, '');
    return;
  }

  const needs = state.placeThematicNeeds
    .filter((item) => item.place_uid === entity.entity_uid)
    .sort((left, right) => new Date(right.recorded_at || 0).getTime() - new Date(left.recorded_at || 0).getTime());
  if (!needs.length) {
    placeAdminNeedsListEl.innerHTML = '<article class="admin-card"><p>No thematic need updates for this Place yet.</p></article>';
  } else {
    placeAdminNeedsListEl.innerHTML = needs.map((item) => `
      <article class="admin-card">
        <div class="admin-card-header">
          <h4>${esc((item.thematic_needs || []).join(', ') || 'Need update')}</h4>
          <span class="admin-badge">${esc(formatDateTime(item.recorded_at))}</span>
        </div>
        <div class="form-group"><label>Thematic Needs</label><textarea rows="3" data-admin-place-needs-thematics>${esc((item.thematic_needs || []).join('\n'))}</textarea></div>
        <div class="form-group"><label>Updated By Organisation</label><input type="text" data-admin-place-needs-org value="${esc(item.updated_by_org || '')}" /></div>
        <div class="form-group"><label>Recorded At</label><input type="datetime-local" data-admin-place-needs-recorded-at value="${esc(String(item.recorded_at || '').slice(0, 16))}" /></div>
        <div class="form-group"><label>Details</label><textarea rows="3" data-admin-place-needs-details>${esc(item.details || '')}</textarea></div>
        <div class="admin-inline-actions">
          <button class="btn btn-success btn-small" type="button" data-save-place-needs="${esc(item.need_uid)}">Save Need Update</button>
          <button class="btn btn-danger btn-small" type="button" data-delete-place-needs="${esc(item.need_uid)}">Delete Need Update</button>
        </div>
      </article>
    `).join('');
  }

  const snapshots = state.placeSpiderSnapshots
    .filter((item) => item.place_uid === entity.entity_uid)
    .sort((left, right) => new Date(right.recorded_at || 0).getTime() - new Date(left.recorded_at || 0).getTime());
  if (!snapshots.length) {
    placeAdminSpiderListEl.innerHTML = '<article class="admin-card"><p>No approved spider chart records for this Place yet.</p></article>';
  } else {
    placeAdminSpiderListEl.innerHTML = snapshots.map((item) => `
      <article class="admin-card place-spider-admin-card">
        <div class="admin-card-header">
          <h4>${esc(item.title || entity.entity_name || 'Spider chart')}</h4>
          <span class="admin-badge">${esc(formatDateTime(item.recorded_at))}</span>
        </div>
        <div class="form-group"><label>Title</label><input type="text" data-admin-place-spider-title value="${esc(item.title || '')}" /></div>
        <div class="form-group"><label>Recorded At</label><input type="datetime-local" data-admin-place-spider-recorded-at value="${esc(String(item.recorded_at || '').slice(0, 16))}" /></div>
        <div class="form-group"><label>Notes</label><textarea rows="3" data-admin-place-spider-notes>${esc(item.notes || '')}</textarea></div>
        <div class="place-spider-admin-metrics">${renderPlaceSpiderMetricRows(item)}</div>
        <div class="admin-inline-actions">
          <button class="btn btn-success btn-small" type="button" data-save-place-spider="${esc(item.snapshot_uid)}">Save Spider Chart</button>
        </div>
      </article>
    `).join('');
  }

  const documents = state.placeDocuments
    .filter((item) => item.place_uid === entity.entity_uid)
    .sort((left, right) => new Date(right.recorded_at || 0).getTime() - new Date(left.recorded_at || 0).getTime());
  if (!documents.length) {
    placeAdminDocumentListEl.innerHTML = '<article class="admin-card"><p>No approved documents for this Place yet.</p></article>';
  } else {
    placeAdminDocumentListEl.innerHTML = documents.map((item) => `
      <article class="admin-card">
        <div class="admin-card-header">
          <h4>${esc(item.title || item.file_name || 'Document')}</h4>
          <span class="admin-badge">${esc(formatDateTime(item.recorded_at))}</span>
        </div>
        <p><strong>File:</strong> ${esc(item.file_name || 'Unknown file')}</p>
        <p>${esc(item.description || 'No description')}</p>
        <div class="admin-inline-actions">
          <a class="btn btn-small" href="${esc(item.file_url)}" target="_blank" rel="noreferrer">Open</a>
          <button class="btn btn-danger btn-small" type="button" data-delete-place-document="${esc(item.document_uid)}">Delete</button>
        </div>
      </article>
    `).join('');
  }
  const titleEl = document.getElementById('placeAdminDocumentTitle');
  const needsThematicsEl = document.getElementById('placeAdminNeedsThematics');
  const needsOrgEl = document.getElementById('placeAdminNeedsOrg');
  const needsRecordedAtEl = document.getElementById('placeAdminNeedsRecordedAt');
  const needsDetailsEl = document.getElementById('placeAdminNeedsDetails');
  const descriptionEl = document.getElementById('placeAdminDocumentDescription');
  const documentDateEl = document.getElementById('placeAdminDocumentDate');
  const recordedAtEl = document.getElementById('placeAdminDocumentRecordedAt');
  const fileEl = document.getElementById('placeAdminDocumentFile');
  if (titleEl) titleEl.value = '';
  if (needsThematicsEl) needsThematicsEl.value = '';
  if (needsOrgEl) needsOrgEl.value = '';
  if (needsRecordedAtEl && !needsRecordedAtEl.value) needsRecordedAtEl.value = new Date().toISOString().slice(0, 16);
  if (needsDetailsEl) needsDetailsEl.value = '';
  if (descriptionEl) descriptionEl.value = '';
  if (documentDateEl) documentDateEl.value = '';
  if (recordedAtEl && !recordedAtEl.value) recordedAtEl.value = new Date().toISOString().slice(0, 16);
  if (fileEl) fileEl.value = '';
  setStatus(placeAdminDocumentStatusEl, '');
}

function setEditorVisibility(visible) {
  adminEditorEmpty.style.display = visible ? 'none' : 'block';
  adminEditorFields.classList.toggle('active', Boolean(visible));
}

function renderEditDynamicFields(entityTypeSlug, values) {
  renderDynamicFields(editDynamicFieldsEl, state.fieldDefinitions, entityTypeSlug, values || {}, 'edit-dynamic');
}

function fillEditor(entity) {
  editEls.entityUid.value = entity.entity_uid || '';
  editEls.entityType.value = entity.entity_type_slug || '';
  editEls.entityName.value = entity.entity_name || '';
  editEls.summary.value = entity.summary || '';
  editEls.description.value = entity.description || '';
  editEls.locationLabel.value = entity.location_label || '';
  editEls.address.value = entity.primary_address || '';
  editEls.district.value = entity.district || '';
  editEls.state.value = entity.state || '';
  editEls.email.value = entity.contact_email || '';
  editEls.phone.value = entity.contact_phone || '';
  editEls.website.value = entity.website_url || '';
  editEls.socialMedia.value = formatSocialLinks(entity.social_media || {});
  editEls.officeLocations.value = formatOfficeLocations(entity.office_locations || []);
  editEls.tags.value = (entity.tags || []).join(', ');
  editEls.keywords.value = (entity.keywords || []).join(', ');
  editEls.latitude.value = entity.latitude ?? '';
  editEls.longitude.value = entity.longitude ?? '';
  editEls.adminNotes.value = entity.admin_notes || '';
  renderEditDynamicFields(entity.entity_type_slug, entity.type_specific_data || {});
  renderPlaceAdminCollections(entity);
  setEditorVisibility(true);
}

function selectEntity(entityUid) {
  state.selectedEntityUid = entityUid;
  const entity = state.entities.find((item) => item.entity_uid === entityUid);
  if (!entity) {
    setEditorVisibility(false);
    if (placeAdminToolsEl) placeAdminToolsEl.hidden = true;
    return;
  }
  fillEditor(entity);
  renderEntityResults();
  setStatus(adminEditStatus, '');
}

function rerenderDynamicFieldsForSelectedType() {
  const selectedType = editEls.entityType.value;
  const existingValues = collectDynamicFieldValues(editDynamicFieldsEl);
  renderEditDynamicFields(selectedType, existingValues);
  const selectedEntity = state.entities.find((item) => item.entity_uid === state.selectedEntityUid);
  const shouldShowPlaceTools = selectedEntity?.entity_type_slug === 'place' && selectedType === 'place';
  if (!shouldShowPlaceTools) {
    if (placeAdminToolsEl) placeAdminToolsEl.hidden = true;
    placeAdminToolsEl?.querySelectorAll('input, textarea, select, button').forEach((element) => {
      if ('disabled' in element) element.disabled = true;
    });
    if (placeAdminNeedsListEl) placeAdminNeedsListEl.innerHTML = '';
    if (placeAdminSpiderListEl) placeAdminSpiderListEl.innerHTML = '';
    if (placeAdminDocumentListEl) placeAdminDocumentListEl.innerHTML = '';
    setStatus(placeAdminNeedsStatusEl, '');
    setStatus(placeAdminDocumentStatusEl, '');
    return;
  }
  renderPlaceAdminCollections(selectedEntity);
}

async function loadAdminData() {
  await refreshSharedAdminSession();
  const data = await adminRequest('loadAdminData', {});
  state.entityTypes = Array.isArray(data.entityTypes) ? data.entityTypes : [];
  state.entities = Array.isArray(data.entities) ? data.entities : [];
  state.fieldDefinitions = Array.isArray(data.fieldDefinitions) ? data.fieldDefinitions : [];
  state.submissions = Array.isArray(data.submissions) ? data.submissions : [];
  state.contactRequests = Array.isArray(data.contactRequests) ? data.contactRequests : [];
  state.placeDocumentSubmissions = Array.isArray(data.placeDocumentSubmissions) ? data.placeDocumentSubmissions : [];
  state.placeSpiderSubmissions = Array.isArray(data.placeSpiderSubmissions) ? data.placeSpiderSubmissions : [];
  state.placeDocuments = Array.isArray(data.placeDocuments) ? data.placeDocuments : [];
  state.placeSpiderSnapshots = Array.isArray(data.placeSpiderSnapshots) ? data.placeSpiderSnapshots : [];
  state.placeThematicNeeds = Array.isArray(data.placeThematicNeeds) ? data.placeThematicNeeds : [];
  populateTypeOptions();
  filterEntities();
  renderSubmissions();
  renderPlaceDocumentSubmissions();
  renderPlaceSpiderSubmissions();
  renderEntityResults();
  renderContactRequests();
  if (state.selectedEntityUid) selectEntity(state.selectedEntityUid);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(value);
      if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0].map((header) => String(header || '').trim());
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function parseJsonSafe(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  return JSON.parse(raw);
}

async function runBulkUpload() {
  const file = document.getElementById('bulkUploadFile').files?.[0];
  if (!file) {
    setStatus(bulkUploadStatus, 'Choose a CSV file first.', true);
    return;
  }
  setStatus(bulkUploadStatus, 'Reading CSV...');
  try {
    const text = await file.text();
    const parsed = parseCsv(text);

    const typeFieldKeys = {};
    state.fieldDefinitions.forEach((f) => {
      if (!typeFieldKeys[f.type_slug]) typeFieldKeys[f.type_slug] = [];
      typeFieldKeys[f.type_slug].push(f);
    });

    const rows = parsed.map((row) => {
      const typeSlug = String(row.entity_type_slug || '').trim();
      const fields = typeFieldKeys[typeSlug] || [];

      const typeValues = {};
      fields.forEach((f) => {
        const raw = row[f.field_key];
        if (raw === undefined || raw === null || String(raw).trim() === '') return;
        if (f.input_type === 'tags' || f.input_type === 'multiselect') {
          typeValues[f.field_key] = String(raw).split('|').map((v) => v.trim()).filter(Boolean);
        } else if (f.input_type === 'number') {
          typeValues[f.field_key] = Number(raw);
        } else {
          typeValues[f.field_key] = String(raw).trim();
        }
      });

      const existingJson = parseJsonSafe(row.type_specific_data_json, {});
      const mergedTypeData = { ...existingJson, ...typeValues };

      return {
        entity_type_slug: typeSlug,
        entity_name: String(row.entity_name || '').trim(),
        summary: String(row.summary || '').trim(),
        description: String(row.description || '').trim(),
        location_label: String(row.location_label || '').trim(),
        primary_address: String(row.primary_address || '').trim(),
        district: String(row.district || '').trim(),
        state: String(row.state || '').trim(),
        country: String(row.country || 'India').trim(),
        contact_email: String(row.contact_email || '').trim(),
        contact_phone: String(row.contact_phone || '').trim(),
        website_url: String(row.website_url || '').trim(),
        social_media: parseJsonSafe(row.social_media_json, {}),
        office_locations: parseJsonSafe(row.office_locations_json, []),
        tags: parseTagList(row.tags),
        keywords: parseTagList(row.keywords),
        latitude: row.latitude ? Number(row.latitude) : null,
        longitude: row.longitude ? Number(row.longitude) : null,
        source_label: String(row.source_label || 'Bulk upload').trim(),
        source_url: String(row.source_url || '').trim(),
        created_by_name: String(row.created_by_name || 'Admin bulk upload').trim(),
        created_by_email: String(row.created_by_email || '').trim(),
        type_specific_data: mergedTypeData,
      };
    });
    const data = await adminRequest('bulkUploadEntities', { rows });
    setStatus(bulkUploadStatus, `Bulk upload completed: ${data.upsertedCount || 0} record(s).`);
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Bulk upload failed.', true);
  }
}

function escCsv(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCsvExampleRow(typeSlug, typeFields) {
  const examples = {
    mentor: { entity_type_slug: 'mentor', entity_name: 'Example Mentor', summary: 'Supports rural entrepreneurs', location_label: 'Raipur, Chhattisgarh', district: 'Raipur', state: 'Chhattisgarh', contact_email: 'mentor@example.org', contact_phone: '+91-9000000000', website_url: 'https://example.org', social_media_json: '{"linkedin":"https://linkedin.com/in/example"}', tags: 'mentoring,advisory', keywords: 'livelihoods,incubation', latitude: '21.2514', longitude: '81.6296', domain_expertise: 'Market access|Enterprise strategy', mentoring_modes: 'In person|Phone|Video call', languages_spoken: 'Hindi|English', years_experience: '10', geography_served: 'Chhattisgarh' },
    community_steward: { entity_type_slug: 'community_steward', entity_name: 'Example Steward', summary: 'Community mobiliser supporting SHGs', location_label: 'Sukma, Chhattisgarh', district: 'Sukma', state: 'Chhattisgarh', contact_email: 'steward@example.org', contact_phone: '+91-9111111111', tags: 'mobilisation,training', community_focus: 'Women SHGs|youth', geography_served: 'Sukma district', languages_spoken: 'Hindi|Gondi', support_areas: 'Mobilisation|training' },
    volunteer: { entity_type_slug: 'volunteer', entity_name: 'Example Volunteer', summary: 'Available for field data collection', location_label: 'Bhopal, Madhya Pradesh', district: 'Bhopal', state: 'Madhya Pradesh', contact_email: 'volunteer@example.org', tags: 'field work, data collection', skills: 'Data collection|Survey design', cause_areas: 'Education|livelihoods', availability_type: 'Flexible', preferred_geography: 'Madhya Pradesh' },
    intern: { entity_type_slug: 'intern', entity_name: 'Example Intern', summary: 'Looking for a 3-month field internship', location_label: 'Pune, Maharashtra', district: 'Pune', state: 'Maharashtra', contact_email: 'intern@example.org', tags: 'internship, rural development', field_of_study: 'Rural development|Commerce', current_institution: 'TISS Mumbai', education_level: 'Postgraduate', skills: 'Research|Field surveys', availability_period: 'June-August 2026', preferred_domains: 'Livelihoods', stipend_expectation: 'Rs 10,000/month' },
    incubation_centre: { entity_type_slug: 'incubation_centre', entity_name: 'Example Incubation Centre', summary: 'Supports early-stage rural enterprises', location_label: 'Bengaluru, Karnataka', district: 'Bengaluru Urban', state: 'Karnataka', contact_email: 'info@exampleinc.org', website_url: 'https://exampleinc.org', tags: 'incubation,startup support', thematic_areas: 'Agriculture|Climate|Health', startup_stages_supported: 'Idea stage|Validation|Early traction', geography_served: 'Karnataka|Pan-India', support_services: 'Mentoring|Labs|Market access' },
    accelerator: { entity_type_slug: 'accelerator', entity_name: 'Example Accelerator', summary: 'Runs cohort and field support programmes', location_label: 'Mumbai, Maharashtra', district: 'Mumbai', state: 'Maharashtra', contact_email: 'team@exampleacc.org', website_url: 'https://exampleacc.org', tags: 'acceleration,investor-readiness', thematic_areas: 'Climate|Agriculture|Fintech', startup_stages_supported: 'Validation|Early traction|Scaling', geography_served: 'Nationwide|Virtual', support_services: 'Cohort program|Mentorship' },
    institute: { entity_type_slug: 'institute', entity_name: 'Example Institute', summary: 'Research and training institute for rural livelihoods', location_label: 'Anand, Gujarat', district: 'Anand', state: 'Gujarat', contact_email: 'contact@exampleinst.org', website_url: 'https://exampleinst.org', tags: 'research,training', thematic_areas: 'Agriculture|Rural livelihoods|Design', departments_or_centres: 'Agribusiness centre|Extension wing', geography_served: 'Gujarat|National', partnership_types: 'Research|Training|Field pilots' },
    trader_association: { entity_type_slug: 'trader_association', entity_name: 'Example Trader Association', summary: 'Collective of local commodity traders', location_label: 'Raipur, Chhattisgarh', district: 'Raipur', state: 'Chhattisgarh', contact_email: 'info@exampleta.org', tags: 'trade,commodities', commodities_or_sectors: 'Pulses|Textiles|Forest produce', geography_served: 'Raipur market area', member_base: '150+ traders', registration_status: 'Registered' },
    cso: { entity_type_slug: 'cso', entity_name: 'Example CSO', summary: 'Grassroots organisation working on women empowerment', location_label: 'Jharsuguda, Odisha', district: 'Jharsuguda', state: 'Odisha', contact_email: 'info@examplecso.org', website_url: 'https://examplecso.org', tags: 'women empowerment,livelihoods', areas_of_work: 'Women empowerment|Skilling|WASH', beneficiary_groups: 'Women|Farmers|Youth', geography_served: 'Western Odisha', registration_status: 'Trust', programs: 'SHG formation|Livelihood training|WASH awareness' },
    csr_philanthropy: { entity_type_slug: 'csr_philanthropy', entity_name: 'Example CSR Funder', summary: 'CSR funding for climate and livelihoods', location_label: 'New Delhi, Delhi', district: 'New Delhi', state: 'Delhi', contact_email: 'csr@examplefunder.org', website_url: 'https://examplefunder.org', tags: 'CSR,funding', focus_areas: 'Livelihoods|Climate resilience|Women enterprise', geography_served: 'Aspirational districts|Nationwide', support_instruments: 'CSR grant|Technical assistance|Capacity building', typical_support_size: 'Rs 10 lakh-Rs 50 lakh' },
    environmental_expert: { entity_type_slug: 'environmental_expert', entity_name: 'Example Environmental Expert', summary: 'Climate adaptation and water stewardship specialist', location_label: 'Dehradun, Uttarakhand', district: 'Dehradun', state: 'Uttarakhand', contact_email: 'expert@example.org', tags: 'climate,water,waste', domain_expertise: 'Climate adaptation|Water stewardship|Waste management', sector_experience: 'Agriculture|Forestry|Energy', service_offerings: 'Assessment/audit|Training/capacity building|Advisory/strategy', years_experience: '12', geography_served: 'Uttarakhand|Himalayan region', languages_spoken: 'Hindi|English' },
    story_teller: { entity_type_slug: 'story_teller', entity_name: 'Example Storyteller', summary: 'Community journalist covering rural livelihoods', location_label: 'Kalahandi, Odisha', district: 'Kalahandi', state: 'Odisha', contact_email: 'storyteller@example.org', tags: 'storytelling,media', storytelling_modes: 'Written|Video|Social Media', youtube_url: 'https://youtube.com/@example', languages: 'Odia, Hindi, English', geography_served: 'Western Odisha', reach: '15k followers, Local WhatsApp groups' },
    place: { entity_type_slug: 'place', entity_name: 'Example Village | Village', summary: 'A sample village in Chhattisgarh', location_label: 'Example Village | Village', district: 'Raipur', state: 'Chhattisgarh', tags: 'village,model', place_kind: 'Village', village_name: 'Example Village', gram_panchayat_name: 'Example GP', block_name: 'Example Block', district_name: 'Raipur', state_name: 'Chhattisgarh' },
  };
  return examples[typeSlug] || { entity_type_slug: typeSlug, entity_name: 'Example ' + (typeSlug || 'Entity'), summary: 'Description of this entity', location_label: 'Example location', district: 'District', state: 'State', contact_email: 'email@example.org' };
}

function downloadCsvTemplate() {
  const typeSlug = document.getElementById('bulkUploadEntityType').value;
  const type = state.entityTypes.find((t) => t.type_slug === typeSlug);
  const filename = typeSlug ? `bulk-upload-template-${typeSlug}.csv` : 'bulk-upload-template.csv';

  const baseColumns = [
    'entity_type_slug', 'entity_name', 'summary', 'description',
    'location_label', 'primary_address', 'district', 'state', 'country',
    'contact_email', 'contact_phone', 'website_url',
    'social_media_json', 'office_locations_json', 'tags', 'keywords',
    'latitude', 'longitude', 'source_label', 'source_url',
    'created_by_name', 'created_by_email',
  ];

  const typeFields = typeSlug
    ? state.fieldDefinitions
        .filter((f) => f.type_slug === typeSlug)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    : [];

  const typeColumnKeys = typeFields.map((f) => f.field_key);
  const allColumns = [...baseColumns, ...typeColumnKeys, 'type_specific_data_json'];

  const exampleRow = typeSlug ? buildCsvExampleRow(typeSlug, typeFields) : {
    entity_type_slug: 'mentor',
    entity_name: 'Example Mentor',
    summary: 'Supports rural entrepreneurs',
    location_label: 'Raipur, Chhattisgarh',
    district: 'Raipur',
    state: 'Chhattisgarh',
    contact_email: 'mentor@example.org',
    contact_phone: '+91-9000000000',
    tags: 'mentoring, advisory',
    keywords: 'livelihoods, incubation',
    latitude: '21.2514',
    longitude: '81.6296',
    type_specific_data_json: '{}',
  };

  const headerRow = allColumns.map(escCsv).join(',');
  const valueRow = allColumns.map((col) => escCsv(exampleRow[col] ?? '')).join(',');

  const csv = '\uFEFF' + headerRow + '\n' + valueRow + '\n';

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function approveSubmission(submissionId) {
  setStatus(bulkUploadStatus, 'Approving submission...');
  try {
    await adminRequest('approveSubmission', { submissionId });
    setStatus(bulkUploadStatus, 'Submission approved.');
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Approval failed.', true);
  }
}

async function rejectSubmission(submissionId) {
  setStatus(bulkUploadStatus, 'Rejecting submission...');
  try {
    await adminRequest('rejectSubmission', { submissionId });
    setStatus(bulkUploadStatus, 'Submission rejected.');
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Rejection failed.', true);
  }
}

async function approvePlaceDocument(placeSubmissionId) {
  setStatus(bulkUploadStatus, 'Approving place document...');
  try {
    await adminRequest('approvePlaceDocument', { placeSubmissionId });
    setStatus(bulkUploadStatus, 'Place document approved.');
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Place document approval failed.', true);
  }
}

async function rejectPlaceDocument(placeSubmissionId) {
  setStatus(bulkUploadStatus, 'Rejecting place document...');
  try {
    await adminRequest('rejectPlaceDocument', { placeSubmissionId });
    setStatus(bulkUploadStatus, 'Place document rejected.');
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Place document rejection failed.', true);
  }
}

async function approvePlaceSpider(placeSubmissionId) {
  setStatus(bulkUploadStatus, 'Approving place spider chart...');
  try {
    await adminRequest('approvePlaceSpider', { placeSubmissionId });
    setStatus(bulkUploadStatus, 'Place spider chart approved.');
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Place spider chart approval failed.', true);
  }
}

async function rejectPlaceSpider(placeSubmissionId) {
  setStatus(bulkUploadStatus, 'Rejecting place spider chart...');
  try {
    await adminRequest('rejectPlaceSpider', { placeSubmissionId });
    setStatus(bulkUploadStatus, 'Place spider chart rejected.');
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Place spider chart rejection failed.', true);
  }
}

async function saveEntity(event) {
  event.preventDefault();
  const entityUid = String(editEls.entityUid.value || '').trim();
  if (!entityUid) {
    setStatus(adminEditStatus, 'Select a record first.', true);
    return;
  }
  setStatus(adminEditStatus, 'Saving changes...');
  try {
    await adminRequest('updateEntity', {
      entityUid,
      updates: {
        entity_type_slug: editEls.entityType.value,
        entity_name: editEls.entityName.value,
        summary: editEls.summary.value,
        description: editEls.description.value,
        location_label: editEls.locationLabel.value,
        primary_address: editEls.address.value,
        district: editEls.district.value,
        state: editEls.state.value,
        contact_email: editEls.email.value,
        contact_phone: editEls.phone.value,
        website_url: editEls.website.value,
        social_media: parseSocialLinks(editEls.socialMedia.value),
        office_locations: parseOfficeLocations(editEls.officeLocations.value),
        tags: parseTagList(editEls.tags.value),
        keywords: parseTagList(editEls.keywords.value),
        latitude: editEls.latitude.value ? Number(editEls.latitude.value) : null,
        longitude: editEls.longitude.value ? Number(editEls.longitude.value) : null,
        type_specific_data: collectDynamicFieldValues(editDynamicFieldsEl),
        admin_notes: editEls.adminNotes.value,
      },
    });
    setStatus(adminEditStatus, 'Record updated.');
    await loadAdminData();
    selectEntity(entityUid);
  } catch (error) {
    setStatus(adminEditStatus, error.message || 'Update failed.', true);
  }
}

function collectAdminSpiderMetrics(card) {
  return Object.fromEntries(PLACE_SPIDER_METRICS.map((metric) => {
    const scoreEl = card.querySelector(`[data-admin-place-score="${metric.key}"]`);
    const maxEl = card.querySelector(`[data-admin-place-max="${metric.key}"]`);
    return [metric.key, {
      score: Number(scoreEl?.value || 0),
      max_score: Number(maxEl?.value || metric.defaultMax || 5),
    }];
  }));
}

async function savePlaceSpiderSnapshot(snapshotUid, triggerButton) {
  const card = triggerButton.closest('.place-spider-admin-card');
  if (!card) return;
  setStatus(bulkUploadStatus, 'Saving spider chart...');
  try {
    await adminRequest('updatePlaceSpiderSnapshot', {
      snapshotUid,
      updates: {
        title: card.querySelector('[data-admin-place-spider-title]')?.value || '',
        recorded_at: card.querySelector('[data-admin-place-spider-recorded-at]')?.value || '',
        notes: card.querySelector('[data-admin-place-spider-notes]')?.value || '',
        metrics_json: collectAdminSpiderMetrics(card),
      },
    });
    setStatus(bulkUploadStatus, 'Spider chart updated.');
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Spider chart update failed.', true);
  }
}

async function savePlaceNeedRecord(needUid, triggerButton) {
  const card = triggerButton.closest('.admin-card');
  if (!card) return;
  setStatus(bulkUploadStatus, 'Saving thematic need update...');
  try {
    await adminRequest('updatePlaceThematicNeedRecord', {
      needUid,
      updates: {
        thematic_needs: parseLineList(card.querySelector('[data-admin-place-needs-thematics]')?.value),
        updated_by_org: card.querySelector('[data-admin-place-needs-org]')?.value || '',
        recorded_at: card.querySelector('[data-admin-place-needs-recorded-at]')?.value || '',
        details: card.querySelector('[data-admin-place-needs-details]')?.value || '',
      },
    });
    setStatus(bulkUploadStatus, 'Thematic need update saved.');
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Thematic need update failed.', true);
  }
}

async function deletePlaceNeedRecord(needUid) {
  setStatus(bulkUploadStatus, 'Deleting thematic need update...');
  try {
    await adminRequest('deletePlaceThematicNeedRecord', { needUid });
    setStatus(bulkUploadStatus, 'Thematic need update deleted.');
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Thematic need delete failed.', true);
  }
}

async function createPlaceNeedRecord() {
  const entityUid = String(editEls.entityUid.value || '').trim();
  const entity = state.entities.find((item) => item.entity_uid === entityUid);
  if (!entity || entity.entity_type_slug !== 'place') {
    setStatus(placeAdminNeedsStatusEl, 'Select a Place record first.', true);
    return;
  }
  const thematicNeeds = parseLineList(document.getElementById('placeAdminNeedsThematics').value);
  if (!thematicNeeds.length) {
    setStatus(placeAdminNeedsStatusEl, 'Add at least one thematic need.', true);
    return;
  }
  const updatedByOrg = String(document.getElementById('placeAdminNeedsOrg').value || '').trim();
  if (!updatedByOrg) {
    setStatus(placeAdminNeedsStatusEl, 'Organisation name is required.', true);
    return;
  }
  setStatus(placeAdminNeedsStatusEl, 'Saving thematic need update...');
  try {
    await adminRequest('createPlaceThematicNeedRecord', {
      submission: {
        place_uid: entity.entity_uid,
        place_name: entity.entity_name,
        thematic_needs: thematicNeeds,
        details: document.getElementById('placeAdminNeedsDetails').value,
        updated_by_org: updatedByOrg,
        updated_by_name: 'Admin',
        updated_by_email: '',
        recorded_at: document.getElementById('placeAdminNeedsRecordedAt').value || new Date().toISOString().slice(0, 16),
      },
    });
    setStatus(placeAdminNeedsStatusEl, 'Thematic need update added.');
    await loadAdminData();
  } catch (error) {
    setStatus(placeAdminNeedsStatusEl, error.message || 'Thematic need create failed.', true);
  }
}

async function deletePlaceDocumentRecord(documentUid) {
  setStatus(bulkUploadStatus, 'Deleting document...');
  try {
    await adminRequest('deletePlaceDocumentRecord', { documentUid });
    setStatus(bulkUploadStatus, 'Document deleted.');
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Document delete failed.', true);
  }
}

async function uploadApprovedPlaceDocument() {
  const entityUid = String(editEls.entityUid.value || '').trim();
  const entity = state.entities.find((item) => item.entity_uid === entityUid);
  const file = document.getElementById('placeAdminDocumentFile').files?.[0];
  if (!entity || entity.entity_type_slug !== 'place') {
    setStatus(placeAdminDocumentStatusEl, 'Select a Place record first.', true);
    return;
  }
  if (!file) {
    setStatus(placeAdminDocumentStatusEl, 'Choose a file first.', true);
    return;
  }
  if (file.size > (10 * 1024 * 1024)) {
    setStatus(placeAdminDocumentStatusEl, 'Please keep uploaded documents under 10 MB.', true);
    return;
  }
  setStatus(placeAdminDocumentStatusEl, 'Uploading approved document...');
  try {
    const fileContentBase64 = await readFileAsBase64(file);
    await adminRequest('createPlaceDocumentRecord', {
      submission: {
        place_uid: entity.entity_uid,
        place_name: entity.entity_name,
        title: document.getElementById('placeAdminDocumentTitle').value || file.name,
        description: document.getElementById('placeAdminDocumentDescription').value,
        document_date: document.getElementById('placeAdminDocumentDate').value,
        recorded_at: document.getElementById('placeAdminDocumentRecordedAt').value,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        file_content_base64: fileContentBase64,
      },
    });
    document.getElementById('placeAdminDocumentTitle').value = '';
    document.getElementById('placeAdminDocumentDescription').value = '';
    document.getElementById('placeAdminDocumentDate').value = '';
    document.getElementById('placeAdminDocumentRecordedAt').value = new Date().toISOString().slice(0, 16);
    document.getElementById('placeAdminDocumentFile').value = '';
    setStatus(placeAdminDocumentStatusEl, 'Approved document uploaded.');
    await loadAdminData();
  } catch (error) {
    setStatus(placeAdminDocumentStatusEl, error.message || 'Document upload failed.', true);
  }
}

async function deleteEntity() {
  const entityUid = String(editEls.entityUid.value || '').trim();
  if (!entityUid) {
    setStatus(adminEditStatus, 'Select a record first.', true);
    return;
  }
  setStatus(adminEditStatus, 'Deleting record...');
  try {
    await adminRequest('deleteEntity', { entityUid });
    state.selectedEntityUid = '';
    setStatus(adminEditStatus, 'Record deleted.');
    setEditorVisibility(false);
    await loadAdminData();
  } catch (error) {
    setStatus(adminEditStatus, error.message || 'Delete failed.', true);
  }
}

document.getElementById('downloadCsvTemplate').addEventListener('click', downloadCsvTemplate);
document.getElementById('runBulkUpload').addEventListener('click', runBulkUpload);
document.getElementById('adminSearchInput').addEventListener('input', () => {
  filterEntities();
  renderEntityResults();
});
document.getElementById('adminEntityTypeFilter').addEventListener('change', () => {
  filterEntities();
  renderEntityResults();
});
editEls.entityType.addEventListener('change', rerenderDynamicFieldsForSelectedType);
document.getElementById('adminEditForm').addEventListener('submit', saveEntity);
document.getElementById('deleteEntityButton').addEventListener('click', deleteEntity);
document.getElementById('placeAdminDocumentUploadButton').addEventListener('click', uploadApprovedPlaceDocument);
document.getElementById('placeAdminNeedsSaveButton').addEventListener('click', createPlaceNeedRecord);
submissionQueue.addEventListener('click', (event) => {
  const approveButton = event.target.closest('[data-approve-submission]');
  if (approveButton) {
    approveSubmission(approveButton.dataset.approveSubmission);
    return;
  }
  const rejectButton = event.target.closest('[data-reject-submission]');
  if (rejectButton) rejectSubmission(rejectButton.dataset.rejectSubmission);
});

placeDocumentQueue.addEventListener('click', (event) => {
  const approveButton = event.target.closest('[data-approve-place-document]');
  if (approveButton) {
    approvePlaceDocument(approveButton.dataset.approvePlaceDocument);
    return;
  }
  const rejectButton = event.target.closest('[data-reject-place-document]');
  if (rejectButton) rejectPlaceDocument(rejectButton.dataset.rejectPlaceDocument);
});

placeSpiderQueue.addEventListener('click', (event) => {
  const approveButton = event.target.closest('[data-approve-place-spider]');
  if (approveButton) {
    approvePlaceSpider(approveButton.dataset.approvePlaceSpider);
    return;
  }
  const rejectButton = event.target.closest('[data-reject-place-spider]');
  if (rejectButton) rejectPlaceSpider(rejectButton.dataset.rejectPlaceSpider);
});
placeAdminSpiderListEl?.addEventListener('click', (event) => {
  const saveButton = event.target.closest('[data-save-place-spider]');
  if (saveButton) savePlaceSpiderSnapshot(saveButton.dataset.savePlaceSpider, saveButton);
});
placeAdminNeedsListEl?.addEventListener('click', (event) => {
  const saveButton = event.target.closest('[data-save-place-needs]');
  if (saveButton) {
    savePlaceNeedRecord(saveButton.dataset.savePlaceNeeds, saveButton);
    return;
  }
  const deleteButton = event.target.closest('[data-delete-place-needs]');
  if (deleteButton) deletePlaceNeedRecord(deleteButton.dataset.deletePlaceNeeds);
});
placeAdminDocumentListEl?.addEventListener('click', (event) => {
  const deleteButton = event.target.closest('[data-delete-place-document]');
  if (deleteButton) deletePlaceDocumentRecord(deleteButton.dataset.deletePlaceDocument);
});

(async function initAdmin() {
  await refreshSharedAdminSession();
  try {
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Could not load admin data.', true);
  }
})();
