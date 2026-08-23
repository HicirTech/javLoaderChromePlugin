import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";

import type { Magnet, MovieSource } from "../../shared/types";
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

/** One open tab, single-choice. Only the chosen magnet shows until expanded;
 *  picking one folds it back. Eight tabs would otherwise be a wall of rows. */
export const MovieCard = ({
  source,
  selectedId,
  onSelect,
}: MovieCardProps): React.ReactElement => {
  const [expanded, setExpanded] = useState(false);

  const selected = source.magnets.find((magnet) => magnet.id === selectedId);
  const visible: readonly Magnet[] = expanded || !selected ? source.magnets : [selected];
  const hidden = source.magnets.length - visible.length;
  const showToggle = expanded || hidden > 0;

  return (
    <Paper variant="outlined" sx={{ p: 1.25 }}>
      <Stack spacing={0.75}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Typography
            variant="subtitle2"
            noWrap
            title={plainHeading(source)}
            sx={{ minWidth: 0, flexGrow: 1, fontWeight: 400 }}
          >
            {source.code ? (
              <Box component="span" sx={{ fontWeight: 700 }}>
                {`[${source.code}] `}
              </Box>
            ) : null}
            {source.title || (source.code ? "" : source.url)}
          </Typography>

          {showToggle ? (
            <Tooltip
              title={
                expanded
                  ? "Hide the other magnets"
                  : hidden === 1
                    ? "Show 1 other magnet"
                    : `Show ${hidden} other magnets`
              }
            >
              <Button
                size="small"
                color="inherit"
                onClick={() => setExpanded((value) => !value)}
                endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{
                  flexShrink: 0,
                  px: 0.5,
                  minWidth: 0,
                  fontWeight: 400,
                  color: "text.secondary",
                  "& .MuiButton-endIcon": { ml: 0.25 },
                }}
              >
                {expanded ? "Hide" : `+${hidden}`}
              </Button>
            </Tooltip>
          ) : null}
        </Stack>

        {source.magnets.length === 0 ? (
          <Alert severity="info" variant="outlined" sx={{ py: 0 }}>
            This page lists no magnet links.
          </Alert>
        ) : (
          <RadioGroup
            value={selectedId ?? ""}
            onChange={(event) => {
              onSelect(source.tabId, event.target.value);
              setExpanded(false);
            }}
          >
            {visible.map((magnet) => (
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
};
