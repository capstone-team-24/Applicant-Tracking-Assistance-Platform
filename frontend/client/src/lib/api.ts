import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";
import type {
  LoginResponse,
  SignupData,
  User,
  Profile,
  Job,
  JobListResponse,
  JobListParams,
  CreateJobData,
  Application,
  ApplicationListResponse,
  ApplicationListParams,
  Assessment,
  AssessmentSubmission,
  CreateAssessmentData,
  AssessmentAnswer,
  RankingStatus,
  SendAssessmentRequest,
  SendAssessmentResponse,
  ReceivedAssessmentInvite,
  InterviewInvite,
  SendInterviewInviteRequest,
  SendInterviewInviteResponse,
  InterviewSlot,
  InterviewBooking,
  CreateInterviewSlotsRequest,
  BookInterviewRequest,
  CandidateBookingResponse,
  InviteTokenResponse,
  AcceptInviteRequest,
  SendOfferRequest,
  DeclineOfferRequest,
  OfferResponse,
  RejectRequest,
  RejectResponse,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get("ats_access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Track if we are currently refreshing to avoid infinite loops
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = Cookies.get("ats_refresh_token");
      if (!refreshToken) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
          refreshToken,
        });
        const { accessToken, refreshToken: newRefreshToken } = response.data;

        Cookies.set("ats_access_token", accessToken, { expires: 1 });
        if (newRefreshToken) {
          Cookies.set("ats_refresh_token", newRefreshToken, { expires: 7 });
        }

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        Cookies.remove("ats_access_token");
        Cookies.remove("ats_refresh_token");
        Cookies.remove("ats_user");
        if (typeof window !== "undefined") {
          const path = window.location.pathname;
          if (path.startsWith("/platform-admin")) {
            window.location.href = "/platform-admin/login";
          } else if (path.startsWith("/org")) {
            window.location.href = "/org/login";
          } else {
            window.location.href = "/login";
          }
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

// ---- Auth API ----
export const authApi = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/api/v1/auth/login", {
      email,
      password,
    });
    return response.data;
  },

  signup: async (
    data: SignupData,
  ): Promise<{ userId: string; message: string }> => {
    const response = await api.post<{ userId: string; message: string }>(
      "/api/v1/auth/signup",
      data,
    );
    return response.data;
  },

  refresh: async (): Promise<{ accessToken: string; refreshToken: string }> => {
    const refreshToken = Cookies.get("ats_refresh_token");
    const response = await api.post("/api/v1/auth/refresh", { refreshToken });
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      const refreshToken = Cookies.get("ats_refresh_token");
      if (refreshToken) {
        await api.post("/api/v1/auth/logout", { refreshToken });
      }
    } finally {
      Cookies.remove("ats_access_token");
      Cookies.remove("ats_refresh_token");
      Cookies.remove("ats_user");
    }
  },
};

// ---- Profiles API ----
export const profilesApi = {
  getMe: async (): Promise<Profile> => {
    const response = await api.get<Profile>("/api/v1/profiles/me");
    return response.data;
  },

  updateProfile: async (data: Partial<Profile>): Promise<Profile> => {
    const response = await api.put<Profile>("/api/v1/profiles/me", data);
    return response.data;
  },

  uploadCv: async (profileId: string, file: File): Promise<Profile> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<Profile>(
      `/api/v1/profiles/${profileId}/upload-cv`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  },
};

// ---- Jobs API ----
export const jobsApi = {
  listJobs: async (params?: JobListParams): Promise<JobListResponse> => {
    const backendParams: Record<string, unknown> = {};
    if (params) {
      if (params.page !== undefined)
        backendParams.page = Math.max(0, (params.page || 1) - 1);
      if (params.pageSize !== undefined) backendParams.size = params.pageSize;
      if (params.status) backendParams.status = params.status;
      if (params.search) backendParams.search = params.search;
      if (params.location) backendParams.location = params.location;
      if (params.employmentType)
        backendParams.employmentType = params.employmentType;
      if (params.experienceLevel)
        backendParams.experienceLevel = params.experienceLevel;
    }
    const response = await api.get<JobListResponse>("/api/v1/jobs", {
      params: backendParams,
    });
    return response.data;
  },

  getJob: async (id: string): Promise<Job> => {
    const response = await api.get<Job>(`/api/v1/jobs/${id}`);
    return response.data;
  },

  createJob: async (data: CreateJobData): Promise<Job> => {
    const response = await api.post<Job>("/api/v1/jobs", data);
    return response.data;
  },

  updateJob: async (id: string, data: Partial<CreateJobData>): Promise<Job> => {
    const response = await api.put<Job>(`/api/v1/jobs/${id}`, data);
    return response.data;
  },

  publishJob: async (id: string): Promise<Job> => {
    const response = await api.post<Job>(`/api/v1/jobs/${id}/publish`);
    return response.data;
  },

  closeJob: async (id: string): Promise<Job> => {
    const response = await api.post<Job>(`/api/v1/jobs/${id}/close`);
    return response.data;
  },
};

