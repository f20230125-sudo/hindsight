"use client";

import { ChevronLeft, ChevronRight, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { Segmented } from "@/components/Segmented";
import { IconButton } from "@/components/ui";
import type { Mode } from "@/timeline/scale";

// What can be changed about how a run is drawn: the clock it is drawn by, how
// much of it is on show, and whether it is a timeline or a table.

type Props = {
  mode: Mode;
  onMode: (mode: Mode) => void;
  /** Whether the run has any wait for a person, which is all that agent time changes. */
  hasWaits: boolean;
  zoomed: boolean;
  onZoom: (factor: number) => void;
  onPan: (fraction: number) => void;
  onReset: () => void;
  /** Zoom to the span that is chosen, when one is. */
  onZoomToSelection: (() => void) | null;
  shape: "timeline" | "table";
  onShape: (shape: "timeline" | "table") => void;
};

// A button that has nothing to do right now is dimmed and marked aria-disabled, but it is not
// disabled: a disabled button cannot be focused, so a key that had just put the run back to
// the whole of it ("Show all") would leave the keyboard with nowhere to be. It stays where it
// is, and pressing it does nothing.
const NOTHING = () => {};

export function Controls({ mode, onMode, hasWaits, zoomed, onZoom, onPan, onReset, onZoomToSelection, shape, onShape }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="toolbar" aria-label="How the run is drawn">
      <Segmented
        label="Clock"
        value={mode}
        onChange={onMode}
        options={[
          { value: "real", label: "Real time", title: "Time passes at the same rate all the way along" },
          {
            value: "agent",
            label: "Agent time",
            title: hasWaits ? "Each wait for a person is squeezed, so what the app did fills the picture" : "This run has no wait for a person, so it looks the same",
          },
        ]}
      />
      <div role="group" aria-label="How much of the run is shown" className="flex items-center gap-0.5">
        <IconButton label="Zoom in" onClick={() => onZoom(0.5)}>
          <ZoomIn size={16} />
        </IconButton>
        <IconButton label="Zoom out" onClick={zoomed ? () => onZoom(2) : NOTHING} aria-disabled={!zoomed}>
          <ZoomOut size={16} />
        </IconButton>
        <IconButton label="Move earlier" onClick={zoomed ? () => onPan(-0.5) : NOTHING} aria-disabled={!zoomed}>
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton label="Move later" onClick={zoomed ? () => onPan(0.5) : NOTHING} aria-disabled={!zoomed}>
          <ChevronRight size={16} />
        </IconButton>
        <IconButton label="Show all of the run" onClick={zoomed ? onReset : NOTHING} aria-disabled={!zoomed}>
          <Maximize2 size={15} />
        </IconButton>
        {onZoomToSelection ? (
          <button
            type="button"
            onClick={onZoomToSelection}
            className="ml-1 h-10 rounded-control px-2.5 text-[12.5px] font-medium text-ink underline underline-offset-2 transition-colors duration-150 hover:bg-paper-2 sm:h-8"
          >
            Zoom to the chosen one
          </button>
        ) : null}
      </div>
      <div className="ml-auto">
        <Segmented
          label="Show as"
          value={shape}
          onChange={onShape}
          options={[
            { value: "timeline", label: "Timeline" },
            { value: "table", label: "Table", title: "The same run as a list, with every time written out" },
          ]}
        />
      </div>
    </div>
  );
}
