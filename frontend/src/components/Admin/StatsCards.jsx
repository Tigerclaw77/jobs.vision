// frontend/src/components/Admin/StatsCards.jsx
import React from "react";
import { Paper, Typography, Stack } from "@mui/material";

export default function StatsCards({
  totalUsers = 0,
  lockedUsers = 0,
  income = 0,
  hideLockedWhenZero = true,
}) {
  const items = [
    { label: "Total Users", value: totalUsers },
    ...(hideLockedWhenZero && !lockedUsers
      ? []
      : [{ label: "Locked Accounts", value: lockedUsers }]),
    { label: "Current Income", value: `$${Number(income || 0).toLocaleString()}` },
  ];

  return (
    <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap" }}>
      {items.map((it) => (
        <Paper
          key={it.label}
          elevation={1}
          sx={{
            p: 2,
            minWidth: 140,
            flex: "1 0 auto",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", mb: 0.5 }}
          >
            {it.label}
          </Typography>
          <Typography
            variant="h5"
            sx={{ fontWeight: 600, color: "text.primary" }}
          >
            {it.value}
          </Typography>
        </Paper>
      ))}
    </Stack>
  );
}
