import json

from .helpers import (
    assert_page_contains_id,
    assert_uuid,
    auth_headers,
    extract_invite_token,
    login_user,
    mailhog_message_text,
    signup_user,
    unique_email,
    unique_suffix,
    wait_for_mailhog_message,
    wait_for_profile,
)


PASSWORD = "Password123!"


def test_public_api_health_auth_and_contact_message_flow(api):
    suffix = unique_suffix()
    candidate_email = unique_email("candidate-api", suffix)

    jwks = api.request_json("GET", "/.well-known/jwks.json", expected_status=200)
    assert isinstance(jwks.get("keys"), list)
    assert jwks["keys"], "JWKS should expose at least one signing key"

    signup_user(
        api,
        email=candidate_email,
        password=PASSWORD,
        role="CANDIDATE",
        first_name="Integration",
        last_name="Candidate",
    )
    login = login_user(api, email=candidate_email, password=PASSWORD, expected_role="CANDIDATE")
    profile = wait_for_profile(
        api,
        access_token=login["accessToken"],
        auth_user_id=login["userId"],
        email=candidate_email,
    )

    assert profile["firstName"] == "Integration"
    assert profile["lastName"] == "Candidate"
    assert profile["role"] == "CANDIDATE"

    updated_profile = api.request_json(
        "PUT",
        "/api/v1/profiles/me",
        expected_status=200,
        headers=auth_headers(login["accessToken"]),
        json={
            "phone": "+1-555-0101",
            "headline": "Backend integration test candidate",
            "location": "Remote",
            "yearsOfExperience": 4,
        },
    )
    assert updated_profile["phone"] == "+1-555-0101"
    assert updated_profile["headline"] == "Backend integration test candidate"
    assert updated_profile["yearsOfExperience"] == 4

    refreshed = api.request_json(
        "POST",
        "/auth/refresh",
        expected_status=200,
        json={"refreshToken": login["refreshToken"]},
    )
    assert refreshed.get("accessToken")
    assert refreshed.get("refreshToken")

    api.request_json(
        "POST",
        "/auth/logout",
        expected_status=200,
        json={"refreshToken": refreshed["refreshToken"]},
    )
    revoked_refresh = api.request(
        "POST",
        "/auth/refresh",
        expected_status=None,
        json={"refreshToken": refreshed["refreshToken"]},
    )
    assert revoked_refresh.status_code in {400, 401, 403}

    contact = api.request_json(
        "POST",
        "/api/v1/contact-messages",
        expected_status=201,
        json={
            "name": f"Integration Org {suffix}",
            "email": unique_email("contact", suffix),
            "message": "Please onboard this organization for integration testing.",
            "hrAdminName": "Test HR Admin",
            "companyDetails": "Created by pytest API integration tests.",
        },
    )
    assert_uuid(contact.get("id"))
    assert contact["status"] == "PENDING_APPROVAL"
    assert contact["message"] == "Please onboard this organization for integration testing."


