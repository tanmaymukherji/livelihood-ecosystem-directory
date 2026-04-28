const {
  esc,
  formatDynamicValue,
} = window.EcosystemForms;

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
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

async function initEntityDetail() {
  const params = new URLSearchParams(window.location.search);
  const entityUid = params.get('entity');
  const root = document.getElementById('entity-detail-root');
  if (!entityUid) {
    root.innerHTML = '<section class="section"><p>Entity id is missing.</p></section>';
    return;
  }

  try {
    const { entityTypes, entities, fieldDefinitions } = await EcosystemStore.loadDirectory();
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
      <section class="section">
        <h3>Request an Edit or Deletion</h3>
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
      </section>
    `;

    document.getElementById('contact-request-form').addEventListener('submit', submitContactRequest);
  } catch (error) {
    root.innerHTML = `<section class="section"><p>${esc(error.message || 'Entity detail could not be loaded.')}</p></section>`;
  }
}

initEntityDetail();
