import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import SettingsIcon from "@mui/icons-material/Settings";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";

import { submitMagnets } from "../shared/aria2";
import { DEFAULT_SETTINGS, hasEndpointPermission, loadSettings } from "../shared/settings";
import type { Aria2Settings, Magnet, SubmitOutcome } from "../shared/types";
import { MovieCard } from "./components/MovieCard";
import { SettingsPane } from "./components/SettingsPane";
import { SubmitReport } from "./components/SubmitReport";
import { useJavdbTabs } from "./useJavdbTabs";

type View = "list" | "settings";

/** Chosen magnet per tab. */
type Selection = Readonly<Record<number, string>>;

const NO_PERMISSION =
  "The extension has no permission to reach that endpoint. Open settings and save it to grant access.";

const count = (value: number, noun: string): string =>
  value === 1 ? `1 ${noun}` : `${value} ${noun}s`;

export const App = (): React.ReactElement => {
  const { sources, unreadable, loading, rescan } = useJavdbTabs();
  const [settings, setSettings] = useState<Aria2Settings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<View>("list");
  const [selection, setSelection] = useState<Selection>({});
  const [outcomes, setOutcomes] = useState<readonly SubmitOutcome[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  // Default to the first magnet, but never overwrite a choice already made.
  useEffect(() => {
    setSelection((previous) => {
      const next: Record<number, string> = {};
      for (const source of sources) {
        const first = source.magnets[0];
        if (!first) continue;
        const chosen = previous[source.tabId];
        next[source.tabId] =
          chosen !== undefined && source.magnets.some((magnet) => magnet.id === chosen)
            ? chosen
            : first.id;
      }
      return next;
    });
  }, [sources]);

  const handleSelect = useCallback((tabId: number, magnetId: string) => {
    setSelection((previous) => ({ ...previous, [tabId]: magnetId }));
  }, []);

  const chosen = useMemo<readonly Magnet[]>(() => {
    const picked: Magnet[] = [];
    for (const source of sources) {
      const magnetId = selection[source.tabId];
      const magnet = source.magnets.find((candidate) => candidate.id === magnetId);
      if (magnet) picked.push(magnet);
    }
    return picked;
  }, [sources, selection]);

  const handleSubmit = async (): Promise<void> => {
    setSubmitting(true);
    setProblem(null);
    setOutcomes([]);

    if (!(await hasEndpointPermission(settings.endpoint))) {
      setProblem(NO_PERMISSION);
      setSubmitting(false);
      return;
    }

    setOutcomes(await submitMagnets(settings, chosen));
    setSubmitting(false);
  };

  return (
    <Box sx={{ width: 520, maxHeight: 600, display: "flex", flexDirection: "column" }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, flexShrink: 0 }}>
        {view === "settings" ? (
          <IconButton size="small" onClick={() => setView("list")} aria-label="Back">
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        ) : null}
        <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 600 }}>
          {view === "settings" ? "Settings" : "Jav Links Collector"}
        </Typography>
        {view === "list" ? (
          <>
            <Tooltip title="Rescan open tabs">
              <span>
                <IconButton size="small" onClick={rescan} disabled={loading} aria-label="Rescan">
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton size="small" onClick={() => setView("settings")} aria-label="Settings">
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : null}
      </Stack>
      <Divider />

      <Box sx={{ flex: 1, overflowY: "auto", p: 1.5 }}>
        {view === "settings" ? (
          <SettingsPane settings={settings} onSaved={setSettings} />
        ) : (
        <Stack spacing={1}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={24} />
            </Stack>
          ) : null}

          {!loading && sources.length === 0 && unreadable.length === 0 ? (
            <Stack alignItems="center" spacing={0.5} sx={{ py: 4, px: 2, textAlign: "center" }}>
              <Typography variant="body2">No javdb video pages are open.</Typography>
              <Typography variant="caption" color="text.secondary">
                Open one or more javdb.com/v/ pages, then reopen this popup.
              </Typography>
            </Stack>
          ) : null}

          {sources.map((source) => (
            <MovieCard
              key={source.tabId}
              source={source}
              selectedId={selection[source.tabId]}
              onSelect={handleSelect}
            />
          ))}

          {unreadable.map((tab) => (
            <Alert key={tab.tabId} severity="warning" variant="outlined">
              <Typography variant="body2" noWrap title={tab.title}>
                {tab.title || tab.url}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {tab.reason}
              </Typography>
            </Alert>
          ))}

          {problem ? (
            <Alert severity="error" variant="outlined">
              {problem}
            </Alert>
          ) : null}

          <SubmitReport outcomes={outcomes} />
        </Stack>
        )}
      </Box>

      {view === "list" ? (
        <>
          <Divider />
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ px: 1.5, py: 1, flexShrink: 0 }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
              {`${count(chosen.length, "magnet")} selected`}
            </Typography>
            <Button
              variant="contained"
              onClick={() => void handleSubmit()}
              disabled={submitting || chosen.length === 0}
            >
              {submitting ? "Sending" : "Send to aria2"}
            </Button>
          </Stack>
        </>
      ) : null}
    </Box>
  );
};
