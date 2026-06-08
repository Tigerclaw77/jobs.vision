import axios from "axios";

function apiBaseUrl() {
  const raw = (process.env.REACT_APP_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  return raw.endsWith("/api") ? raw : `${raw}/api`;
}

// ✅ Base Axios instance (adjust baseURL as needed)
const axiosInstance = axios.create({
  baseURL: apiBaseUrl(),
});

// ✅ Attach token to every request (if applicable)
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// =============================
// ✅ AUTH
// =============================
export const loginUser = async (email, password) => {
  const { data } = await axiosInstance.post("/auth/login", { email, password });
  return data;
};

export const registerUser = async (userData) => {
  const { data } = await axiosInstance.post("/register", userData);
  return data;
};

export const resetPasswordRequest = async (email) => {
  const { data } = await axiosInstance.post("/auth/forgot-password", { email });
  return data;
};

export const resetPassword = async (token, newPassword) => {
  const { data } = await axiosInstance.post("/auth/reset-password", { token, newPassword });
  return data;
};

export const verifyEmail = async (token) => {
  const { data } = await axiosInstance.get(`/auth/verify-email?token=${token}`);
  return data;
};

// =============================
// ✅ JOBS (Candidate jobs now handled in Supabase)
// =============================
// Leave jobs-related functions here commented out or deleted.

// =============================
// ✅ USER INTERACTIONS (non-Supabase ones)
// =============================
export const getHiddenJobs = async () => {
  const { data } = await axiosInstance.get("/users/hidden");
  return data;
};

export const hideJob = async (jobId) => {
  const { data } = await axiosInstance.post(`/users/hide/${jobId}`);
  return data;
};

export const unhideJob = async (jobId) => {
  const { data } = await axiosInstance.delete(`/users/hide/${jobId}`);
  return data;
};

export const updateUserProfile = async (profileUpdates) => {
  const { data } = await axiosInstance.put("/profile", profileUpdates);
  return data;
};

export const fetchUserProfile = async () => {
  const { data } = await axiosInstance.get("/profile");
  return data;
};

// =============================
// ✅ NOTIFICATIONS
// =============================
export const fetchNotifications = async () => {
  const { data } = await axiosInstance.get("/notifications");
  return data.notifications || data;
};

// =============================
// ✅ ADMIN
// =============================
export const fetchAdminDashboard = async () => {
  const { data } = await axiosInstance.get("/admin/dashboard");
  return data;
};

export const fetchManualOverrides = async (status = "pending") => {
  const { data } = await axiosInstance.get("/manual-overrides", { params: { status } });
  return data?.items || [];
};

export const decideManualOverride = async (id, decision) => {
  const { data } = await axiosInstance.post(`/manual-overrides/${id}/decision`, { decision });
  return data;
};

export const fetchJobImports = async (params = {}) => {
  const { data } = await axiosInstance.get("/admin/job-imports", { params });
  return data?.items || [];
};

export const runJobDiscovery = async (sources) => {
  const { data } = await axiosInstance.post("/admin/job-imports/discover", {
    sources: Array.isArray(sources) ? sources : [sources],
  });
  return data;
};

export const updateJobImport = async (id, normalizedJob) => {
  const { data } = await axiosInstance.patch(`/admin/job-imports/${id}`, { normalizedJob });
  return data;
};

export const approveJobImport = async (id, job = {}) => {
  const { data } = await axiosInstance.post(`/admin/job-imports/${id}/approve`, { job });
  return data;
};

export const rejectJobImport = async (id, reason = "") => {
  const { data } = await axiosInstance.post(`/admin/job-imports/${id}/reject`, { reason });
  return data;
};

// =============================
// ✅ RECRUITER: Jobs CRUD (Axios)
// =============================
export const fetchRecruiterJobs = async () => {
  const { data } = await axiosInstance.get("/jobs/recruiter");
  return data?.data ?? data;
};

export const fetchJobById = async (jobId) => {
  const { data } = await axiosInstance.get(`/jobs/${jobId}`);
  return data;
};

export const createJob = async (jobData) => {
  const { data } = await axiosInstance.post("/jobs", jobData);
  return data;
};

export const updateJob = async (jobId, jobData) => {
  const { data } = await axiosInstance.patch(`/jobs/${jobId}`, jobData);
  return data;
};

export const archiveJob = async (jobId) => {
  const { data } = await axiosInstance.post(`/jobs/${jobId}/archive`);
  return data;
};

export const unarchiveJob = async (jobId) => {
  const { data } = await axiosInstance.post(`/jobs/${jobId}/unarchive`);
  return data;
};

export const fetchRecruiterDomains = async () => {
  const { data } = await axiosInstance.get("/recruiter/domains");
  return data?.items || [];
};

export const requestRecruiterDomainVerification = async ({ domain, sendTo }) => {
  const { data } = await axiosInstance.post("/recruiter/domains/request", { domain, sendTo });
  return data;
};

export const fetchRecruiterApplications = async () => {
  const { data } = await axiosInstance.get("/applications/for-my-jobs");
  return Array.isArray(data) ? data : data?.items || [];
};

export const createStripeCheckout = async (planKey) => {
  const { data } = await axiosInstance.post("/stripe/checkout", { planKey });
  return data;
};

export default axiosInstance;
