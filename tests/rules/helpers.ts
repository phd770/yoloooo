import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

export async function setupEnv(): Promise<RulesTestEnvironment> {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
  return initializeTestEnvironment({
    projectId: "demo-yoloooo-rules",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host, port: Number(port) },
  });
}

export const asUser = (env: RulesTestEnvironment, uid: string) =>
  env.authenticatedContext(uid).firestore();
export const anon = (env: RulesTestEnvironment) => env.unauthenticatedContext().firestore();

export function zimmer(overrides: Record<string, unknown> = {}) {
  return {
    url: "https://example.com/cabin",
    title: "Cabin",
    amenities: ["pool"],
    votes: {},
    createdBy: "boaz",
    createdAt: 1000,
    ...overrides,
  };
}
