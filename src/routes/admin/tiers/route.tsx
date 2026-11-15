import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { IconRestore, IconSearch } from "@tabler/icons-react";
import {
  Button,
  Heading,
  Modal,
  Segmented,
  Stack,
  Text,
  TextInput,
  cx,
  notify,
} from "~/ui";
import { FactionIcon } from "~/components/icons/FactionIcon";
import { factions } from "~/data/factionData";
import { factionTiersQueryKey } from "~/hooks/useFactionTiers";
import {
  getAdminFactionTiers,
  resetFactionTiersToDefault,
  setFactionTiers,
} from "~/server/factionTiers.functions";
import {
  TIER_COLORS,
  TIERS,
  toStoredTierList,
  type FactionTierList,
  type Tier,
} from "~/utils/factionTiers";
import type { Faction, FactionId } from "~/types";
import mapStyles from "../maps/styles.module.css";
import classes from "./styles.module.css";

type Group = "core" | "ds" | "tf" | "all";

const GROUP_SETS: Record<Exclude<Group, "all">, Faction["set"][]> = {
  core: ["base", "pok", "te"],
  ds: ["discordant", "discordantexp", "drahn"],
  tf: ["twilightsFall"],
};

const SET_LABELS: Partial<Record<Faction["set"], string>> = {
  base: "Base",
  pok: "PoK",
  te: "Thunder's Edge",
  discordant: "Discordant Stars",
  discordantexp: "DS expansion",
  drahn: "Drahn",
  twilightsFall: "Twilight's Fall",
};

const allFactions = Object.values(factions);

export const Route = createFileRoute("/admin/tiers")({
  loader: () => getAdminFactionTiers(),
  head: () => ({ meta: [{ title: "Tier list - Admin - TI4 Lab" }] }),
  component: AdminTiers,
});

