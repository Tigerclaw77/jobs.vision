// import React, { forwardRef, useEffect, useRef, useState } from "react";
// import TextField from "@mui/material/TextField";
// import InputAdornment from "@mui/material/InputAdornment";
// import IconButton from "@mui/material/IconButton";
// import Visibility from "@mui/icons-material/Visibility";
// import VisibilityOff from "@mui/icons-material/VisibilityOff";

// const GlassTextField = forwardRef(function GlassTextField(
//   {
//     type = "text",
//     enablePasswordToggle = false,
//     autoComplete,
//     InputProps: inputPropsFromCaller,
//     inputProps: innerInputPropsFromCaller,
//     ...props
//   },
//   forwardedRef
// ) {
//   const [show, setShow] = useState(false);
//   const isPassword = type === "password";

//   // keep RHF bindings on the real input element
//   const { name, onChange, onBlur, ref: rhfRef, ...rest } = props;

//   const localRef = useRef(null);
//   const setInputRef = (node) => {
//     localRef.current = node;
//     if (typeof rhfRef === "function") rhfRef(node);
//     else if (rhfRef && "current" in rhfRef) rhfRef.current = node;
//     if (typeof forwardedRef === "function") forwardedRef(node);
//     else if (forwardedRef && "current" in forwardedRef) forwardedRef.current = node;
//   };

//   // sensible defaults; caller may still override
//   const computedAutoComplete =
//     autoComplete ?? (isPassword ? "new-password" : type === "email" ? "email" : "off");

//   // --- Firefox autofill normalize: clear preview paint & force text color ---
//   useEffect(() => {
//     const el = localRef.current;
//     if (!el) return;

//     // force text color through inline style (beats most author rules)
//     el.style.setProperty("color", "#111", "important");
//     el.style.setProperty("caret-color", "#111", "important");
//     // WebKit text fill (no harm in FF)
//     el.style.setProperty("-webkit-text-fill-color", "#111", "important");

//     // If Firefox “preview” is active, rewriting the value removes the preview state.
//     try {
//       // only when the input already has a value (autofilled/previewed)
//       if (el.value) {
//         const v = el.value;
//         el.value = "";       // clear
//         el.value = v;        // restore
//       }
//     } catch {}
//   }, []);

//   const endAdornment =
//     enablePasswordToggle && isPassword ? (
//       <InputAdornment position="end">
//         <IconButton
//           aria-label="toggle password visibility"
//           onClick={() => setShow((s) => !s)}
//           edge="end"
//           tabIndex={-1}
//         >
//           {show ? <VisibilityOff /> : <Visibility />}
//         </IconButton>
//       </InputAdornment>
//     ) : (
//       inputPropsFromCaller?.endAdornment
//     );

//   return (
//     <TextField
//       variant="outlined"
//       fullWidth
//       margin="normal"
//       type={isPassword && enablePasswordToggle ? (show ? "text" : "password") : type}
//       name={name}
//       onChange={onChange}
//       onBlur={onBlur}
//       inputRef={setInputRef}
//       inputProps={{
//         autoComplete: computedAutoComplete,
//         "data-lpignore": "true",
//         "data-1p-ignore": "true",
//         ...(innerInputPropsFromCaller || {}),
//         // inline color as a backstop (FF + extensions often ignore stylesheet rules)
//         style: {
//           ...(innerInputPropsFromCaller?.style || {}),
//           color: "#111",
//           caretColor: "#111",
//           WebkitTextFillColor: "#111",
//         },
//       }}
//       InputProps={{ ...(inputPropsFromCaller || {}), endAdornment }}
//       sx={{
//         "& .MuiOutlinedInput-root": {
//           borderRadius: "12px",
//           background: "rgba(255,255,255,0.10)",
//           backdropFilter: "blur(10px)",
//           "& fieldset": {
//             borderColor: "rgba(255,255,255,0.30)",
//             borderRadius: "12px",
//           },
//           "&:hover fieldset": { borderColor: "rgba(140,180,255,0.6)" },
//           "&.Mui-focused fieldset": { borderColor: "rgba(140,180,255,0.8)" },
//           "& .MuiInputAdornment-root": { background: "transparent", marginRight: 4 },
//           "& .MuiOutlinedInput-input": {
//             color: "#111", // base ink; inline style above will reinforce on autofill
//             "::placeholder": { color: "#53565a" },
//             padding: "12px 14px",
//           },
//         },
//       }}
//       {...rest}
//     />
//   );
// });

// export default GlassTextField;

// src/components/ui/GlassTextField.jsx
import * as React from "react";
import TextField from "@mui/material/TextField";

const GlassTextField = React.forwardRef(function GlassTextField(
  { className, InputProps, sx, variant = "outlined", fullWidth = true, ...props },
  ref
) {
  return (
    <TextField
      {...props}
      // pass react-hook-form's ref through to the actual <input>
      inputRef={ref}
      variant={variant}
      fullWidth={fullWidth}
      className={["glass-textfield", className].filter(Boolean).join(" ")}
      InputProps={{
        ...InputProps,
      }}
      sx={{
        // glassy container
        "& .MuiOutlinedInput-root": {
          backdropFilter: "blur(10px)",
          background: "rgba(255,255,255,0.06)",
          borderRadius: 12,
          "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
          "&:hover fieldset": { borderColor: "rgba(255,255,255,0.22)" },
          "&.Mui-focused fieldset": { borderColor: "#90caf9" },
        },
        // text colors
        "& .MuiInputBase-input": {
          color: "#e5e7eb",
        },
        "& .MuiFormLabel-root": {
          color: "rgba(255,255,255,0.72)",
        },
        "& .MuiFormHelperText-root": {
          color: "#fca5a5",
        },
        ...sx,
      }}
    />
  );
});

export default GlassTextField;
