import { afterAll, beforeAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { anon, asUser, setupEnv } from "./helpers";

let env: RulesTestEnvironment;
beforeAll(async () => { env = await setupEnv(); });
afterAll(async () => { await env.cleanup(); });

const collections = ["users", "missions", "sessions", "chat_sessions", "chat_messages", "vault", "games"];

describe("existing collections: unauthenticated access is denied", () => {
  for (const name of collections) {
    it(name, async () => {
      await assertFails(getDoc(doc(anon(env), `${name}/x`)));
      await assertFails(setDoc(doc(anon(env), `${name}/x`), { a: 1 }));
    });
  }
  it("unknown collections are denied even when signed in", async () => {
    await assertFails(getDoc(doc(asUser(env, "boaz"), "private_pin_codes/boaz")));
    await assertFails(setDoc(doc(asUser(env, "boaz"), "push_subscriptions/x"), { a: 1 }));
    await assertFails(getDoc(doc(asUser(env, "boaz"), "private_pin_attempts/x")));
  });
});

describe("custom-token identity (uid == profile)", () => {
  it("accepts boaz and mishel", async () => {
    await assertSucceeds(setDoc(doc(asUser(env, "boaz"), "games/g"), { a: 1 }));
    await assertSucceeds(getDoc(doc(asUser(env, "mishel"), "games/g")));
  });
  it("rejects any other uid, even with a profile claim", async () => {
    const db = env.authenticatedContext("someone", { profile: "boaz" }).firestore();
    await assertFails(getDoc(doc(db, "games/g")));
  });
  it("accepts the claim-bearing token minted by api/auth", async () => {
    const db = env.authenticatedContext("mishel", { profile: "mishel" }).firestore();
    await assertSucceeds(getDoc(doc(db, "games/g")));
  });
});

describe("validation sanity", () => {
  it("users requires a name", async () => {
    const db = asUser(env, "boaz");
    await assertFails(setDoc(doc(db, "users/u"), { points: 1 }));
    await assertSucceeds(setDoc(doc(db, "users/u"), { name: "B" }));
  });
  it("vault media cannot be updated", async () => {
    const db = asUser(env, "boaz");
    const media = { id: "1", type: "image", name: "n", storagePath: "p", url: "u", createdAt: 1 };
    await assertSucceeds(setDoc(doc(db, "vault/m"), media));
    await assertFails(setDoc(doc(db, "vault/m"), { ...media, name: "other" }));
  });
});
