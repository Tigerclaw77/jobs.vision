import React from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { Controller } from "react-hook-form";

const SelectInput = ({ name, control, label, options, rules }) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field, fieldState: { error } }) => (
        <FormControl fullWidth margin="normal" error={!!error}>
          <InputLabel>{label}</InputLabel>
          <Select {...field}>
            {options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          {error && <p style={{ color: "red", fontSize: "0.8rem" }}>{error.message}</p>}
        </FormControl>
      )}
    />
  );
};

export default SelectInput;
