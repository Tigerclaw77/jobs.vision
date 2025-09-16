import React from "react";
import { Container, Paper, Typography } from "@mui/material";

const EmailVerification = () => {
  return (
    <Container maxWidth="sm">
      <Paper elevation={5} className="glass-form">
        <Typography variant="h4" align="center" gutterBottom>
          Verify Your Email
        </Typography>
        <Typography align="center">
          We've sent you a verification email. Please check your inbox and click the link to activate your account.
        </Typography>
      </Paper>
    </Container>
  );
};

export default EmailVerification;
