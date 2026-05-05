import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const OUTPUT_DIR = path.join(ROOT, 'data', 'lgd');
const BUCKET_DIR = path.join(OUTPUT_DIR, 'buckets');
const CACHE_DIR = path.join(ROOT, 'data', 'lgd-cache');

const SOURCES = {
  villages: {
    label: 'LGD Villages',
    url: 'https://api.data.gov.in/resource/c967fe8f-69c4-42df-8afc-8a2c98057437?api-key=579b464db66ec23bdd000001cdc3b564546246a772a26393094f5645',
  },
  localBodies: {
    label: 'LGD Local Bodies',
    url: 'https://api.data.gov.in/resource/1a6c26ed-d67c-40ea-aa20-d38d35f341a5?api-key=579b464db66ec23bdd000001cdc3b564546246a772a26393094f5645',
  },
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

async function fetchJsonWithRetry(url, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': 'livelihood-ecosystem-directory/1.0' } });
      if (!response.ok) throw new Error(`Download failed for ${url} (${response.status})`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.warn(`Retry ${attempt}/${attempts - 1} for ${url}`);
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  throw lastError;
}

async function readApiRecords(url, cacheKey) {
  const pageSize = 10000;
  let offset = 0;
  let total = Infinity;
  const rows = [];
  const datasetCacheDir = path.join(CACHE_DIR, cacheKey);
  await fs.mkdir(datasetCacheDir, { recursive: true });

  while (offset < total) {
    const pageUrl = `${url}&offset=${offset}&limit=${pageSize}&format=json`;
    const cacheFile = path.join(datasetCacheDir, `${offset}.json`);
    let json;
    try {
      json = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
    } catch {
      json = await fetchJsonWithRetry(pageUrl);
      await fs.writeFile(cacheFile, JSON.stringify(json));
    }
    total = Number(json?.total || 0) || 0;
    const records = Array.isArray(json?.records) ? json.records : [];
    rows.push(...records);
    if (!records.length) break;
    offset += records.length;
    console.log(`Fetched ${Math.min(offset, total)} / ${total}`);
  }

  return rows;
}

function getBucketKey(value) {
  const normalized = normalizeText(value).replace(/[^a-z0-9]/g, '');
  return normalized[0] || '_';
}

function ensureBucket(map, key) {
  if (!map.has(key)) map.set(key, []);
  return map.get(key);
}

function pushBucketEntry(buckets, entry) {
  ensureBucket(buckets, getBucketKey(entry[1])).push(entry);
}

function choosePanchayatCandidate(current, candidate) {
  if (!current) return candidate;
  if (candidate.rank > current.rank) return candidate;
  if (candidate.rank < current.rank) return current;
  if (normalizeText(candidate.name) === normalizeText(current.name)) return current;
  return {
    ...current,
    name: `${current.name} / ${candidate.name}`,
  };
}

function getPanchayatRank(typeName) {
  const normalized = normalizeText(typeName);
  if (!normalized) return 0;
  if (normalized.includes('gram panchayat')) return 5;
  if (normalized.includes('village panchayat')) return 5;
  if (normalized.includes('gaon panchayat')) return 5;
  if (normalized.includes('panchayat')) return 4;
  if (normalized.includes('village council')) return 3;
  return 0;
}

async function main() {
  await fs.mkdir(BUCKET_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });

  console.log(`Downloading ${SOURCES.villages.label}...`);
  const villages = await readApiRecords(SOURCES.villages.url, 'villages');
  console.log(`Downloading ${SOURCES.localBodies.label}...`);
  const localBodies = await readApiRecords(SOURCES.localBodies.url, 'local-bodies');

  const stateMap = new Map();
  const districtMap = new Map();
  const blockMap = new Map();
  const villageMap = new Map();

  for (const row of villages) {
    const stateCode = String(row.stateCode || row.StateCode || '').trim();
    const stateName = String(row.stateNameEnglish || row.StateNameEnglish || '').trim();
    const districtCode = String(row.districtCode || row.DistrictCode || '').trim();
    const districtName = String(row.districtNameEnglish || row.DistrictNameEnglish || '').trim();
    const blockCode = String(row.subdistrictCode || row.SubdistrictCode || '').trim();
    const blockName = String(row.subdistrictNameEnglish || row.SubDistrictNameEnglish || '').trim();
    const villageCode = String(row.villageCode || row.VillageCode || '').trim();
    const villageName = String(row.villageNameEnglish || row.VillageNameEnglish || '').trim();

    if (stateCode && stateName && !stateMap.has(stateCode)) {
      stateMap.set(stateCode, { stateCode, stateName });
    }
    if (districtCode && districtName && !districtMap.has(districtCode)) {
      districtMap.set(districtCode, { districtCode, districtName, stateCode, stateName });
    }
    if (blockCode && blockName && !blockMap.has(blockCode)) {
      blockMap.set(blockCode, { blockCode, blockName, districtCode, districtName, stateCode, stateName });
    }
    if (villageCode && villageName && !villageMap.has(villageCode)) {
      villageMap.set(villageCode, {
        villageCode,
        villageName,
        blockCode,
        blockName,
        districtCode,
        districtName,
        stateCode,
        stateName,
        panchayatName: '',
        localBodyCode: '',
      });
    }
  }

  const panchayatMap = new Map();

  for (const row of localBodies) {
    const entityType = String(row.entityType || row.coverage_entityType || '').trim();
    const entityCode = String(row.entityCode || row.coverage_entityCode || '').trim();
    const localBodyCode = String(row.localBodyCode || '').trim();
    const localBodyName = String(row.localBodyNameEnglish || '').trim();
    const localBodyTypeName = String(row.localBodyTypeName || '').trim();
    const rank = getPanchayatRank(localBodyTypeName);
    if (!entityCode || !localBodyCode || !localBodyName || rank <= 0) continue;
    const village = normalizeText(entityType) === 'village' ? villageMap.get(entityCode) : null;
    if (!village) continue;

    villageMap.set(entityCode, {
      ...village,
      panchayatName: choosePanchayatCandidate(
        village.panchayatName ? { name: village.panchayatName, rank } : null,
        { name: localBodyName, rank },
      ).name,
      localBodyCode,
    });

    if (!panchayatMap.has(localBodyCode)) {
      panchayatMap.set(localBodyCode, {
        localBodyCode,
        panchayatName: localBodyName,
        localBodyTypeName,
        blockCode: village.blockCode,
        blockName: village.blockName,
        districtCode: village.districtCode,
        districtName: village.districtName,
        stateCode: village.stateCode,
        stateName: village.stateName,
      });
    }
  }

  const buckets = new Map();

  for (const state of stateMap.values()) {
    pushBucketEntry(buckets, ['state', state.stateName, state.stateName, state.stateCode]);
  }
  for (const district of districtMap.values()) {
    pushBucketEntry(buckets, ['district', district.districtName, district.stateName, district.stateCode, district.districtCode]);
  }
  for (const block of blockMap.values()) {
    pushBucketEntry(buckets, ['block', block.blockName, block.districtName, block.stateName, block.stateCode, block.districtCode, block.blockCode]);
  }
  for (const panchayat of panchayatMap.values()) {
    pushBucketEntry(
      buckets,
      ['panchayat', panchayat.panchayatName, panchayat.blockName, panchayat.districtName, panchayat.stateName, panchayat.stateCode, panchayat.districtCode, panchayat.blockCode, panchayat.localBodyCode]
    );
  }
  for (const village of villageMap.values()) {
    pushBucketEntry(
      buckets,
      ['village', village.villageName, village.panchayatName, village.blockName, village.districtName, village.stateName, village.stateCode, village.districtCode, village.blockCode, village.localBodyCode, village.villageCode]
    );
  }

  for (const [bucketKey, entries] of buckets.entries()) {
    entries.sort((left, right) => {
      const labelLeft = left.filter(Boolean).join(', ');
      const labelRight = right.filter(Boolean).join(', ');
      return labelLeft.localeCompare(labelRight);
    });
    await fs.writeFile(path.join(BUCKET_DIR, `${bucketKey}.json`), JSON.stringify(entries));
  }

  const manifest = {
    version: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    generated_at: new Date().toISOString(),
    source_urls: SOURCES,
    schema: {
      state: ['location_kind', 'state_name', 'display_label', 'lgd_state_code'],
      district: ['location_kind', 'district_name', 'state_name', 'lgd_state_code', 'lgd_district_code'],
      block: ['location_kind', 'block_name', 'district_name', 'state_name', 'lgd_state_code', 'lgd_district_code', 'lgd_subdistrict_code'],
      panchayat: ['location_kind', 'gram_panchayat_name', 'block_name', 'district_name', 'state_name', 'lgd_state_code', 'lgd_district_code', 'lgd_subdistrict_code', 'lgd_local_body_code'],
      village: ['location_kind', 'village_name', 'gram_panchayat_name', 'block_name', 'district_name', 'state_name', 'lgd_state_code', 'lgd_district_code', 'lgd_subdistrict_code', 'lgd_local_body_code', 'lgd_village_code'],
    },
    bucket_files: Array.from(buckets.keys()).sort().map((key) => `${key}.json`),
    counts: {
      states: stateMap.size,
      districts: districtMap.size,
      blocks: blockMap.size,
      panchayats: panchayatMap.size,
      villages: villageMap.size,
    },
  };

  await fs.writeFile(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const sqlRows = [];
  const pushSqlRow = (entry) => {
    const [kind] = entry;
    let row;
    if (kind === 'state') {
      const [, stateName, displayLabel, stateCode] = entry;
      row = {
        entry_uid: `state-${stateCode}`,
        location_kind: kind,
        lgd_code: stateCode,
        state_code: stateCode,
        state_name: stateName,
        display_label: displayLabel,
        search_text: [stateName, displayLabel].filter(Boolean).join(' '),
      };
    } else if (kind === 'district') {
      const [, districtName, stateName, stateCode, districtCode] = entry;
      row = {
        entry_uid: `district-${districtCode}`,
        location_kind: kind,
        lgd_code: districtCode,
        state_code: stateCode,
        district_code: districtCode,
        state_name: stateName,
        district_name: districtName,
        display_label: [districtName, stateName].filter(Boolean).join(', '),
        search_text: [districtName, stateName].filter(Boolean).join(' '),
      };
    } else if (kind === 'block') {
      const [, blockName, districtName, stateName, stateCode, districtCode, subdistrictCode] = entry;
      row = {
        entry_uid: `block-${subdistrictCode}`,
        location_kind: kind,
        lgd_code: subdistrictCode,
        state_code: stateCode,
        district_code: districtCode,
        subdistrict_code: subdistrictCode,
        state_name: stateName,
        district_name: districtName,
        block_name: blockName,
        display_label: [blockName, districtName, stateName].filter(Boolean).join(', '),
        search_text: [blockName, districtName, stateName].filter(Boolean).join(' '),
      };
    } else if (kind === 'panchayat') {
      const [, panchayatName, blockName, districtName, stateName, stateCode, districtCode, subdistrictCode, localBodyCode] = entry;
      row = {
        entry_uid: `panchayat-${localBodyCode}`,
        location_kind: kind,
        lgd_code: localBodyCode,
        state_code: stateCode,
        district_code: districtCode,
        subdistrict_code: subdistrictCode,
        local_body_code: localBodyCode,
        state_name: stateName,
        district_name: districtName,
        block_name: blockName,
        gram_panchayat_name: panchayatName,
        display_label: [panchayatName, blockName, districtName, stateName].filter(Boolean).join(', '),
        search_text: [panchayatName, blockName, districtName, stateName].filter(Boolean).join(' '),
      };
    } else if (kind === 'village') {
      const [, villageName, panchayatName, blockName, districtName, stateName, stateCode, districtCode, subdistrictCode, localBodyCode, villageCode] = entry;
      row = {
        entry_uid: `village-${villageCode}`,
        location_kind: kind,
        lgd_code: villageCode,
        state_code: stateCode,
        district_code: districtCode,
        subdistrict_code: subdistrictCode,
        local_body_code: localBodyCode || null,
        village_code: villageCode,
        state_name: stateName,
        district_name: districtName,
        block_name: blockName,
        gram_panchayat_name: panchayatName || null,
        village_name: villageName,
        display_label: [villageName, panchayatName, blockName, districtName, stateName].filter(Boolean).join(', '),
        search_text: [villageName, panchayatName, blockName, districtName, stateName].filter(Boolean).join(' '),
      };
    }
    if (row) sqlRows.push(row);
  };

  for (const entries of buckets.values()) {
    entries.forEach(pushSqlRow);
  }

  const sqlLines = [
    '-- Generated by scripts/build-lgd-geography.mjs',
    'truncate table public.lgd_geography_directory;',
  ];
  const chunkSize = 2000;
  for (let index = 0; index < sqlRows.length; index += chunkSize) {
    const chunk = sqlRows.slice(index, index + chunkSize);
    const values = chunk.map((row) => {
      const fields = [
        row.entry_uid,
        row.location_kind,
        row.lgd_code,
        row.state_code || null,
        row.district_code || null,
        row.subdistrict_code || null,
        row.local_body_code || null,
        row.village_code || null,
        row.state_name || null,
        row.district_name || null,
        row.block_name || null,
        row.gram_panchayat_name || null,
        row.village_name || null,
        row.display_label,
        row.search_text,
      ].map((value) => value === null ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
      return `(${fields.join(', ')})`;
    }).join(',\n');
    sqlLines.push(
      'insert into public.lgd_geography_directory (' +
        'entry_uid, location_kind, lgd_code, state_code, district_code, subdistrict_code, local_body_code, village_code, state_name, district_name, block_name, gram_panchayat_name, village_name, display_label, search_text' +
      `) values\n${values};`
    );
  }

  await fs.writeFile(path.join(OUTPUT_DIR, 'seed.sql'), sqlLines.join('\n\n'));
  console.log(`Generated LGD geography assets in ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
