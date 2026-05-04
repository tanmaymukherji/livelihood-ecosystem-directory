const loginStatus = document.getElementById('loginStatus');
const sessionStatus = document.getElementById('sessionStatus');
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
const ADMIN_SESSION_KEY = 'livelihood-ecosystem-admin-session';

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
  selectedEntityUid: '',
};

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

function togglePanels(isSignedIn) {
  ['bulkUploadPanel', 'submissionQueuePanel', 'placeDocumentQueuePanel', 'placeSpiderQueuePanel', 'adminEditorPanel', 'contactRequestPanel'].forEach((id) => {
    document.getElementById(id).classList.toggle('active', Boolean(isSignedIn));
  });
}

function populateTypeOptions() {
  const selectEls = [document.getElementById('adminEntityTypeFilter'), editEls.entityType];
  selectEls.forEach((selectEl, index) => {
    if (!selectEl) return;
    const previous = selectEl.value;
    selectEl.innerHTML = index === 0 ? '<option value="">All entity types</option>' : '';
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
  setEditorVisibility(true);
}

function selectEntity(entityUid) {
  state.selectedEntityUid = entityUid;
  const entity = state.entities.find((item) => item.entity_uid === entityUid);
  if (!entity) {
    setEditorVisibility(false);
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
}

async function verifySession() {
  const token = getStoredToken();
  if (!token) {
    togglePanels(false);
    return false;
  }
  try {
    const data = await EcosystemStore.adminRequest('verify', { token });
    if (!data?.valid) throw new Error('Invalid session');
    togglePanels(true);
    return true;
  } catch {
    setStoredToken('');
    togglePanels(false);
    submissionQueueMeta.textContent = 'Your admin session has expired. Please sign in again.';
    placeDocumentQueueMeta.textContent = 'Your admin session has expired. Please sign in again.';
    placeSpiderQueueMeta.textContent = 'Your admin session has expired. Please sign in again.';
    adminSearchMeta.textContent = 'Your admin session has expired. Please sign in again.';
    contactRequestMeta.textContent = 'Your admin session has expired. Please sign in again.';
    return false;
  }
}

async function loadAdminData() {
  const token = getStoredToken();
  if (!token) return;
  const data = await EcosystemStore.adminRequest('loadAdminData', { token });
  state.entityTypes = Array.isArray(data.entityTypes) ? data.entityTypes : [];
  state.entities = Array.isArray(data.entities) ? data.entities : [];
  state.fieldDefinitions = Array.isArray(data.fieldDefinitions) ? data.fieldDefinitions : [];
  state.submissions = Array.isArray(data.submissions) ? data.submissions : [];
  state.contactRequests = Array.isArray(data.contactRequests) ? data.contactRequests : [];
  state.placeDocumentSubmissions = Array.isArray(data.placeDocumentSubmissions) ? data.placeDocumentSubmissions : [];
  state.placeSpiderSubmissions = Array.isArray(data.placeSpiderSubmissions) ? data.placeSpiderSubmissions : [];
  state.placeDocuments = Array.isArray(data.placeDocuments) ? data.placeDocuments : [];
  state.placeSpiderSnapshots = Array.isArray(data.placeSpiderSnapshots) ? data.placeSpiderSnapshots : [];
  populateTypeOptions();
  filterEntities();
  renderSubmissions();
  renderPlaceDocumentSubmissions();
  renderPlaceSpiderSubmissions();
  renderEntityResults();
  renderContactRequests();
  if (state.selectedEntityUid) selectEntity(state.selectedEntityUid);
}

async function handleLogin(event) {
  event.preventDefault();
  const password = String(document.getElementById('adminPassword').value || '').trim();
  if (!password) {
    setStatus(loginStatus, 'Enter the admin password.', true);
    return;
  }
  setStatus(loginStatus, 'Signing in...');
  try {
    const data = await EcosystemStore.adminRequest('login', { password });
    if (!data?.token) throw new Error('Admin login failed.');
    setStoredToken(data.token);
    document.getElementById('adminPassword').value = '';
    togglePanels(true);
    setStatus(loginStatus, 'Signed in.');
    setStatus(sessionStatus, 'Admin session is active.');
    await loadAdminData();
  } catch (error) {
    setStatus(loginStatus, error.message || 'Admin login failed.', true);
  }
}

async function handleLogout() {
  const token = getStoredToken();
  try {
    if (token) await EcosystemStore.adminRequest('logout', { token });
  } catch {}
  setStoredToken('');
  togglePanels(false);
  state.entities = [];
  state.filteredEntities = [];
  state.submissions = [];
  state.contactRequests = [];
  state.selectedEntityUid = '';
  submissionQueue.innerHTML = '';
  adminSearchResults.innerHTML = '';
  contactRequestList.innerHTML = '';
  setEditorVisibility(false);
  setStatus(loginStatus, '');
  setStatus(sessionStatus, 'Signed out.');
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
  const token = getStoredToken();
  const file = document.getElementById('bulkUploadFile').files?.[0];
  if (!token || !file) {
    setStatus(bulkUploadStatus, 'Choose a CSV file first.', true);
    return;
  }
  setStatus(bulkUploadStatus, 'Reading CSV...');
  try {
    const text = await file.text();
    const rows = parseCsv(text).map((row) => ({
      entity_type_slug: String(row.entity_type_slug || '').trim(),
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
      type_specific_data: parseJsonSafe(row.type_specific_data_json, {}),
    }));
    const data = await EcosystemStore.adminRequest('bulkUploadEntities', { token, rows });
    setStatus(bulkUploadStatus, `Bulk upload completed: ${data.upsertedCount || 0} record(s).`);
    await loadAdminData();
  } catch (error) {
    setStatus(bulkUploadStatus, error.message || 'Bulk upload failed.', true);
  }
}

async function approveSubmission(submissionId) {
  setStatus(sessionStatus, 'Approving submission...');
  try {
    await EcosystemStore.adminRequest('approveSubmission', { token: getStoredToken(), submissionId });
    setStatus(sessionStatus, 'Submission approved.');
    await loadAdminData();
  } catch (error) {
    setStatus(sessionStatus, error.message || 'Approval failed.', true);
  }
}

async function rejectSubmission(submissionId) {
  setStatus(sessionStatus, 'Rejecting submission...');
  try {
    await EcosystemStore.adminRequest('rejectSubmission', { token: getStoredToken(), submissionId });
    setStatus(sessionStatus, 'Submission rejected.');
    await loadAdminData();
  } catch (error) {
    setStatus(sessionStatus, error.message || 'Rejection failed.', true);
  }
}

async function approvePlaceDocument(placeSubmissionId) {
  setStatus(sessionStatus, 'Approving place document...');
  try {
    await EcosystemStore.adminRequest('approvePlaceDocument', { token: getStoredToken(), placeSubmissionId });
    setStatus(sessionStatus, 'Place document approved.');
    await loadAdminData();
  } catch (error) {
    setStatus(sessionStatus, error.message || 'Place document approval failed.', true);
  }
}

async function rejectPlaceDocument(placeSubmissionId) {
  setStatus(sessionStatus, 'Rejecting place document...');
  try {
    await EcosystemStore.adminRequest('rejectPlaceDocument', { token: getStoredToken(), placeSubmissionId });
    setStatus(sessionStatus, 'Place document rejected.');
    await loadAdminData();
  } catch (error) {
    setStatus(sessionStatus, error.message || 'Place document rejection failed.', true);
  }
}

async function approvePlaceSpider(placeSubmissionId) {
  setStatus(sessionStatus, 'Approving place spider chart...');
  try {
    await EcosystemStore.adminRequest('approvePlaceSpider', { token: getStoredToken(), placeSubmissionId });
    setStatus(sessionStatus, 'Place spider chart approved.');
    await loadAdminData();
  } catch (error) {
    setStatus(sessionStatus, error.message || 'Place spider chart approval failed.', true);
  }
}

async function rejectPlaceSpider(placeSubmissionId) {
  setStatus(sessionStatus, 'Rejecting place spider chart...');
  try {
    await EcosystemStore.adminRequest('rejectPlaceSpider', { token: getStoredToken(), placeSubmissionId });
    setStatus(sessionStatus, 'Place spider chart rejected.');
    await loadAdminData();
  } catch (error) {
    setStatus(sessionStatus, error.message || 'Place spider chart rejection failed.', true);
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
    await EcosystemStore.adminRequest('updateEntity', {
      token: getStoredToken(),
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

async function deleteEntity() {
  const entityUid = String(editEls.entityUid.value || '').trim();
  if (!entityUid) {
    setStatus(adminEditStatus, 'Select a record first.', true);
    return;
  }
  setStatus(adminEditStatus, 'Deleting record...');
  try {
    await EcosystemStore.adminRequest('deleteEntity', { token: getStoredToken(), entityUid });
    state.selectedEntityUid = '';
    setStatus(adminEditStatus, 'Record deleted.');
    setEditorVisibility(false);
    await loadAdminData();
  } catch (error) {
    setStatus(adminEditStatus, error.message || 'Delete failed.', true);
  }
}

document.getElementById('loginForm').addEventListener('submit', handleLogin);
document.getElementById('logoutButton').addEventListener('click', handleLogout);
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

(async function initAdmin() {
  const valid = await verifySession();
  if (valid) {
    setStatus(sessionStatus, 'Admin session is active.');
    await loadAdminData();
  } else {
    setStatus(sessionStatus, 'Sign in to access the admin tools.');
  }
})();
