// frontend/src/store/authSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { supabase } from "../utils/supabaseClient";
import { fetchUserJobData } from "./jobSlice";

// -------- helpers --------
async function getRoleTier(userId, metaRole) {
  // admin wins if set in app/user metadata
  if (metaRole === "admin") return { role: "admin", tier: "premium" };

  // recruiter entitlements
  const { data: rec } = await supabase
    .from("recruiter_entitlements")
    .select("plan,status")
    .eq("profile_id", userId)
    .maybeSingle();
  if (rec?.status === "active") return { role: "recruiter", tier: rec.plan || "staff" };

  // candidate entitlements
  const { data: can } = await supabase
    .from("candidate_entitlements")
    .select("plan,status")
    .eq("profile_id", userId)
    .maybeSingle();
  if (can?.status === "active") return { role: "candidate", tier: can.plan || "free" };

  // fallback
  return { role: metaRole || "candidate", tier: "free" };
}

function safeGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, val) {
  try {
    if (val === null || val === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, val);
  } catch {}
}

// hydrate user from LS (back-compat)
let rawUser = null;
try {
  const parsed = JSON.parse(safeGet("user") || "null");
  rawUser = parsed && Object.keys(parsed).length ? parsed : null;
} catch { rawUser = null; }

const initialState = {
  token: safeGet("token") || null,
  userRole: safeGet("userRole") || null,
  user: rawUser || null,
  status: "idle",
  error: null,
  isAuthenticated: !!safeGet("token"),
};

/**
 * ✅ Thunk: read Supabase session/user on app boot or refresh
 */
export const fetchUserSession = createAsyncThunk(
  "auth/fetchUserSession",
  async (_, thunkAPI) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!session || !user) return thunkAPI.rejectWithValue("No active session");

      const metaRole = user?.app_metadata?.role || user?.user_metadata?.role || null;
      const { role, tier } = await getRoleTier(user.id, metaRole);

      const shapedUser = {
        id: user.id,
        email: user.email,
        isVerified: !!user.email_confirmed_at,
        userRole: role,   // keep this for places that read user.userRole
        tier,             // AccessGate reads this
        ...user.user_metadata, // e.g., firstName, lastName, recruiterType
      };

      // (stub) load related user data here if you want, keeps your old flow alive
      thunkAPI.dispatch(
        fetchUserJobData({
          savedJobs: [],
          appliedJobs: [],
          recruiterJobs: [],
          hiddenJobs: [],
        })
      );

      return { token: session.access_token, user: shapedUser };
    } catch (err) {
      return thunkAPI.rejectWithValue(err?.message || "Failed to load session");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Called by your login screen after supabase signInWithPassword()
    login(state, action) {
      const { token, userRole, user } = action.payload;
      state.token = token;
      state.userRole = userRole;
      state.user = user;
      state.isAuthenticated = true;

      safeSet("token", token);
      safeSet("userRole", userRole || "");
      safeSet("user", JSON.stringify(user || {}));
    },
    logout(state) {
      state.token = null;
      state.userRole = null;
      state.user = null;
      state.status = "idle";
      state.error = null;
      state.isAuthenticated = false;

      safeSet("token", null);
      safeSet("userRole", null);
      safeSet("user", null);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserSession.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchUserSession.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.userRole = action.payload.user?.userRole || null;
        state.isAuthenticated = true;

        safeSet("token", action.payload.token);
        safeSet("userRole", action.payload.user?.userRole || "");
        safeSet("user", JSON.stringify(action.payload.user));
      })
      .addCase(fetchUserSession.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
        state.token = null;
        state.user = null;
        state.userRole = null;
        state.isAuthenticated = false;

        safeSet("token", null);
        safeSet("userRole", null);
        safeSet("user", null);
      });
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
