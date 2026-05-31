#!/usr/bin/env bash
set -euo pipefail

# Seeds a screenshot-ready ATS workspace through the public API, with a small
# amount of direct SQL for invite-token lookup and richer demo application state.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env"
  set +a
fi

GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"
POSTGRES_USER="${POSTGRES_USER:-ats_admin}"
AUTH_DB="${AUTH_DB:-ats_auth}"
JOBS_DB="${JOBS_DB:-ats_jobs}"

ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="admin123"
ORG_ADMIN_EMAIL="sara.alemu@shegertech.example"
ORG_ADMIN_PASSWORD="OrgAdminDemo123!"
RECRUITER_EMAIL="dawit.bekele@shegertech.example"
RECRUITER_PASSWORD="RecruiterDemo123!"
CANDIDATE_EMAIL="mekdes.tesfaye@example.com"
CANDIDATE_PASSWORD="CandidateDemo123!"

CANDIDATE_RESUME_TXT="$ROOT_DIR/data/samples/mekdes_tesfaye_resume.txt"
CANDIDATE_RESUME_DOC="$ROOT_DIR/data/samples/mekdes_tesfaye_resume.doc"

json_value() {
  local field="$1"
  python3 -c 'import json,sys; data=json.load(sys.stdin); value=data.get(sys.argv[1], ""); print("" if value is None else value)' "$field"
}

api_json() {
  curl -fsS "$@"
}

login() {
  local email="$1"
  local password="$2"
  api_json -X POST "$GATEWAY_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "$(python3 - "$email" "$password" <<'PY'
import json, sys
print(json.dumps({"email": sys.argv[1], "password": sys.argv[2]}))
PY
)"
}

wait_for_gateway() {
  printf '==> Waiting for API Gateway at %s\n' "$GATEWAY_URL"
  for i in $(seq 1 60); do
    if curl -fsS "$GATEWAY_URL/actuator/health" >/dev/null 2>&1; then
      printf '    Gateway is ready.\n'
      return 0
    fi
    printf '    Waiting... (%s/60)\n' "$i"
    sleep 5
  done
  printf 'Gateway did not become ready in time.\n' >&2
  exit 1
}

wait_for_admin_login() {
  printf '==> Waiting for default platform admin login\n'
  for i in $(seq 1 36); do
    if ADMIN_LOGIN="$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD" 2>/dev/null)"; then
      ADMIN_TOKEN="$(printf '%s' "$ADMIN_LOGIN" | json_value accessToken)"
      if [ -n "$ADMIN_TOKEN" ]; then
        printf '    Platform admin is ready.\n'
        return 0
      fi
    fi
    printf '    Waiting... (%s/36)\n' "$i"
    sleep 5
  done
  printf 'Could not log in as %s.\n' "$ADMIN_EMAIL" >&2
  exit 1
}

wait_for_jobs_service() {
  local token="$1"
  printf '==> Waiting for jobs-service through the gateway\n'
  for i in $(seq 1 36); do
    if curl -fsS "$GATEWAY_URL/api/v1/jobs?size=1" \
      -H "Authorization: Bearer $token" >/dev/null 2>&1; then
      printf '    Jobs service is ready.\n'
      return 0
    fi
    printf '    Waiting... (%s/36)\n' "$i"
    sleep 5
  done
  printf 'jobs-service did not become ready in time.\n' >&2
  exit 1
}

create_org() {
  printf '==> Creating demo organization\n'
  for i in $(seq 1 24); do
    if ORG_RESP="$(api_json -X POST "$GATEWAY_URL/api/v1/organizations" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -d '{"name":"Sheger Tech"}' 2>/dev/null)"; then
      ORG_ID="$(printf '%s' "$ORG_RESP" | json_value id)"
      if [ -n "$ORG_ID" ]; then
        printf '    Organization ID: %s\n' "$ORG_ID"
        return 0
      fi
    fi
    printf '    Waiting for user-service... (%s/24)\n' "$i"
    sleep 5
  done
  printf 'Could not create organization.\n' >&2
  exit 1
}

psql_scalar() {
  local db="$1"
  local sql="$2"
  $COMPOSE_CMD exec -T postgres psql -U "$POSTGRES_USER" -d "$db" -Atc "$sql"
}

psql_jobs() {
  $COMPOSE_CMD exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$JOBS_DB"
}