function AdminTiers() {
  const saved = Route.useLoaderData();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tiers, setTiers] = useState<FactionTierList>(saved.tiers);
  const [group, setGroup] = useState<Group>("core");
  const [search, setSearch] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const dirty = JSON.stringify(sortedEntries(tiers)) !==
    JSON.stringify(sortedEntries(saved.tiers));

  const afterSave = async () => {
    await router.invalidate();
    await queryClient.invalidateQueries({ queryKey: factionTiersQueryKey });
  };

  const save = useMutation({
    mutationFn: () => setFactionTiers({ data: { tiers: toStoredTierList(tiers) } }),
    onSuccess: async () => {
      notify({ tone: "success", title: "Tier list saved" });
      await afterSave();
    },
    onError: (error) =>
      notify({
        tone: "danger",
        title: "Could not save",
        message: error instanceof Error ? error.message : String(error),
      }),
  });

  const reset = useMutation({
    mutationFn: () => resetFactionTiersToDefault(),
    onSuccess: async () => {
      setConfirmReset(false);
      notify({ tone: "success", title: "Tier list reset to default" });
      await afterSave();
      const fresh = await getAdminFactionTiers();
      setTiers(fresh.tiers);
    },
    onError: (error) =>
      notify({
        tone: "danger",
        title: "Could not reset",
        message: error instanceof Error ? error.message : String(error),
      }),
  });

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return allFactions.filter((faction) => {
      if (group !== "all" && !GROUP_SETS[group].includes(faction.set)) {
        return false;
      }
      return !needle || faction.name.toLowerCase().includes(needle);
    });
  }, [group, search]);

  const setTier = (id: FactionId, tier: Tier | undefined) =>
    setTiers((current) => {
      const next = { ...current };
      if (tier) next[id] = tier;
      else delete next[id];
      return next;
    });

  const rankedCount = Object.keys(tiers).length;

  return (
    <Stack gap={4}>
      <header>
        <Heading variant="title">Faction tier list</Heading>
        <Text size="sm" tone="muted" className={mapStyles.lede}>
          One shared list. Drafts with “Show tier badges” on show the tier
          next to each faction’s name, running drafts included. Factions
          without a tier get no badge.
          {!saved.customized && " Currently using the built-in default."}
        </Text>
      </header>

      <section className={classes.board} aria-label="Tier list preview">
        {TIERS.map((tier) => {
          const ids = allFactions.filter((f) => tiers[f.id] === tier);
          return (
            <div key={tier} className={classes.boardRow}>
              <span
                className={classes.boardTier}
                style={{ background: TIER_COLORS[tier] }}
              >
                {tier}
              </span>
              <div className={classes.boardFactions}>
                {ids.length === 0 ? (
                  <span className={classes.boardEmpty}>No factions</span>
                ) : (
                  ids.map((f) => (
                    <span key={f.id} className={classes.chip} title={f.name}>
                      <FactionIcon
                        faction={f.id}
                        style={{ width: 18, height: 18, flexShrink: 0 }}
                      />
                      {f.name}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </section>

      <div className={classes.saveBar}>
        <Text size="sm" tone="muted">
          {dirty ? "Unsaved changes" : "All changes saved"} · {rankedCount}{" "}
          ranked
        </Text>
        <div className={classes.saveActions}>
          <Button
            size="sm"
            variant="tertiary"
            icon={<IconRestore size={14} />}
            onClick={() => setConfirmReset(true)}
          >
            Reset to default
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            disabled={!dirty}
            onClick={() => setTiers(saved.tiers)}
          >
            Discard
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={!dirty}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </div>
      </div>

      <div className={mapStyles.toolbar}>
        <TextInput
          placeholder="Search factions"
          aria-label="Search factions"
          leftIcon={<IconSearch size={14} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          className={mapStyles.search}
        />
        <Segmented
          label="Faction set"
          size="sm"
          value={group}
          onChange={(value) => setGroup(value as Group)}
          options={[
            { label: "Base · PoK · TE", value: "core" },
            { label: "Discordant", value: "ds" },
            { label: "Twilight's Fall", value: "tf" },
            { label: "All", value: "all" },
          ]}
        />
      </div>

      <ul className={classes.list}>
        {visible.map((faction) => (
          <li key={faction.id} className={classes.row}>
            <span className={classes.faction}>
              <FactionIcon
                faction={faction.id}
                style={{ width: 24, height: 24, flexShrink: 0 }}
              />
              <span className={classes.factionText}>
                <span className={classes.factionName}>{faction.name}</span>
                <span className={classes.factionSet}>
                  {SET_LABELS[faction.set] ?? faction.set}
                </span>
              </span>
            </span>
            <TierPicker
              factionName={faction.name}
              value={tiers[faction.id]}
              onChange={(tier) => setTier(faction.id, tier)}
            />
          </li>
        ))}
      </ul>

      {confirmReset && (
        <Modal
          opened
          onClose={() => setConfirmReset(false)}
          title="Reset tier list?"
          footer={
            <>
              <Button variant="tertiary" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={reset.isPending}
                onClick={() => reset.mutate()}
              >
                Reset
              </Button>
            </>
          }
        >
          <Text size="sm">
            The saved tier list is replaced by the built-in default, for every
            draft. Unsaved changes here are lost too.
          </Text>
        </Modal>
      )}
    </Stack>
  );
}

function TierPicker({
  factionName,
  value,
  onChange,
}: {
  factionName: string;
  value: Tier | undefined;
  onChange: (tier: Tier | undefined) => void;
}) {
  return (
    <div
      className={classes.picker}
      role="radiogroup"
      aria-label={`Tier for ${factionName}`}
    >
      {TIERS.map((tier) => (
        <button
          key={tier}
          type="button"
          role="radio"
          aria-checked={value === tier}
          className={cx(classes.pick, value === tier && classes.pickOn)}
          style={value === tier ? { background: TIER_COLORS[tier] } : undefined}
          onClick={() => onChange(tier)}
        >
          {tier}
        </button>
      ))}
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        aria-label="No tier"
        title="No tier"
        className={cx(classes.pick, classes.pickNone, !value && classes.pickNoneOn)}
        onClick={() => onChange(undefined)}
      >
        –
      </button>
    </div>
  );
}

function sortedEntries(list: FactionTierList) {
  return Object.entries(list).sort(([a], [b]) => a.localeCompare(b));
}