// ---- Applications API ----
export const applicationsApi = {
  apply: async (jobId: string, formData: FormData): Promise<Application> => {
    const response = await api.post<Application>(
      `/api/v1/jobs/${jobId}/apply`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return response.data;
  },

  listApplications: async (
    jobId: string,
    params?: ApplicationListParams,
  ): Promise<ApplicationListResponse> => {
    const backendParams: Record<string, unknown> = {};
    if (params) {
      if (params.page !== undefined)
        backendParams.page = Math.max(0, (params.page || 1) - 1);
      if (params.pageSize !== undefined) backendParams.size = params.pageSize;
      if (params.status) backendParams.status = params.status;
      if (params.sortBy) backendParams.sortBy = params.sortBy;
      if (params.sortOrder) backendParams.sortDir = params.sortOrder;
    }
    const response = await api.get<ApplicationListResponse>(
      `/api/v1/jobs/${jobId}/applications`,
      { params: backendParams },
    );
    return response.data;
  },

  getMyApplications: async (
    params?: ApplicationListParams,
  ): Promise<ApplicationListResponse> => {
    const backendParams: Record<string, unknown> = {};
    if (params) {
      if (params.page !== undefined)
        backendParams.page = Math.max(0, (params.page || 1) - 1);
      if (params.pageSize !== undefined) backendParams.size = params.pageSize;
      if (params.sortBy) backendParams.sortBy = params.sortBy;
      if (params.sortOrder) backendParams.sortDir = params.sortOrder;
    }
    const response = await api.get<ApplicationListResponse>(
      `/api/v1/applications/me`,
      { params: backendParams },
    );
    return response.data;
  },

  getApplication: async (id: string): Promise<Application> => {
    const response = await api.get<Application>(`/api/v1/applications/${id}`);
    return response.data;
  },

  /** Recruiter: update an application's status (whitelist, waitlist, shortlist, etc.) */
  updateStatus: async (id: string, status: string): Promise<Application> => {
    const response = await api.put<Application>(
      `/api/v1/applications/${id}/status`,
      { status },
    );
    return response.data;
  },

  downloadFile: async (id: string): Promise<Blob> => {
    const response = await api.get(`/api/v1/applications/${id}/file`, {
      responseType: "blob",
    });
    return response.data;
  },

  /**
   * Recruiter: manually send an OA invite to a single candidate,
   * bypassing AI ranking. Requires an assessment to exist on the job.
   */
  sendOA: async (
    appId: string,
    data: SendAssessmentRequest,
  ): Promise<SendAssessmentResponse> => {
    const response = await api.post<SendAssessmentResponse>(
      `/api/v1/applications/${appId}/send-oa`,
      data,
    );
    return response.data;
  },

  /**
   * Recruiter: manually send an interview invite to a single candidate,
   * bypassing OA score filter and topN cap.
   */
  sendInterviewInvite: async (
    appId: string,
    data?: { expiresAt?: string },
  ): Promise<SendInterviewInviteResponse> => {
    const response = await api.post<SendInterviewInviteResponse>(
      `/api/v1/applications/${appId}/send-interview-invite`,
      data ?? {},
    );
    return response.data;
  },

  /** Bulk waitlist applications */
  waitlist: async (jobId: string, applicationIds: string[]): Promise<void> => {
    await api.post(`/api/v1/jobs/${jobId}/applications/waitlist`, applicationIds);
  },

  /** Recalculate final ranking */
  recalculateRanking: async (jobId: string): Promise<void> => {
    await api.post(`/api/v1/jobs/${jobId}/applications/recalculate-ranking`);
  },

  /** Recruiter: reject a single application and send a rejection email */
  rejectApplication: async (
    appId: string,
    data?: RejectRequest,
  ): Promise<Application> => {
    const response = await api.post<Application>(
      `/api/v1/applications/${appId}/reject`,
      data ?? {},
    );
    return response.data;
  },

  /** Recruiter: bulk-reject selected applications and send rejection emails */
  bulkReject: async (
    jobId: string,
    data: RejectRequest,
  ): Promise<RejectResponse> => {
    const response = await api.post<RejectResponse>(
      `/api/v1/jobs/${jobId}/applications/bulk-reject`,
      data,
    );
    return response.data;
  },
};

// ---- Ranking API ----
export const rankingApi = {
  triggerRanking: async (jobId: string): Promise<{ rankingJobId: string }> => {
    const response = await api.post<{ id: string }>(
      `/api/v1/jobs/${jobId}/rank`,
    );
    return { rankingJobId: response.data.id };
  },

  getRankingStatus: async (rankingJobId: string): Promise<RankingStatus> => {
    const response = await api.get<RankingStatus>(
      `/api/v1/jobs/ranking/${rankingJobId}`,
    );
    return response.data;
  },

  sendAssessmentInvites: async (
    jobId: string,
    data: SendAssessmentRequest,
  ): Promise<SendAssessmentResponse> => {
    const response = await api.post<SendAssessmentResponse>(
      `/api/v1/jobs/${jobId}/send-assessment`,
      data,
    );
    return response.data;
  },

  sendInterviewInvites: async (
    jobId: string,
    data: SendInterviewInviteRequest,
  ): Promise<SendInterviewInviteResponse> => {
    const response = await api.post<SendInterviewInviteResponse>(
      `/api/v1/jobs/${jobId}/send-interview-invites`,
      data,
    );
    return response.data;
  },

  rejectUninvited: async (jobId: string) => {
    const res = await api.post(`/api/v1/jobs/${jobId}/reject-uninvited`);
    return res.data;
  },

  rejectUninvitedInterview: async (jobId: string) => {
    const res = await api.post(`/api/v1/jobs/${jobId}/reject-uninvited-interview`);
    return res.data;
  },

  updateAssessmentDeadline: async (jobId: string, newDeadline: string): Promise<void> => {
    await api.put(`/api/v1/jobs/${jobId}/assessment-deadline`, { newDeadline });
  },

  updateInterviewDeadline: async (jobId: string, newDeadline: string): Promise<void> => {
    await api.put(`/api/v1/jobs/${jobId}/interview-deadline`, { newDeadline });
  },
};

// ---- Assessments API ----
export const assessmentsApi = {
  createAssessment: async (data: CreateAssessmentData): Promise<Assessment> => {
    const response = await api.post<Assessment>("/api/v1/assessments", data);
    return response.data;
  },

  updateAssessment: async (
    id: string,
    data: Partial<CreateAssessmentData>,
  ): Promise<Assessment> => {
    const response = await api.put<Assessment>(
      `/api/v1/assessments/${id}`,
      data,
    );
    return response.data;
  },

  deleteAssessment: async (id: string): Promise<void> => {
    await api.delete(`/api/v1/assessments/${id}`);
  },

  generateAssessment: async (jobId: string): Promise<{ questions: any[] }> => {
    const response = await api.post<{ questions: any[] }>(
      "/api/v1/assessments/generate",
      { jobId },
    );
    return response.data;
  },

  /** Fetch all assessments linked to a job (recruiter use). */
  getAssessmentsByJob: async (jobId: string): Promise<Assessment[]> => {
    const response = await api.get<Assessment[]>(
      `/api/v1/assessments/by-job/${jobId}`,
    );
    return response.data;
  },

  getAssessment: async (
    token: string,
    candidateId?: string,
  ): Promise<Assessment> => {
    const params: Record<string, string> = {};
    if (candidateId) params.candidateId = candidateId;
    const response = await api.get<Assessment>(`/api/v1/assessments/${token}`, {
      params,
    });
    return response.data;
  },

  saveAnswers: async (
    assessmentId: string,
    candidateId: string,
    answers: AssessmentAnswer[],
  ): Promise<AssessmentSubmission> => {
    const response = await api.post<AssessmentSubmission>(
      `/api/v1/assessments/${assessmentId}/save`,
      { answers },
      { params: { candidateId } },
    );
    return response.data;
  },

  submitAssessment: async (
    assessmentId: string,
    candidateId: string,
    answers: AssessmentAnswer[],
  ): Promise<AssessmentSubmission> => {
    const response = await api.post<AssessmentSubmission>(
      `/api/v1/assessments/${assessmentId}/submit`,
      { answers },
      { params: { candidateId } },
    );
    return response.data;
  },

  getSubmissions: async (
    assessmentId: string,
  ): Promise<AssessmentSubmission[]> => {
    const response = await api.get<AssessmentSubmission[]>(
      `/api/v1/assessments/${assessmentId}/submissions`,
    );
    return response.data;
  },

  /** Candidate: list OA invites sent to the logged-in user. */
  getReceivedInvites: async (): Promise<ReceivedAssessmentInvite[]> => {
    const response = await api.get<ReceivedAssessmentInvite[]>(
      "/api/v1/applications/me/assessment-invites",
    );
    return response.data;
  },

  /** Candidate: list interview invites sent to the logged-in user. */
  getReceivedInterviewInvites: async (): Promise<InterviewInvite[]> => {
    const response = await api.get<InterviewInvite[]>(
      "/api/v1/applications/me/interview-invites",
    );
    return response.data;
  },
};

// ---- Interviews API ----
export const interviewsApi = {
  createSlots: async (jobId: string, data: CreateInterviewSlotsRequest): Promise<InterviewSlot[]> => {
    const response = await api.post<InterviewSlot[]>(`/api/v1/jobs/${jobId}/slots`, data);
    return response.data;
  },

  getJobSlots: async (jobId: string): Promise<InterviewSlot[]> => {
    const response = await api.get<InterviewSlot[]>(`/api/v1/jobs/${jobId}/slots`);
    return response.data;
  },

  getJobBookings: async (jobId: string): Promise<InterviewBooking[]> => {
    const response = await api.get<InterviewBooking[]>(`/api/v1/jobs/${jobId}/bookings`);
    return response.data;
  },

  getAvailableSlots: async (jobId: string): Promise<InterviewSlot[]> => {
    const response = await api.get<InterviewSlot[]>(`/api/v1/interviews/available-slots/${jobId}`);
    return response.data;
  },

  getMyBookings: async (): Promise<CandidateBookingResponse[]> => {
    const response = await api.get<CandidateBookingResponse[]>(`/api/v1/interviews/me/bookings`);
    return response.data;
  },

  bookInterview: async (jobId: string, data: BookInterviewRequest): Promise<InterviewBooking> => {
    const response = await api.post<InterviewBooking>(`/api/v1/interviews/book`, data, { params: { jobId } });
    return response.data;
  },

  completeBooking: async (
    jobId: string,
    bookingId: string,
    data: {
      rating: number;
      feedback: string;
      technical?: number;
      problemSolving?: number;
      communication?: number;
      behavioral?: number;
      cultureFit?: number;
      recruiterSummary?: string;
      strengths?: string;
      weaknesses?: string;
      hireRecommendation?: string;
    },
  ): Promise<InterviewBooking> => {
    const response = await api.put<InterviewBooking>(`/api/v1/jobs/${jobId}/bookings/${bookingId}/complete`, data);
    return response.data;
  },
};

// ---- Integrations API ----
export const integrationsApi = {
  getGoogleAuthUrl: async (): Promise<{ url: string }> => {
    const response = await api.get<{ url: string }>("/api/v1/integrations/google/auth-url");
    return response.data;
  },

  handleGoogleCallback: async (code: string): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>("/api/v1/integrations/google/callback", { code });
    return response.data;
  },

  getGoogleIntegrationStatus: async (): Promise<{ connected: boolean }> => {
    const response = await api.get<{ connected: boolean }>("/api/v1/integrations/google/status");
    return response.data;
  },
};