accept_invite() {
  local token="$1"
  local first_name="$2"
  local last_name="$3"
  local password="$4"

  api_json -X POST "$GATEWAY_URL/api/v1/auth/invite/accept" \
    -H "Content-Type: application/json" \
    -d "$(python3 - "$token" "$first_name" "$last_name" "$password" <<'PY'
import json, sys
print(json.dumps({
    "token": sys.argv[1],
    "firstName": sys.argv[2],
    "lastName": sys.argv[3],
    "password": sys.argv[4],
}))
PY
)" >/dev/null
}

create_org_admin() {
  printf '==> Creating org admin account\n'
  local token_resp invite_token
  token_resp="$(api_json -X POST "$GATEWAY_URL/auth/internal/invite-org-admin-token" \
    -H "Content-Type: application/json" \
    -d "$(python3 - "$ORG_ADMIN_EMAIL" "$ORG_ID" <<'PY'
import json, sys
print(json.dumps({"email": sys.argv[1], "orgId": sys.argv[2]}))
PY
)")"
  invite_token="$(printf '%s' "$token_resp" | json_value token)"
  accept_invite "$invite_token" "Sara" "Alemu" "$ORG_ADMIN_PASSWORD"
  ORG_ADMIN_LOGIN="$(login "$ORG_ADMIN_EMAIL" "$ORG_ADMIN_PASSWORD")"
  ORG_ADMIN_TOKEN="$(printf '%s' "$ORG_ADMIN_LOGIN" | json_value accessToken)"
  printf '    Org admin: %s\n' "$ORG_ADMIN_EMAIL"
}

create_recruiter() {
  printf '==> Creating recruiter account\n'
  api_json -X POST "$GATEWAY_URL/api/v1/auth/invite/recruiter" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ORG_ADMIN_TOKEN" \
    -d "$(python3 - "$RECRUITER_EMAIL" <<'PY'
import json, sys
print(json.dumps({"email": sys.argv[1], "firstName": "Dawit", "lastName": "Bekele"}))
PY
)" >/dev/null

  local invite_token
  invite_token="$(psql_scalar "$AUTH_DB" "SELECT token FROM invite_token WHERE email = '$RECRUITER_EMAIL' AND used = false ORDER BY created_at DESC LIMIT 1;")"
  if [ -z "$invite_token" ]; then
    printf 'Could not find recruiter invite token for %s.\n' "$RECRUITER_EMAIL" >&2
    exit 1
  fi

  accept_invite "$invite_token" "Dawit" "Bekele" "$RECRUITER_PASSWORD"
  RECRUITER_LOGIN="$(login "$RECRUITER_EMAIL" "$RECRUITER_PASSWORD")"
  RECRUITER_TOKEN="$(printf '%s' "$RECRUITER_LOGIN" | json_value accessToken)"
  RECRUITER_ID="$(printf '%s' "$RECRUITER_LOGIN" | json_value userId)"
  printf '    Recruiter: %s\n' "$RECRUITER_EMAIL"
}

create_candidate() {
  printf '==> Creating candidate account and profile\n'
  api_json -X POST "$GATEWAY_URL/api/v1/auth/signup" \
    -H "Content-Type: application/json" \
    -d "$(python3 - "$CANDIDATE_EMAIL" "$CANDIDATE_PASSWORD" <<'PY'
import json, sys
print(json.dumps({
    "firstName": "Mekdes",
    "lastName": "Tesfaye",
    "email": sys.argv[1],
    "password": sys.argv[2],
    "role": "CANDIDATE",
}))
PY
)" >/dev/null

  CANDIDATE_LOGIN="$(login "$CANDIDATE_EMAIL" "$CANDIDATE_PASSWORD")"
  CANDIDATE_TOKEN="$(printf '%s' "$CANDIDATE_LOGIN" | json_value accessToken)"
  CANDIDATE_ID="$(printf '%s' "$CANDIDATE_LOGIN" | json_value userId)"

  local profile_resp profile_id
  if ! profile_resp="$(api_json -X GET "$GATEWAY_URL/api/v1/profiles/me" \
    -H "Authorization: Bearer $CANDIDATE_TOKEN" 2>/dev/null)"; then
    api_json -X POST "$GATEWAY_URL/internal/profiles/bootstrap" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $CANDIDATE_TOKEN" \
      -d "$(python3 - "$CANDIDATE_ID" "$CANDIDATE_EMAIL" <<'PY'
import json, sys
print(json.dumps({
    "authUserId": sys.argv[1],
    "firstName": "Mekdes",
    "lastName": "Tesfaye",
    "email": sys.argv[2],
    "role": "CANDIDATE",
}))
PY
)" >/dev/null
  fi

  profile_resp="$(api_json -X PUT "$GATEWAY_URL/api/v1/profiles/me" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CANDIDATE_TOKEN" \
    -d '{
      "phone": "+251 91 234 5678",
      "headline": "Full stack product engineer focused on hiring platforms",
      "location": "Addis Ababa, Ethiopia",
      "bio": "Product-minded engineer with 5 years building React, Next.js, Spring Boot, and data-heavy workflow tools. Strong record shipping polished candidate and recruiter experiences for Ethiopian and remote teams.",
      "linkedinUrl": "https://linkedin.com/in/mekdestesfaye-demo",
      "portfolioUrl": "https://mekdes-tesfaye.example/portfolio",
      "websiteUrl": "https://mekdes-tesfaye.example",
      "yearsOfExperience": 5
    }')"
  profile_id="$(printf '%s' "$profile_resp" | json_value id)"

  api_json -X POST "$GATEWAY_URL/api/v1/profiles/$profile_id/upload-cv" \
    -H "Authorization: Bearer $CANDIDATE_TOKEN" \
    -F "file=@$CANDIDATE_RESUME_DOC;type=application/msword" >/dev/null

  printf '    Candidate: %s\n' "$CANDIDATE_EMAIL"
}

