import { BookOpen, GitBranch, Hourglass, Layers, ListChecks, MessageSquare, MessageSquareText, Plug, ShieldCheck, Sparkles, Workflow, Bot } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SourceName, SpanKind } from "@/trace/schema";

// The small picture beside a span's name. Colour says what kind of time a bar
// is; the picture says what kind of thing it is, so neither carries it alone.

export const KIND_ICONS: Record<SpanKind, LucideIcon> = {
  understand: BookOpen,
  plan: ListChecks,
  step: Layers,
  tool: Plug,
  model: Sparkles,
  wait: Hourglass,
  check: ShieldCheck,
  said: MessageSquare,
};

export const SOURCE_ICONS: Record<SourceName, LucideIcon> = {
  sayso: MessageSquareText,
  flowboard: Workflow,
  "agent-desk": Bot,
  "github-bot": GitBranch,
};
