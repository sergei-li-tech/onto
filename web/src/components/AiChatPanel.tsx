import { useEffect, useRef, useState } from "react";
import type { Entity, Ontology } from "../types";
import { applyOperations } from "../lib/applyOperations";
import { AiChatError, sendOntologyChat, type ChatScope } from "../lib/aiChat";
import { composeSchemaInput, draftHistory, takeDraftReply } from "../lib/draftHandoff";
import { operationsInEntityScope } from "../lib/entityScope";
import { pruneUnrequestedEntityAttributes } from "../lib/pruneEntityAttributes";
import {
  operationsInRelationshipScope,
  relationshipIdAfterApply,
} from "../lib/relationshipScope";
import { validateOntology } from "../lib/validate";
import { formatValidationIssues } from "../lib/validationMessages";
import { getLang, useT } from "../i18n";
import { useOntologyStore } from "../store";
import { InfoTip } from "./InfoTip";

type ChatLine = { role: "user" | "assistant"; text: string; brief?: string };

type Pending = {
  assistant_message: string;
  operations: unknown[];
};

type Thread = {
  input: string;
  lines: ChatLine[];
  pending: Pending | null;
  loading: boolean;
  error: string | null;
  expandNonce: number;
};

const EMPTY_THREAD: Thread = {
  input: "",
  lines: [],
  pending: null,
  loading: false,
  error: null,
  expandNonce: 0,
};

const threads = new Map<string, Thread>();
const threadListeners = new Set<() => void>();

function readThread(key: string): Thread {
  return threads.get(key) ?? EMPTY_THREAD;
}

function writeThread(key: string, updater: (thread: Thread) => Thread) {
  const prev = threads.get(key) ?? EMPTY_THREAD;
  threads.set(key, updater(prev));
  threadListeners.forEach((listener) => listener());
}

function retargetThread(fromKey: string, toKey: string) {
  if (fromKey === toKey) return;
  const thread = threads.get(fromKey);
  if (!thread) return;
  threads.delete(fromKey);
  threads.set(toKey, thread);
  threadListeners.forEach((listener) => listener());
}

function useThread(key: string): Thread {
  const [, bump] = useState(0);
  useEffect(() => {
    const listener = () => bump((n) => n + 1);
    threadListeners.add(listener);
    return () => {
      threadListeners.delete(listener);
    };
  }, []);
  return readThread(key);
}

type AssistantProps = {
  doc: Ontology;
  scope: ChatScope;
  threadKey: string;
  entityId: string | null;
  relationshipId: string | null;
  title: string;
  hint: string;
  example: string;
  placeholder: string;
  variant: "column" | "card";
  initiallyOpen?: boolean;
  extraClass?: string;
};

