window.EcosystemStore = (() => {
  const ENTITY_TYPES_TABLE = () => (window.APP_CONFIG && window.APP_CONFIG.ENTITY_TYPES_TABLE) || 'ecosystem_entity_types';
  const PUBLIC_ENTITIES_VIEW = () => (window.APP_CONFIG && window.APP_CONFIG.PUBLIC_ENTITIES_VIEW) || 'ecosystem_directory_entities';
  const FIELD_DEFINITIONS_TABLE = () => 'ecosystem_entity_field_definitions';
  const ADMIN_API_URL = () => `${String(window.APP_CONFIG?.SUPABASE_URL || '').replace(/\/$/, '')}/functions/v1/livelihood-ecosystem-admin`;
  let client = null;

  function getClient() {
    if (client) return client;
    const config = window.APP_CONFIG || {};
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || String(config.SUPABASE_ANON_KEY).includes('YOUR_SUPABASE')) {
      throw new Error('Missing Supabase config. Update config.js with your project values.');
    }
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase client library failed to load.');
    }
    client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    return client;
  }

  async function fetchAllRows(table, orderColumn) {
    const supabase = getClient();
    const pageSize = 1000;
    const rows = [];
    let from = 0;

    while (true) {
      const to = from + pageSize - 1;
      const result = await supabase.from(table).select('*').order(orderColumn).range(from, to);
      if (result.error) throw new Error(`${table} load failed: ${result.error.message}`);
      const batch = result.data || [];
      rows.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return rows;
  }

  async function loadDirectory() {
    const [entityTypes, entities, fieldDefinitions, placeDocuments, placeSpiderSnapshots, placeThematicNeeds] = await Promise.all([
      fetchAllRows(ENTITY_TYPES_TABLE(), 'sort_order'),
      fetchAllRows(PUBLIC_ENTITIES_VIEW(), 'entity_name'),
      fetchAllRows(FIELD_DEFINITIONS_TABLE(), 'sort_order'),
      fetchAllRows('place_document_records_public', 'recorded_at'),
      fetchAllRows('place_spider_chart_snapshots_public', 'recorded_at'),
      fetchAllRows('place_thematic_need_records_public', 'recorded_at'),
    ]);
    return { entityTypes, entities, fieldDefinitions, placeDocuments, placeSpiderSnapshots, placeThematicNeeds };
  }

  async function loadPlaceInitiativesData() {
    const [entityTypes, entities, placeInitiatives, placeLocations, placePartners, placeRoleTypes, placeSpiderSnapshots, placeThematicNeeds] = await Promise.all([
      fetchAllRows(ENTITY_TYPES_TABLE(), 'sort_order'),
      fetchAllRows(PUBLIC_ENTITIES_VIEW(), 'entity_name'),
      fetchAllRows('place_initiatives_public', 'initiative_name'),
      fetchAllRows('place_initiative_locations_public', 'sort_order'),
      fetchAllRows('place_initiative_partners_public', 'sort_order'),
      fetchAllRows('place_role_types', 'sort_order'),
      fetchAllRows('place_spider_chart_snapshots_public', 'recorded_at'),
      fetchAllRows('place_thematic_need_records_public', 'recorded_at'),
    ]);
    return { entityTypes, entities, placeInitiatives, placeLocations, placePartners, placeRoleTypes, placeSpiderSnapshots, placeThematicNeeds };
  }

  async function adminRequest(action, payload = {}) {
    const config = window.APP_CONFIG || {};
    const response = await fetch(ADMIN_API_URL(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: String(config.SUPABASE_ANON_KEY || ''),
        Authorization: `Bearer ${String(config.SUPABASE_ANON_KEY || '')}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const rawText = await response.text().catch(() => '');
    let data = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {}
    if (!response.ok) throw new Error(data?.error || rawText || `Request failed (${response.status}).`);
    return data;
  }

  return { loadDirectory, loadPlaceInitiativesData, adminRequest };
})();
