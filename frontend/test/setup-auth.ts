import { beforeEach } from "vitest";

import { ADMIN_AUTH, setAuthSessionForTests } from "../src/auth/session.js";

beforeEach(() => {
  setAuthSessionForTests(ADMIN_AUTH);
});
