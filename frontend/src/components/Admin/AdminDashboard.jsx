// frontend/src/components/Admin/AdminDashboard.jsx
import React, { useState, useEffect } from "react";
import { Link as RouterLink } from "react-router-dom";
import axiosInstance, { fetchAdminDashboard } from "../../utils/api"; // ← fixed path
import UserTable from "./UserTable";
import StatsCards from "./StatsCards";
import IncomeWidget from "./IncomeWidget";
import { Box, Paper, Typography, Button, Stack } from "@mui/material";
import "./AdminDashboard.css";

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [lockedUsers, setLockedUsers] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [income, setIncome] = useState(0);

  useEffect(() => {
    getAdminDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getAdminDashboardData = async () => {
    try {
      // 1) counts (jobs/users/applications)
      const dashboardData = await fetchAdminDashboard();
      setTotalUsers(dashboardData?.counts?.users || 0);
      // income isn’t returned by the API yet — keep it 0 instead of a fake value
      setIncome(dashboardData?.income || 0);

      // 2) users list
      const { data } = await axiosInstance.get("/users");
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : [];
      setUsers(items);
      setLockedUsers(items.filter((u) => u.locked || u.lockedAt));
    } catch (error) {
      console.error("❌ Error fetching admin dashboard data:", error?.message || error);
      setUsers([]);
      setLockedUsers([]);
      setTotalUsers(0);
      setIncome(0);
    }
  };

  return (
    <Box className="admin-dashboard-container text-on-dim" sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
      {/* Header row with CTA */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4" component="h2">
          Admin Dashboard
        </Typography>

        {/* Admin can post jobs */}
        <Button
          component={RouterLink}
          to="/admin/addjob"                 // alias route for the same AddJob form
          variant="contained"
          className="glass-button"
        >
          Post a Job
        </Button>
      </Stack>

      <StatsCards totalUsers={totalUsers} lockedUsers={lockedUsers.length} income={income} />

      <Paper elevation={3} sx={{ p: 2, mb: 3 }}>
        <IncomeWidget income={income} />
      </Paper>

      <Paper elevation={3} sx={{ p: 2 }}>
        <UserTable users={users} lockedUsers={lockedUsers} />
      </Paper>
    </Box>
  );
};

export default AdminDashboard;
