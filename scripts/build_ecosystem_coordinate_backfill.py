import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path


PROJECT_ROOT = Path(r"C:\github\livelihood-ecosystem-directory")
CONFIG_PATH = PROJECT_ROOT / "config.js"
OUTPUT_SQL_PATH = PROJECT_ROOT / "supabase" / "migrations" / "20260428173000_backfill_ecosystem_entity_coordinates.sql"
PUBLIC_VIEW = "ecosystem_directory_entities"

ENTITY_TABLES = {
    "mentor": "mentor_entities",
    "community_steward": "community_steward_entities",
    "volunteer": "volunteer_entities",
    "intern": "intern_entities",
    "incubation_centre": "incubation_centre_entities",
    "accelerator": "accelerator_entities",
    "institute": "institute_entities",
    "trader_association": "trader_association_entities",
    "cso": "cso_entities",
}


def read_config():
    text = CONFIG_PATH.read_text(encoding="utf-8")
    url_match = re.search(r"SUPABASE_URL:\s*'([^']+)'", text)
    key_match = re.search(r"SUPABASE_ANON_KEY:\s*'([^']+)'", text)
    if not url_match or not key_match:
        raise RuntimeError("Could not read Supabase config from config.js")
    return url_match.group(1), key_match.group(1)


def fetch_entities(base_url, anon_key):
    query = ",".join([
        "entity_uid",
        "entity_type_slug",
        "entity_name",
        "location_label",
        "primary_address",
        "district",
        "state",
        "country",
        "office_locations",
        "latitude",
        "longitude",
    ])
    url = f"{base_url}/rest/v1/{PUBLIC_VIEW}?select={urllib.parse.quote(query)}&limit=1000"
    request = urllib.request.Request(url)
    request.add_header("apikey", anon_key)
    request.add_header("Authorization", f"Bearer {anon_key}")
    request.add_header("Accept", "application/json")
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def normalize_text(value):
    return str(value or "").strip()


def has_usable_coordinate(latitude, longitude):
    try:
        lat = float(latitude)
        lng = float(longitude)
    except (TypeError, ValueError):
        return False
    return abs(lat) > 0.0001 or abs(lng) > 0.0001


def dedupe(values):
    seen = set()
    output = []
    for value in values:
        text = normalize_text(value)
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        output.append(text)
    return output


def normalize_query(value):
    return (
        normalize_text(value)
        .replace("|", ", ")
        .replace(";", ", ")
        .replace("registered office source also lists", ", ")
    )


def build_geocode_queries(entity):
    address = normalize_query(entity.get("primary_address"))
    location_label = normalize_query(entity.get("location_label"))
    district = normalize_query(entity.get("district"))
    state = normalize_query(entity.get("state"))
    country = normalize_query(entity.get("country") or "India")
    office_locations = [
        normalize_query(item)
        for item in (entity.get("office_locations") or [])
        if normalize_query(item)
    ]
    return dedupe([
        ", ".join(part for part in [address, district, state, country] if part),
        ", ".join(part for part in [address, state, country] if part),
        ", ".join(part for part in [location_label, state, country] if part),
        ", ".join(part for part in [district, state, country] if part),
        *[", ".join(part for part in [office, state, country] if part) for office in office_locations],
        ", ".join(part for part in [state, country] if part),
    ])


def build_geocode_hints(entity):
    location_head = normalize_text(entity.get("location_label")).split(",")[0]
    return [item.lower() for item in dedupe([
        normalize_text(entity.get("district")),
        normalize_text(entity.get("state")),
        location_head,
    ])]


def geocode_query(query, hints, cache):
    if query in cache:
        return cache[query]
    url = f"https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q={urllib.parse.quote(query)}"
    request = urllib.request.Request(url)
    request.add_header("Accept", "application/json")
    request.add_header("User-Agent", "Livelihood Ecosystem Directory Backfill/1.0")
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception:
        cache[query] = None
        return None
    match = data[0] if isinstance(data, list) and data else None
    if not match:
        cache[query] = None
        return None
    display_name = normalize_text(match.get("display_name")).lower()
    if hints and not any(hint and hint in display_name for hint in hints):
        cache[query] = None
        return None
    try:
        point = (float(match["lat"]), float(match["lon"]))
    except (KeyError, TypeError, ValueError):
        cache[query] = None
        return None
    cache[query] = point if has_usable_coordinate(point[0], point[1]) else None
    return cache[query]


def sql_text(value):
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def safe_console_text(value):
    return normalize_text(value).encode("ascii", "ignore").decode("ascii") or "[non-ascii-name]"


def main():
    base_url, anon_key = read_config()
    entities = fetch_entities(base_url, anon_key)
    missing = [entity for entity in entities if not has_usable_coordinate(entity.get("latitude"), entity.get("longitude"))]
    cache = {}
    statements = []
    geocoded_count = 0

    for index, entity in enumerate(missing, start=1):
        point = None
        hints = build_geocode_hints(entity)
        for query in build_geocode_queries(entity):
            point = geocode_query(query, hints, cache)
            if point:
                break
            time.sleep(1.0)
        if not point:
            continue
        geocoded_count += 1
        table = ENTITY_TABLES.get(normalize_text(entity.get("entity_type_slug")))
        if not table:
            continue
        statements.append(
            f"update public.{table} set latitude = {point[0]}, longitude = {point[1]}, updated_at = now() where entity_uid = {sql_text(entity.get('entity_uid'))};"
        )
        print(f"[{index}/{len(missing)}] Geocoded {safe_console_text(entity.get('entity_name'))} -> {point[0]}, {point[1]}")
        time.sleep(1.0)

    if not statements:
        OUTPUT_SQL_PATH.write_text("-- No missing coordinates were found.\n", encoding="utf-8")
    else:
        OUTPUT_SQL_PATH.write_text("\n".join(statements) + "\n", encoding="utf-8")
    print(f"Wrote {len(statements)} coordinate updates to {OUTPUT_SQL_PATH}")
    print(f"Geocoded rows: {geocoded_count} / {len(missing)}")


if __name__ == "__main__":
    main()
