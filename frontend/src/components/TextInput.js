import React from "react";
import { TextField } from "@mui/material";

function TextInput({ label, value, onChange, type = "text" }) {
  return (
    <TextField
      label={label}
      variant="outlined"
      fullWidth
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={{ marginBottom: 2 }}
    />
  );
}

export default TextInput;
