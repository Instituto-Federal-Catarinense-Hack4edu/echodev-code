"""Load test of the live captions on Firestore: N real-time listeners on one lesson and a
writer adding one sentence every INTERVAL seconds. Reports p50/p95/max latency and losses.

Usage: npm run load:test -- [--clients 40] [--minutes 10] [--interval 2] [--emulators]
Uses the Admin SDK (listeners skip the security rules, which `npm run test:rules` covers).
Latency is measured on one machine (same clock). The throwaway lesson is deleted at the end.
"""

import argparse
import statistics
import threading
import time
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from _common import init, load_env
from google.cloud import firestore


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    k = max(0, min(len(ordered) - 1, round(p / 100 * (len(ordered) - 1))))
    return ordered[k]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--clients", type=int, default=40)
    parser.add_argument("--minutes", type=float, default=10)
    parser.add_argument("--interval", type=float, default=2)
    parser.add_argument("--emulators", action="store_true")
    args = parser.parse_args()

    db = init(load_env())
    lesson_id = str(uuid4())
    lesson = db.collection("lessons").document(lesson_id)
    lesson.set({"title": "Teste de carga", "status": "ao_vivo", "teacher_id": "load-test"})
    utterances = lesson.collection("utterances")

    received: list[dict[int, float]] = [{} for _ in range(args.clients)]
    lock = threading.Lock()
    watches = []
    for i in range(args.clients):

        def on_snapshot(_docs, changes, _read_time, box=received[i]):
            now = time.time() * 1000
            for change in changes:
                if change.type.name != "ADDED":
                    continue
                d = change.document.to_dict() or {}
                seq, sent = d.get("seq"), d.get("sentAt")
                if isinstance(seq, int) and isinstance(sent, (int, float)):
                    with lock:
                        box.setdefault(seq, now - sent)

        watches.append(utterances.on_snapshot(on_snapshot))

    total = int(args.minutes * 60 / args.interval)
    print(f"{args.clients} clientes, {total} frases (1 a cada {args.interval} s)…")
    try:
        for seq in range(1, total + 1):
            utterances.document(str(seq)).set(
                {
                    "seq": seq,
                    "text": f"frase de teste {seq}",
                    "terms": [],
                    "wpm": 120,
                    "sentAt": time.time() * 1000,
                    "created_at": firestore.SERVER_TIMESTAMP,
                    "expires_at": datetime.now(UTC) + timedelta(hours=24),
                }
            )
            time.sleep(args.interval)
        time.sleep(5)  # let the last sentences arrive
    finally:
        for w in watches:
            w.unsubscribe()
        db.recursive_delete(lesson)

    latencies = [ms for box in received for ms in box.values()]
    expected = total * args.clients
    lost = expected - len(latencies)
    print(f"Recebidas {len(latencies)}/{expected} (perdas: {lost}).")
    if latencies:
        print(
            f"Latência p50 {pct(latencies, 50):.0f} ms, p95 {pct(latencies, 95):.0f} ms, "
            f"média {statistics.mean(latencies):.0f} ms, máximo {max(latencies):.0f} ms."
        )


if __name__ == "__main__":
    main()
