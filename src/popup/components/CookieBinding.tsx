import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import {
  canPickFiles,
  ensureWritable,
  forgetEnvFile,
  pickEnvFile,
  rememberEnvFile,
} from "../../shared/envTarget";
import { ENV_KEY, useCookie } from "../useCookie";

interface CookieBindingProps {
  /**
   * Only the settings page offers a picker: opening one closes the popup, so
   * from there this button navigates to the settings page instead.
   */
  readonly allowPicker: boolean;
}

/**
 * Which .env file the cookie gets written into, and nothing else.
 *
 * Copying the cookie and writing it live in the popup footer, where they are
 * one click from anywhere. This is only about the binding, which is set once.
 */
export const CookieBinding = ({ allowPicker }: CookieBindingProps): React.ReactElement => {
  const state = useCookie();

  const handlePick = async (): Promise<void> => {
    const handle = await pickEnvFile();
    if (!handle) return;
    // Ask for write access now, while a click is still in hand, so the footer
    // button works later without a prompt.
    await ensureWritable(handle);
    await rememberEnvFile(handle);
    state.refresh();
  };

  const handleForget = async (): Promise<void> => {
    await forgetEnvFile();
    state.refresh();
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">javdb cookie</Typography>

      <Typography variant="caption" color="text.secondary">
        {state.summary}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {state.envName
          ? `Writes ${ENV_KEY} into ${state.envName}.`
          : "No .env file chosen, so the footer's Update button has nowhere to write."}
      </Typography>

      {state.problem ? (
        <Alert severity="error" variant="outlined" sx={{ py: 0 }}>
          {state.problem}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1}>
        {allowPicker && canPickFiles() ? (
          <Button variant="outlined" size="small" onClick={() => void handlePick()}>
            {state.envName ? "Choose another file" : "Choose .env file"}
          </Button>
        ) : (
          <Button variant="outlined" size="small" onClick={state.openSettingsPage}>
            {state.envName ? "Change file" : "Choose .env file"}
          </Button>
        )}

        {allowPicker && state.envName ? (
          <Button size="small" color="inherit" onClick={() => void handleForget()}>
            Forget
          </Button>
        ) : null}
      </Stack>
    </Stack>
  );
};
