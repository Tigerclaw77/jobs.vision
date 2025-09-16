import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { Snackbar, Alert } from "@mui/material";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ open: false, message: "", severity: "info", duration: 4000 });

  const show = useCallback((message, opts = {}) => {
    setToast({ open: true, message, severity: opts.severity || "info", duration: opts.duration ?? 4000 });
  }, []);

  const api = useMemo(() => ({
    show,
    success: (m, o) => show(m, { ...o, severity: "success" }),
    error:   (m, o) => show(m, { ...o, severity: "error" }),
    info:    (m, o) => show(m, { ...o, severity: "info" }),
    warn:    (m, o) => show(m, { ...o, severity: "warning" }),
  }), [show]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <Snackbar
        open={toast.open}
        autoHideDuration={toast.duration}
        onClose={() => setToast(t => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          elevation={6}
          variant="filled"
          severity={toast.severity}
          onClose={() => setToast(t => ({ ...t, open: false }))}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
