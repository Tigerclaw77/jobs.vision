import React from "react";
import { useNavigate } from "react-router-dom";
import { Container, Paper, Typography, Button } from "@mui/material";

const Unauthorized = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    navigate(-1); // Go back to the previous page
  };

  const handleGoHome = () => {
    navigate("/"); // Go to home (or change to login if you want)
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={5} className="glass-form">
        <Typography variant="h4" align="center" gutterBottom>
          Access Denied
        </Typography>

        <Typography align="center" paragraph>
          You do not have permission to access this page.
        </Typography>

        <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
          <Button variant="contained" onClick={handleGoBack} className="glass-button">
            Go Back
          </Button>
          <Button variant="outlined" onClick={handleGoHome} className="glass-button">
            Go Home
          </Button>
        </div>
      </Paper>
    </Container>
  );
};

export default Unauthorized;
