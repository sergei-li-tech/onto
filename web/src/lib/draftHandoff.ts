export type DraftTurn = {
  user: string;
  assistant: string;
  brief: string;
};

const DRAFT_HISTORY_LIMIT = 6;

export function draftHistory(
  lines: { role: "user" | "assistant"; text: string; brief?: string }[],
): DraftTurn[] {
  const turns: DraftTurn[] = [];
  let pendingUser: string | null = null;
  for (const line of lines) {
    if (line.role === "user") {
      const text = line.text.trim();
      pendingUser = text || null;
      continue;
    }
    if (!pendingUser) continue;
    const assistant = line.text.trim();
    if (assistant) {
      turns.push({
        user: pendingUser,
        assistant,
        brief: (line.brief ?? "").trim(),
      });
    }
    pendingUser = null;
  }
  return turns.slice(-DRAFT_HISTORY_LIMIT);
}

export function takeDraftReply(res: {
  assistant_message: string;
  brief?: string;
  operations?: unknown[];
}): { text: string; brief: string } {
  return {
    text: res.assistant_message,
    brief: typeof res.brief === "string" ? res.brief.trim() : "",
  };
}

export function composeSchemaInput(current: string, brief: string): string {
  const next = brief.trim();
  if (!next) return current;
  const prev = current.trim();
  return prev ? `${prev}\n${next}` : next;
}
