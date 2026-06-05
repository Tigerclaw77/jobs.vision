// frontend/src/store/notificationsSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../utils/api";

/**
 * Normalize possible shapes:
 * - id vs _id
 * - isRead vs is_read vs read
 */
const normalize = (n) => ({
  ...n,
  id: n.id ?? n._id,
  isRead: n.isRead ?? n.is_read ?? n.read ?? false,
});

// ✅ GET all notifications
export const fetchNotifications = createAsyncThunk(
  "notifications/fetchNotifications",
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get("/notifications");
      const list = Array.isArray(res.data)
        ? res.data
        : res.data?.notifications ?? res.data?.items ?? [];
      return {
        items: list.map(normalize),
        profileCompletion: res.data?.profileCompletion || null,
      };
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Error fetching notifications"
      );
    }
  }
);

// ✅ PATCH one notification as read
export const markNotificationRead = createAsyncThunk(
  "notifications/markNotificationRead",
  async (id, { rejectWithValue }) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      return id;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Error marking notification as read"
      );
    }
  }
);

// ✅ DELETE one notification
export const deleteNotification = createAsyncThunk(
  "notifications/deleteNotification",
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/notifications/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Error deleting notification"
      );
    }
  }
);

// ✅ PATCH all as read
export const markAllRead = createAsyncThunk(
  "notifications/markAllRead",
  async (_, { rejectWithValue }) => {
    try {
      await api.patch("/notifications/read-all");
      return true;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Error marking all as read"
      );
    }
  }
);

// ✅ DELETE all
export const deleteAllNotifications = createAsyncThunk(
  "notifications/deleteAllNotifications",
  async (_, { rejectWithValue }) => {
    try {
      await api.delete("/notifications");
      return true;
    } catch (err) {
      return rejectWithValue(
        err?.response?.data?.message || "Error deleting all notifications"
      );
    }
  }
);

const notificationsSlice = createSlice({
  name: "notifications",
  initialState: {
    items: [],
    loading: false,
    error: null,
    hasUnreadNotifications: false,
    profileCompletion: null,
  },
  reducers: {
    clearNotifications(state) {
      state.items = [];
      state.hasUnreadNotifications = false;
      state.error = null;
      state.profileCompletion = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetch
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items || [];
        state.profileCompletion = action.payload.profileCompletion || null;
        state.hasUnreadNotifications = state.items.some((n) => !n.isRead);
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load notifications";
      })

      // mark one read
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const id = action.payload;
        const n = state.items.find((x) => (x.id ?? x._id) === id);
        if (n) n.isRead = true;
        state.hasUnreadNotifications = state.items.some((x) => !x.isRead);
      })

      // delete one
      .addCase(deleteNotification.fulfilled, (state, action) => {
        const id = action.payload;
        state.items = state.items.filter((x) => (x.id ?? x._id) !== id);
        state.hasUnreadNotifications = state.items.some((x) => !x.isRead);
      })

      // mark all read
      .addCase(markAllRead.fulfilled, (state) => {
        state.items.forEach((x) => (x.isRead = true));
        state.hasUnreadNotifications = false;
      })

      // delete all
      .addCase(deleteAllNotifications.fulfilled, (state) => {
        state.items = [];
        state.hasUnreadNotifications = false;
      });
  },
});

export const { clearNotifications } = notificationsSlice.actions;
export default notificationsSlice.reducer;
