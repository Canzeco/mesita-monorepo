import { setMyProfile, rereadMyProfile, type Profile } from "@/features/auth";
import { callEdge, EdgeError } from "@/lib/edge";

import { checkDraft, type Details } from "./model";
import { saveDetails } from "./queries";

jest.mock("@/lib/edge", () => ({ ...jest.requireActual("@/lib/edge"), callEdge: jest.fn() }));
jest.mock("@/features/auth", () => ({
  ...jest.requireActual("@/features/auth"),
  setMyProfile: jest.fn(),
  rereadMyProfile: jest.fn(),
}));
const call = callEdge as jest.Mock;
const reread = rereadMyProfile as jest.Mock;

const ANA: Details = { firstName: "Ana", lastName: "López", sex: "female", birthYear: 1990 };
const saved: Profile = { id: "g1", phone: null, isVip: false, instagramHandle: null, instagramProvedAt: null, instagramVipStatus: null, instagramFollowers: null, fullName: null, avatarUrl: null, socialLevel: null, socialLock: null, ...ANA };
const noWait = async () => undefined;
const failure = (retry: EdgeError["retry"]) =>
  new EdgeError({ fn: "f", kind: "network", retry, code: "x", status: null, message: "m", body: {}, requestId: null });

beforeEach(() => jest.clearAllMocks());

test("a save whose answer is lost is sent once, and the re-read is the answer", async () => {
  call.mockRejectedValue(failure("reconcile-first"));
  reread.mockResolvedValueOnce({ ...saved, lastName: null }).mockResolvedValueOnce(saved);
  await saveDetails("g1", ANA, noWait);
  expect(call).toHaveBeenCalledTimes(1);
  expect(reread).toHaveBeenCalledTimes(2);
});

test("a save the re-reads never show is still unknown", async () => {
  call.mockRejectedValue(failure("reconcile-first"));
  reread.mockResolvedValue({ ...saved, lastName: null });
  await expect(saveDetails("g1", ANA, noWait)).rejects.toMatchObject({ retry: "reconcile-first" });
  expect(call).toHaveBeenCalledTimes(1);
  expect(reread).toHaveBeenCalledTimes(3);
});

test("a refusal re-reads nothing", async () => {
  call.mockRejectedValue(failure("after-fix"));
  await expect(saveDetails("g1", ANA, noWait)).rejects.toThrow();
  expect(reread).not.toHaveBeenCalled();
  call.mockResolvedValue({ consumer: saved });
  await saveDetails("g1", ANA, noWait);
  expect(setMyProfile).toHaveBeenCalledWith(saved);
});

test("a draft is checked field by field", () => {
  const now = new Date("2026-11-25");
  const draft = { firstName: " Ana  María ", lastName: "López", sex: "female", birthYear: "1990" };
  expect(checkDraft(draft, now).details).toEqual({ ...ANA, firstName: "Ana María" });
  expect(Object.keys(checkDraft({ firstName: " ", lastName: "", sex: "x", birthYear: "" }, now).errors!)).toEqual([
    "firstName", "lastName", "sex", "birthYear",
  ]);
  expect(checkDraft({ ...draft, birthYear: "2012" }, now).details).not.toBeNull();
  expect(checkDraft({ ...draft, birthYear: "2013" }, now).errors?.birthYear).toContain("14");
  for (const bad of ["90", "19900", "2030", "abcd"]) expect(checkDraft({ ...draft, birthYear: bad }, now).details).toBeNull();
});
