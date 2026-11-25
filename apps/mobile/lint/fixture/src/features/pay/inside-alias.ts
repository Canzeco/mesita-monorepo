// expect: import/no-restricted-paths, no-restricted-imports
import { readWallet } from "@/features/wallet/queries";

export const x = readWallet;
