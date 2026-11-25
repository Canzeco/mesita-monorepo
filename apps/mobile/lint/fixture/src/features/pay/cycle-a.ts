// expect: import/no-cycle
import { b } from "./cycle-b";

export const a = (): unknown => b;
