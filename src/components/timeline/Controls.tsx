"use client";

import { ChevronLeft, ChevronRight, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { Mode } from "@/timeline/scale";
import { IconButton } from "@/components/ui";

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

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; title?: string; disabled?: boolean }[]; onChange: (value: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          title={option.title}
          onClick={() => onChange(option.value)}
          className={`h-7 rounded-md px-2.5 text-[12.5px] font-medium transition-colors ${value === option.value ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

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
        <IconButton label="Zoom out" onClick={() => onZoom(2)} disabled={!zoomed}>
          <ZoomOut size={16} />
        </IconButton>
        <IconButton label="Move earlier" onClick={() => onPan(-0.5)} disabled={!zoomed}>
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton label="Move later" onClick={() => onPan(0.5)} disabled={!zoomed}>
          <ChevronRight size={16} />
        </IconButton>
        <IconButton label="Show all of the run" onClick={onReset} disabled={!zoomed}>
          <Maximize2 size={15} />
        </IconButton>
        {onZoomToSelection ? (
          <button type="button" onClick={onZoomToSelection} className="ml-1 h-8 rounded-lg px-2.5 text-[12.5px] font-medium text-accent hover:bg-surface-2">
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
