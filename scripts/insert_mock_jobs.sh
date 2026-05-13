#!/usr/bin/env bash
set -euo pipefail

echo "==> Inserting mock jobs directly into the database..."

# Assuming Postgres is running in docker-compose as "postgres"
DB_CONTAINER=$(docker-compose ps -q postgres 2>/dev/null || docker ps -qf "name=postgres")

if [ -z "$DB_CONTAINER" ]; then
    echo "Could not find a running Postgres container. Make sure your docker-compose is up."
    # Fallback to local psql if container is not found directly
    export PGPASSWORD=ats_secret_2024
    PSQL_CMD="psql -h localhost -p 5432 -U ats_admin -d ats_jobs"
else
    PSQL_CMD="docker exec -i $DB_CONTAINER psql -U ats_admin -d ats_jobs"
fi

# We use random UUIDs for org_id and created_by since the frontend just needs some data to display
ORG_ID=$(uuidgen || python3 -c 'import uuid; print(uuid.uuid4())')
USER_ID=$(uuidgen || python3 -c 'import uuid; print(uuid.uuid4())')
JOB_ID_1=$(uuidgen || python3 -c 'import uuid; print(uuid.uuid4())')
JOB_ID_2=$(uuidgen || python3 -c 'import uuid; print(uuid.uuid4())')

$PSQL_CMD <<EOF
INSERT INTO jobs (
    id, org_id, title, description, requirements, location, 
    employment_type, experience_level, skills, status, 
    created_by, assigned_to, created_at, updated_at, published_at
) VALUES (
    '$JOB_ID_1',
    '$ORG_ID',
    'Senior Frontend Developer',
    'We are looking for a Senior Frontend Developer with deep React and Next.js knowledge.',
    '5+ years experience in React, TypeScript, Next.js, and TailwindCSS.',
    'Remote',
    'FULL_TIME',
    'SENIOR',
    '{"React", "TypeScript", "Next.js"}',
    'PUBLISHED',
    '$USER_ID',
    '$USER_ID',
    NOW(),
    NOW(),
    NOW()
),
(
    '$JOB_ID_2',
    '$ORG_ID',
    'Backend Systems Engineer',
    'Join our core team to build highly scalable microservices in Java and Spring Boot.',
    '4+ years working with Java, Spring Boot, Postgres, and Kafka.',
    'New York, NY (Hybrid)',
    'FULL_TIME',
    'MID_LEVEL',
    '{"Java", "Spring Boot", "PostgreSQL", "Docker"}',
    'PUBLISHED',
    '$USER_ID',
    '$USER_ID',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;
EOF

echo "==> Mock jobs inserted successfully."
