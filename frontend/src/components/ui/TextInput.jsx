import React from "react";
import { TextField } from "@mui/material";
import { Controller } from "react-hook-form";

const TextInput = ({ name, control, label, rules, type = "text", ...props }) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <TextField
          {...field}
          label={label}
          type={type}
          fullWidth
          error={!!error}
          helperText={error ? error.message : ""}
          margin="normal"
          variant="outlined"
          {...props}
        />
      )}
    />
  );
};

export default TextInput;
