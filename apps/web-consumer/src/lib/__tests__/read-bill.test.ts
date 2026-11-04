import { describe, expect, it } from "vitest";
import { readBill } from "@/lib/api/rewards";

describe("readBill", () => {
  it("reads what a guest types as whole cents", () => {
    expect(readBill("1,234.50")).toBe(123450);
    expect(readBill(" 200 ")).toBe(20000);
    expect(readBill("19.9")).toBe(1990);
  });

  it("refuses what is not a bill", () => {
    expect(readBill("")).toBeNull();
    expect(readBill("0")).toBeNull();
    expect(readBill("12.345")).toBeNull();
    expect(readBill("-5")).toBeNull();
  });
});