create_jobs() {
  printf '==> Creating and publishing six jobs\n'
  JOB_IDS=()

  while IFS= read -r payload; do
    local title job_resp job_id
    title="$(printf '%s' "$payload" | json_value title)"
    job_resp="$(api_json -X POST "$GATEWAY_URL/api/v1/jobs" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $RECRUITER_TOKEN" \
      -d "$payload")"
    job_id="$(printf '%s' "$job_resp" | json_value id)"
    api_json -X POST "$GATEWAY_URL/api/v1/jobs/$job_id/publish" \
      -H "Authorization: Bearer $RECRUITER_TOKEN" >/dev/null
    JOB_IDS+=("$job_id")
    printf '    Published: %s\n' "$title"
  done < <(python3 <<'PY'
import json

jobs = [
    {
        "title": "Software Engineer",
        "description": "Join the Core Experience team building the workflows candidates and hiring teams use every day. You will own product surfaces from polished Next.js interfaces through Spring Boot APIs, data models, observability, and production rollout. The role is ideal for an engineer who cares about craft, speed, and measurable user outcomes.",
        "requirements": "5+ years building production web applications. Deep experience with React, TypeScript, API design, and relational data modeling. Comfortable with Java or Spring Boot, automated testing, and shipping accessible UI. Experience with hiring, workflow, or B2B SaaS products is a plus.",
        "location": "Addis Ababa, Ethiopia",
        "employmentType": "FULL_TIME",
        "experienceLevel": "SENIOR",
        "skills": ["React", "Next.js", "TypeScript", "Spring Boot", "PostgreSQL", "Product Engineering", "Accessibility", "API Design"],
        "applicationDeadline": "2026-07-15T17:00:00",
        "customScoringRules": {"mustHave": ["React", "TypeScript"], "niceToHave": ["Spring Boot", "B2B SaaS"]},
    },
    {
        "title": "Backend Engineer",
        "description": "Own the services powering job posting, applications, notifications, and ranking workflows. You will improve service boundaries, data reliability, queue processing, and operational tooling across a local-first microservice platform.",
        "requirements": "Strong backend engineering background with Java, Spring Boot, PostgreSQL, Kafka, and Docker. Experience designing resilient APIs, debugging distributed systems, and improving developer workflows. Familiarity with observability and cloud deployment patterns preferred.",
        "location": "Remote",
        "employmentType": "REMOTE",
        "experienceLevel": "MID",
        "skills": ["Java", "Spring Boot", "Kafka", "PostgreSQL", "Docker", "Microservices", "Observability", "REST APIs"],
        "applicationDeadline": "2026-07-22T17:00:00",
        "customScoringRules": {"mustHave": ["Java", "PostgreSQL"], "niceToHave": ["Kafka", "Observability"]},
    },
    {
        "title": "UX Designer",
        "description": "Design recruiter-facing experiences for AI-assisted screening, assessment setup, interview scheduling, and candidate communication. You will partner closely with engineering and product to turn complex automation into clear, trustworthy workflows.",
        "requirements": "4+ years designing SaaS products or operational tools. Strong UX systems thinking, prototyping skill, and comfort validating designs with users. Experience with AI-assisted products, HR tech, or analytics-heavy interfaces is highly valued.",
        "location": "Bahir Dar, Ethiopia",
        "employmentType": "FULL_TIME",
        "experienceLevel": "MID",
        "skills": ["Product Design", "UX Research", "Figma", "Design Systems", "AI Workflows", "Recruiter UX", "Prototyping"],
        "applicationDeadline": "2026-08-01T17:00:00",
        "customScoringRules": {"mustHave": ["Product Design", "Figma"], "niceToHave": ["AI Workflows", "HR Tech"]},
    },
    {
        "title": "Data Analyst",
        "description": "Build dashboards and analysis that help recruiting leaders understand pipeline health, candidate quality, assessment outcomes, and time-to-hire. You will transform product data into actionable insights for operators and executives.",
        "requirements": "3+ years in analytics with strong SQL, dashboarding, and stakeholder communication. Experience with funnel metrics, experimentation, and data quality checks. Python or dbt experience preferred.",
        "location": "Hawassa, Ethiopia",
        "employmentType": "FULL_TIME",
        "experienceLevel": "MID",
        "skills": ["SQL", "Analytics", "Tableau", "Python", "dbt", "Recruiting Metrics", "Experimentation"],
        "applicationDeadline": "2026-07-29T17:00:00",
        "customScoringRules": {"mustHave": ["SQL", "Analytics"], "niceToHave": ["dbt", "Python"]},
    },
    {
        "title": "Frontend Engineer",
        "description": "Create fast, accessible candidate experiences for job discovery, applications, assessments, interview booking, and offer review. You will work across responsive UI, component quality, animation details, and client-side data flows.",
        "requirements": "2+ years with React, TypeScript, modern CSS, and API integration. Care for accessibility, mobile quality, and performance. Experience with Next.js, Tailwind CSS, and design collaboration is a plus.",
        "location": "Mekelle, Ethiopia",
        "employmentType": "FULL_TIME",
        "experienceLevel": "ENTRY",
        "skills": ["React", "TypeScript", "Next.js", "Tailwind CSS", "Accessibility", "Responsive Design", "Testing"],
        "applicationDeadline": "2026-08-08T17:00:00",
        "customScoringRules": {"mustHave": ["React", "TypeScript"], "niceToHave": ["Accessibility", "Next.js"]},
    },
    {
        "title": "Operations Manager",
        "description": "Lead recruiting operations for a growing product and engineering organization. You will manage process design, reporting, interviewer training, candidate communications, and system hygiene across the ATS.",
        "requirements": "5+ years in recruiting operations, talent acquisition, or people operations. Strong process ownership, stakeholder management, reporting discipline, and ATS administration experience. Excellent written communication required.",
        "location": "Adama, Ethiopia",
        "employmentType": "FULL_TIME",
        "experienceLevel": "LEAD",
        "skills": ["Recruiting Ops", "ATS Administration", "Process Design", "Reporting", "Stakeholder Management", "Candidate Experience"],
        "applicationDeadline": "2026-08-12T17:00:00",
        "customScoringRules": {"mustHave": ["Recruiting Ops", "ATS Administration"], "niceToHave": ["Reporting", "Candidate Experience"]},
    },
]

for job in jobs:
    print(json.dumps(job))
PY
)
}

