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

  async function fetchAllRows(table, orderColumn, columns = '*') {
    const supabase = getClient();
    const pageSize = 1000;
    const rows = [];
    let from = 0;

    while (true) {
      const to = from + pageSize - 1;
      const result = await supabase.from(table).select(columns).order(orderColumn).range(from, to);
      if (result.error) throw new Error(`${table} load failed: ${result.error.message}`);
      const batch = result.data || [];
      rows.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return rows;
  }

  async function fetchOptionalRows(table, orderColumn, columns = '*') {
    try {
      return await fetchAllRows(table, orderColumn, columns);
    } catch (error) {
      console.warn(`${table} could not be loaded`, error);
      return [];
    }
  }

  const DIRECTORY_SUMMARY_COLUMNS = [
    'id',
    'entity_uid',
    'entity_name',
    'entity_type_slug',
    'entity_type_label',
    'summary',
    'description',
    'location_label',
    'primary_address',
    'district',
    'state',
    'country',
    'contact_email',
    'contact_phone',
    'website_url',
    'tags',
    'keywords',
    'search_text',
    'latitude',
    'longitude',
    'approved_at'
  ].join(',');

  async function fetchRowCount(table) {
    const supabase = getClient();
    const result = await supabase.from(table).select('id', { count: 'exact', head: true });
    if (result.error) throw new Error(`${table} count failed: ${result.error.message}`);
    return Number(result.count || 0);
  }

  async function fetchPageRows(table, orderColumn, from, to, columns = '*') {
    const supabase = getClient();
    const result = await supabase.from(table).select(columns).order(orderColumn).range(from, to);
    if (result.error) throw new Error(`${table} load failed: ${result.error.message}`);
    return result.data || [];
  }

  async function loadDirectoryBootstrap(pageSize = 12) {
    const [entityTypes, totalCount, entities] = await Promise.all([
      fetchAllRows(ENTITY_TYPES_TABLE(), 'sort_order'),
      fetchRowCount(PUBLIC_ENTITIES_VIEW()),
      fetchPageRows(PUBLIC_ENTITIES_VIEW(), 'entity_name', 0, Math.max(0, pageSize - 1), DIRECTORY_SUMMARY_COLUMNS),
    ]);
    return { entityTypes, totalCount, entities };
  }

  async function loadFieldDefinitions() {
    return fetchAllRows(FIELD_DEFINITIONS_TABLE(), 'sort_order');
  }

  async function loadDirectorySummary() {
    const [entityTypes, entities, fieldDefinitions] = await Promise.all([
      fetchAllRows(ENTITY_TYPES_TABLE(), 'sort_order'),
      fetchAllRows(PUBLIC_ENTITIES_VIEW(), 'entity_name', DIRECTORY_SUMMARY_COLUMNS),
      fetchAllRows(FIELD_DEFINITIONS_TABLE(), 'sort_order'),
    ]);
    return { entityTypes, entities, fieldDefinitions };
  }

  async function loadDirectory() {
    const [
      entityTypes,
      entities,
      fieldDefinitions,
      placeDocuments,
      placeSpiderSnapshots,
      placeThematicNeeds,
      placeVillageProfiles,
      placeVillageEconomicItems,
      placeVillageSubscores,
    ] = await Promise.all([
      fetchAllRows(ENTITY_TYPES_TABLE(), 'sort_order'),
      fetchAllRows(PUBLIC_ENTITIES_VIEW(), 'entity_name'),
      fetchAllRows(FIELD_DEFINITIONS_TABLE(), 'sort_order'),
      fetchOptionalRows('place_document_records_public', 'recorded_at'),
      fetchOptionalRows('place_spider_chart_snapshots_public', 'recorded_at'),
      fetchOptionalRows('place_thematic_need_records_public', 'recorded_at'),
      fetchOptionalRows('place_village_profile_public', 'place_uid'),
      fetchOptionalRows('place_village_economic_items_public', 'place_uid'),
      fetchOptionalRows('place_village_subscores_public', 'place_uid'),
    ]);
    return {
      entityTypes,
      entities,
      fieldDefinitions,
      placeDocuments,
      placeSpiderSnapshots,
      placeThematicNeeds,
      placeVillageProfiles,
      placeVillageEconomicItems,
      placeVillageSubscores,
    };
  }

  async function loadPlaceInitiativesData() {
    const [entityTypes, entities, placeInitiatives, placeLocations, placePartners, placeRoleTypes, placeDocuments, placeSpiderSnapshots, placeThematicNeeds, placePartnerMatchCache] = await Promise.all([
      fetchAllRows(ENTITY_TYPES_TABLE(), 'sort_order'),
      fetchAllRows(PUBLIC_ENTITIES_VIEW(), 'entity_name'),
      fetchAllRows('place_initiatives_public', 'initiative_name'),
      fetchAllRows('place_initiative_locations_public', 'sort_order'),
      fetchAllRows('place_initiative_partners_public', 'sort_order'),
      fetchAllRows('place_role_types', 'sort_order'),
      fetchAllRows('place_document_records_public', 'recorded_at'),
      fetchAllRows('place_spider_chart_snapshots_public', 'recorded_at'),
      fetchAllRows('place_thematic_need_records_public', 'recorded_at'),
      fetchAllRows('place_partner_match_cache_public', 'refreshed_at'),
    ]);
    return { entityTypes, entities, placeInitiatives, placeLocations, placePartners, placeRoleTypes, placeDocuments, placeSpiderSnapshots, placeThematicNeeds, placePartnerMatchCache };
  }

  function getLgdBase() {
    return (window.APP_CONFIG && window.APP_CONFIG.LGD_API_BASE) || 'https://grameee.org/api/lgd';
  }

  async function searchLgdGeography(query, limit = 12) {
    const raw = String(query || '').trim();
    if (!raw) return [];
    try {
      const res = await fetch(`${getLgdBase()}/s.php?q=${encodeURIComponent(raw)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data || []).slice(0, limit);
    } catch {
      return [];
    }
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

  return { loadDirectoryBootstrap, loadFieldDefinitions, loadDirectorySummary, loadDirectory, loadPlaceInitiativesData, searchLgdGeography, adminRequest };
})();
