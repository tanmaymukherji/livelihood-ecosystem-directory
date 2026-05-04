const {
  esc,
  formatDynamicValue,
} = window.EcosystemForms;

const ADMIN_SESSION_KEY = 'livelihood-ecosystem-admin-session';

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

function getStoredAdminToken() {
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) || window.localStorage.getItem(ADMIN_SESSION_KEY) || '';
}

async function verifyAdminSession() {
  const token = getStoredAdminToken();
  if (!token) return { valid: false, token: '' };
  try {
    const response = await window.EcosystemStore.adminRequest('verify', { token });
    if (response?.valid) return { valid: true, token };
  } catch {}
  return { valid: false, token: '' };
}

function normalizePlaceMetricSet(metricsJson) {
  const source = metricsJson && typeof metricsJson === 'object' ? metricsJson : {};
  return PLACE_SPIDER_METRICS.map((metric) => {
    const entry = source[metric.key] && typeof source[metric.key] === 'object' ? source[metric.key] : {};
    const score = Math.max(0, Number(entry.score || 0));
    const maxScore = Math.max(1, Number(entry.max_score || metric.defaultMax || 5));
    const normalized = Math.max(0, Math.min(100, (score / maxScore) * 100));
    return {
      ...metric,
      score,
      maxScore,
      normalized,
    };
  });
}

function renderTypeSpecificDetails(entity, fieldDefinitions) {
  const definitions = asArray(fieldDefinitions)
    .filter((item) => item.type_slug === entity.entity_type_slug)
    .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
  const values = entity.type_specific_data && typeof entity.type_specific_data === 'object' ? entity.type_specific_data : {};
  const rows = definitions
    .map((field) => ({ field, value: formatDynamicValue(field, values[field.field_key]) }))
    .filter((item) => item.value);
  if (!rows.length) return '';
  return `<div class="vendor-inline-list"><strong>Type-Specific Details</strong>${rows.map((item) => `<div><strong>${esc(item.field.label)}:</strong> ${esc(item.value)}</div>`).join('')}</div>`;
}