def test_end_to_end_hiring_flow_through_gateway_kafka_and_mailhog(api, mailhog_base_url):
    suffix = unique_suffix()
    admin_email = unique_email("admin-api", suffix)
    org_admin_email = unique_email("org-admin-api", suffix)
    recruiter_email = unique_email("recruiter-api", suffix)
    candidate_email = unique_email("applicant-api", suffix)

    signup_user(
        api,
        email=admin_email,
        password=PASSWORD,
        role="ADMIN",
        first_name="Platform",
        last_name="Admin",
    )
    admin_login = login_user(api, email=admin_email, password=PASSWORD, expected_role="ADMIN")

    organization = api.request_json(
        "POST",
        "/api/v1/organizations",
        expected_status=201,
        headers=auth_headers(admin_login["accessToken"]),
        json={"name": f"Integration Test Org {suffix}"},
    )
    org_id = assert_uuid(organization.get("id"))
    assert organization["name"] == f"Integration Test Org {suffix}"

    org_admin_invite = api.request_json(
        "POST",
        "/auth/internal/invite-org-admin-token",
        expected_status=201,
        json={"email": org_admin_email, "orgId": org_id},
    )
    org_admin_token = assert_uuid(org_admin_invite.get("token"))

    validated_org_admin_invite = api.request_json(
        "GET",
        "/auth/invite/validate",
        expected_status=200,
        params={"token": org_admin_token},
    )
    assert validated_org_admin_invite["email"] == org_admin_email
    assert validated_org_admin_invite["role"] == "ORG_ADMIN"
    assert validated_org_admin_invite["orgId"] == org_id

    org_admin_accept = api.request_json(
        "POST",
        "/auth/invite/accept",
        expected_status=201,
        json={
            "token": org_admin_token,
            "firstName": "Org",
            "lastName": "Admin",
            "password": PASSWORD,
        },
    )
    assert_uuid(org_admin_accept.get("userId"))
    org_admin_login = login_user(api, email=org_admin_email, password=PASSWORD, expected_role="ORG_ADMIN")
    assert org_admin_login["orgId"] == org_id

    recruiter_invite = api.request_json(
        "POST",
        "/api/v1/auth/invite/recruiter",
        expected_status=201,
        headers=auth_headers(org_admin_login["accessToken"]),
        json={
            "email": recruiter_email,
            "firstName": "Integration",
            "lastName": "Recruiter",
        },
    )
    assert recruiter_email in recruiter_invite["message"]

    recruiter_invite_email = wait_for_mailhog_message(
        mailhog_base_url,
        recipient_email=recruiter_email,
    )
    recruiter_invite_token = extract_invite_token(recruiter_invite_email)

    validated_recruiter_invite = api.request_json(
        "GET",
        "/auth/invite/validate",
        expected_status=200,
        params={"token": recruiter_invite_token},
    )
    assert validated_recruiter_invite["email"] == recruiter_email
    assert validated_recruiter_invite["role"] == "RECRUITER"
    assert validated_recruiter_invite["orgId"] == org_id

    api.request_json(
        "POST",
        "/auth/invite/accept",
        expected_status=201,
        json={
            "token": recruiter_invite_token,
            "firstName": "Integration",
            "lastName": "Recruiter",
            "password": PASSWORD,
        },
    )
    recruiter_login = login_user(api, email=recruiter_email, password=PASSWORD, expected_role="RECRUITER")
    recruiter_id = assert_uuid(recruiter_login["userId"])
    assert recruiter_login["orgId"] == org_id

    created_job = api.request_json(
        "POST",
        "/api/v1/jobs",
        expected_status=201,
        headers=auth_headers(recruiter_login["accessToken"]),
        json={
            "title": f"Integration QA Engineer {suffix}",
            "description": "Own API integration quality for a distributed ATS platform.",
            "requirements": "Python, API testing, Kafka, Spring Boot, and clear communication.",
            "location": "Remote",
            "employmentType": "FULL_TIME",
            "experienceLevel": "MID",
            "skills": ["Python", "Pytest", "API Testing", "Kafka"],
        },
    )
    job_id = assert_uuid(created_job.get("id"))
    assert created_job["status"] == "DRAFT"
    assert created_job["orgId"] == org_id
    assert created_job["createdBy"] == recruiter_id
    assert recruiter_id in created_job["assignedRecruiterIds"]

    published_job = api.request_json(
        "POST",
        f"/api/v1/jobs/{job_id}/publish",
        expected_status=200,
        headers=auth_headers(recruiter_login["accessToken"]),
    )
    assert published_job["status"] == "PUBLISHED"
    assert published_job["publishedAt"]

    public_jobs = api.request_json(
        "GET",
        "/api/v1/jobs",
        expected_status=200,
        params={"search": created_job["title"]},
    )
    assert_page_contains_id(public_jobs, job_id)

    signup_user(
        api,
        email=candidate_email,
        password=PASSWORD,
        role="CANDIDATE",
        first_name="Application",
        last_name="Candidate",
    )
    candidate_login = login_user(api, email=candidate_email, password=PASSWORD, expected_role="CANDIDATE")
    candidate_id = assert_uuid(candidate_login["userId"])
    wait_for_profile(
        api,
        access_token=candidate_login["accessToken"],
        auth_user_id=candidate_id,
        email=candidate_email,
    )

    apply_payload = {
        "coverLetter": "I have tested Spring Boot, Kafka, and API gateway flows end to end.",
        "portfolioLinks": ["https://example.com/integration-tests"],
        "contactPhone": "+1-555-0199",
        "useProfileData": True,
    }
    application = api.request_json(
        "POST",
        f"/api/v1/jobs/{job_id}/apply",
        expected_status=201,
        headers=auth_headers(candidate_login["accessToken"]),
        files={
            "request": (None, json.dumps(apply_payload), "application/json"),
            "file": ("resume.txt", b"Integration test resume for ATS API workflow.\n", "text/plain"),
        },
    )
    application_id = assert_uuid(application.get("id"))
    assert application["jobId"] == job_id
    assert application["status"] == "APPLIED"
    assert application["candidateEmail"] == candidate_email
    assert application["candidateName"] == "Application Candidate"

    candidate_applications = api.request_json(
        "GET",
        "/api/v1/applications/me",
        expected_status=200,
        headers=auth_headers(candidate_login["accessToken"]),
    )
    assert_page_contains_id(candidate_applications, application_id)

    recruiter_applications = api.request_json(
        "GET",
        f"/api/v1/jobs/{job_id}/applications",
        expected_status=200,
        headers=auth_headers(recruiter_login["accessToken"]),
    )
    assert_page_contains_id(recruiter_applications, application_id)

    application_received_email = wait_for_mailhog_message(
        mailhog_base_url,
        recipient_email=candidate_email,
        subject_contains="Application Received",
    )
    assert application_id in mailhog_message_text(application_received_email)
