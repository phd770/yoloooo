import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { anon, asUser, setupEnv, zimmer } from "./helpers";

let env: RulesTestEnvironment;
beforeAll(async () => { env = await setupEnv(); });
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const seed = (data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "zimmers/z1"), data);
  });

describe("zimmers: access", () => {
  it("denies unauthenticated read and write", async () => {
    await seed(zimmer());
    await assertFails(getDoc(doc(anon(env), "zimmers/z1")));
    await assertFails(setDoc(doc(anon(env), "zimmers/z2"), zimmer()));
    await assertFails(deleteDoc(doc(anon(env), "zimmers/z1")));
  });
  it("denies signed-in users that are not boaz or mishel", async () => {
    await assertFails(getDoc(doc(asUser(env, "stranger"), "zimmers/z1")));
    await assertFails(setDoc(doc(asUser(env, "stranger"), "zimmers/z2"), zimmer({ createdBy: "stranger" })));
  });
  it("lets both partners read", async () => {
    await seed(zimmer());
    await assertSucceeds(getDoc(doc(asUser(env, "boaz"), "zimmers/z1")));
    await assertSucceeds(getDoc(doc(asUser(env, "mishel"), "zimmers/z1")));
  });
});

describe("zimmers: create", () => {
  it("lets boaz and mishel create their own", async () => {
    await assertSucceeds(setDoc(doc(asUser(env, "boaz"), "zimmers/a"), zimmer()));
    await assertSucceeds(setDoc(doc(asUser(env, "mishel"), "zimmers/b"), zimmer({ createdBy: "mishel" })));
  });
  it("requires createdBy == auth uid", async () => {
    await assertFails(setDoc(doc(asUser(env, "boaz"), "zimmers/a"), zimmer({ createdBy: "mishel" })));
  });
  it("allows only your own uid in votes on create", async () => {
    const db = asUser(env, "boaz");
    await assertSucceeds(setDoc(doc(db, "zimmers/a"), zimmer({ votes: { boaz: "like" } })));
    await assertFails(setDoc(doc(db, "zimmers/b"), zimmer({ votes: { mishel: "like" } })));
    await assertFails(setDoc(doc(db, "zimmers/c"), zimmer({ votes: { boaz: "like", mishel: "like" } })));
  });
  it("rejects invalid vote values and unknown vote keys", async () => {
    const db = asUser(env, "boaz");
    await assertFails(setDoc(doc(db, "zimmers/a"), zimmer({ votes: { boaz: "love" } })));
    await assertFails(setDoc(doc(db, "zimmers/b"), zimmer({ votes: { other: "like" } })));
  });
  it("rejects missing required fields and unknown fields", async () => {
    const db = asUser(env, "boaz");
    const { title: _t, ...noTitle } = zimmer();
    await assertFails(setDoc(doc(db, "zimmers/a"), noTitle));
    await assertFails(setDoc(doc(db, "zimmers/b"), zimmer({ hacked: true })));
  });
  it("rejects bad url, empty title and wrong types", async () => {
    const db = asUser(env, "boaz");
    await assertFails(setDoc(doc(db, "zimmers/a"), zimmer({ url: "javascript:alert(1)" })));
    await assertFails(setDoc(doc(db, "zimmers/b"), zimmer({ title: "" })));
    await assertFails(setDoc(doc(db, "zimmers/c"), zimmer({ amenities: "pool" })));
    await assertFails(setDoc(doc(db, "zimmers/d"), zimmer({ createdAt: "now" })));
  });
  it("rejects over-long strings and oversize lists", async () => {
    const db = asUser(env, "boaz");
    await assertFails(setDoc(doc(db, "zimmers/a"), zimmer({ title: "x".repeat(201) })));
    await assertFails(setDoc(doc(db, "zimmers/b"), zimmer({ url: "https://e.com/" + "x".repeat(2048) })));
    await assertFails(setDoc(doc(db, "zimmers/c"), zimmer({ notes: "x".repeat(2001) })));
    await assertFails(setDoc(doc(db, "zimmers/d"), zimmer({ description: "x".repeat(1001) })));
    await assertFails(setDoc(doc(db, "zimmers/e"), zimmer({ amenities: Array(31).fill("a") })));
    await assertSucceeds(setDoc(doc(db, "zimmers/f"), zimmer({ title: "x".repeat(200), notes: "x".repeat(2000) })));
  });
  it("rejects out-of-range numbers", async () => {
    const db = asUser(env, "boaz");
    await assertFails(setDoc(doc(db, "zimmers/a"), zimmer({ nights: 400 })));
    await assertFails(setDoc(doc(db, "zimmers/b"), zimmer({ pricePerNight: -1 })));
  });
});

describe("zimmers: update", () => {
  beforeEach(async () => {
    await seed(zimmer({ createdBy: "boaz", votes: { boaz: "like", mishel: "maybe" } }));
  });
  it("lets a partner change their own vote", async () => {
    await assertSucceeds(updateDoc(doc(asUser(env, "mishel"), "zimmers/z1"), { "votes.mishel": "dislike" }));
    await assertSucceeds(updateDoc(doc(asUser(env, "boaz"), "zimmers/z1"), { "votes.boaz": "dislike" }));
  });
  it("lets the non-creator edit ordinary fields", async () => {
    await assertSucceeds(updateDoc(doc(asUser(env, "mishel"), "zimmers/z1"), { notes: "nice", updatedBy: "mishel", updatedAt: 5 }));
  });
  it("cannot change the partner's vote", async () => {
    await assertFails(updateDoc(doc(asUser(env, "boaz"), "zimmers/z1"), { "votes.mishel": "like" }));
    await assertFails(updateDoc(doc(asUser(env, "mishel"), "zimmers/z1"), { "votes.boaz": "dislike" }));
  });
  it("cannot add the partner's vote when absent", async () => {
    await seed(zimmer({ votes: { boaz: "like" } }));
    await assertFails(updateDoc(doc(asUser(env, "boaz"), "zimmers/z1"), { "votes.mishel": "like" }));
  });
  it("cannot remove the partner's vote", async () => {
    await assertFails(updateDoc(doc(asUser(env, "boaz"), "zimmers/z1"), { votes: { boaz: "like" } }));
  });
  it("cannot change createdBy or createdAt", async () => {
    await assertFails(updateDoc(doc(asUser(env, "boaz"), "zimmers/z1"), { createdBy: "mishel" }));
    await assertFails(updateDoc(doc(asUser(env, "mishel"), "zimmers/z1"), { createdBy: "mishel" }));
    await assertFails(updateDoc(doc(asUser(env, "boaz"), "zimmers/z1"), { createdAt: 2 }));
  });
  it("rejects invalid updates", async () => {
    const ref = doc(asUser(env, "boaz"), "zimmers/z1");
    await assertFails(updateDoc(ref, { title: "x".repeat(201) }));
    await assertFails(updateDoc(ref, { url: "ftp://x.com" }));
    await assertFails(updateDoc(ref, { extra: 1 }));
  });
  it("denies unauthenticated updates", async () => {
    await assertFails(updateDoc(doc(anon(env), "zimmers/z1"), { notes: "x" }));
  });
});
