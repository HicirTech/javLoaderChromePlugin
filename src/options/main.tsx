/**
 * The settings page.
 *
 * It exists for one reason: choosing a file opens a picker, and a picker closes
 * the popup. Everything here also works from the popup once a file has been
 * chosen and the browser still holds write permission.
 */

import CssBaseline from "@mui/material/CssBaseline";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ThemeProvider } from "@mui/material/styles";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { CookieBinding } from "../popup/components/CookieBinding";
import { theme } from "../popup/theme";

const Options = (): React.ReactElement => (
  <Box sx={{ maxWidth: 640, mx: "auto", p: 3 }}>
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Jav Links Collector
        </Typography>
        <Typography variant="body2" color="text.secondary">
          The javdb clearance cookie expires quickly. Nominate the .env file avLoaderClient reads
          and the cookie is one button away from being current -- that button lives in the popup
          footer. This page exists only because choosing a file opens a picker, and a picker closes
          the popup.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <CookieBinding allowPicker />
      </Paper>

      <Typography variant="caption" color="text.secondary">
        The file is remembered, not its path: the browser hands out a handle rather than a location.
        Write access is granted when you choose the file; if the browser forgets it, choose the file
        again here. Nothing is written until you press Update in the popup footer.
      </Typography>
    </Stack>
  </Box>
);

const container = document.getElementById("root");
if (!container) throw new Error("options.html is missing its #root element");

createRoot(container).render(
  <StrictMode>
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline />
      <Options />
    </ThemeProvider>
  </StrictMode>,
);
