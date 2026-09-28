import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import { probeVersion } from "../../shared/aria2";
import { requestEndpointPermission, saveSettings, validateEndpoint } from "../../shared/settings";
import type { Aria2Settings } from "../../shared/types";
import { CookieBinding } from "./CookieBinding";

interface SettingsPaneProps {
  readonly settings: Aria2Settings;
  readonly onSaved: (settings: Aria2Settings) => void;
}

type Status =
  | { readonly kind: "idle" }
  | { readonly kind: "busy" }
  | { readonly kind: "ok"; readonly message: string }
  | { readonly kind: "error"; readonly message: string };

const describe = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const NO_PERMISSION = "Chrome did not grant permission to reach that host, so it cannot be used.";

/** The aria2 endpoint and secret. The secret goes to chrome.storage.local, never
 *  the bundle. A non-default endpoint needs a host grant, hence the click handler. */
export const SettingsPane = ({ settings, onSaved }: SettingsPaneProps): React.ReactElement => {
  const [endpoint, setEndpoint] = useState(settings.endpoint);
  const [secret, setSecret] = useState(settings.secret);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [touched, setTouched] = useState(false);

  // The field starts empty because nothing ships configured; complaining about
  // that before the user has typed anything would be noise.
  const endpointError = touched && status.kind !== "error" ? validateEndpoint(endpoint) : null;

  const ensureReachable = async (): Promise<Aria2Settings | null> => {
    const invalid = validateEndpoint(endpoint);
    if (invalid) {
      setStatus({ kind: "error", message: invalid });
      return null;
    }

    if (!(await requestEndpointPermission(endpoint))) {
      setStatus({ kind: "error", message: NO_PERMISSION });
      return null;
    }
    return { endpoint: endpoint.trim(), secret };
  };

  const handleTest = async (): Promise<void> => {
    setStatus({ kind: "busy" });
    try {
      const candidate = await ensureReachable();
      // ensureReachable has already reported why.
      if (!candidate) return;

      setStatus({ kind: "ok", message: `Connected to aria2 ${await probeVersion(candidate)}.` });
    } catch (cause) {
      setStatus({ kind: "error", message: describe(cause) });
    }
  };

  const handleSave = async (): Promise<void> => {
    const invalid = validateEndpoint(endpoint);
    if (invalid) {
      setStatus({ kind: "error", message: invalid });
      return;
    }

    const candidate: Aria2Settings = { endpoint: endpoint.trim(), secret };
    setStatus({ kind: "busy" });

    try {
      // Dispatched, not awaited: Chrome may tear the popup down for the prompt,
      // and awaiting would also spend the user activation the request needs.
      void saveSettings(candidate);

      if (!(await requestEndpointPermission(candidate.endpoint))) {
        setStatus({ kind: "error", message: NO_PERMISSION });
        return;
      }

      onSaved(candidate);
      setStatus({ kind: "ok", message: "Saved." });
    } catch (cause) {
      setStatus({ kind: "error", message: describe(cause) });
    }
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        Magnets are submitted to this aria2 daemon over JSON-RPC. Nothing is configured until you
        enter it here.
      </Typography>

      <TextField
        label="JSON-RPC URL"
        value={endpoint}
        onChange={(event) => {
          setEndpoint(event.target.value);
          setTouched(true);
          setStatus({ kind: "idle" });
        }}
        error={endpointError !== null}
        helperText={endpointError ?? "For example http://localhost:6800/jsonrpc"}
      />

      <TextField
        label="RPC secret"
        type="password"
        value={secret}
        onChange={(event) => {
          setSecret(event.target.value);
          setStatus({ kind: "idle" });
        }}
        autoComplete="off"
        helperText="The daemon's --rpc-secret. Leave empty if it runs without one."
      />

      {status.kind === "ok" ? (
        <Alert severity="success" variant="outlined" sx={{ py: 0 }}>
          {status.message}
        </Alert>
      ) : null}
      {status.kind === "error" ? (
        <Alert severity="error" variant="outlined" sx={{ py: 0 }}>
          {status.message}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          onClick={() => void handleTest()}
          disabled={status.kind === "busy"}
        >
          Test connection
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSave()}
          disabled={status.kind === "busy"}
        >
          Save
        </Button>
      </Stack>

      <Divider />
      <CookieBinding allowPicker={false} />
    </Stack>
  );
};
