import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const BUCKET_DIR = path.join(ROOT, 'data', 'lgd', 'buckets');
const PROGRESS_FILE = path.join(ROOT, 'data', 'lgd', 'import-progress.json');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BATCH_SIZE = 1000;

function buildRowFromBucketEntry(row) {
  const kind = row?.[0] || 'state';
  if (kind === 'state') {
    return {
      entry_uid: `state-${row[3]}`,
      location_kind: 'state',
      lgd_code: row[3],
      state_code: row[3],
      district_code: null,
      subdistrict_code: null,
      local_body_code: null,
      village_code: null,
      state_name: row[1],
      district_name: null,
      block_name: null,
      gram_panchayat_name: null,
      village_name: null,
      display_label: row[2] || row[1],
      search_text: [row[1], row[2]].filter(Boolean).join(' '),
    };
  }
  if (kind === 'district') {
    return {
      entry_uid: `district-${row[4]}`,
      location_kind: 'district',
      lgd_code: row[4],
      state_code: row[3],
      district_code: row[4],
      subdistrict_code: null,
      local_body_code: null,
      village_code: null,
      state_name: row[2],
      district_name: row[1],
      block_name: null,
      gram_panchayat_name: null,
      village_name: null,
      display_label: [row[1], row[2]].filter(Boolean).join(', '),
      search_text: [row[1], row[2]].filter(Boolean).join(' '),
    };
  }
  if (kind === 'block') {
    return {
      entry_uid: `block-${row[6]}`,
      location_kind: 'block',
      lgd_code: row[6],
      state_code: row[4],
      district_code: row[5],
      subdistrict_code: row[6],
      local_body_code: null,
      village_code: null,
      state_name: row[3],
      district_name: row[2],
      block_name: row[1],
      gram_panchayat_name: null,
      village_name: null,
      display_label: [row[1], row[2], row[3]].filter(Boolean).join(', '),
      search_text: [row[1], row[2], row[3]].filter(Boolean).join(' '),
    };
  }
  if (kind === 'panchayat') {
    return {
      entry_uid: `panchayat-${row[8]}`,
      location_kind: 'panchayat',
      lgd_code: row[8],
      state_code: row[5],
      district_code: row[6],
      subdistrict_code: row[7],
      local_body_code: row[8],
      village_code: null,
      state_name: row[4],
      district_name: row[3],
      block_name: row[2],
      gram_panchayat_name: row[1],
      village_name: null,
      display_label: [row[1], row[2], row[3], row[4]].filter(Boolean).join(', '),
      search_text: [row[1], row[2], row[3], row[4]].filter(Boolean).join(' '),
    };
  }
  return {
    entry_uid: `village-${row[10]}`,
    location_kind: 'village',
    lgd_code: row[10],
    state_code: row[6],
    district_code: row[7],
    subdistrict_code: row[8],
    local_body_code: row[9] || null,
    village_code: row[10],
    state_name: row[5],
    district_name: row[4],
    block_name: row[3],
    gram_panchayat_name: row[2] || null,
    village_name: row[1],
    display_label: [row[1], row[2], row[3], row[4], row[5]].filter(Boolean).join(', '),
    search_text: [row[1], row[2], row[3], row[4], row[5]].filter(Boolean).join(' '),
  };
}

async function postRows(rows) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/lgd_geography_directory?on_conflict=entry_uid`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Import batch failed (${response.status}): ${text}`);
  }
}

async function readProgress() {
  try {
    return JSON.parse(await fs.readFile(PROGRESS_FILE, 'utf8'));
  } catch {
    return { fileIndex: 0, rowOffset: 0, imported: 0 };
  }
}

async function writeProgress(progress) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function resetRemoteTable() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/lgd_geography_directory?entry_uid=not.is.null`, {
    method: 'DELETE',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Reset failed (${response.status}): ${text}`);
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running the importer.');
  }
  const args = new Set(process.argv.slice(2));
  const files = (await fs.readdir(BUCKET_DIR)).filter((name) => name.endsWith('.json')).sort();
  let progress = await readProgress();

  if (args.has('--reset')) {
    console.log('Resetting remote LGD table...');
    await resetRemoteTable();
    progress = { fileIndex: 0, rowOffset: 0, imported: 0 };
    await writeProgress(progress);
  }

  for (let fileIndex = progress.fileIndex; fileIndex < files.length; fileIndex += 1) {
    const fileName = files[fileIndex];
    const rows = JSON.parse(await fs.readFile(path.join(BUCKET_DIR, fileName), 'utf8'));
    let rowOffset = fileIndex === progress.fileIndex ? progress.rowOffset : 0;
    while (rowOffset < rows.length) {
      const batch = rows.slice(rowOffset, rowOffset + BATCH_SIZE).map(buildRowFromBucketEntry);
      await postRows(batch);
      rowOffset += batch.length;
      progress = {
        fileIndex,
        rowOffset,
        imported: progress.imported + batch.length,
      };
      await writeProgress(progress);
      console.log(`${fileName}: ${rowOffset}/${rows.length} | total imported ${progress.imported}`);
    }
    progress = {
      fileIndex: fileIndex + 1,
      rowOffset: 0,
      imported: progress.imported,
    };
    await writeProgress(progress);
  }

  console.log(`LGD import complete. Imported ${progress.imported} rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
