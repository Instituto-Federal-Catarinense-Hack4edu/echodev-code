/**
 * Proves the access rules in firestore.rules against the Firestore emulator (replaces the
 * old check:rls). Run with `npm run test:rules` from the repo root.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const LESSON = "11111111-1111-4111-8111-111111111111";
const OTHER_LESSON = "22222222-2222-4222-8222-222222222222";
const HOUR = 3600_000;

let env: RulesTestEnvironment;

const as = (uid: string): Firestore => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const anon = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;
const teacher = () => as("T");
const otherTeacher = () => as("T2");
const member = () => as("S1");
const outsider = () => as("S2");

const utterance = (seq: number, extra: Record<string, unknown> = {}) => ({
  seq,
  text: `frase ${seq}`,
  terms: [],
  wpm: 100,
  created_at: serverTimestamp(),
  expires_at: Timestamp.fromMillis(Date.now() + 24 * HOUR),
  ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-echodev-rules",
    firestore: {
      rules: readFileSync(fileURLToPath(new URL("../../firestore.rules", import.meta.url)), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    const profile = (role: string, pseudonym: string) => ({
      role,
      pseudonym_id: pseudonym,
      depth_pref: "curta",
      lang_pref: "pt",
    });
    await setDoc(doc(db, "profiles", "T"), profile("professor", "pT"));
    await setDoc(doc(db, "profiles", "T2"), profile("professor", "pT2"));
    await setDoc(doc(db, "profiles", "S1"), profile("estudante", "pS1"));
    await setDoc(doc(db, "profiles", "S2"), profile("estudante", "pS2"));
    await setDoc(doc(db, "teacherAllowlist", "prof@escola.test"), { email: "prof@escola.test" });
    const lesson = { title: "Git", code: "ABC234", status: "ao_vivo", pack_ids: [], created_at: Timestamp.now() };
    await setDoc(doc(db, "lessons", LESSON), { ...lesson, teacher_id: "T" });
    await setDoc(doc(db, "lessons", OTHER_LESSON), { ...lesson, code: "XYZ234", teacher_id: "T2" });
    await setDoc(doc(db, "lessonCodes", "ABC234"), { lesson_id: LESSON });
    await setDoc(doc(db, "lessonMembers", `${LESSON}_pS1`), {
      lesson_id: LESSON,
      pseudonym_id: "pS1",
      lesson_code: "ABC234",
    });
    await setDoc(doc(db, "lessons", LESSON, "utterances", "1"), { ...utterance(1), created_at: Timestamp.now() });
    const material = (kind: string, status: string) => ({ kind, status, content: {} });
    await setDoc(doc(db, "lessons", LESSON, "materials", "resumo"), material("resumo", "rascunho"));
    await setDoc(doc(db, "lessons", LESSON, "materials", "quiz"), material("quiz", "aprovado"));
    await setDoc(doc(db, "lessonReports", LESSON), { data: { total_utterances: 1 } });
    await setDoc(doc(db, "termEvents", "e1"), {
      lesson_id: LESSON,
      pseudonym_id: "pS1",
      term_id: "git",
      kind: "tap",
      depth: "curta",
    });
    await setDoc(doc(db, "consents", "S1_termos_uso"), {
      user_id: "S1",
      purpose: "termos_uso",
      granted_at: Timestamp.now(),
      revoked_at: null,
    });
    await setDoc(doc(db, "termCorrections", "c1"), { term_id: "commit", heard: "comiti", correct: "commit" });
  });
});

describe("profiles", () => {
  it("each user reads only their own profile", async () => {
    await assertSucceeds(getDoc(doc(member(), "profiles", "S1")));
    await assertFails(getDoc(doc(member(), "profiles", "S2")));
    await assertFails(getDoc(doc(teacher(), "profiles", "S1")));
    await assertFails(getDoc(doc(anon(), "profiles", "S1")));
    await assertFails(getDocs(collection(teacher(), "profiles")));
  });

  it("only preferences are writable; role, pseudonym and creation are not", async () => {
    await assertSucceeds(updateDoc(doc(member(), "profiles", "S1"), { depth_pref: "passos", lang_pref: "es" }));
    await assertFails(updateDoc(doc(member(), "profiles", "S1"), { depth_pref: "nada" }));
    await assertFails(updateDoc(doc(member(), "profiles", "S1"), { role: "professor" }));
    await assertFails(updateDoc(doc(member(), "profiles", "S1"), { pseudonym_id: "pT" }));
    await assertFails(setDoc(doc(as("NEW"), "profiles", "NEW"), { role: "professor", pseudonym_id: "x" }));
  });

  it("the teacher allowlist is invisible to the app", async () => {
    await assertFails(getDoc(doc(teacher(), "teacherAllowlist", "prof@escola.test")));
    await assertFails(setDoc(doc(member(), "teacherAllowlist", "eu@escola.test"), { email: "eu@escola.test" }));
  });
});

describe("consents", () => {
  const consent = (uid: string, purpose: string, extra: Record<string, unknown> = {}) => ({
    user_id: uid,
    purpose,
    granted_at: serverTimestamp(),
    revoked_at: null,
    ...extra,
  });

  it("own consents only, never pre-revoked or for someone else", async () => {
    await assertSucceeds(getDocs(query(collection(member(), "consents"), where("user_id", "==", "S1"))));
    await assertFails(getDocs(query(collection(outsider(), "consents"), where("user_id", "==", "S1"))));
    await assertSucceeds(setDoc(doc(member(), "consents", "S1_tratamento_dados"), consent("S1", "tratamento_dados")));
    await assertFails(setDoc(doc(member(), "consents", "S2_termos_uso"), consent("S2", "termos_uso")));
    await assertFails(setDoc(doc(member(), "consents", "S1_outra"), consent("S1", "outra")));
    await assertFails(
      setDoc(doc(member(), "consents", "S1_doacao_lexico"), consent("S1", "doacao_lexico", { revoked_at: serverTimestamp() })),
    );
  });

  it("revoke and grant again; nobody touches another user's consent", async () => {
    await assertSucceeds(updateDoc(doc(member(), "consents", "S1_termos_uso"), { revoked_at: serverTimestamp() }));
    await assertSucceeds(
      setDoc(doc(member(), "consents", "S1_termos_uso"), consent("S1", "termos_uso"), { merge: true }),
    );
    await assertFails(updateDoc(doc(outsider(), "consents", "S1_termos_uso"), { revoked_at: serverTimestamp() }));
    await assertFails(updateDoc(doc(member(), "consents", "S1_termos_uso"), { purpose: "doacao_sinais" }));
  });
});

describe("lessons", () => {
  const newLesson = (teacherId: string, code: string) => ({
    teacher_id: teacherId,
    title: "Nova",
    code,
    status: "criada",
    pack_ids: ["programacao-geral"],
    started_at: null,
    ended_at: null,
    created_at: serverTimestamp(),
  });
  const create = (db: Firestore, id: string, teacherId: string, code: string) => {
    const batch = writeBatch(db);
    batch.set(doc(db, "lessons", id), newLesson(teacherId, code));
    batch.set(doc(db, "lessonCodes", code), { lesson_id: id });
    return batch.commit();
  };

  it("a teacher creates a lesson together with its code", async () => {
    await assertSucceeds(create(teacher(), "33333333-3333-4333-8333-333333333333", "T", "QRS234"));
    // without reserving the code
    await assertFails(setDoc(doc(teacher(), "lessons", "x1"), newLesson("T", "QRT234")));
    // code already taken
    await assertFails(create(teacher(), "44444444-4444-4444-8444-444444444444", "T", "ABC234"));
    // students and other teacher ids
    await assertFails(create(member(), "55555555-5555-4555-8555-555555555555", "S1", "QRU234"));
    await assertFails(
      (() => {
        const db = teacher();
        const batch = writeBatch(db);
        batch.set(doc(db, "lessons", "x2"), newLesson("T2", "QRW234"));
        batch.set(doc(db, "lessonCodes", "QRW234"), { lesson_id: "x2" });
        return batch.commit();
      })(),
    );
  });

  it("owner and members read; outsiders do not", async () => {
    await assertSucceeds(getDoc(doc(teacher(), "lessons", LESSON)));
    await assertSucceeds(getDoc(doc(member(), "lessons", LESSON)));
    await assertFails(getDoc(doc(outsider(), "lessons", LESSON)));
    await assertFails(getDoc(doc(otherTeacher(), "lessons", LESSON)));
    await assertSucceeds(
      getDocs(query(collection(teacher(), "lessons"), where("teacher_id", "==", "T"), orderBy("created_at", "desc"))),
    );
    await assertFails(getDocs(collection(teacher(), "lessons")));
    await assertFails(getDoc(doc(member(), "lessonCodes", "ABC234")));
  });

  it("only the owner updates (never the owner field) or deletes", async () => {
    await assertSucceeds(updateDoc(doc(teacher(), "lessons", LESSON), { status: "encerrada" }));
    await assertFails(updateDoc(doc(teacher(), "lessons", LESSON), { teacher_id: "T2" }));
    await assertFails(updateDoc(doc(teacher(), "lessons", LESSON), { status: "apagada" }));
    await assertFails(updateDoc(doc(otherTeacher(), "lessons", LESSON), { status: "encerrada" }));
    await assertFails(updateDoc(doc(member(), "lessons", LESSON), { status: "encerrada" }));
    await assertFails(deleteDoc(doc(member(), "lessons", LESSON)));
  });
});

describe("live transcript", () => {
  const ref = (db: Firestore, seq: number) => doc(db, "lessons", LESSON, "utterances", String(seq));

  it("only the owner writes each sentence once, with a 24 h expiry", async () => {
    await assertSucceeds(setDoc(ref(teacher(), 2), utterance(2, { text_es: "frase 2" })));
    await assertFails(setDoc(ref(teacher(), 1), utterance(1))); // seq taken
    await assertFails(setDoc(ref(teacher(), 3), utterance(4))); // id must match seq
    await assertFails(setDoc(ref(member(), 3), utterance(3)));
    await assertFails(setDoc(ref(otherTeacher(), 3), utterance(3)));
    await assertFails(setDoc(ref(teacher(), 3), utterance(3, { expires_at: Timestamp.fromMillis(Date.now() + 72 * HOUR) })));
    await assertFails(setDoc(ref(teacher(), 3), utterance(3, { text: "x".repeat(5001) })));
    await assertFails(setDoc(ref(teacher(), 3), utterance(3, { autor: "nome" })));
    await assertFails(deleteDoc(ref(teacher(), 1)));
  });

  it("owner and members read the live sentences; outsiders cannot listen", async () => {
    const q = (db: Firestore) => query(collection(db, "lessons", LESSON, "utterances"), orderBy("seq"));
    await assertSucceeds(getDocs(q(teacher())));
    await assertSucceeds(getDocs(q(member())));
    await assertFails(getDocs(q(outsider())));
    await assertFails(getDocs(q(otherTeacher())));
    await assertFails(getDocs(q(anon())));
  });
});

describe("materials", () => {
  const mats = (db: Firestore) => collection(db, "lessons", LESSON, "materials");

  it("the owner edits; members see only approved material", async () => {
    await assertSucceeds(
      setDoc(doc(mats(teacher()), "resumo_es"), { kind: "resumo_es", status: "rascunho", content: {} }),
    );
    await assertSucceeds(updateDoc(doc(mats(teacher()), "resumo"), { status: "aprovado" }));
    await assertFails(setDoc(doc(mats(teacher()), "outro"), { kind: "outro", status: "rascunho", content: {} }));
    await assertSucceeds(
      setDoc(doc(mats(teacher()), "glossario"), { kind: "glossario", status: "rascunho", content: { termos: [] } }),
    );
    await assertFails(getDoc(doc(mats(member()), "glossario"))); // draft
    await assertFails(
      setDoc(doc(mats(member()), "glossario"), { kind: "glossario", status: "aprovado", content: { termos: [] } }),
    );
    await assertFails(updateDoc(doc(mats(member()), "quiz"), { status: "descartado" }));
    await assertSucceeds(getDoc(doc(mats(member()), "quiz")));
    await assertFails(getDoc(doc(mats(member()), "resumo_es"))); // draft
    await assertSucceeds(getDocs(query(mats(member()), where("status", "==", "aprovado"))));
    await assertFails(getDocs(mats(member())));
    await assertFails(getDocs(query(mats(outsider()), where("status", "==", "aprovado"))));
  });
});

describe("privacy of students", () => {
  it("a student sees only their own memberships; the teacher sees none", async () => {
    const mine = (db: Firestore, p: string) => query(collection(db, "lessonMembers"), where("pseudonym_id", "==", p));
    await assertSucceeds(getDocs(mine(member(), "pS1")));
    await assertFails(getDocs(mine(outsider(), "pS1")));
    await assertFails(getDocs(collection(teacher(), "lessonMembers")));
    await assertFails(getDocs(query(collection(teacher(), "lessonMembers"), where("lesson_id", "==", LESSON))));
    await assertFails(
      setDoc(doc(outsider(), "lessonMembers", `${LESSON}_pS2`), { lesson_id: LESSON, pseudonym_id: "pS2" }),
    );
  });

  it("members write anonymous term events with their own pseudonym; nobody reads them", async () => {
    const event = (pseudonym: string, lesson = LESSON) => ({
      lesson_id: lesson,
      pseudonym_id: pseudonym,
      term_id: "commit",
      kind: "doubt",
      depth: "exemplo",
      created_at: serverTimestamp(),
    });
    await assertSucceeds(addDoc(collection(member(), "termEvents"), event("pS1")));
    await assertFails(addDoc(collection(member(), "termEvents"), event("pS2")));
    await assertFails(addDoc(collection(outsider(), "termEvents"), event("pS2")));
    await assertFails(addDoc(collection(member(), "termEvents"), event("pS1", OTHER_LESSON)));
    await assertFails(addDoc(collection(teacher(), "termEvents"), event("pT")));
    await assertFails(getDocs(collection(teacher(), "termEvents")));
    await assertFails(getDocs(query(collection(teacher(), "termEvents"), where("lesson_id", "==", LESSON))));
    await assertFails(getDoc(doc(member(), "termEvents", "e1")));
  });

  it("the report snapshot is the owner's only and written by the API", async () => {
    await assertSucceeds(getDoc(doc(teacher(), "lessonReports", LESSON)));
    await assertFails(getDoc(doc(member(), "lessonReports", LESSON)));
    await assertFails(getDoc(doc(otherTeacher(), "lessonReports", LESSON)));
    await assertFails(setDoc(doc(teacher(), "lessonReports", LESSON), { data: {} }));
  });
});

describe("term corrections", () => {
  it("teachers read and add; students cannot", async () => {
    const pair = { term_id: "commit", heard: "comitê", correct: "commit", created_at: serverTimestamp() };
    await assertSucceeds(getDocs(collection(teacher(), "termCorrections")));
    await assertSucceeds(addDoc(collection(teacher(), "termCorrections"), pair));
    await assertFails(addDoc(collection(teacher(), "termCorrections"), { ...pair, autor: "T" }));
    await assertFails(getDocs(collection(member(), "termCorrections")));
    await assertFails(addDoc(collection(member(), "termCorrections"), pair));
  });
});
