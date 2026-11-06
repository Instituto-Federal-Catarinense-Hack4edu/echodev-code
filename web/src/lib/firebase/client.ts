"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { publicEnv } from "@/lib/env";

// No Analytics on purpose: students may be minors and consent is per purpose
// (docs/DECISIONS.md). Only Auth and Firestore are used.

let services: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

function init() {
  if (services) return services;
  const env = publicEnv();
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
        storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      });
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (env.NEXT_PUBLIC_FIREBASE_EMULATORS) {
    const host = window.location.hostname === "127.0.0.1" ? "127.0.0.1" : "localhost";
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, 8080);
  }
  services = { app, auth, db };
  return services;
}

/** One Firebase app for the whole browser session. */
export function getFirebaseAuth(): Auth {
  return init().auth;
}

export function getDb(): Firestore {
  return init().db;
}

/** Resolves with the signed-in user once Auth has restored the session (or null). */
export function currentUser() {
  const auth = getFirebaseAuth();
  return auth.authStateReady().then(() => auth.currentUser);
}
