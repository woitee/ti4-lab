import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconFile, IconUsers } from "@tabler/icons-react";
import type { DraftPreset } from "~/drizzle/draftPreset.server";
import {
  getFeaturedDraftPresets,
  loadFeaturedDraftPreset,
  type LoadDraftPresetResponse,
} from "~/server/draftPresets.functions";
import {
  draftFormatLabel,
  filterFeaturedPresets,
} from "~/utils/featuredPresets";
import { Modal, Spinner, Stack, Switch, Tag, Text, notify } from "~/ui";
import classes from "./BrowsePresetsModal.module.css";

type Props = {
  opened: boolean;
  onClose: () => void;
  playerCount: number;
  onContinue: (preset: DraftPreset) => void;
};

async function loadPreset(id: string): Promise<LoadDraftPresetResponse> {
  try {
    return await loadFeaturedDraftPreset({ data: id });
  } catch {
    return { success: false, error: "Something went wrong. Try again." };
  }
}

export function BrowsePresetsModal({
  opened,
  onClose,
  playerCount,
  onContinue,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const [loadingId, setLoadingId] = useState<string>();
  const query = useQuery({
    queryKey: ["featuredDraftPresets"],
    queryFn: () => getFeaturedDraftPresets(),
    enabled: opened,
    staleTime: 60_000,
  });

  const all = query.data?.presets ?? [];
  const presets = filterFeaturedPresets(all, playerCount, showAll);

  const choose = async (id: string) => {
    if (loadingId) return;
    setLoadingId(id);
    const result = await loadPreset(id);
    setLoadingId(undefined);
    if (result.success) {
      onContinue(result.preset);
      return;
    }
    notify({
      tone: "danger",
      title: "Could not load preset",
      message: result.error,
    });
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Browse presets" size="xl">
      <Stack gap={4}>
        <div className={classes.toolbar}>
          <Text size="sm" tone="muted">
            Ready-made drafts picked by TI4 Lab. Choose one to open it in the
            draft builder, where you can review it before you create the draft.
          </Text>
          <Switch
            checked={showAll}
            onChange={setShowAll}
            label="All player counts"
            className={classes.toggle}
          />
        </div>

        {query.isPending ? (
          <div className={classes.empty}>
            <Spinner />
          </div>
        ) : query.isError ? (
          <div className={classes.empty}>
            <Text weight={600}>Couldn't load presets. Try again later.</Text>
          </div>
        ) : presets.length === 0 ? (
          <div className={classes.empty}>
            <IconFile size={24} />
            <Text weight={600}>
              {all.length === 0
                ? "No presets yet"
                : `No presets for ${playerCount} players`}
            </Text>
            {all.length > 0 && !showAll && (
              <button
                type="button"
                className={classes.link}
                onClick={() => setShowAll(true)}
              >
                Show all {all.length} presets
              </button>
            )}
          </div>
        ) : (
          <ul className={classes.grid}>
            {presets.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  className={classes.card}
                  onClick={() => choose(preset.id)}
                  disabled={!!loadingId}
                  aria-busy={loadingId === preset.id}
                >
                  <span className={classes.preview}>
                    <img
                      src={`/draft-preset/${preset.id}.png`}
                      alt=""
                      loading="lazy"
                    />
                    {loadingId === preset.id && (
                      <span className={classes.loading}>
                        <Spinner />
                      </span>
                    )}
                  </span>
                  <span className={classes.body}>
                    <span className={classes.title}>{preset.title}</span>
                    {preset.description && (
                      <span className={classes.description}>
                        {preset.description}
                      </span>
                    )}
                    <span className={classes.tags}>
                      <Tag icon={<IconUsers size={11} />}>
                        {preset.playerCount} players
                      </Tag>
                      <Tag>{draftFormatLabel(preset.draftType, preset.gameMode)}</Tag>
                      <Tag tone={preset.keepFactions ? "neutral" : "ion"}>
                        {preset.keepFactions
                          ? "Factions fixed"
                          : "Factions re-rolled"}
                      </Tag>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Stack>
    </Modal>
  );
}