apply_candidate_to_job() {
  local job_id="$1"
  local cover_letter="$2"
  local status="$3"
  local score="$4"
  local rank="$5"
  local final_rank="$6"
  local request_json app_resp app_id

  request_json="$(python3 - "$cover_letter" <<'PY'
import json, sys
print(json.dumps({
    "coverLetter": sys.argv[1],
    "portfolioLinks": ["https://mekdes-tesfaye.example/portfolio", "https://github.com/mekdestesfaye-demo"],
    "contactPhone": "+251 91 234 5678",
    "useProfileData": True,
}))
PY
)"

  app_resp="$(api_json -X POST "$GATEWAY_URL/api/v1/jobs/$job_id/apply" \
    -H "Authorization: Bearer $CANDIDATE_TOKEN" \
    -F "request=$request_json;type=application/json" \
    -F "file=@$CANDIDATE_RESUME_TXT;filename=Mekdes_Tesfaye_Resume.txt;type=text/plain")"
  app_id="$(printf '%s' "$app_resp" | json_value id)"

  psql_jobs <<SQL >/dev/null
UPDATE application
SET status = '$status',
    parse_confidence = 0.97,
    composite_score = $score,
    ranking_position = $rank,
    final_ranking_score = $score,
    final_rank = $final_rank,
    updated_at = NOW()
