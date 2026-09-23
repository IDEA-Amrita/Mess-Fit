import type { Citation } from "@/lib/chat-api";

export interface Msg {
  /** Stable client-side id (list keys, retry targets). */
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  /**
   * user:      "failed"      — the send never produced an answer.
   * assistant: "interrupted" — the stream dropped mid-answer (text is partial).
   *            "stopped"     — the user pressed Stop (text is partial).
   */
  status?: "failed" | "interrupted" | "stopped";
  /** Human-readable reason, shown next to a failed/interrupted message. */
  error?: string;
}

let seq = 0;
export const newMsgId = () => `m${++seq}`;
