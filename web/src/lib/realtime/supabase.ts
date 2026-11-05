"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPages } from "./paging";
import { parseControl, parseUtterance, type ControlMessage, type UtteranceMessage } from "./schemas";
import type { FetchSince, RealtimeTransport, TransportStatus } from "./types";

export const UTTERANCE_EVENT = "utterance";
export const CONTROL_EVENT = "control";
export const lessonTopic = (lessonId: string) => `lesson:${lessonId}`;

/**
 * Private Realtime Broadcast channel `lesson:<id>`, authorized by RLS on realtime.messages
 * (only the owner sends; owner and members receive). `self: false`: the teacher does
 * not get their own messages back.
 */
export class SupabaseTransport implements RealtimeTransport {
  private channel: RealtimeChannel | null = null;
  private _status: TransportStatus = "connecting";
  private statusHandlers = new Set<(s: TransportStatus) => void>();
  private msgHandlers = new Set<(m: UtteranceMessage) => void>();
  private controlHandlers = new Set<(m: ControlMessage) => void>();
  private closed = false;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly lessonId: string,
  ) {
    void this.connect();
  }

  get status() {
    return this._status;
  }

  private setStatus(s: TransportStatus) {
    if (this._status === s && s !== "connected") return;
    this._status = s;
    for (const h of this.statusHandlers) h(s);
  }

  private async connect() {
    await this.supabase.realtime.setAuth();
    if (this.closed) return;
    const channel = this.supabase.channel(lessonTopic(this.lessonId), {
      config: { private: true, broadcast: { self: false } },
    });
    channel.on("broadcast", { event: UTTERANCE_EVENT }, ({ payload }) => {
      const msg = parseUtterance(payload);
      if (msg) for (const h of this.msgHandlers) h(msg);
    });
    channel.on("broadcast", { event: CONTROL_EVENT }, ({ payload }) => {
      const msg = parseControl(payload);
      if (msg) for (const h of this.controlHandlers) h(msg);
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") this.setStatus("connected");
      else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") this.setStatus("error");
      else if (status === "CLOSED") this.setStatus("disconnected");
    });
    this.channel = channel;
  }

  async publish(msg: UtteranceMessage): Promise<void> {
    const ch = this.channel;
    if (!ch) throw new Error("channel not ready");
    const r = await ch.send({ type: "broadcast", event: UTTERANCE_EVENT, payload: msg });
    if (r !== "ok") throw new Error(`broadcast ${r}`);
  }

  subscribe(handler: (msg: UtteranceMessage) => void): () => void {
    this.msgHandlers.add(handler);
    return () => this.msgHandlers.delete(handler);
  }

  onStatus(handler: (s: TransportStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  async publishControl(msg: ControlMessage): Promise<void> {
    const ch = this.channel;
    if (!ch) throw new Error("channel not ready");
    const r = await ch.send({ type: "broadcast", event: CONTROL_EVENT, payload: msg });
    if (r !== "ok") throw new Error(`broadcast ${r}`);
  }

  onControl(handler: (msg: ControlMessage) => void): () => void {
    this.controlHandlers.add(handler);
    return () => this.controlHandlers.delete(handler);
  }

  close(): void {
    this.closed = true;
    const ch = this.channel;
    this.channel = null;
    if (ch) void this.supabase.removeChannel(ch);
    this.msgHandlers.clear();
    this.controlHandlers.clear();
    this.setStatus("disconnected");
    this.statusHandlers.clear();
  }
}

interface UtteranceRow {
  seq: number;
  text: string;
  text_es?: string | null;
  terms: unknown;
  wpm: number;
  created_at: string;
}

export function rowToMessage(r: UtteranceRow): UtteranceMessage | null {
  return parseUtterance({
    seq: r.seq,
    text: r.text,
    ...(r.text_es ? { es: r.text_es } : {}),
    terms: r.terms,
    wpm: r.wpm,
    sentAt: Date.parse(r.created_at),
  });
}

export function utteranceFetcher(supabase: SupabaseClient, lessonId: string): FetchSince {
  return async (afterSeq) => {
    const rows = await fetchAllPages<UtteranceRow>(async (from, to) => {
      const { data, error } = await supabase
        .from("utterances")
        .select("*")
        .eq("lesson_id", lessonId)
        .gt("seq", afterSeq)
        .order("seq", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as UtteranceRow[];
    });
    return rows.map(rowToMessage).filter((m): m is UtteranceMessage => m !== null);
  };
}

/** Highest stored seq: a reloaded teacher page continues numbering from here. */
export async function maxSeq(supabase: SupabaseClient, lessonId: string): Promise<number> {
  const { data, error } = await supabase
    .from("utterances")
    .select("seq")
    .eq("lesson_id", lessonId)
    .order("seq", { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.seq as number | undefined) ?? 0;
}

export async function persistUtterance(
  supabase: SupabaseClient,
  lessonId: string,
  msg: UtteranceMessage,
): Promise<"ok" | "duplicate"> {
  const row: Record<string, unknown> = {
    lesson_id: lessonId,
    seq: msg.seq,
    text: msg.text,
    terms: msg.terms,
    wpm: msg.wpm,
  };
  let { error } = await supabase.from("utterances").insert(msg.es ? { ...row, text_es: msg.es } : row);
  // Database without the translation column yet: keep the Portuguese sentence.
  if (error?.code === "PGRST204" && msg.es) ({ error } = await supabase.from("utterances").insert(row));
  if (!error) return "ok";
  if (error.code === "23505") return "duplicate";
  throw new Error(error.message);
}