function splitSpiderLabel(label, maxChars = 16, maxLines = 3) {
  const parts = String(label || '')
    .replace(/\//g, ' / ')
    .split(/\s+/)
    .filter(Boolean);
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

function buildSpiderChartSvg(placeName, recordedAt, metricsJson) {
  const metrics = normalizePlaceMetricSet(metricsJson);
  const width = 980;
  const height = 900;
  const centerX = width / 2;
  const centerY = 470;
  const radius = 250;
  const labelRadius = 356;
  const lineHeight = 18;
  const polygonPoints = metrics.map((metric, index) => {
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / metrics.length);
    const pointRadius = radius * (metric.normalized / 100);
    return [
      centerX + Math.cos(angle) * pointRadius,
      centerY + Math.sin(angle) * pointRadius,
    ];
  });
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
  const dataPolygon = polygonPoints.map((point) => point.join(',')).join(' ');
  const dataDots = polygonPoints.map((point) => `<circle cx="${point[0]}" cy="${point[1]}" r="4" fill="#2f7d73" stroke="#ffffff" stroke-width="2"></circle>`).join('');
  const labels = labelPoints.map((metric) => {
    const startY = metric.y - (((metric.lines.length - 1) * lineHeight) / 2);
    const tspans = metric.lines
      .map((line, index) => `<tspan x="${metric.x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`)
      .join('');
    return `<text x="${metric.x}" y="${startY}" font-size="14" font-weight="600" text-anchor="${metric.textAnchor}" fill="#28435c">${tspans}</text>`;
  }).join('');
  const ringLabels = rings.map((ring) => `<text x="${centerX + 12}" y="${centerY - ((radius * ring) / 100) + 5}" font-size="12" font-weight="600" fill="#688099">${ring}</text>`).join('');
  return `
    <svg viewBox="0 0 ${width} ${height}" class="place-radar-svg" role="img" aria-label="Spider chart for ${esc(placeName)}" preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#fbfcfe"></rect>
      <text x="${centerX}" y="48" text-anchor="middle" font-size="28" font-weight="700" fill="#16324f">${esc(placeName)}</text>
      <text x="${centerX}" y="78" text-anchor="middle" font-size="15" fill="#5f7388">${esc(formatDateTime(recordedAt))}</text>
      ${ringPolygons}
      ${axisLines}
      ${ringLabels}
      <polygon points="${dataPolygon}" fill="rgba(47,125,115,0.22)" stroke="#2f7d73" stroke-width="3"></polygon>
      ${dataDots}
      ${labels}
    </svg>
  `;
}

function renderPlaceDocuments(entity, placeDocuments, isAdmin = false) {
  const items = asArray(placeDocuments)
    .filter((item) => item.place_uid === entity.entity_uid)
    .sort((left, right) => new Date(right.recorded_at || 0).getTime() - new Date(left.recorded_at || 0).getTime());
  if (!items.length) {
    return `<section class="section"><h3>Documents</h3><p class="section-note">No approved place documents have been added yet.</p></section>`;
  }
  return `
    <section class="section">
      <h3>Documents</h3>
      <div class="place-history-list">
        ${items.map((item) => `
          <article class="admin-card place-history-card">
            <div class="admin-card-header">
              <h4>${esc(item.title || item.file_name || 'Document')}</h4>
              <span class="admin-badge">${esc(formatDate(item.document_date || item.recorded_at))}</span>
            </div>
            <p>${esc(item.description || 'No description provided.')}</p>
            <p><strong>Recorded:</strong> ${esc(formatDateTime(item.recorded_at))}</p>
            <p><strong>File:</strong> ${esc(item.file_name || 'Document')}</p>
            <div class="btn-group">
              <a class="btn btn-small" href="${esc(item.file_url)}" target="_blank" rel="noreferrer">Open Document</a>
              <a class="btn btn-small" href="${esc(item.file_url)}" target="_blank" rel="noreferrer" download="${esc(item.file_name || 'place-document')}">Download</a>
              ${isAdmin ? `<button class="btn btn-danger btn-small" type="button" data-admin-delete-place-document="${esc(item.document_uid)}">Delete Document</button>` : ''}
            </div>
          </article>
        `).join('')}
      </div>
      ${isAdmin ? `
        <details class="section-collapsible" open>
          <summary><h3>Admin: Upload Updated Document</h3></summary>
          <div class="section-collapsible-body">
            <div class="admin-form">
              <div class="form-group"><label for="admin-place-document-title">Title</label><input id="admin-place-document-title" type="text" required /></div>
              <div class="form-group"><label for="admin-place-document-description">Description</label><textarea id="admin-place-document-description" rows="3"></textarea></div>
              <div class="form-group"><label for="admin-place-document-date">Document Date</label><input id="admin-place-document-date" type="date" /></div>
              <div class="form-group"><label for="admin-place-document-recorded-at">Recorded At</label><input id="admin-place-document-recorded-at" type="datetime-local" required /></div>
              <div class="form-group"><label for="admin-place-document-file">Replacement / New File</label><input id="admin-place-document-file" type="file" required /></div>
              <button class="btn btn-success" type="button" id="admin-place-document-upload-button">Upload Approved Document</button>
              <p class="admin-status" id="admin-place-document-status"></p>
            </div>
          </div>
        </details>
      ` : ''}
    </section>
  `;
}

function renderPlaceSpiderHistory(entity, placeSpiderSnapshots, isAdmin = false) {
  const items = asArray(placeSpiderSnapshots)
    .filter((item) => item.place_uid === entity.entity_uid)
    .sort((left, right) => new Date(right.recorded_at || 0).getTime() - new Date(left.recorded_at || 0).getTime());
  if (!items.length) {
    return `<section class="section"><h3>Spider Chart History</h3><p class="section-note">No approved spider chart snapshots have been added yet.</p></section>`;
  }
  return `
    <section class="section">
      <h3>Spider Chart History</h3>
      <div class="place-history-list">
        ${items.map((item, index) => `
          <article class="admin-card place-history-card">
            <div class="admin-card-header">
              <h4>${esc(item.title || entity.entity_name)}</h4>
              <span class="admin-badge">${esc(formatDateTime(item.recorded_at))}</span>
            </div>
            <p>${esc(item.notes || 'No notes provided.')}</p>
            <div class="btn-group">
              <button class="btn btn-small" type="button" data-open-spider-chart="${esc(String(index))}">View Spider Chart</button>
            </div>
            ${isAdmin ? `
              <div class="admin-form">
                <div class="form-group"><label>Title</label><input type="text" data-admin-place-spider-title value="${esc(item.title || '')}" /></div>
                <div class="form-group"><label>Recorded At</label><input type="datetime-local" data-admin-place-spider-recorded-at value="${esc(String(item.recorded_at || '').slice(0, 16))}" /></div>
                <div class="form-group"><label>Notes</label><textarea rows="3" data-admin-place-spider-notes>${esc(item.notes || '')}</textarea></div>
                <div class="place-metric-grid">
                  ${PLACE_SPIDER_METRICS.map((metric) => {
                    const data = item.metrics_json && typeof item.metrics_json === 'object' && item.metrics_json[metric.key] && typeof item.metrics_json[metric.key] === 'object'
                      ? item.metrics_json[metric.key]
                      : {};
                    return `
                      <div class="place-metric-row">
                        <div>
                          <strong>${esc(metric.label)}</strong>
                          <small>Saved as score and max score.</small>
                        </div>
                        <input type="number" min="0" step="any" data-admin-place-score="${esc(metric.key)}" value="${esc(String(data.score ?? 0))}" />
                        <input type="number" min="1" step="any" data-admin-place-max="${esc(metric.key)}" value="${esc(String(data.max_score ?? metric.defaultMax))}" />
                      </div>
                    `;
                  }).join('')}
                </div>
                <button class="btn btn-success btn-small" type="button" data-admin-save-place-spider="${esc(item.snapshot_uid)}">Save Spider Chart</button>
              </div>
            ` : ''}
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderPlaceMetricEditorRows() {
  return PLACE_SPIDER_METRICS.map((metric) => `
    <div class="place-metric-row">
      <div>
        <strong>${esc(metric.label)}</strong>
        <small>Normalized to 100 using score / max score.</small>
      </div>
      <input type="number" min="0" step="any" data-place-score="${esc(metric.key)}" placeholder="Score" />
      <input type="number" min="1" step="any" data-place-max="${esc(metric.key)}" value="${esc(metric.defaultMax)}" placeholder="Max score" />
    </div>
  `).join('');
}

function renderPlaceSubmissionSections(entity) {
  return `
    <section class="section">
      <details class="section-collapsible">
        <summary><h3>Submit a New Place Document</h3></summary>
        <div class="section-collapsible-body">
          <p class="section-note">New place documents are sent for admin approval before they appear publicly.</p>
          <form class="admin-form" id="place-document-form">
            <input type="hidden" id="place-document-place-uid" value="${esc(entity.entity_uid)}" />
            <div class="form-group"><label for="place-document-title">Title</label><input id="place-document-title" type="text" required /></div>
            <div class="form-group"><label for="place-document-description">Description</label><textarea id="place-document-description" rows="4"></textarea></div>
            <div class="form-group"><label for="place-document-date">Document Date</label><input id="place-document-date" type="date" /></div>
            <div class="form-group"><label for="place-document-recorded-at">Recorded At</label><input id="place-document-recorded-at" type="datetime-local" required /></div>
            <div class="form-group"><label for="place-document-file">File</label><input id="place-document-file" type="file" required /></div>
            <div class="form-group"><label for="place-document-submit-name">Your Name</label><input id="place-document-submit-name" type="text" required /></div>
            <div class="form-group"><label for="place-document-submit-email">Your Email</label><input id="place-document-submit-email" type="email" required /></div>
            <button class="btn btn-success" type="submit">Send Document for Approval</button>
            <p class="admin-status" id="place-document-status"></p>
          </form>
        </div>
      </details>
    </section>
    <section class="section">
      <details class="section-collapsible">
        <summary><h3>Submit Spider Chart Information</h3></summary>
        <div class="section-collapsible-body">
          <p class="section-note">Each spider chart snapshot is stored with its date and normalized to 100 when viewed.</p>
          <form class="admin-form" id="place-spider-form">
            <input type="hidden" id="place-spider-place-uid" value="${esc(entity.entity_uid)}" />
            <div class="form-group"><label for="place-spider-title">Snapshot Title</label><input id="place-spider-title" type="text" placeholder="${esc(entity.entity_name)} Spider Chart" /></div>
            <div class="form-group"><label for="place-spider-recorded-at">Recorded At</label><input id="place-spider-recorded-at" type="datetime-local" required /></div>
            <div class="form-group"><label for="place-spider-notes">Notes</label><textarea id="place-spider-notes" rows="4" placeholder="Context, data source, or collection notes"></textarea></div>
            <div class="place-metric-grid">
              ${renderPlaceMetricEditorRows()}
            </div>
            <div class="form-group"><label for="place-spider-submit-name">Your Name</label><input id="place-spider-submit-name" type="text" required /></div>
            <div class="form-group"><label for="place-spider-submit-email">Your Email</label><input id="place-spider-submit-email" type="email" required /></div>
            <button class="btn btn-success" type="submit">Send Spider Chart for Approval</button>
            <p class="admin-status" id="place-spider-status"></p>
          </form>
        </div>
      </details>
    </section>
    <div id="place-spider-modal" class="place-modal" hidden aria-hidden="true">
      <div class="place-modal-backdrop" data-close-place-modal></div>
      <div class="place-modal-dialog">
        <div class="place-modal-toolbar">
          <h3 id="place-spider-modal-title">Spider Chart</h3>
          <button class="btn btn-small" type="button" data-close-place-modal>Close</button>
        </div>
        <div id="place-spider-modal-body"></div>
      </div>
    </div>
  `;
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

async function submitContactRequest(event) {
  event.preventDefault();
  const statusEl = document.getElementById('contact-request-status');
  const form = event.target;
  const entityUid = document.getElementById('contact-request-entity-uid').value;
  statusEl.textContent = 'Sending request...';
  statusEl.classList.remove('error');
  try {
    await EcosystemStore.adminRequest('submitContactRequest', {
      request: {
        entity_uid: entityUid,
        request_type: document.getElementById('contact-request-type').value,
        requester_name: document.getElementById('contact-request-name').value,
        requester_email: document.getElementById('contact-request-email').value,
        requester_phone: document.getElementById('contact-request-phone').value,
        message: document.getElementById('contact-request-message').value,
      },
    });
    form.reset();
    document.getElementById('contact-request-entity-uid').value = entityUid;
    statusEl.textContent = 'Request sent to the admin team.';
  } catch (error) {
    statusEl.textContent = error.message || 'Request could not be sent.';
    statusEl.classList.add('error');
  }
}

function collectPlaceMetricsFromForm() {
  return Object.fromEntries(PLACE_SPIDER_METRICS.map((metric) => {
    const scoreInput = document.querySelector(`[data-place-score="${metric.key}"]`);
    const maxInput = document.querySelector(`[data-place-max="${metric.key}"]`);
    return [metric.key, {
      score: Number(scoreInput?.value || 0),
      max_score: Number(maxInput?.value || metric.defaultMax || 5),
    }];
  }));
}

async function submitPlaceSpider(event, entity) {
  event.preventDefault();
  const form = event.target;
  const statusEl = document.getElementById('place-spider-status');
  statusEl.textContent = 'Sending spider chart for approval...';
  statusEl.classList.remove('error');
  try {
    await EcosystemStore.adminRequest('submitPlaceSpider', {
      submission: {
        place_uid: entity.entity_uid,
        place_name: entity.entity_name,
        title: document.getElementById('place-spider-title').value,
        recorded_at: document.getElementById('place-spider-recorded-at').value,
        notes: document.getElementById('place-spider-notes').value,
        metrics_json: collectPlaceMetricsFromForm(),
        submitted_by_name: document.getElementById('place-spider-submit-name').value,
        submitted_by_email: document.getElementById('place-spider-submit-email').value,
      },
    });
    form.reset();
    PLACE_SPIDER_METRICS.forEach((metric) => {
      const maxInput = document.querySelector(`[data-place-max="${metric.key}"]`);
      if (maxInput) maxInput.value = String(metric.defaultMax);
    });
    statusEl.textContent = 'Spider chart sent for admin approval.';
  } catch (error) {
    statusEl.textContent = error.message || 'Spider chart submission failed.';
    statusEl.classList.add('error');
  }
}

async function submitPlaceDocument(event, entity) {
  event.preventDefault();
  const form = event.target;
  const statusEl = document.getElementById('place-document-status');
  const file = document.getElementById('place-document-file').files?.[0];
  if (!file) {
    statusEl.textContent = 'Choose a file first.';
    statusEl.classList.add('error');
    return;
  }
  if (file.size > (10 * 1024 * 1024)) {
    statusEl.textContent = 'Please keep place document uploads under 10 MB.';
    statusEl.classList.add('error');
    return;
  }
  statusEl.textContent = 'Uploading document for approval...';
  statusEl.classList.remove('error');
  try {
    const fileContentBase64 = await readFileAsBase64(file);
    await EcosystemStore.adminRequest('submitPlaceDocument', {
      submission: {
        place_uid: entity.entity_uid,
        place_name: entity.entity_name,
        title: document.getElementById('place-document-title').value,
        description: document.getElementById('place-document-description').value,
        document_date: document.getElementById('place-document-date').value,
        recorded_at: document.getElementById('place-document-recorded-at').value,
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        file_content_base64: fileContentBase64,
        submitted_by_name: document.getElementById('place-document-submit-name').value,
        submitted_by_email: document.getElementById('place-document-submit-email').value,
      },
    });
    form.reset();
    statusEl.textContent = 'Place document sent for admin approval.';
  } catch (error) {
    statusEl.textContent = error.message || 'Place document submission failed.';
    statusEl.classList.add('error');
  }
}

function collectAdminPlaceSpiderMetrics(card) {
  return Object.fromEntries(PLACE_SPIDER_METRICS.map((metric) => {
    const scoreEl = card.querySelector(`[data-admin-place-score="${metric.key}"]`);
    const maxEl = card.querySelector(`[data-admin-place-max="${metric.key}"]`);
    return [metric.key, {
      score: Number(scoreEl?.value || 0),
      max_score: Number(maxEl?.value || metric.defaultMax || 5),
    }];
  }));
}

async function saveAdminPlaceSpiderSnapshot(entity, snapshotUid, triggerButton, adminToken) {
  const card = triggerButton.closest('.place-history-card');
  if (!card) return;
  try {
    await EcosystemStore.adminRequest('updatePlaceSpiderSnapshot', {
      token: adminToken,
      snapshotUid,
      updates: {
        title: card.querySelector('[data-admin-place-spider-title]')?.value || '',
        recorded_at: card.querySelector('[data-admin-place-spider-recorded-at]')?.value || '',
        notes: card.querySelector('[data-admin-place-spider-notes]')?.value || '',
        metrics_json: collectAdminPlaceSpiderMetrics(card),
      },
    });
    window.location.reload();
  } catch (error) {
    alert(error.message || 'Spider chart update failed.');
  }
}

async function deleteAdminPlaceDocument(documentUid, adminToken) {
  try {
    await EcosystemStore.adminRequest('deletePlaceDocumentRecord', {
      token: adminToken,
      documentUid,
    });
    window.location.reload();
  } catch (error) {
    alert(error.message || 'Document delete failed.');
  }
}

async function uploadAdminPlaceDocument(entity, adminToken) {
  const statusEl = document.getElementById('admin-place-document-status');
  const file = document.getElementById('admin-place-document-file').files?.[0];
  if (!file) {
    statusEl.textContent = 'Choose a file first.';
    statusEl.classList.add('error');
    return;
  }
  if (file.size > (10 * 1024 * 1024)) {
    statusEl.textContent = 'Please keep uploaded documents under 10 MB.';
    statusEl.classList.add('error');
    return;
  }
  statusEl.textContent = 'Uploading approved document...';
  statusEl.classList.remove('error');
  try {
    const fileContentBase64 = await readFileAsBase64(file);
    await EcosystemStore.adminRequest('createPlaceDocumentRecord', {
      token: adminToken,
      submission: {
        place_uid: entity.entity_uid,
        place_name: entity.entity_name,
        title: document.getElementById('admin-place-document-title').value || file.name,
        description: document.getElementById('admin-place-document-description').value,
        document_date: document.getElementById('admin-place-document-date').value,
        recorded_at: document.getElementById('admin-place-document-recorded-at').value || new Date().toISOString().slice(0, 16),
        file_name: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        file_content_base64: fileContentBase64,
      },
    });
    window.location.reload();
  } catch (error) {
    statusEl.textContent = error.message || 'Document upload failed.';
    statusEl.classList.add('error');
  }
}

function openPlaceSpiderModal(entity, snapshot) {
  const modal = document.getElementById('place-spider-modal');
  const body = document.getElementById('place-spider-modal-body');
  const titleEl = document.getElementById('place-spider-modal-title');
  if (!modal || !body) return;
  if (titleEl) {
    titleEl.textContent = `${entity.entity_name} - ${formatDateTime(snapshot.recorded_at)}`;
  }
  body.innerHTML = `
    <div class="place-modal-chart">${buildSpiderChartSvg(entity.entity_name, snapshot.recorded_at, snapshot.metrics_json)}</div>
    <div class="place-modal-summary">
      <p><strong>Title:</strong> ${esc(snapshot.title || entity.entity_name)}</p>
      <p><strong>Recorded:</strong> ${esc(formatDateTime(snapshot.recorded_at))}</p>
      <p><strong>Notes:</strong> ${esc(snapshot.notes || 'No notes provided.')}</p>
    </div>
  `;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('place-modal-open');
}

function closePlaceSpiderModal() {
  const modal = document.getElementById('place-spider-modal');
  const body = document.getElementById('place-spider-modal-body');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  if (body) body.innerHTML = '';
  document.body.classList.remove('place-modal-open');
}

async function initEntityDetail() {
  const params = new URLSearchParams(window.location.search);
  const entityUid = params.get('entity');
  const root = document.getElementById('entity-detail-root');
  if (!entityUid) {
    root.innerHTML = '<section class="section"><p>Entity id is missing.</p></section>';
    return;
  }

  try {
    const adminSession = await verifyAdminSession();
    const { entityTypes, entities, fieldDefinitions, placeDocuments, placeSpiderSnapshots } = await EcosystemStore.loadDirectory();
    const entity = entities.find((item) => item.entity_uid === entityUid);
    if (!entity) {
      root.innerHTML = '<section class="section"><p>Entity not found in the approved directory.</p></section>';
      return;
    }
    const typeMeta = entityTypes.find((item) => item.type_slug === entity.entity_type_slug) || { label: entity.entity_type_slug, color_hex: '#1f4b6e' };
    const socialMedia = entity.social_media && typeof entity.social_media === 'object' ? Object.entries(entity.social_media).filter(([, value]) => value) : [];
    const officeLocations = asArray(entity.office_locations);
    const tags = asArray(entity.tags);
    const keywords = asArray(entity.keywords);
    const subtitle = entity.location_label || entity.primary_address || [entity.district, entity.state, entity.country].filter(Boolean).join(', ') || 'Location not listed';
    const isPlace = entity.entity_type_slug === 'place';
    const placeSnapshotItems = isPlace
      ? asArray(placeSpiderSnapshots).filter((item) => item.place_uid === entity.entity_uid).sort((left, right) => new Date(right.recorded_at || 0).getTime() - new Date(left.recorded_at || 0).getTime())
      : [];

    document.getElementById('detail-title').textContent = entity.entity_name;
    document.getElementById('detail-subtitle').textContent = subtitle;
    root.innerHTML = `
      <section class="section">
        <div class="vendor-result-top">
          <div>
            <h3>${esc(entity.entity_name)}</h3>
            <p>${esc(subtitle)}</p>
          </div>
          <span class="admin-badge" style="background:${esc(typeMeta.color_hex || '#1f4b6e')}22;color:${esc(typeMeta.color_hex || '#1f4b6e')};border:1px solid ${esc(typeMeta.color_hex || '#1f4b6e')}44">${esc(typeMeta.label)}</span>
        </div>
        <p>${esc(entity.summary || entity.description || 'No summary available.')}</p>
        ${entity.description && entity.description !== entity.summary ? `<p>${esc(entity.description)}</p>` : ''}
        <div class="vendor-detail-grid">
          <div>
            <h4>Contact</h4>
            <p><strong>Email:</strong> ${esc(entity.contact_email || 'Not listed')}</p>
            <p><strong>Phone:</strong> ${esc(entity.contact_phone || 'Not listed')}</p>
            <p><strong>Address:</strong> ${esc(entity.primary_address || 'Not listed')}</p>
            <p><strong>District / State:</strong> ${esc([entity.district, entity.state].filter(Boolean).join(', ') || 'Not listed')}</p>
            <p><strong>Website:</strong> ${entity.website_url ? `<a href="${esc(entity.website_url)}" target="_blank" rel="noreferrer">${esc(entity.website_url)}</a>` : 'Not listed'}</p>
          </div>
          <div>
            <h4>Metadata</h4>
            <p><strong>Entity Type:</strong> ${esc(typeMeta.label)}</p>
            <p><strong>Place Label:</strong> ${esc(entity.location_label || 'Not listed')}</p>
            <p><strong>Tags:</strong> ${esc(tags.join(', ') || 'Not listed')}</p>
            <p><strong>Keywords:</strong> ${esc(keywords.join(', ') || 'Not listed')}</p>
            <p><strong>Source:</strong> ${entity.source_url ? `<a href="${esc(entity.source_url)}" target="_blank" rel="noreferrer">${esc(entity.source_label || entity.source_url)}</a>` : esc(entity.source_label || 'Manual entry')}</p>
          </div>
        </div>
        ${officeLocations.length ? `<div class="vendor-inline-list"><strong>Office Locations</strong>${officeLocations.map((item) => `<div>${esc(item)}</div>`).join('')}</div>` : ''}
        ${socialMedia.length ? `<div class="vendor-inline-list"><strong>Social Media</strong>${socialMedia.map(([label, value]) => `<div>${esc(label)}: <a href="${esc(value)}" target="_blank" rel="noreferrer">${esc(value)}</a></div>`).join('')}</div>` : ''}
        ${renderTypeSpecificDetails(entity, fieldDefinitions)}
      </section>
      ${isPlace ? renderPlaceDocuments(entity, placeDocuments, adminSession.valid) : ''}
      ${isPlace ? renderPlaceSpiderHistory(entity, placeSpiderSnapshots, adminSession.valid) : ''}
      ${isPlace ? renderPlaceSubmissionSections(entity) : ''}
      <section class="section">
        <details class="section-collapsible">
          <summary><h3>Request an Edit or Deletion</h3></summary>
          <div class="section-collapsible-body">
            <p class="section-note">If this listing needs correction or removal, this request will be sent to the admin team at tanmay@greenruraleconomy.in.</p>
            <form class="admin-form" id="contact-request-form">
              <input id="contact-request-entity-uid" type="hidden" value="${esc(entity.entity_uid)}" />
              <div class="form-group">
                <label for="contact-request-type">Request Type</label>
                <select id="contact-request-type">
                  <option value="edit">Edit this record</option>
                  <option value="delete">Delete this record</option>
                </select>
              </div>
              <div class="form-group"><label for="contact-request-name">Your Name</label><input id="contact-request-name" type="text" required /></div>
              <div class="form-group"><label for="contact-request-email">Your Email</label><input id="contact-request-email" type="email" required /></div>
              <div class="form-group"><label for="contact-request-phone">Your Phone</label><input id="contact-request-phone" type="text" /></div>
              <div class="form-group"><label for="contact-request-message">What should change?</label><textarea id="contact-request-message" rows="5" required></textarea></div>
              <button class="btn btn-success" type="submit">Send Request</button>
              <p class="admin-status" id="contact-request-status"></p>
            </form>
          </div>
        </details>
      </section>
    `;

    document.getElementById('contact-request-form').addEventListener('submit', submitContactRequest);
    if (isPlace) {
      if (adminSession.valid) {
        document.querySelectorAll('[data-admin-save-place-spider]').forEach((button) => {
          button.addEventListener('click', () => saveAdminPlaceSpiderSnapshot(entity, button.dataset.adminSavePlaceSpider, button, adminSession.token));
        });
        document.querySelectorAll('[data-admin-delete-place-document]').forEach((button) => {
          button.addEventListener('click', () => deleteAdminPlaceDocument(button.dataset.adminDeletePlaceDocument, adminSession.token));
        });
        document.getElementById('admin-place-document-upload-button')?.addEventListener('click', () => uploadAdminPlaceDocument(entity, adminSession.token));
        const recordedAtEl = document.getElementById('admin-place-document-recorded-at');
        if (recordedAtEl && !recordedAtEl.value) recordedAtEl.value = new Date().toISOString().slice(0, 16);
      }
      document.getElementById('place-document-form')?.addEventListener('submit', (event) => submitPlaceDocument(event, entity));
      document.getElementById('place-spider-form')?.addEventListener('submit', (event) => submitPlaceSpider(event, entity));
      document.querySelectorAll('[data-open-spider-chart]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          const snapshot = placeSnapshotItems[Number(button.dataset.openSpiderChart)];
          if (snapshot) openPlaceSpiderModal(entity, snapshot);
        });
      });
      document.querySelectorAll('[data-close-place-modal]').forEach((button) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          closePlaceSpiderModal();
        });
      });
      window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closePlaceSpiderModal();
      });
    }
  } catch (error) {
    root.innerHTML = `<section class="section"><p>${esc(error.message || 'Entity detail could not be loaded.')}</p></section>`;
  }
}

initEntityDetail();
