import { apiFetch, ApiError } from "./api";
import { supabase } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** Server-side limit on a single message (MessageIn.content max_length). */
export const MAX_MESSAGE_LENGTH = 2000;

export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  chunk_id: string;
  source: string | null;
  title: string | null;
  slug?: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  created_at: string;
}

export async function createConversation(): Promise<Conversation> {
  return apiFetch<Conversation>("/api/v1/chat/conversations", { method: "POST" });
}

export async function listConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>("/api/v1/chat/conversations");
}

export async function getMessages(convId: string): Promise<ChatMessage[]> {
  return apiFetch<ChatMessage[]>(`/api/v1/chat/conversations/${convId}/messages`);
}

export async function renameConversation(convId: string, title: string): Promise<Conversation> {
  return apiFetch<Conversation>(`/api/v1/chat/conversations/${convId}/title`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

/**
 * Turn any error from the chat endpoints into a sentence a user can act on.
 * FastAPI validation errors put an array in `detail`, and the rate limiter
 * returns no `detail` at all — neither is fit to show verbatim.
 */
export function describeChatError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "You're sending messages too quickly. Wait a moment and try again.";
    if (err.status === 422) return "That message couldn't be sent. Try shortening or rewording it.";
    if (err.status === 401) return "Your session expired. Please sign in again.";
    if (typeof err.detail === "string" && err.detail) return err.detail;
  }
  return "Something went wrong. Please try again.";
}

/**
 * Send a message and stream the assistant reply. Calls `onToken` for each token
 * and `onDone` with the final citations. Uses fetch directly (not apiFetch) so we
 * can read the SSE body incrementally.
 *
 * Resolves `true` only if the server's final `done` event arrived. A stream that
 * just ends (dropped connection, server error mid-generation) resolves `false`
 * so the caller can tell a complete answer from a truncated one. Pass `signal`
 * to support "Stop generating"; aborting rejects with an AbortError.
 */
export async function streamMessage(
  convId: string,
  content: string,
  handlers: { onToken: (t: string) => void; onDone: (citations: Citation[]) => void },
  signal?: AbortSignal,
): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new ApiError(401, "Not authenticated");

  const res = await fetch(`${BASE}/api/v1/chat/conversations/${convId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ content }),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }

  let completed = false;
  const handleEvent = (raw: string) => {
    const line = raw.trim();
    if (!line.startsWith("data: ")) return;
    let data: { token?: unknown; done?: unknown; citations?: Citation[] };
    try {
      data = JSON.parse(line.slice(6));
    } catch {
      return; // a malformed/partial event must not kill the whole stream
    }
    if (typeof data.token === "string") handlers.onToken(data.token);
    if (data.done) {
      completed = true;
      handlers.onDone(data.citations ?? []);
    }
  };

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) handleEvent(part);
  }
  // Flush the decoder and any final event that lacked a trailing blank line.
  buffer += decoder.decode();
  if (buffer.trim()) handleEvent(buffer);

  return completed;
}
