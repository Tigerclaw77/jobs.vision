import React from "react";
import { FormControlLabel, Checkbox } from "@mui/material";
import { Controller } from "react-hook-form";

const CheckboxInput = ({ name, control, label }) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <FormControlLabel control={<Checkbox {...field} />} label={label} />
      )}
    />
  );
};

export default CheckboxInput;
