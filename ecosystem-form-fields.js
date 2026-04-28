window.EcosystemForms = (() => {
  function esc(value) {
    return String(value || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  function parseTagList(value) {
    return String(value || '')
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function formatTagList(values) {
    return Array.isArray(values) ? values.filter(Boolean).join(', ') : '';
  }

  function parseOfficeLocations(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function formatOfficeLocations(values) {
    return Array.isArray(values) ? values.filter(Boolean).join('\n') : '';
  }

  function parseSocialLinks(value) {
    const lines = String(value || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const output = {};
    lines.forEach((line) => {
      const parts = line.includes('|') ? line.split('|') : line.split(/\s+/);
      const key = String(parts.shift() || '').trim().toLowerCase().replace(/\s+/g, '_');
      const url = String(parts.join('|') || '').trim();
      if (key && url) output[key] = url;
    });
    return output;
  }

  function formatSocialLinks(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
    return Object.entries(value)
      .filter(([, url]) => url)
      .map(([platform, url]) => `${platform}|${url}`)
      .join('\n');
  }

  function getFieldDefinitionsForType(fieldDefinitions, typeSlug) {
    return (Array.isArray(fieldDefinitions) ? fieldDefinitions : [])
      .filter((item) => item.type_slug === typeSlug)
      .sort((left, right) => Number(left.sort_order || 0) - Number(right.sort_order || 0));
  }

  function renderFieldInput(field, value, prefix) {
    const fieldId = `${prefix}-${field.field_key}`;
    const placeholder = field.placeholder ? ` placeholder="${esc(field.placeholder)}"` : '';
    const required = field.required ? ' required' : '';
    const help = field.help_text ? `<small>${esc(field.help_text)}</small>` : '';
    const options = Array.isArray(field.options_json) ? field.options_json : [];

    if (field.input_type === 'textarea') {
      return `<div class="form-group"><label for="${esc(fieldId)}">${esc(field.label)}${field.required ? ' *' : ''}</label><textarea id="${esc(fieldId)}" data-dynamic-key="${esc(field.field_key)}" data-input-type="${esc(field.input_type)}" rows="4"${required}${placeholder}>${esc(value || '')}</textarea>${help}</div>`;
    }

    if (field.input_type === 'tags') {
      return `<div class="form-group"><label for="${esc(fieldId)}">${esc(field.label)}${field.required ? ' *' : ''}</label><textarea id="${esc(fieldId)}" data-dynamic-key="${esc(field.field_key)}" data-input-type="tags" rows="3"${required}${placeholder}>${esc(formatTagList(value))}</textarea>${help}</div>`;
    }

    if (field.input_type === 'select') {
      return `<div class="form-group"><label for="${esc(fieldId)}">${esc(field.label)}${field.required ? ' *' : ''}</label><select id="${esc(fieldId)}" data-dynamic-key="${esc(field.field_key)}" data-input-type="select"${required}><option value="">Select</option>${options.map((option) => {
        const selected = String(value || '') === String(option) ? ' selected' : '';
        return `<option value="${esc(option)}"${selected}>${esc(option)}</option>`;
      }).join('')}</select>${help}</div>`;
    }

    if (field.input_type === 'multiselect') {
      const selectedValues = Array.isArray(value) ? value.map(String) : [];
      return `<div class="form-group"><label>${esc(field.label)}${field.required ? ' *' : ''}</label><div class="checkbox-grid dynamic-checkbox-grid" data-dynamic-key="${esc(field.field_key)}" data-input-type="multiselect">${options.map((option) => {
        const checked = selectedValues.includes(String(option)) ? ' checked' : '';
        return `<label class="checkbox-card"><input type="checkbox" value="${esc(option)}"${checked} /><span class="checkbox-card-meta"><span><strong>${esc(option)}</strong></span></span></label>`;
      }).join('')}</div>${help}</div>`;
    }

    const inputType = ['url', 'email', 'number'].includes(field.input_type) ? field.input_type : 'text';
    const valueAttr = value === null || value === undefined ? '' : ` value="${esc(value)}"`;
    const stepAttr = inputType === 'number' ? ' step="any"' : '';
    return `<div class="form-group"><label for="${esc(fieldId)}">${esc(field.label)}${field.required ? ' *' : ''}</label><input id="${esc(fieldId)}" type="${esc(inputType)}" data-dynamic-key="${esc(field.field_key)}" data-input-type="${esc(field.input_type)}"${valueAttr}${required}${placeholder}${stepAttr} />${help}</div>`;
  }

  function renderDynamicFields(container, fieldDefinitions, typeSlug, values = {}, prefix = 'dynamic') {
    if (!container) return;
    const fields = getFieldDefinitionsForType(fieldDefinitions, typeSlug);
    if (!fields.length) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = `<div class="dynamic-fields-block"><h4>Type-Specific Details</h4>${fields.map((field) => renderFieldInput(field, values?.[field.field_key], prefix)).join('')}</div>`;
  }

  function collectDynamicFieldValues(container) {
    if (!container) return {};
    const output = {};
    container.querySelectorAll('[data-dynamic-key]').forEach((element) => {
      const key = element.dataset.dynamicKey;
      const inputType = element.dataset.inputType;
      if (!key) return;
      if (inputType === 'multiselect') {
        output[key] = Array.from(element.querySelectorAll('input[type="checkbox"]:checked')).map((input) => input.value);
        return;
      }
      if (inputType === 'tags') {
        output[key] = parseTagList(element.value);
        return;
      }
      if (inputType === 'number') {
        output[key] = element.value ? Number(element.value) : null;
        return;
      }
      output[key] = String(element.value || '').trim();
    });
    return output;
  }

  function formatDynamicValue(field, value) {
    if (value === null || value === undefined || value === '') return '';
    if (field.input_type === 'multiselect' || field.input_type === 'tags') {
      return Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value);
    }
    return String(value);
  }

  return {
    esc,
    parseTagList,
    formatTagList,
    parseOfficeLocations,
    formatOfficeLocations,
    parseSocialLinks,
    formatSocialLinks,
    getFieldDefinitionsForType,
    renderDynamicFields,
    collectDynamicFieldValues,
    formatDynamicValue,
  };
})();
