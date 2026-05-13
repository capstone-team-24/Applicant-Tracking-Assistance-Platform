# ATS Frontend

Next.js + TypeScript frontend for the ATS (Applicant Tracking System) platform.

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:8080` |

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Available Pages

### Public Pages
- `/` - Landing page with hero section and feature overview
- `/jobs` - Public job listings with search and filter
- `/jobs/[id]` - Job detail page
- `/login` - Login form
- `/signup` - Registration form

### Candidate Pages (authenticated)
- `/dashboard` - Candidate dashboard with applications list and profile summary
- `/jobs/[id]/apply` - Job application form with file upload

### Recruiter Pages (authenticated)
- `/dashboard` - Recruiter dashboard with job listings and application counts
- `/recruiter/jobs/new` - Create a new job posting
- `/recruiter/jobs/[id]` - Manage job posting, view applications, trigger ranking
- `/recruiter/jobs/[id]/applications/[appId]` - View application details

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State Management:** TanStack React Query
- **HTTP Client:** Axios
- **Notifications:** react-hot-toast
- **Auth:** Cookie-based JWT tokens

## Docker

```bash
# Build image
docker build -t ats-frontend .

# Run container
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://api:8080 ats-frontend
```

## Project Structure

```
src/
  app/           # Next.js App Router pages
  components/    # Reusable UI components
  lib/           # Utilities, API client, types
  public/        # Static assets
```
