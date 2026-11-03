"""Load test of the live caption channel: N subscribers on a private lesson channel and the
teacher publishing one sentence every INTERVAL seconds. Reports p50/p95/max latency and losses.

Usage: npm run load:test -- [--clients 40] [--minutes 10] [--interval 2]
Needs `npm run seed:dev` (uses the test teacher and the 8 test students; 40 clients reuse
the 8 accounts, 5 connections each). Latency is measured on one machine (same clock).
"""

import argparse
import asyncio
import secrets
import statistics
import sys
import time

import httpx
from _common import STUDENT_EMAILS, TEACHER_EMAIL_DEFAULT, load_env, sign_in, user_headers
from realtime import AsyncRealtimeClient, RealtimeSubscribeStates

ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    k = max(0, min(len(ordered) - 1, round(p / 100 * (len(ordered) - 1))))
    return ordered[k]


async def subscriber(url, anon, token, topic, received: dict[int, float], ready: asyncio.Event):
    client = AsyncRealtimeClient(url, token=anon, auto_reconnect=True)
    await client.connect()
    await client.set_auth(token)
    ch = client.channel(topic, {"config": {"private": True, "broadcast": {"self": False}}})

    def on_msg(payload):
        data = payload.get("payload", payload) if isinstance(payload, dict) else {}
        seq, sent = data.get("seq"), data.get("sentAt")
        if isinstance(seq, int) and isinstance(sent, (int, float)) and seq not in received:
            received[seq] = time.time() * 1000 - sent

    ch.on_broadcast("utterance", on_msg)

    def on_state(state: RealtimeSubscribeStates, err):
        if state == RealtimeSubscribeStates.SUBSCRIBED:
            ready.set()

    await ch.subscribe(on_state)
    return client


def setup(env: dict[str, str]) -> tuple[dict, str, list[str]]:
    """Sync setup (before the event loop): throwaway lesson + 8 students joined."""
    password = env.get("DEV_USERS_PASSWORD") or sys.exit("Defina DEV_USERS_PASSWORD no .env.")
    teacher_email = env.get("DEV_TEACHER_EMAIL", TEACHER_EMAIL_DEFAULT).lower()
    base = f"{env['SUPABASE_URL']}/rest/v1"

    with httpx.Client(timeout=30) as http:
        teacher = sign_in(http, env, teacher_email, password)
        th = user_headers(env, teacher["access_token"])
        code = "".join(secrets.choice(ALPHABET) for _ in range(6))
        res = http.post(
            f"{base}/lessons",
            headers={**th, "Prefer": "return=representation"},
            json={"teacher_id": teacher["user"]["id"], "title": "load_test", "code": code},
        )
        res.raise_for_status()
        lesson_id = res.json()[0]["id"]
        students = []
        for email in STUDENT_EMAILS:
            s = sign_in(http, env, email, password)
            h = user_headers(env, s["access_token"])
            have = {
                r["purpose"]
                for r in http.get(
                    f"{base}/consents", params={"select": "purpose", "revoked_at": "is.null"},
                    headers=h,
                ).json()
            }  # fmt: skip
            missing = [
                {"user_id": s["user"]["id"], "purpose": p}
                for p in ("termos_uso", "tratamento_dados")
                if p not in have
            ]
            if missing:
                http.post(f"{base}/consents", headers=h, json=missing)
            http.post(
                f"{base}/rpc/join_lesson", headers=h, json={"p_code": code}
            ).raise_for_status()
            students.append(s["access_token"])
    return teacher, lesson_id, students


def cleanup(env: dict[str, str], teacher: dict, lesson_id: str) -> None:
    with httpx.Client(timeout=30) as http:
        http.delete(
            f"{env['SUPABASE_URL']}/rest/v1/lessons",
            params={"id": f"eq.{lesson_id}"},
            headers=user_headers(env, teacher["access_token"]),
        )


async def run(args, env: dict[str, str], teacher: dict, lesson_id: str, students: list[str]) -> int:
    url = f"{env['SUPABASE_URL']}/realtime/v1"
    topic = f"lesson:{lesson_id}"
    anon = env["SUPABASE_ANON_KEY"]
    received: list[dict[int, float]] = [{} for _ in range(args.clients)]
    ready = [asyncio.Event() for _ in range(args.clients)]
    clients = []
    print(f"Conectando {args.clients} clientes ao canal {topic}…")
    for i in range(args.clients):
        clients.append(
            await subscriber(url, anon, students[i % len(students)], topic, received[i], ready[i])
        )
    try:
        await asyncio.wait_for(asyncio.gather(*(e.wait() for e in ready)), 60)
    except TimeoutError:
        print(f"Aviso: só {sum(e.is_set() for e in ready)} clientes assinaram em 60 s.")

    pub = AsyncRealtimeClient(url, token=anon, auto_reconnect=True)
    await pub.connect()
    await pub.set_auth(teacher["access_token"])
    pub_ch = pub.channel(topic, {"config": {"private": True, "broadcast": {"self": False}}})
    pub_ok = asyncio.Event()
    await pub_ch.subscribe(
        lambda s, e: pub_ok.set() if s == RealtimeSubscribeStates.SUBSCRIBED else None
    )
    await asyncio.wait_for(pub_ok.wait(), 30)

    total = int(args.minutes * 60 / args.interval)
    print(f"Publicando {total} frases (1 a cada {args.interval} s, {args.minutes} min)…")
    for seq in range(1, total + 1):
        text = f"frase de carga {seq} com commit e pull request"
        await pub_ch.send_broadcast(
            "utterance",
            {"seq": seq, "text": text, "terms": [], "wpm": 120, "sentAt": int(time.time() * 1000)},
        )
        if seq % 30 == 0:
            got = sum(len(r) for r in received)
            print(f"  {seq}/{total} enviadas; {got} recebimentos até agora")
        await asyncio.sleep(args.interval)
    await asyncio.sleep(5)

    latencies = [v for r in received for v in r.values()]
    expected = total * args.clients
    lost = expected - len(latencies)
    p50, p95, worst = pct(latencies, 50), pct(latencies, 95), max(latencies, default=float("nan"))
    print("\n=== Resultado ===")
    print(f"clientes: {args.clients} | frases: {total} | esperado: {expected} recebimentos")
    print(f"recebidos: {len(latencies)} | perdas: {lost} ({lost / expected:.2%})")
    print(f"latência p50: {p50:.0f} ms | p95: {p95:.0f} ms | máx: {worst:.0f} ms")
    if latencies:
        print(f"média: {statistics.mean(latencies):.0f} ms")

    for c in [*clients, pub]:
        try:
            await c.close()
        except Exception:  # noqa: BLE001 - best-effort shutdown
            pass
    ok = p95 < 2000 and lost / expected < 0.01
    print("\nMeta (p95 < 2 s e perdas < 1%):", "ATINGIDA" if ok else "NÃO ATINGIDA")
    return 0 if ok else 1


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clients", type=int, default=40)
    parser.add_argument("--minutes", type=float, default=10)
    parser.add_argument("--interval", type=float, default=2)
    args = parser.parse_args()
    env = load_env()
    teacher, lesson_id, students = setup(env)
    try:
        code = asyncio.run(run(args, env, teacher, lesson_id, students))
    finally:
        cleanup(env, teacher, lesson_id)
    sys.exit(code)


if __name__ == "__main__":
    main()
