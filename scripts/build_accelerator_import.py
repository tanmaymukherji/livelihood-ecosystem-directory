import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd


WORKBOOK_PATH = Path(r"C:\Users\tmukh\OneDrive\Desktop\India_Accelerators_Mapping_All_134_Website_Verified.xlsx")
OUTPUT_SQL_PATH = Path(r"C:\github\livelihood-ecosystem-directory\supabase\migrations\20260428194500_import_accelerators.sql")
SHEET_NAME = "Accelerator_Database"

INDIA_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry",
    "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Andaman and Nicobar Islands",
    "Lakshadweep",
]

COUNTRY_HINTS = {
    "india": "India",
    "usa": "United States",
    "united states": "United States",
    "us": "United States",
    "singapore": "Singapore",
    "norway": "Norway",
    "uae": "United Arab Emirates",
    "united arab emirates": "United Arab Emirates",
    "dubai": "United Arab Emirates",
    "uk": "United Kingdom",
    "united kingdom": "United Kingdom",
}

MISSING_PATTERNS = (
    "not found",
    "not visible",
    "not publicly disclosed",
    "unknown",
    "contact via official website",
    "contact page / online form",
    "apply via official page",
    "public accelerator email not found",
    "public program-specific email not found",
    "public phone not found",
)

MISSING_EXACT = {"na", "n/a", "nil", "none", "null", "-", "not publicly disclosed"}


def slugify(value: str) -> str:
    value = re.sub(r"[^\w\s-]", "", value or "").strip().lower()
    value = re.sub(r"[-\s]+", "-", value)
    return value.strip("-")


def compact_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def normalize_unicode_text(value: str) -> str:
    return (
        str(value or "")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u2026", "...")
        .replace("\u2192", " to ")
        .replace("\u00a0", " ")
        .replace("\u200b", "")
    )


def clean_text(value):
    if pd.isna(value):
        return None
    text = compact_spaces(normalize_unicode_text(str(value)))
    if not text:
        return None
    lowered = text.lower()
    if lowered in MISSING_EXACT:
        return None
    if any(lowered.startswith(pattern) for pattern in MISSING_PATTERNS):
        return None
    return text


def clean_contact_text(value):
    text = clean_text(value)
    if not text:
        return None
    lowered = text.lower()
    if "contact form" in lowered or "online form" in lowered or "not publicly disclosed" in lowered:
        return None
    if "not found" in lowered:
        return None
    return text


def first_sentence(text: str, limit: int = 320):
    if not text:
        return None
    pieces = re.split(r"(?<=[.!?])\s+", text)
    sentence = pieces[0].strip() if pieces else text.strip()
    if len(sentence) > limit:
        sentence = sentence[: limit - 1].rstrip() + "..."
    return sentence


def split_list(value):
    text = clean_text(value)
    if not text:
        return []
    parts = re.split(r"\s*[;|]\s*", text)
    output = []
    for part in parts:
        cleaned = compact_spaces(part)
        cleaned = re.sub(r"^[A-Za-z][A-Za-z0-9\s/&+.-]+:\s*", "", cleaned) if re.match(r"^[A-Za-z][A-Za-z0-9\s/&+.-]+:\s*https?://", cleaned) else cleaned
        if cleaned and cleaned.lower() not in {"not found on source", "not publicly disclosed"} and cleaned not in output:
            output.append(cleaned)
    return output


def parse_social_links(value):
    text = clean_text(value)
    if not text:
        return {}
    parts = re.split(r"\s*[;|]\s*", text)
    output = {}
    for part in parts:
        match = re.match(r"^\s*([^:|]+)\s*:\s*(https?://\S+)\s*$", part)
        if not match:
            url_match = re.search(r"(https?://\S+)", part)
            if not url_match:
                continue
            output[f"link_{len(output) + 1}"] = url_match.group(1).rstrip(" ,;")
            continue
        label = slugify(match.group(1)) or f"link_{len(output) + 1}"
        output[label] = match.group(2).rstrip(" ,;")
    return output


