import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type SyntheticEvent } from "react";
import { Popover, Text } from "~/ui";
import type { RulesEntry } from "~/data/tileRules";

const OPEN_DELAY = 120;
const CLOSE_DELAY = 80;

const stop = (e: SyntheticEvent) => e.stopPropagation();

/**
 * Open/close state for a rules popover. Desktop: hover the marker (mouse only,
 * so a tap never opens it by "hover"). Mobile/desktop: press the marker to
 * toggle; press outside to close.
 */
export function useRulesPopover() {
  const [open, setOpen] = useState(false);
  const hovering = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const schedule = (next: boolean, delay: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(next), delay);
  };

  const hoverProps = {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      hovering.current = true;
      schedule(true, OPEN_DELAY);
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      hovering.current = false;
      schedule(false, CLOSE_DELAY);
    },
  };

  const onOpenChange = (next: boolean, details: { reason: string }) => {
    // Clicking the marker while the mouse already opened it by hover keeps it open.
    if (!next && hovering.current && details.reason === "trigger-press") return;
    clearTimeout(timer.current);
    setOpen(next);
  };

  return { open, onOpenChange, hoverProps };
}

type Props = {
  entry: RulesEntry;
  /** The tappable marker (legendary icon, station icon, anomaly badge). */
  marker: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean, details: { reason: string }) => void;
  markerStyle?: CSSProperties;
  markerProps?: Record<string, unknown>;
};

/** Small text popover with a rules reminder, opened from a marker icon. */
export function RulesPopover({ entry, marker, open, onOpenChange, markerStyle, markerProps }: Props) {
  return (
    <Popover
      opened={open}
      onOpenChange={onOpenChange}
      side="top"
      width={290}
      title={entry.title}
      trigger={
        <span
          role="button"
          tabIndex={0}
          aria-label={`Rules: ${entry.title}`}
          // Keep marker presses from reaching the tile / slice / drag handlers underneath.
          onClick={stop}
          onPointerDown={stop}
          onMouseDown={stop}
          onMouseUp={stop}
          onPointerUp={stop}
          onTouchStart={stop}
          onKeyDown={stop}
          style={{ display: "inline-flex", cursor: "help", lineHeight: 0, ...markerStyle }}
          {...markerProps}
        >
          {marker}
        </span>
      }
    >
      {/* The popup is portalled, but React still bubbles its events to the tile; stop them here. */}
      <div role="presentation" onClick={stop} onKeyDown={stop} onPointerDown={stop} onMouseDown={stop} onMouseUp={stop} onPointerUp={stop} onTouchStart={stop} style={{ display: "grid", gap: 6 }}>
        {entry.meta && (
          <Text size="xs" tone="muted">
            {entry.meta}
          </Text>
        )}
        {entry.lines.map((line, i) => (
          <Text key={i} size="sm">
            {line}
          </Text>
        ))}
      </div>
    </Popover>
  );
}