// ---- Invite API (public – no auth token required) ----
export const inviteApi = {
  validateInvite: async (token: string): Promise<InviteTokenResponse> => {
    const response = await api.get<InviteTokenResponse>("/api/v1/auth/invite/validate", {
      params: { token },
    });
    return response.data;
  },

  acceptInvite: async (data: AcceptInviteRequest): Promise<{ userId: string; message: string }> => {
    const response = await api.post<{ userId: string; message: string }>(
      "/api/v1/auth/invite/accept",
      data,
    );
    return response.data;
  },
};

// ---- Platform Admin API ----
export const platformAdminApi = {
  submitContactMessage: async (data: { name: string; email: string; message: string }): Promise<import("./types").ContactMessage> => {
    const response = await api.post<import("./types").ContactMessage>("/api/v1/contact-messages", data);
    return response.data;
  },
  
  getContactMessages: async (params?: { page?: number; size?: number }): Promise<{ content: import("./types").ContactMessage[]; totalElements: number; totalPages: number }> => {
    const response = await api.get("/api/v1/contact-messages", { params });
    return response.data;
  },

  approveContactMessage: async (id: string): Promise<import("./types").Organization> => {
    const response = await api.post<import("./types").Organization>(`/api/v1/contact-messages/${id}/approve`);
    return response.data;
  },
  
  getOrganizations: async (params?: { page?: number; size?: number }): Promise<{ content: import("./types").Organization[]; totalElements: number; totalPages: number }> => {
    const response = await api.get("/api/v1/organizations", { params });
    return response.data;
  },
  
  createOrganization: async (data: import("./types").CreateOrganizationRequest): Promise<import("./types").Organization> => {
    const response = await api.post<import("./types").Organization>("/api/v1/organizations", data);
    return response.data;
  },
  
  updateOrganization: async (id: string, data: import("./types").CreateOrganizationRequest): Promise<import("./types").Organization> => {
    const response = await api.put<import("./types").Organization>(`/api/v1/organizations/${id}`, data);
    return response.data;
  },
  
  toggleSuspension: async (id: string, suspend: boolean): Promise<import("./types").Organization> => {
    const response = await api.put<import("./types").Organization>(`/api/v1/organizations/${id}/suspend`, null, { params: { suspend } });
    return response.data;
  },

  /** Invite an org admin – sends email with setup link, does NOT create account yet */
  inviteOrgAdmin: async (data: { email: string; orgId: string }): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>("/api/v1/auth/invite/org-admin", {
      email: data.email,
      orgId: data.orgId,
    });
    return response.data;
  },
};