function AssistantChat({
  doc,
  scope,
  threadKey,
  entityId,
  relationshipId,
  title,
  hint,
  example,
  placeholder,
  variant,
  initiallyOpen,
  extraClass,
}: AssistantProps) {
  const patchDoc = useOntologyStore((s) => s.patchDoc);
  const setSelection = useOntologyStore((s) => s.setSelection);
  const t = useT();
  const thread = useThread(threadKey);
  const [open, setOpen] = useState(initiallyOpen ?? false);
  const seenExpand = useRef(0);
  const [billingOk, setBillingOk] = useState(false);

  useEffect(() => {
    setBillingOk(sessionStorage.getItem("onto-ai-billing-ok") === "1");
  }, []);

  useEffect(() => {
    if (thread.expandNonce !== seenExpand.current) {
      seenExpand.current = thread.expandNonce;
      if (thread.expandNonce > 0) setOpen(true);
    }
  }, [thread.expandNonce]);

  async function onSend() {
    const text = thread.input.trim();
    if (!text || thread.loading) return;
    if (scope === "entity" && !entityId) return;
    if (scope === "relationship" && !relationshipId) return;

    if (!billingOk) {
      const ok = window.confirm(t("ai.billingConfirm"));
      if (!ok) return;
      sessionStorage.setItem("onto-ai-billing-ok", "1");
      setBillingOk(true);
    }

    const history = scope === "draft" ? draftHistory(thread.lines) : [];
    const key = threadKey;
    writeThread(key, (current) => ({
      ...current,
      input: "",
      error: null,
      pending: null,
      loading: true,
      lines: [...current.lines, { role: "user", text }],
    }));

    try {
      const res = await sendOntologyChat(
        text,
        doc,
        scope,
        entityId,
        history,
        relationshipId,
        getLang(),
      );
      if (scope === "draft") {
        const draft = takeDraftReply(res);
        writeThread(key, (current) => ({
          ...current,
          loading: false,
          pending: null,
          lines: [...current.lines, { role: "assistant", text: draft.text, brief: draft.brief }],
        }));
        return;
      }
      let operations = res.operations;
      let message = res.assistant_message;
      if (scope === "global") {
        const pruned = pruneUnrequestedEntityAttributes(text, operations);
        if (JSON.stringify(pruned) !== JSON.stringify(operations)) {
          message = `${message}\n\n${t("ai.noteUnrequestedAttributes")}`;
        }
        operations = pruned;
      }
      if (scope === "entity" && entityId) {
        const kept = operationsInEntityScope(doc, entityId, operations);
        if (kept.length < operations.length) {
          message = `${message}\n\n${t("ai.noteEntityScope")}`;
        }
        operations = kept;
      }
      if (scope === "relationship" && relationshipId) {
        const kept = operationsInRelationshipScope(relationshipId, operations);
        if (JSON.stringify(kept) !== JSON.stringify(operations)) {
          message = `${message}\n\n${t("ai.noteRelationshipScope")}`;
        }
        operations = kept;
      }
      writeThread(key, (current) => ({
        ...current,
        loading: false,
        lines: [...current.lines, { role: "assistant", text: message }],
        pending: operations.length > 0 ? { assistant_message: message, operations } : null,
      }));
    } catch (e) {
      const status = e instanceof AiChatError ? e.status : null;
      const message =
        status === null
          ? t("ai.errorNetwork")
          : status === 503
            ? t("ai.errorApiKey")
            : status === 400
              ? t("ai.errorBadRequest")
              : t("ai.errorHttp", { status });
      writeThread(key, (current) => ({
        ...current,
        loading: false,
        error: message,
      }));
    }
  }

  function applyPending() {
    if (!thread.pending) return;
    const operations =
      scope === "entity" && entityId
        ? operationsInEntityScope(doc, entityId, thread.pending.operations)
        : scope === "relationship" && relationshipId
          ? operationsInRelationshipScope(relationshipId, thread.pending.operations)
          : thread.pending.operations;
    const next = applyOperations(doc, operations);
    const errors = validateOntology(next);
    if (errors.length > 0) {
      writeThread(threadKey, (current) => ({
        ...current,
        error: formatValidationIssues(errors, t).slice(0, 5).join("\n"),
      }));
      return;
    }
    const nextRelId =
      scope === "relationship" && relationshipId
        ? relationshipIdAfterApply(doc, next, relationshipId, operations)
        : null;
    const nextKey =
      nextRelId && nextRelId !== relationshipId ? `relationship:${nextRelId}` : threadKey;
    writeThread(threadKey, (current) => ({ ...current, pending: null, error: null }));
    if (nextKey !== threadKey) retargetThread(threadKey, nextKey);
    patchDoc(() => next);
    if (nextRelId && nextRelId !== relationshipId) {
      setSelection({ kind: "relationship", id: nextRelId });
    }
  }

  function handoffBrief(brief: string) {
    writeThread("global", (current) => ({
      ...current,
      input: composeSchemaInput(current.input, brief),
      expandNonce: current.expandNonce + 1,
    }));
  }

  const rootClass = [
    "ai-chat",
    "tech-only",
    variant === "card" ? "ai-chat-card" : "",
    extraClass ?? "",
    open ? "" : "ai-chat-collapsed",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={rootClass}>
      <header className="ai-chat-header">
        <button type="button" className="ai-chat-toggle" onClick={() => setOpen(!open)}>
          {open ? "▾" : "▸"} {title}
        </button>
        <InfoTip text={`${hint} ${example}`} />
      </header>
      {open && (
        <div className="ai-chat-body">
          <div className="ai-chat-log">
            {thread.lines.map((line, i) => (
              <div key={i} className={`ai-chat-line ai-chat-${line.role}`}>
                {line.text}
                {line.brief ? (
                  <div className="draft-brief">
                    <div className="draft-brief-text">{line.brief}</div>
                    <button type="button" onClick={() => handoffBrief(line.brief ?? "")}>
                      {t("ai.sendToSchema")}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {thread.pending && (
            <div className="ai-chat-pending">
              <strong>{t("ai.pendingChanges")}</strong>
              <div className="ai-chat-pending-actions">
                <button type="button" className="primary" onClick={applyPending}>
                  {t("ai.apply")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    writeThread(threadKey, (current) => ({ ...current, pending: null }))
                  }
                >
                  {t("ai.discard")}
                </button>
              </div>
            </div>
          )}
          {thread.error && <div className="errors ai-chat-error">{thread.error}</div>}
          <div className="ai-chat-input-row">
            <textarea
              rows={2}
              placeholder={placeholder}
              value={thread.input}
              disabled={thread.loading}
              onChange={(e) =>
                writeThread(threadKey, (current) => ({ ...current, input: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
            />
            <button
              type="button"
              disabled={thread.loading || !thread.input.trim()}
              onClick={() => void onSend()}
            >
              {thread.loading ? "…" : t("ai.send")}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

export function DraftAssistant({ doc }: { doc: Ontology }) {
  const t = useT();
  return (
    <AssistantChat
      doc={doc}
      scope="draft"
      threadKey="draft"
      entityId={null}
      relationshipId={null}
      title={t("ai.draft")}
      hint={t("ai.draftHint")}
      example={t("ai.draftExample")}
      placeholder={t("ai.draftPlaceholder")}
      variant="column"
      initiallyOpen={false}
      extraClass="draft-chat"
    />
  );
}

export function AiChatPanel({ doc }: { doc: Ontology }) {
  const t = useT();
  return (
    <AssistantChat
      doc={doc}
      scope="global"
      threadKey="global"
      entityId={null}
      relationshipId={null}
      title={t("ai.schema")}
      hint={t("ai.schemaHint")}
      example={t("ai.schemaExample")}
      placeholder={t("ai.schemaPlaceholder")}
      variant="column"
      initiallyOpen={false}
    />
  );
}

export function EntityAssistant({ doc, entity }: { doc: Ontology; entity: Entity }) {
  const t = useT();
  return (
    <AssistantChat
      doc={doc}
      scope="entity"
      threadKey={`entity:${entity.id}`}
      entityId={entity.id}
      relationshipId={null}
      title={t("ai.entityTitle", { name: entity.name })}
      hint={t("ai.entityHint", { name: entity.name })}
      example={t("ai.entityExample")}
      placeholder={t("ai.entityPlaceholder", { name: entity.name })}
      variant="card"
      initiallyOpen={false}
    />
  );
}

export function RelationshipAssistant({
  doc,
  relationshipId,
  name,
  fromName,
  toName,
}: {
  doc: Ontology;
  relationshipId: string;
  name: string;
  fromName: string;
  toName: string;
}) {
  const t = useT();
  return (
    <AssistantChat
      doc={doc}
      scope="relationship"
      threadKey={`relationship:${relationshipId}`}
      entityId={null}
      relationshipId={relationshipId}
      title={t("ai.relationshipTitle", { name })}
      hint={t("ai.relationshipHint", { from: fromName, to: toName })}
      example={t("ai.relationshipExample")}
      placeholder={t("ai.relationshipPlaceholder", { name })}
      variant="card"
      initiallyOpen={false}
    />
  );
}
