import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import Alert from "@mui/material/Alert";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";

import type { SubmitOutcome } from "../../shared/types";

/** Per-magnet results. The count is what aria2 accepted, not what was sent. */
export const SubmitReport = ({
  outcomes,
}: {
  readonly outcomes: readonly SubmitOutcome[];
}): React.ReactElement | null => {
  if (outcomes.length === 0) return null;

  const accepted = outcomes.filter((outcome) => outcome.ok).length;
  const failed = outcomes.length - accepted;

  return (
    <Paper variant="outlined" sx={{ p: 1 }}>
      <Alert
        severity={failed === 0 ? "success" : accepted === 0 ? "error" : "warning"}
        variant="outlined"
        sx={{ py: 0 }}
      >
        {failed === 0
          ? `aria2 accepted ${accepted} of ${outcomes.length}.`
          : `aria2 accepted ${accepted} of ${outcomes.length}; ${failed} failed.`}
      </Alert>
      <List dense disablePadding sx={{ mt: 0.5 }}>
        {outcomes.map((outcome) => (
          <ListItem key={outcome.magnetId} disableGutters sx={{ alignItems: "flex-start" }}>
            <ListItemIcon sx={{ minWidth: 28, mt: 0.25 }}>
              {outcome.ok ? (
                <CheckCircleOutlineIcon fontSize="small" color="success" />
              ) : (
                <ErrorOutlineIcon fontSize="small" color="error" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={outcome.name}
              secondary={outcome.ok ? `GID ${outcome.gid ?? "unknown"}` : outcome.error}
              slotProps={{
                primary: { variant: "body2", sx: { wordBreak: "break-all" } },
                secondary: { variant: "caption", sx: { wordBreak: "break-word" } },
              }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};