WHERE id = '$app_id'::uuid;
SQL
  printf '    Candidate application: %s (%s)\n' "$app_id" "$status"
}

seed_applications() {
  printf '==> Seeding candidate and sample applications\n'

  apply_candidate_to_job "${JOB_IDS[0]}" \
    "I have spent the last five years building workflow-heavy React and Spring Boot products. Sheger Tech stands out because the role combines product craft, candidate empathy, and platform depth." \
    "SCREENED" "94.20" "1" "1"

  apply_candidate_to_job "${JOB_IDS[1]}" \
    "My recent work includes Java services, PostgreSQL-backed workflow APIs, and event-driven integrations. I would be excited to help harden the platform services behind applications and ranking for remote teams." \
    "APPLIED" "86.40" "2" "2"

  apply_candidate_to_job "${JOB_IDS[4]}" \
    "Candidate experience is the product surface I care about most. I can bring strong frontend execution, accessible UI habits, and enough backend context to move quickly with the platform team." \
    "INTERVIEW_INVITED" "91.10" "1" "1"

  psql_jobs <<SQL >/dev/null
INSERT INTO application (
    id, job_id, candidate_auth_user_id, candidate_email, candidate_name,
    cover_letter, portfolio_links, contact_phone, candidate_profile_snapshot,
    original_filename, status, parse_confidence, composite_score, ranking_position,
    oa_score, final_ranking_score, final_rank, created_at, updated_at
) VALUES
    (gen_random_uuid(), '${JOB_IDS[0]}'::uuid, NULL, 'abebe.kebede@example.com', 'Abebe Kebede',
     'I have led React platform projects for scheduling and onboarding products and enjoy pairing polished UI with reliable APIs.',
     ARRAY['https://abebekebede.example/work'], '+251 91 111 0142',
     '{"headline":"Senior product engineer", "yearsOfExperience":7, "location":"Addis Ababa, Ethiopia"}'::jsonb,
     'Abebe_Kebede_Resume.pdf', 'SCREENED', 0.95, 88.90, 2, NULL, 88.90, 2, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
    (gen_random_uuid(), '${JOB_IDS[0]}'::uuid, NULL, 'hana.tadesse@example.com', 'Hana Tadesse',
     'My background combines design systems, TypeScript, and B2B product delivery across several high-growth SaaS teams.',
     ARRAY['https://hanatadesse.example'], '+251 92 111 0119',
     '{"headline":"Frontend focused full stack engineer", "yearsOfExperience":6, "location":"Bahir Dar, Ethiopia"}'::jsonb,
     'Hana_Tadesse_Resume.pdf', 'OA_INVITED', 0.93, 82.70, 3, NULL, 82.70, 3, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days'),
    (gen_random_uuid(), '${JOB_IDS[1]}'::uuid, NULL, 'selamawit.gebre@example.com', 'Selamawit Gebre',
     'I specialize in Spring Boot, Kafka, and observability for high-volume workflow systems.',
     ARRAY['https://github.com/selamawitgebre-demo'], '+251 93 111 0138',
     '{"headline":"Backend platform engineer", "yearsOfExperience":8, "location":"Remote"}'::jsonb,
     'Selamawit_Gebre_Resume.pdf', 'SCREENED', 0.96, 92.60, 1, NULL, 92.60, 1, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
    (gen_random_uuid(), '${JOB_IDS[1]}'::uuid, NULL, 'yonas.desta@example.com', 'Yonas Desta',
     'I have shipped Java APIs, PostgreSQL schemas, and Dockerized services for logistics and HR teams.',
     ARRAY['https://yonasdesta.example/projects'], '+251 94 111 0161',
     '{"headline":"Backend engineer", "yearsOfExperience":4, "location":"Hawassa, Ethiopia"}'::jsonb,
     'Yonas_Desta_Resume.pdf', 'APPLIED', 0.90, 78.30, 4, NULL, 78.30, 4, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), '${JOB_IDS[2]}'::uuid, NULL, 'ruth.alemayehu@example.com', 'Ruth Alemayehu',
     'I design AI-assisted B2B workflows and have recently focused on trust, explainability, and operational review states.',
     ARRAY['https://ruthalemayehu.example/case-studies'], '+251 95 111 0183',
     '{"headline":"Senior product designer", "yearsOfExperience":7, "location":"Addis Ababa, Ethiopia"}'::jsonb,
     'Ruth_Alemayehu_Portfolio.pdf', 'OA_COMPLETED', 0.98, 90.50, 1, 87.00, 89.33, 1, NOW() - INTERVAL '6 days', NOW() - INTERVAL '1 day'),
    (gen_random_uuid(), '${JOB_IDS[2]}'::uuid, NULL, 'bereket.tesfaye@example.com', 'Bereket Tesfaye',
     'My portfolio includes data-dense admin tools, Figma design systems, and usability testing for AI recommendation flows.',
     ARRAY['https://berekettesfaye.example'], '+251 96 111 0184',
     '{"headline":"Product designer", "yearsOfExperience":5, "location":"Bahir Dar, Ethiopia"}'::jsonb,
     'Bereket_Tesfaye_Portfolio.pdf', 'INTERVIEW_INVITED', 0.94, 84.20, 2, 79.00, 82.47, 2, NOW() - INTERVAL '3 days', NOW() - INTERVAL '12 hours'),
    (gen_random_uuid(), '${JOB_IDS[3]}'::uuid, NULL, 'meron.girma@example.com', 'Meron Girma',
     'I build SQL models and dashboard suites for funnel analytics, operations reporting, and executive talent reviews.',
     ARRAY['https://merongirma.example/analytics'], '+251 97 111 0130',
     '{"headline":"Talent analytics specialist", "yearsOfExperience":5, "location":"Hawassa, Ethiopia"}'::jsonb,
     'Meron_Girma_Resume.pdf', 'SCREENED', 0.97, 91.80, 1, NULL, 91.80, 1, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
    (gen_random_uuid(), '${JOB_IDS[4]}'::uuid, NULL, 'fitsum.haile@example.com', 'Fitsum Haile',
     'I am a frontend engineer focused on accessible interfaces, component quality, and thoughtful product details.',
     ARRAY['https://github.com/fitsumhaile-demo'], '+251 98 111 0152',
     '{"headline":"Frontend engineer", "yearsOfExperience":3, "location":"Mekelle, Ethiopia"}'::jsonb,
     'Fitsum_Haile_Resume.pdf', 'APPLIED', 0.91, 80.10, 3, NULL, 80.10, 3, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
    (gen_random_uuid(), '${JOB_IDS[5]}'::uuid, NULL, 'kalkidan.mekonnen@example.com', 'Kalkidan Mekonnen',
     'I have managed ATS hygiene, interviewer enablement, and pipeline reporting for distributed hiring teams.',
     ARRAY['https://kalkidanmekonnen.example'], '+251 99 111 0133',
     '{"headline":"Recruiting operations lead", "yearsOfExperience":9, "location":"Adama, Ethiopia"}'::jsonb,
     'Kalkidan_Mekonnen_Resume.pdf', 'SCREENED', 0.95, 89.40, 1, NULL, 89.40, 1, NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days');
SQL

  printf '    Added additional sample applicants for recruiter views.\n'
}

main() {
  printf '==> Seeding ATS platform with screenshot-ready data\n'
  printf '    Gateway: %s\n\n' "$GATEWAY_URL"

  wait_for_gateway
  wait_for_admin_login
  create_org
  create_org_admin
  create_recruiter
  wait_for_jobs_service "$RECRUITER_TOKEN"
  create_candidate
  create_jobs
  seed_applications

  printf '\n=== Seed data creation complete ===\n\n'
  printf 'Accounts for screenshots:\n'
  printf '  Recruiter: %s / %s\n' "$RECRUITER_EMAIL" "$RECRUITER_PASSWORD"
  printf '  Candidate: %s / %s\n' "$CANDIDATE_EMAIL" "$CANDIDATE_PASSWORD"
  printf '\nSupporting accounts:\n'
  printf '  Platform Admin: %s / %s\n' "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
  printf '  Org Admin:      %s / %s\n' "$ORG_ADMIN_EMAIL" "$ORG_ADMIN_PASSWORD"
  printf '\nSuggested screenshot pages:\n'
  printf '  Jobs:                 http://localhost:3000/jobs\n'
  printf '  Recruiter dashboard:  http://localhost:3000/dashboard\n'
  printf '  Candidate dashboard:  http://localhost:3000/dashboard\n'
}

main "$@"