def extract_first_url(value):
    text = clean_text(value)
    if not text:
        return None
    match = re.search(r"https?://[^\s)]+", text)
    return match.group(0).rstrip(" ,;") if match else None


def extract_state(address: str, geography: str):
    haystacks = [address or "", geography or ""]
    for state in sorted(INDIA_STATES, key=len, reverse=True):
        for haystack in haystacks:
            if re.search(rf"\b{re.escape(state)}\b", haystack, flags=re.IGNORECASE):
                return state
    if re.search(r"\bcalifornia\b", address or "", flags=re.IGNORECASE):
        return "California"
    return None


def extract_country(address: str, geography: str):
    address_haystack = normalize_unicode_text(address or "").lower()
    geography_haystack = normalize_unicode_text(geography or "").lower()
    priority_hints = [item for item in COUNTRY_HINTS.items() if item[0] != "india"]
    for hint, country in priority_hints:
        if re.search(rf"\b{re.escape(hint)}\b", address_haystack):
            return country
    for hint, country in priority_hints:
        if re.search(rf"\b{re.escape(hint)}\b", geography_haystack):
            return country
    haystack = f"{address_haystack} {geography_haystack}"
    if re.search(r"\bglobal\b", haystack) and not re.search(r"\bindia\b", haystack):
        return "Global"
    return "India"


def extract_district(address: str, state: str):
    if not address:
        return None
    segments = [compact_spaces(item) for item in re.split(r"[,/]", address) if compact_spaces(item)]
    if state:
        for index, segment in enumerate(segments):
            if state.lower() in segment.lower():
                if index > 0:
                    prior = re.sub(r"\b\d{4,6}\b", "", segments[index - 1]).strip(" -")
                    return compact_spaces(prior) or None
                return None
    if len(segments) >= 2:
        candidate = re.sub(r"\b\d{4,6}\b", "", segments[-2]).strip(" -")
        return compact_spaces(candidate) or None
    return None


def dedupe(values):
    seen = set()
    output = []
    for value in values:
        text = compact_spaces(str(value or ""))
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        output.append(text)
    return output


def normalize_query(value):
    return (
        compact_spaces(str(value or ""))
        .replace("|", ", ")
        .replace(";", ", ")
        .replace(" / ", ", ")
        .replace("→", ", ")
    )


def build_geocode_queries(address, location_label, district, state, country, office_locations):
    return dedupe([
        ", ".join(part for part in [normalize_query(address), district, state, country] if part),
        ", ".join(part for part in [normalize_query(address), state, country] if part),
        ", ".join(part for part in [normalize_query(location_label), state, country] if part),
        ", ".join(part for part in [district, state, country] if part),
        *[", ".join(part for part in [normalize_query(item), state, country] if part) for item in office_locations],
        ", ".join(part for part in [state, country] if part),
        country if country != "India" else "",
    ])


def build_geocode_hints(location_label, district, state):
    location_head = compact_spaces(str(location_label or "")).split(",")[0]
    return [item.lower() for item in dedupe([district, state, location_head]) if item]


def has_usable_coordinate(latitude, longitude):
    try:
        lat = float(latitude)
        lng = float(longitude)
    except (TypeError, ValueError):
        return False
    return abs(lat) > 0.0001 or abs(lng) > 0.0001


def geocode_query(query, hints, cache):
    if not query:
        return None
    if query in cache:
        return cache[query]
    url = f"https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q={urllib.parse.quote(query)}"
    request = urllib.request.Request(url)
    request.add_header("Accept", "application/json")
    request.add_header("User-Agent", "Livelihood Ecosystem Accelerator Import/1.0")
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
    display_name = compact_spaces(str(match.get("display_name") or "")).lower()
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


