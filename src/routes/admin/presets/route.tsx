import {
  Button,
  IconButton,
  Heading,
  NumberField,
  Segmented,
  Stack,
  Switch,
  Tag,
  Text,
  TextInput,
  Textarea,
  Modal,
  notify,
} from "~/ui";
import styles from "../maps/styles.module.css";
import own from "./styles.module.css";
import {
  IconEdit,
  IconSearch,
  IconStarFilled,
  IconTrash,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  getAdminDraftPresets,
  removeDraftPreset,
  setDraftPresetFeature,
} from "~/server/draftPresetsAdmin.functions";
import type { AdminDraftPresetListing } from "~/drizzle/draftPreset.server";
import {
  draftFormatLabel,
  FEATURED_DESCRIPTION_MAX_LENGTH,
  FEATURED_TITLE_MAX_LENGTH,
} from "~/utils/featuredPresets";

type View = "all" | "featured";

export const Route = createFileRoute("/admin/presets")({
  loader: () => getAdminDraftPresets(),
  head: () => ({ meta: [{ title: "Presets - Admin - TI4 Lab" }] }),
  component: AdminPresets,
});

function AdminPresets() {
  const { presets } = Route.useLoaderData();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("all");
  const [editing, setEditing] = useState<AdminDraftPresetListing>();
  const [deleting, setDeleting] = useState<AdminDraftPresetListing>();

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return presets.filter((preset) => {
      if (view === "featured" && !preset.featured) return false;
      if (!needle) return true;
      return (
        preset.name.toLowerCase().includes(needle) ||
        (preset.title ?? "").toLowerCase().includes(needle)
      );
    });
  }, [presets, search, view]);

  const featuredCount = presets.filter((preset) => preset.featured).length;

  return (
    <Stack gap={4}>
      <header>
        <Heading variant="title">Draft presets</Heading>
        <Text size="sm" tone="muted" className={styles.lede}>
          Featured presets are listed for everyone under “Browse presets” on
          the draft setup page, by ascending order. Other presets stay
          unlisted and load only by name.
        </Text>
      </header>

      <div className={styles.toolbar}>
        <TextInput
          placeholder="Search name or title"
          aria-label="Search name or title"
          leftIcon={<IconSearch size={14} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          className={styles.search}
        />
        <Segmented
          label="Filter presets"
          size="sm"
          value={view}
          onChange={(value) => setView(value as View)}
          options={[
            { label: "All", value: "all" },
            { label: `Featured (${featuredCount})`, value: "featured" },
          ]}
        />
        <Text size="sm" tone="muted" className={styles.showing}>
          {visible.length} of {presets.length}
        </Text>
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <IconSearch size={24} />
          <Text weight={600}>No presets match</Text>
        </div>
      ) : (
        <ul className={`${styles.list} ${own.list}`}>
          <li className={styles.headRow} aria-hidden>
            <span>Preset</span>
            <span className={styles.num}>Players</span>
            <span>Factions</span>
            <span className={styles.num}>Order</span>
            <span>Created</span>
            <span />
          </li>
          {visible.map((preset) => (
            <li key={preset.id} className={styles.row}>
              <div className={styles.mapCell}>
                <div className={styles.titleLine}>
                  <span className={own.name}>{preset.name}</span>
                  {preset.featured && (
                    <Tag tone="gold" icon={<IconStarFilled size={11} />}>
                      Featured
                    </Tag>
                  )}
                </div>
                <span className={styles.author}>
                  {draftFormatLabel(preset.draftType, preset.gameMode)}
                  {preset.hubUses > 0 &&
                    ` · in ${preset.hubUses} hub${preset.hubUses === 1 ? "" : "s"}`}
                </span>
                {preset.featured && (preset.title || preset.description) && (
                  <span className={styles.desc}>
                    {[preset.title, preset.description]
                      .filter(Boolean)
                      .join(" — ")}
                  </span>
                )}
              </div>
              <span className={styles.num} data-label="Players">
                {preset.playerCount}P
              </span>
              <span className={styles.date} data-label="Factions">
                {preset.keepFactions ? "Fixed" : "Random"}
              </span>
              <span className={styles.num} data-label="Order">
                {preset.featured ? preset.sortOrder : "–"}
              </span>
              <span className={styles.date} data-label="Created">
                {formatDate(preset.createdAt)}
              </span>
              <span className={own.actions}>
                <Button
                  size="sm"
                  icon={<IconEdit size={14} />}
                  onClick={() => setEditing(preset)}
                >
                  Feature
                </Button>
                <IconButton
                  size="sm"
                  variant="danger"
                  label={`Delete ${preset.name}`}
                  onClick={() => setDeleting(preset)}
                >
                  <IconTrash size={15} />
                </IconButton>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <FeatureModal preset={editing} onClose={() => setEditing(undefined)} />
      )}
      {deleting && (
        <DeleteModal preset={deleting} onClose={() => setDeleting(undefined)} />
      )}
    </Stack>
  );
}

function FeatureModal({
  preset,
  onClose,
}: {
  preset: AdminDraftPresetListing;
  onClose: () => void;
}) {
  const router = useRouter();
  const [featured, setFeatured] = useState(preset.featured);
  const [title, setTitle] = useState(preset.title ?? "");
  const [description, setDescription] = useState(preset.description ?? "");
  const [sortOrder, setSortOrder] = useState<number | null>(preset.sortOrder);

  const save = useMutation({
    mutationFn: () =>
      setDraftPresetFeature({
        data: {
          id: preset.id,
          featured,
          title,
          description,
          sortOrder: Math.round(sortOrder ?? 0),
        },
      }),
    onSuccess: async () => {
      await router.invalidate();
      onClose();
    },
    onError: (error) =>
      notify({
        tone: "danger",
        title: "Could not save",
        message: error instanceof Error ? error.message : String(error),
      }),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title={`Feature “${preset.name}”`}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </>
      }
    >
      <Stack gap={4}>
        <Switch
          checked={featured}
          onChange={setFeatured}
          label="Featured"
          description="List this preset publicly under Browse presets."
        />
        <TextInput
          label="Title"
          hint={`Shown on the card. Empty uses the preset name. Up to ${FEATURED_TITLE_MAX_LENGTH} characters.`}
          placeholder={preset.name}
          maxLength={FEATURED_TITLE_MAX_LENGTH}
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
        />
        <Textarea
          label="Short description"
          hint={`${description.length} / ${FEATURED_DESCRIPTION_MAX_LENGTH}`}
          maxLength={FEATURED_DESCRIPTION_MAX_LENGTH}
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
        <NumberField
          label="Order"
          hint="Lower numbers are listed first."
          value={sortOrder}
          onChange={setSortOrder}
          step={1}
          width={160}
        />
      </Stack>
    </Modal>
  );
}

function DeleteModal({
  preset,
  onClose,
}: {
  preset: AdminDraftPresetListing;
  onClose: () => void;
}) {
  const router = useRouter();
  const remove = useMutation({
    mutationFn: () => removeDraftPreset({ data: { id: preset.id } }),
    onSuccess: async (result) => {
      if (!result.ok) {
        notify({ tone: "danger", title: "Not deleted", message: result.error });
        return;
      }
      notify({ tone: "success", title: `Deleted “${preset.name}”` });
      await router.invalidate();
      onClose();
    },
    onError: (error) =>
      notify({
        tone: "danger",
        title: "Could not delete",
        message: error instanceof Error ? error.message : String(error),
      }),
  });

  return (
    <Modal
      opened
      onClose={onClose}
      title="Delete preset?"
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete
          </Button>
        </>
      }
    >
      <Text size="sm">
        “{preset.name}” will be deleted for good. Anyone using its name, here
        or with the Discord bot, won't be able to load it anymore.
      </Text>
    </Modal>
  );
}

function formatDate(value: string) {
  return new Date(value.replace(" ", "T") + "Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
