// The kit's peers must be at its exact versions: npm's refusal is the guard, and this test is the one that can't be switched off.
import { checkPeers } from "next-app-kit/testing";
import { test } from "vitest";

test("next-app-kit's peers are at its versions", () => checkPeers());