// ---- Org Admin API (Organization-level admin) ----
export const orgAdminApi = {
  getRecruiters: async (): Promise<import("./types").RecruiterUser[]> => {
    const response = await api.get<import("./types").RecruiterUser[]>("/api/v1/auth/org/recruiters");
    return response.data;
  },

  /** Invite a recruiter – sends email with setup link, does NOT create account yet */
  inviteRecruiter: async (data: { email: string; firstName: string; lastName: string }): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>("/api/v1/auth/invite/recruiter", data);
    return response.data;
  },

  /** @deprecated Use inviteRecruiter instead */
  createRecruiter: async (data: { email: string; firstName: string; lastName: string }): Promise<{ userId: string; message: string }> => {
    const response = await api.post<{ userId: string; message: string }>("/api/v1/auth/org/recruiters", data);
    return response.data;
  },

  suspendRecruiter: async (id: string, suspend: boolean): Promise<{ message: string }> => {
    const response = await api.put<{ message: string }>(`/api/v1/auth/org/recruiters/${id}/suspend`, null, { params: { suspend } });
    return response.data;
  },

  getOrgJobs: async (orgId: string, params?: { page?: number; size?: number }): Promise<import("./types").JobListResponse> => {
    const response = await api.get<import("./types").JobListResponse>("/api/v1/jobs", { params: { orgId, ...params } });
    return response.data;
  },

  reassignJob: async (jobId: string, assignedTo: string | null): Promise<import("./types").Job> => {
    const response = await api.put<import("./types").Job>(`/api/v1/jobs/${jobId}/reassign`, { assignedTo: assignedTo ?? "" });
    return response.data;
  },
};

// ---- Offers API ----
export const offersApi = {
  sendOffer: async (
    jobId: string,
    appId: string,
    data: SendOfferRequest,
  ): Promise<OfferResponse> => {
    const response = await api.post<OfferResponse>(
      `/api/v1/jobs/${jobId}/applications/${appId}/offer`,
      data,
    );
    return response.data;
  },

  getOffer: async (token: string): Promise<OfferResponse> => {
    const response = await api.get<OfferResponse>(`/api/v1/offers/${token}`);
    return response.data;
  },

  acceptOffer: async (token: string): Promise<void> => {
    await api.post(`/api/v1/offers/${token}/accept`);
  },

  declineOffer: async (token: string, data?: DeclineOfferRequest): Promise<void> => {
    await api.post(`/api/v1/offers/${token}/decline`, data || {});
  },
};

export default api;
