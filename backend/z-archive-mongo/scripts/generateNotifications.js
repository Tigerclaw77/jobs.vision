const axios = require("axios");

// Replace with your actual token and recipient ID
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImFkbWluLXVzZXItaWQiLCJ1c2VyUm9sZSI6ImFkbWluIiwicmVjcnVpdGVyVHlwZSI6ImNvcnBvcmF0ZSIsImNvcnBvcmF0aW9uIjoibHV4b3R0aWNhIiwiaWF0IjoxNzQ0MDUwNjM1LCJleHAiOjE3NDQwNTQyMzV9.-AXhunBXnxIBL2ng49PkDLUxVYzRe7_cuJCc1FX51Vg";
const recipientId = "67ccb98f866cbc48ae78d3e0";

const seedNotifications = async () => {
  try {
    const response = await axios.post(
      "http://localhost:5000/api/notifications/seed",
      {
        recipient: recipientId,
        count: 50
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Seed success:", response.data);
  } catch (err) {
    console.error("❌ Seed failed:", err.response?.data || err.message);
  }
};

seedNotifications();