def sql_text_array(values):
    cleaned = [str(item).replace("'", "''") for item in values if item]
    if not cleaned:
        return "'{}'::text[]"
    return "ARRAY[" + ", ".join(f"'{item}'" for item in cleaned) + "]::text[]"


def sql_json(value):
    return sql_text(json.dumps(value, ensure_ascii=False)) + "::jsonb"


def safe_console_text(value):
    return compact_spaces(str(value or "")).encode("ascii", "ignore").decode("ascii") or "[non-ascii-name]"


def build_admin_notes(row, source_urls):
    notes = [
        f"Accelerator Record ID: {clean_text(row['Record_ID']) or 'Unknown'}",
        f"Program / Organisation Type: {clean_text(row['Program / Organisation Type']) or 'Unknown'}",
    ]
    verification_level = clean_text(row["Verification level"])
    verification_notes = clean_text(row["Notes / Next verification needed"])
    if verification_level:
        notes.append(f"Verification Level: {verification_level}")
    if verification_notes:
        notes.append(f"Verification Notes: {verification_notes}")
    if source_urls:
        notes.append("Source URLs: " + "; ".join(source_urls))
    return "\n".join(notes)


def build_row_sql(row, geocode_cache):
    record_id = clean_text(row["Record_ID"])
    name = clean_text(row["Name of Accelerator"])
    if not name:
        return None

    address = clean_text(row["Address / Head Office"])
    geography_text = clean_text(row["Geography served"])
    state = extract_state(address or "", geography_text or "")
    country = extract_country(address or "", geography_text or "")
    district = extract_district(address or "", state)
    website_url = extract_first_url(row["Website"])
    application_link = extract_first_url(row["Program application link"])
    source_urls = [item for item in split_list(row["Source URLs"]) if item]
    source_url = extract_first_url(row["Source URLs"]) or website_url

    thematic_areas = split_list(row["Thematic areas of work"])
    startup_stages = split_list(row["Startup stages supported"])
    support_services = split_list(row["Support Services offered"])
    geography_served = split_list(row["Geography served"])
    facilities = split_list(row["Facilities"])
    office_locations = split_list(row["Additional office locations"])
    social_media = parse_social_links(row["Social media links"])

    description = clean_text(row["Description of the accelerator"])
    summary = first_sentence(description)
    contact_email = clean_contact_text(row["Contact email"])
    contact_phone = clean_contact_text(row["Contact phone"])
    funding_support = clean_text(row["Funding Support"])
    program_duration = clean_text(row["Program duration"])
    program_type = clean_text(row["Program / Organisation Type"])
    verification_level = clean_text(row["Verification level"])

    location_label = district and state and f"{district}, {state}" or state or geography_text or address
    cohort_frequency = None
    duration_text = program_duration or ""
    if re.search(r"\b\d+\s*(times|cohorts)\s*(a|per)\s*year\b", duration_text, flags=re.IGNORECASE):
        cohort_frequency = duration_text

    investment_range = funding_support
    tags = ["Accelerator", "Accelerator Mapping 2026"]
    if program_type:
        tags.append(program_type)
    if verification_level:
        tags.append(verification_level)

    keywords = []
    for collection in (thematic_areas, startup_stages, support_services, geography_served, facilities):
        keywords.extend(collection)
    if program_type:
        keywords.append(program_type)
    if country:
        keywords.append(country)

    type_specific_data = {
        "thematic_areas": thematic_areas,
        "startup_stages_supported": startup_stages,
        "support_services": support_services,
        "geography_served": geography_served,
        "program_duration": program_duration,
        "application_link": application_link,
        "cohort_frequency": cohort_frequency,
        "investment_range": investment_range,
        "program_organisation_type": program_type,
        "funding_support": funding_support,
        "facilities": facilities,
        "verification_level": verification_level,
    }

    latitude = None
    longitude = None
    hints = build_geocode_hints(location_label, district, state)
    for query in build_geocode_queries(address, location_label, district, state, country, office_locations):
        point = geocode_query(query, hints, geocode_cache)
        if point:
            latitude, longitude = point
            break
        time.sleep(1.0)

    search_text_parts = [
        name,
        summary or "",
        description or "",
        location_label or "",
        address or "",
        district or "",
        state or "",
        country or "",
        contact_email or "",
        contact_phone or "",
        website_url or "",
        " ".join(tags),
        " ".join(keywords),
        " ".join(thematic_areas + startup_stages + support_services + geography_served + facilities),
        funding_support or "",
        verification_level or "",
    ]
    search_text = compact_spaces(" ".join(part for part in search_text_parts if part))

    entity_uid = f"accelerator-{slugify(record_id or name)}-{slugify(name)[:72]}"
    admin_notes = build_admin_notes(row, source_urls)
    print(f"Prepared {safe_console_text(name)} | coords={'yes' if latitude and longitude else 'no'}")

    return "(" + ", ".join([
        sql_text(entity_uid),
        sql_text(name),
        sql_text(summary),
        sql_text(description),
        sql_text(location_label),
        sql_text(address),
        sql_text(district),
        sql_text(state),
        sql_text(country),
        sql_text(contact_email),
        sql_text(contact_phone),
        sql_text(website_url),
        sql_json(social_media),
        sql_json(office_locations),
        sql_text_array(tags),
        sql_text_array(keywords),
        str(latitude) if latitude is not None else "null",
        str(longitude) if longitude is not None else "null",
        sql_text("India accelerator mapping workbook"),
        sql_text(source_url),
        sql_json(type_specific_data),
        sql_text("Accelerator workbook import"),
        "null",
        sql_text(admin_notes),
        sql_text("approved"),
        "now()",
        sql_text("admin"),
        "false",
        sql_text(search_text),
        "now()",
    ]) + ")"


