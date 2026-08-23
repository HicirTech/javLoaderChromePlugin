import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import type { MovieSource } from "../../shared/types";
import { MagnetRow } from "./MagnetRow";

interface MovieCardProps {
  readonly source: MovieSource;
  readonly selectedId: string | undefined;
  readonly onSelect: (tabId: number, magnetId: string) => void;
}

/** The heading as one string, for the native tooltip on a truncated line. */
const plainHeading = (source: MovieSource): string => {
  if (source.code && source.title) return `[${source.code}] ${source.title}`;
  return source.code || source.title || source.url;
};

/** One open javdb tab, as a single-choice group over its magnets. */
export const MovieCard = ({
  source,
  selectedId,
  onSelect,
}: MovieCardProps): React.ReactElement => (
  <Paper variant="outlined" sx={{ p: 1.25 }}>
    <Stack spacing={0.75}>
      <Typography
        variant="subtitle2"
        noWrap
        title={plainHeading(source)}
        sx={{ minWidth: 0, fontWeight: 400 }}
      >
        {source.code ? (
          <Box component="span" sx={{ fontWeight: 700 }}>
            {`[${source.code}] `}
          </Box>
        ) : null}
        {source.title || (source.code ? "" : source.url)}
      </Typography>

      {source.magnets.length === 0 ? (
        <Alert severity="info" variant="outlined" sx={{ py: 0 }}>
          This page lists no magnet links.
        </Alert>
      ) : (
        <RadioGroup
          value={selectedId ?? ""}
          onChange={(event) => onSelect(source.tabId, event.target.value)}
        >
          {source.magnets.map((magnet) => (
            <FormControlLabel
              key={magnet.id}
              value={magnet.id}
              control={<Radio size="small" sx={{ py: 0.25 }} />}
              label={<MagnetRow magnet={magnet} />}
              sx={{ alignItems: "flex-start", mr: 0, ml: -0.5 }}
            />
          ))}
        </RadioGroup>
      )}
    </Stack>
  </Paper>
);
