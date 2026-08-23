import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { formatSize } from "../../shared/format";
import type { Magnet } from "../../shared/types";

/** javdb reuses the video code as every row's name, so these numbers are the discriminator. */
const metrics = (magnet: Magnet): string => {
  const parts: string[] = [];

  const size = magnet.sizeBytes !== null ? formatSize(magnet.sizeBytes) : magnet.sizeText;
  if (size) parts.push(size);

  if (magnet.fileCount !== null) {
    parts.push(magnet.fileCount === 1 ? "1 file" : `${magnet.fileCount} files`);
  }

  return parts.join(" · ");
};

/** Name and date, then size. Page-controlled text, so React interpolation only. */
export const MagnetRow = ({ magnet }: { readonly magnet: Magnet }): React.ReactElement => {
  const summary = metrics(magnet);

  return (
    <Stack spacing={0.25} sx={{ py: 0.25, minWidth: 0 }}>
      <Typography
        variant="body2"
        sx={{ wordBreak: "break-all", lineHeight: 1.35, fontWeight: 500 }}
      >
        {magnet.dateText ? `${magnet.name} · ${magnet.dateText}` : magnet.name}
      </Typography>
      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
        {summary ? (
          <Typography variant="caption" color="text.secondary">
            {summary}
          </Typography>
        ) : null}
        {magnet.tags.map((tag) => (
          <Chip key={tag} label={tag} variant="outlined" sx={{ height: 18, fontSize: 11 }} />
        ))}
      </Stack>
    </Stack>
  );
};
