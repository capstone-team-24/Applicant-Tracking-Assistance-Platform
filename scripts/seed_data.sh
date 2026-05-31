#!/usr/bin/env bash
set -euo pipefail

# Seed script: creates initial data via API calls through the gateway
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"

echo "==> Seeding ATS platform with sample data..."
echo "    Gateway: $GATEWAY_URL"
echo ""

# Wait for gateway to be available
echo "==> Waiting for API Gateway..."
for i in $(seq 1 30); do
  if curl -sf "$GATEWAY_URL/actuator/health" > /dev/null 2>&1; then
    echo "    Gateway is ready."
    break
  fi
  echo "    Waiting... ($i/30)"
  sleep 5
done

# 0. Setup Platform Admin, Organization, and Org Admin
echo ""
echo "==> Creating Platform Admin..."
curl -sf -X POST "$GATEWAY_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "System",
    "lastName": "Admin",
    "email": "admin@ats.platform",
    "password": "Password123!",
    "role": "ADMIN"
  }' > /dev/null 2>&1 || echo "Platform admin already exists"

echo "==> Logging in as Platform Admin..."
ADMIN_LOGIN=$(curl -sf -X POST "$GATEWAY_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ats.platform",
    "password": "Password123!"
  }' 2>&1) || { echo "Admin login failed"; exit 1; }

ADMIN_TOKEN=$(echo "$ADMIN_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null || echo "")

echo "==> Creating Organization..."
ORG_RESP=$(curl -sf -X POST "$GATEWAY_URL/organizations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Acme Corp",
    "organizationPolicies": "Default Policies"
  }' 2>&1) || echo "Organization creation failed"

ORG_ID=$(echo "$ORG_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -z "$ORG_ID" ]; then
  echo "Failed to create or extract Organization ID. Cannot proceed to create Org Admin."
  exit 1
fi
echo "    Organization ID: $ORG_ID"

echo "==> Creating Organization Admin..."
curl -sf -X POST "$GATEWAY_URL/auth/org-admin" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"orgadmin@acmecorp.com\",
    \"orgId\": \"$ORG_ID\"
  }" > /dev/null 2>&1 || echo "Org Admin creation failed"

# 1. Create a recruiter account
echo ""
echo "==> Creating recruiter account..."
SIGNUP_RESP=$(curl -sf -X POST "$GATEWAY_URL/auth/org/recruiters" \
  -H "Content-Type: application/json" \
  -H "X-Org-Id: $ORG_ID" \
  -d '{
    "firstName": "Alice",
    "lastName": "Recruiter",
    "email": "alice@example.com"
  }' 2>&1) || echo "Signup may have failed (possibly already exists): $SIGNUP_RESP"
echo "    Recruiter signup response: $SIGNUP_RESP"

# 2. Login as recruiter
echo ""
echo "==> Logging in as recruiter..."
LOGIN_RESP=$(curl -sf -X POST "$GATEWAY_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "recruiter123"
  }' 2>&1) || { echo "Login failed"; exit 1; }

ACCESS_TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null || echo "")
if [ -z "$ACCESS_TOKEN" ]; then
  echo "    Could not extract token. Response: $LOGIN_RESP"
  echo "    Continuing without token..."
else
  echo "    Got access token: ${ACCESS_TOKEN:0:20}..."
fi

# 3. Create a job posting
echo ""
echo "==> Creating sample job posting..."
JOB_RESP=$(curl -sf -X POST "$GATEWAY_URL/api/v1/jobs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "title": "Senior Backend Engineer",
    "description": "We are looking for a Senior Backend Engineer to join our platform team.",
    "requirements": "5+ years backend experience, Java/Spring Boot proficiency",
    "location": "San Francisco, CA (Hybrid)",
    "employmentType": "FULL_TIME",
    "experienceLevel": "SENIOR",
    "skills": ["Java", "Spring Boot", "PostgreSQL", "Docker", "Kubernetes"]
  }' 2>&1) || echo "Job creation may have failed: $JOB_RESP"
echo "    Job response: $JOB_RESP"

JOB_ID=$(echo "$JOB_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

# 4. Publish the job
if [ -n "$JOB_ID" ]; then
  echo ""
  echo "==> Publishing job $JOB_ID..."
  curl -sf -X POST "$GATEWAY_URL/api/v1/jobs/$JOB_ID/publish" \
    -H "Authorization: Bearer $ACCESS_TOKEN" || echo "Publish may have failed"
fi

# 5. Create a candidate account
echo ""
echo "==> Creating candidate account..."
CAND_RESP=$(curl -sf -X POST "$GATEWAY_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "email": "john@example.com",
    "password": "Password123!",
    "role": "CANDIDATE"
  }' 2>&1) || echo "Candidate signup may have failed: $CAND_RESP"
echo "    Candidate signup response: $CAND_RESP"

# 6. Login as candidate
echo ""
echo "==> Logging in as candidate..."
CAND_LOGIN=$(curl -sf -X POST "$GATEWAY_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Password123!"
  }' 2>&1) || echo "Candidate login failed"

CAND_TOKEN=$(echo "$CAND_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null || echo "")

# 7. Apply to the job
if [ -n "$JOB_ID" ] && [ -n "$CAND_TOKEN" ]; then
  echo ""
  echo "==> Applying to job as candidate..."
  curl -sf -X POST "$GATEWAY_URL/api/v1/jobs/$JOB_ID/apply" \
    -H "Authorization: Bearer $CAND_TOKEN" \
    -F "request={\"coverLetter\":\"I am excited to apply for this position.\",\"useProfileData\":true};type=application/json" \
    -F "file=@$(dirname "$0")/../data/samples/sample_cv_1.txt" || echo "Apply may have failed"
fi

echo ""
echo "=== Seed data creation complete ==="
echo ""
echo "Accounts created:"
echo "  Platform Admin: admin@ats.platform / Password123!"
echo "  Org Admin:      orgadmin@acmecorp.com / admin123"
echo "  Recruiter:      alice@example.com / recruiter123"
echo "  Candidate:      john@example.com / Password123!"
echo ""
echo "You can now:"
echo "  - Browse jobs: curl $GATEWAY_URL/api/v1/jobs"
echo "  - Login:       curl -X POST $GATEWAY_URL/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"alice@example.com\",\"password\":\"recruiter123\"}'"
echo "  - Open frontend: http://localhost:3000"
