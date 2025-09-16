import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// ✅ Toggle Favorite Job
export const toggleFavoriteJob = createAsyncThunk(
  "jobs/toggleFavoriteJob",
  async (jobId, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const res = await axios.post(
        `/api/jobs/favorite/${jobId}`,
        {},
        {
          headers: { Authorization: `Bearer ${auth.token}` },
        }
      );
      return res.data.favorites;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to toggle favorite");
    }
  }
);

// ✅ Apply to Job
export const applyToJob = createAsyncThunk(
  "jobs/applyToJob",
  async (jobId, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const res = await axios.post(
        `/api/jobs/apply/${jobId}`,
        {},
        {
          headers: { Authorization: `Bearer ${auth.token}` },
        }
      );
      return res.data.appliedJobs;
    } catch (error) {
      return rejectWithValue(error.response?.data || "Failed to apply to job");
    }
  }
);

// ✅ Load jobs & interactions from /api/users/me
export const fetchUserJobData = createAsyncThunk(
  "jobs/fetchUserJobData",
  async ({ savedJobs = [], appliedJobs = [], recruiterJobs = [], hiddenJobs = [] }, thunkAPI) => {
    try {
      return { savedJobs, appliedJobs, recruiterJobs, hiddenJobs };
    } catch (error) {
      return thunkAPI.rejectWithValue("Failed to load user job data");
    }
  }
);

const jobSlice = createSlice({
  name: "jobs",
  initialState: {
    favorites: [],
    appliedJobs: [],
    recruiterJobs: [],
    hiddenJobs: [],
    searchResults: [], // 🔄 Optional: candidate-facing job list
    loading: false,
    error: null,
  },
  reducers: {
    resetJobState(state) {
      state.favorites = [];
      state.appliedJobs = [];
      state.recruiterJobs = [];
      state.hiddenJobs = [];
      state.searchResults = [];
      state.loading = false;
      state.error = null;
    },

    updateRecruiterJob(state, action) {
      const updated = action.payload;
      state.recruiterJobs = state.recruiterJobs.map((job) =>
        job._id === updated._id ? updated : job
      );
    },

    removeRecruiterJob(state, action) {
      const jobId = action.payload;
      state.recruiterJobs = state.recruiterJobs.filter((job) => job._id !== jobId);
    },

    // Optional if you're syncing with job search results
    setSearchJobs(state, action) {
      state.searchResults = action.payload;
    },
    updateSearchJob(state, action) {
      const updated = action.payload;
      state.searchResults = state.searchResults.map((job) =>
        job._id === updated._id ? updated : job
      );
    },
    removeSearchJob(state, action) {
      const jobId = action.payload;
      state.searchResults = state.searchResults.filter((job) => job._id !== jobId);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserJobData.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchUserJobData.fulfilled, (state, action) => {
        state.loading = false;
        state.favorites = action.payload.savedJobs || [];
        state.appliedJobs = action.payload.appliedJobs || [];
        state.recruiterJobs = action.payload.recruiterJobs || [];
        state.hiddenJobs = action.payload.hiddenJobs || [];
      })
      .addCase(fetchUserJobData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(toggleFavoriteJob.fulfilled, (state, action) => {
        state.favorites = action.payload;
      })
      .addCase(applyToJob.fulfilled, (state, action) => {
        state.appliedJobs = action.payload;
      });
  },
});

export const {
  resetJobState,
  updateRecruiterJob,
  removeRecruiterJob,
  setSearchJobs,
  updateSearchJob,
  removeSearchJob,
} = jobSlice.actions;

export default jobSlice.reducer;
