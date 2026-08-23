import { createTheme } from "@mui/material/styles";

/** Plain by intent: one accent, tight spacing for a 520px popup. Both colour
 *  schemes declared, selected from the OS setting. */
export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "media" },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: "#37474f" },
        background: { default: "#ffffff", paper: "#ffffff" },
      },
    },
    dark: {
      palette: {
        primary: { main: "#90a4ae" },
        background: { default: "#1b1f23", paper: "#22272c" },
      },
    },
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      "Segoe UI",
      "Roboto",
      "Helvetica Neue",
      "Arial",
      "sans-serif",
    ].join(", "),
    fontSize: 13,
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiChip: { defaultProps: { size: "small" } },
    MuiTextField: { defaultProps: { size: "small", fullWidth: true } },
  },
});
