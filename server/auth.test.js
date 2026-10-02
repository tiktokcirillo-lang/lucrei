import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("firebase-admin/app", () => ({
  getApps: () => [{}],
  initializeApp: vi.fn(),
  applicationDefault: vi.fn(),
  cert: vi.fn(),
}));
vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: mock.verify }),
}));
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({}),
  Timestamp: {},
}));
import { authenticate } from "./platform.js";
beforeEach(() => {
  vi.clearAllMocks();
  mock.verify.mockResolvedValue({
    uid: "alice",
    auth_time: Math.floor(Date.now() / 1000),
  });
});
describe("autenticação do servidor", () => {
  it("exige token e verifica revogação", async () => {
    await expect(authenticate({ headers: {} })).rejects.toMatchObject({
      status: 401,
    });
    expect(
      await authenticate({ headers: { authorization: "Bearer token" } }),
    ).toMatchObject({ uid: "alice" });
    expect(mock.verify).toHaveBeenCalledWith("token", true);
  });
  it("nega token revogado", async () => {
    mock.verify.mockRejectedValue(new Error("revoked"));
    await expect(
      authenticate({ headers: { authorization: "Bearer token" } }),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("exige login recente antes de excluir dados", async () => {
    mock.verify.mockResolvedValue({
      uid: "alice",
      auth_time: Math.floor(Date.now() / 1000) - 301,
    });
    await expect(
      authenticate({ headers: { authorization: "Bearer token" } }, true),
    ).rejects.toMatchObject({ code: "REAUTH_REQUIRED" });
  });
});
