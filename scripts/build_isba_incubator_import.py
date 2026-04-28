import json
import re
from pathlib import Path

import pandas as pd


WORKBOOK_PATH = Path(r"C:\Users\tmukh\OneDrive\Desktop\isba_member_directory_research_workbook_verified_final.xlsx")
OUTPUT_SQL_PATH = Path(r"C:\github\livelihood-ecosystem-directory\supabase\migrations\20260428153000_import_isba_incubators.sql")
SHEET_NAME = "ISBA_Member_Directory"

STATE_NAMES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry",
    "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Andaman and Nicobar Islands",
    "Lakshadweep",
]

MISSING_PATTERNS = (
    "not found",
    "not visible",
    "js-limited",
    "not accessible",
    "unknown",
)

MISSING_EXACT = {"na", "n/a", "nil", "none", "null", "-"}


def slugify(value: str) -> str:
    value = re.sub(r"[^\w\s-]", "", value or "").strip().lower()
    value = re.sub(r"[-\s]+", "-", value)
    return value.strip("-")


def compact_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", (value or "").strip())


def clean_text(value):
    if pd.isna(value):
        return None
    text = compact_spaces(str(value))
    if not text:
        return None
    lowered = text.lower()
    if lowered in MISSING_EXACT:
        return None
    if any(lowered.startswith(pattern) for pattern in MISSING_PATTERNS):
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
      cleaned = re.sub(r"^[A-Za-z][A-Za-z\s]+:\s*", "", cleaned) if re.match(r"^[A-Za-z][A-Za-z\s]+:\s*https?://", cleaned) else cleaned
      if cleaned and cleaned.lower() not in {"not found on source"} and cleaned not in output:
          output.append(cleaned)
    return output


def parse_social_links(value):
    text = clean_text(value)
    if not text:
        return {}
    parts = re.split(r"\s*\|\s*", text)
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
    for state in sorted(STATE_NAMES, key=len, reverse=True):
        for haystack in haystacks:
            if re.search(rf"\b{re.escape(state)}\b", haystack, flags=re.IGNORECASE):
                return state
    return None


def extract_district(address: str, state: str):
    if not address:
        return None
    segments = [compact_spaces(item) for item in address.split(",") if compact_spaces(item)]
    if state:
        for index, segment in enumerate(segments):
            if state.lower() in segment.lower():
                if index > 0:
                    prior = re.sub(r"\b\d{5,6}\b", "", segments[index - 1]).strip(" -")
                    return compact_spaces(prior) or None
                return None
    if len(segments) >= 2:
        candidate = re.sub(r"\b\d{5,6}\b", "", segments[-2]).strip(" -")
        return compact_spaces(candidate) or None
    return None


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


def build_admin_notes(row, source_urls):
    notes = [
        f"ISBA Record ID: {int(row['Record ID'])}",
        f"Membership Type: {clean_text(row['Membership Type']) or 'Unknown'}",
        f"Region: {clean_text(row['Region']) or 'Unknown'}",
    ]
    reviewed_sources = clean_text(row["Member website/source reviewed"])
    research_status = clean_text(row["Research status"])
    verification_notes = clean_text(row["Notes / fields needing verification"])
    if reviewed_sources:
        notes.append(f"Reviewed Sources: {reviewed_sources}")
    if research_status:
        notes.append(f"Research Status: {research_status}")
    if verification_notes:
        notes.append(f"Verification Notes: {verification_notes}")
    if source_urls:
        notes.append("Source URLs: " + "; ".join(source_urls))
    return "\n".join(notes)


def build_row_sql(row):
    record_id = int(row["Record ID"])
    name = clean_text(row["Name of Incubator"])
    if not name:
        return None

    address = clean_text(row["Address"])
    geography_text = clean_text(row["Geography served"])
    state = extract_state(address or "", geography_text or "")
    district = extract_district(address or "", state)
    website_url = extract_first_url(row["Website"])
    application_link = extract_first_url(row["Program application link"])
    source_url = extract_first_url(row["ISBA directory source URL"])
    source_reviewed = clean_text(row["Member website/source reviewed"])
    source_urls = [item.strip() for item in re.split(r"\s*;\s*", source_reviewed or "") if item.strip()]

    thematic_areas = split_list(row["Thematic areas of work"])
    startup_stages = split_list(row["Startup stages supported"])
    support_services = split_list(row["Support Services offered"])
    geography_served = split_list(row["Geography served"])
    facilities = split_list(row["Facilities"])
    office_locations = split_list(row["Additional office locations"])
    social_media = parse_social_links(row["Social media links"])

    description = clean_text(row["Description of the incubator"])
    summary = first_sentence(description)
    contact_email = clean_text(row["Contact email"])
    contact_phone = clean_text(row["Contact phone"])
    funding_support = clean_text(row["Funding Support"])
    program_duration = clean_text(row["Program duration"])
    membership_type = clean_text(row["Membership Type"])
    region = clean_text(row["Region"])

    tags = ["ISBA", "Incubation Centre"]
    if membership_type:
        tags.append(f"ISBA {membership_type}")
    if region:
        tags.append(region)

    keywords = []
    for collection in (thematic_areas, startup_stages, support_services, geography_served, facilities):
        keywords.extend(collection)
    if membership_type:
        keywords.append(membership_type)
    if region:
        keywords.append(region)

    type_specific_data = {
        "thematic_areas": thematic_areas,
        "startup_stages_supported": startup_stages,
        "support_services": support_services,
        "geography_served": geography_served,
        "program_duration": program_duration,
        "application_link": application_link,
        "funding_support": funding_support,
        "facilities": facilities,
        "isba_membership_type": membership_type,
        "isba_region": region,
    }

    search_text_parts = [
        name,
        summary or "",
        description or "",
        address or "",
        district or "",
        state or "",
        contact_email or "",
        contact_phone or "",
        website_url or "",
        " ".join(tags),
        " ".join(keywords),
        " ".join(thematic_areas + startup_stages + support_services + geography_served + facilities),
    ]
    search_text = compact_spaces(" ".join(part for part in search_text_parts if part))

    entity_uid = f"isba-incubator-{record_id:03d}-{slugify(name)[:80]}"
    admin_notes = build_admin_notes(row, source_urls)

    return "(" + ", ".join([
        sql_text(entity_uid),
        sql_text(name),
        sql_text(summary),
        sql_text(description),
        sql_text(district and state and f"{district}, {state}" or district or state or geography_text or address),
        sql_text(address),
        sql_text(district),
        sql_text(state),
        sql_text("India"),
        sql_text(contact_email),
        sql_text(contact_phone),
        sql_text(website_url),
        sql_json(social_media),
        sql_json(office_locations),
        sql_text_array(tags),
        sql_text_array(keywords),
        "null",
        "null",
        sql_text("ISBA member directory research workbook"),
        sql_text(source_url),
        sql_json(type_specific_data),
        sql_text("ISBA workbook import"),
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
    values_sql = []
    for _, row in df.iterrows():
        row_sql = build_row_sql(row)
        if row_sql:
            values_sql.append(row_sql)

    sql = """insert into public.incubation_centre_entities (
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
    print(f"Wrote {len(values_sql)} incubator rows to {OUTPUT_SQL_PATH}")


if __name__ == "__main__":
    main()
