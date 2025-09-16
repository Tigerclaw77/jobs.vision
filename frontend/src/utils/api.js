import axios from "axios";

// ✅ Base Axios instance (adjust baseURL as needed)
const axiosInstance = axios.create({
  baseURL: "http://localhost:5000/api",
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

// =============================
// ✅ RECRUITER: Jobs CRUD (Axios)
// =============================
export const fetchRecruiterJobs = async () => {
  const { data } = await axiosInstance.get("/jobs/recruiter");
  return data?.data ?? data;
};

export const createJob = async (jobData) => {
  const { data } = await axiosInstance.post("/jobs", jobData);
  return data;
};

export const updateJob = async (jobId, jobData) => {
  const { data } = await axiosInstance.put(`/jobs/${jobId}`, jobData);
  return data;
};

export const archiveJob = async (jobId) => {
  const { data } = await axiosInstance.put(`/jobs/${jobId}/archive`);
  return data;
};

export const migrateRecruiterJobTemplates = async () => {
  const { data } = await axiosInstance.post("/recruiters/migrate-job-templates");
  return data;
};

export default axiosInstance;
