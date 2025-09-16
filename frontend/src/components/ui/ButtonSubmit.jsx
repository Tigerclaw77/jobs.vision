import React from "react";
import { Button } from "@mui/material";

const ButtonSubmit = ({ children, ...props }) => {
  return (
    <Button variant="contained" color="primary" fullWidth {...props}>
      {children}
    </Button>
  );
};

export default ButtonSubmit;