def main():
    df = pd.read_excel(WORKBOOK_PATH, sheet_name=SHEET_NAME)
    geocode_cache = {}
    values_sql = []
    for _, row in df.iterrows():
        row_sql = build_row_sql(row, geocode_cache)
        if row_sql:
            values_sql.append(row_sql)

    sql = """insert into public.accelerator_entities (
  entity_uid,
  entity_name,
  summary,
  description,
  location_label,
  primary_address,
  district,
  state,
  country,
  contact_email,
  contact_phone,
  website_url,
  social_media,
  office_locations,
  tags,
  keywords,
  latitude,
  longitude,
  source_label,
  source_url,
  type_specific_data,
  created_by_name,
  created_by_email,
  admin_notes,
  approval_status,
  approved_at,
  approved_by,
  is_deleted,
  search_text,
  updated_at
) values
""" + ",\n".join(values_sql) + """
on conflict (entity_uid) do update set
  entity_name = excluded.entity_name,
  summary = excluded.summary,
  description = excluded.description,
  location_label = excluded.location_label,
  primary_address = excluded.primary_address,
  district = excluded.district,
  state = excluded.state,
  country = excluded.country,
  contact_email = excluded.contact_email,
  contact_phone = excluded.contact_phone,
  website_url = excluded.website_url,
  social_media = excluded.social_media,
  office_locations = excluded.office_locations,
  tags = excluded.tags,
  keywords = excluded.keywords,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  source_label = excluded.source_label,
  source_url = excluded.source_url,
  type_specific_data = excluded.type_specific_data,
  created_by_name = excluded.created_by_name,
  created_by_email = excluded.created_by_email,
  admin_notes = excluded.admin_notes,
  approval_status = 'approved',
  approved_at = now(),
  approved_by = 'admin',
  is_deleted = false,
  search_text = excluded.search_text,
  updated_at = now();
"""
    OUTPUT_SQL_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_SQL_PATH.write_text(sql, encoding="utf-8")
    print(f"Wrote {len(values_sql)} accelerator rows to {OUTPUT_SQL_PATH}")


if __name__ == "__main__":
    main()
