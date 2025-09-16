import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import jobReducer from "./jobSlice";
import notificationsReducer from './notificationsSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    jobs: jobReducer,
    notifications: notificationsReducer,
  },
  // DevTools will be enabled by default in development mode
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;
