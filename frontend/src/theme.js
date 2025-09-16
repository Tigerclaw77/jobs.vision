import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: { main: "#007bff" },
    secondary: { main: "#ff5722" },
  },
  typography: {
    fontFamily: "Roboto, sans-serif",
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          backgroundColor: "#fff",
          borderRadius: "8px",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontSize: "16px",
          padding: "10px 20px",
        },
      },
    },
  },
});

export default theme;
