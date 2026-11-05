"use client";

import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { parseUtterance, type ControlMessage, type UtteranceMessage } from "./schemas";
import type { FetchSince, RealtimeTransport, TransportStatus } from "./types";

const PAGE = 1000;
export const TRANSCRIPT_TTL_MS = 24 * 60 * 60 * 1000;

const utterancesOf = (db: Firestore, lessonId: string) => collection(db, "lessons", lessonId, "utterances");

/**
 * Live channel on Firestore. The teacher's write of each sentence (persistUtterance) is the
 * broadcast: students get it through a real-time listener, authorized by firestore.rules
 * (owner and members read). "Lesson ended" comes from the lesson document's status.
 */
export class FirestoreTransport implements RealtimeTransport {
  private _status: TransportStatus = "connecting";
  private statusHandlers = new Set<(s: TransportStatus) => void>();
  private msgHandlers = new Set<(m: UtteranceMessage) => void>();
  private controlHandlers = new Set<(m: ControlMessage) => void>();
  private unsubs: Unsubscribe[] = [];
  private ended = false;
  private closed = false;
  private readonly onOffline = () => this.setStatus("disconnected");

  constructor(
    private readonly db: Firestore,
    private readonly lessonId: string,
    /** Students listen to sentences; the teacher only needs the connection status. */
    opts: { listenUtterances: boolean },
  ) {
    window.addEventListener("offline", this.onOffline);
    this.unsubs.push(
      onSnapshot(
        doc(db, "lessons", lessonId),
        { includeMetadataChanges: true },
        (snap) => {
          this.setStatus(snap.metadata.fromCache ? "disconnected" : "connected");
          if (snap.data()?.status === "encerrada" && !this.ended) {
            this.ended = true;
            for (const h of this.controlHandlers) h({ type: "lesson_ended", at: Date.now() });
          }
        },
        () => this.setStatus("error"),
      ),
    );
    if (opts.listenUtterances) {
      this.unsubs.push(
        onSnapshot(
          query(utterancesOf(db, lessonId), orderBy("seq")),
          (snap) => {
            for (const change of snap.docChanges()) {
              if (change.type !== "added") continue;
              const msg = docToMessage(change.doc);
              if (msg) for (const h of this.msgHandlers) h(msg);
            }
          },
          () => this.setStatus("error"),
        ),
      );
    }
  }

  get status() {
    return this._status;
  }

  /** Only transitions are reported, so "connected" means "(re)connected just now". */
  private setStatus(s: TransportStatus) {
    if (this.closed || this._status === s) return;
    this._status = s;
    for (const h of this.statusHandlers) h(s);
  }

  /** No-op: persistUtterance already wrote the sentence, which is what students receive. */
  async publish(msg: UtteranceMessage): Promise<void> {
    void msg;
  }

  subscribe(handler: (msg: UtteranceMessage) => void): () => void {
    this.msgHandlers.add(handler);
    return () => this.msgHandlers.delete(handler);
  }

  onStatus(handler: (s: TransportStatus) => void): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /** No-op: the API sets status "encerrada" and every listener sees it. */
  async publishControl(msg: ControlMessage): Promise<void> {
    void msg;
  }

  onControl(handler: (msg: ControlMessage) => void): () => void {
    this.controlHandlers.add(handler);
    return () => this.controlHandlers.delete(handler);
  }

  close(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    window.removeEventListener("offline", this.onOffline);
    this.msgHandlers.clear();
    this.controlHandlers.clear();
    this.setStatus("disconnected");
    this.closed = true;
    this.statusHandlers.clear();
  }
}

export function docToMessage(d: QueryDocumentSnapshot<DocumentData>): UtteranceMessage | null {
  const r = d.data({ serverTimestamps: "estimate" });
  const created = r.created_at instanceof Timestamp ? r.created_at.toMillis() : Date.now();
  return parseUtterance({
    seq: r.seq,
    text: r.text,
    ...(r.text_es ? { es: r.text_es } : {}),
    terms: r.terms,
    wpm: r.wpm,
    sentAt: created,
  });
}

/** Every sentence with seq > afterSeq, in order, page by page. */
export function utteranceFetcher(db: Firestore, lessonId: string): FetchSince {
  return async (afterSeq) => {
    const out: UtteranceMessage[] = [];
    let cursor = afterSeq;
    for (;;) {
      const snap = await getDocs(
        query(utterancesOf(db, lessonId), where("seq", ">", cursor), orderBy("seq"), limit(PAGE)),
      );
      for (const d of snap.docs) {
        const msg = docToMessage(d);
        if (msg) out.push(msg);
      }
      if (snap.size < PAGE) return out;
      cursor = snap.docs[snap.docs.length - 1].data().seq as number;
    }
  };
}

/** Highest stored seq: a reloaded teacher page continues numbering from here. */
export async function maxSeq(db: Firestore, lessonId: string): Promise<number> {
  const snap = await getDocs(query(utterancesOf(db, lessonId), orderBy("seq", "desc"), limit(1)));
  return (snap.docs[0]?.data().seq as number | undefined) ?? 0;
}

/** Stores one sentence under its seq; "duplicate" if that seq is taken (second tab). */
export async function persistUtterance(
  db: Firestore,
  lessonId: string,
  msg: UtteranceMessage,
): Promise<"ok" | "duplicate"> {
  const ref = doc(utterancesOf(db, lessonId), String(msg.seq));
  return runTransaction(db, async (tx) => {
    if ((await tx.get(ref)).exists()) return "duplicate";
    tx.set(ref, {
      seq: msg.seq,
      text: msg.text,
      ...(msg.es ? { text_es: msg.es } : {}),
      terms: msg.terms,
      wpm: msg.wpm,
      created_at: serverTimestamp(),
      // POST /cron/purge deletes the sentence after this moment.
      expires_at: Timestamp.fromMillis(Date.now() + TRANSCRIPT_TTL_MS),
    });
    return "ok" as const;
  });
}
