import { apiFetch, ApiError } from "./api";
import { supabase } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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

/**
 * Send a message and stream the assistant reply. Calls `onToken` for each token
 * and `onDone` with the final citations. Uses fetch directly (not apiFetch) so we
 * can read the SSE body incrementally.
 */
export async function streamMessage(
  convId: string,
  content: string,
  handlers: { onToken: (t: string) => void; onDone: (citations: Citation[]) => void },
): Promise<void> {
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
  });
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail ?? res.statusText);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      const data = JSON.parse(line.slice(6));
      if (typeof data.token === "string") handlers.onToken(data.token);
      if (data.done) handlers.onDone(data.citations ?? []);
    }
  }
}
