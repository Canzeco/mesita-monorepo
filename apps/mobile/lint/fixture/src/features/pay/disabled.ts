// expect: import/no-restricted-paths, inline-config
// eslint-disable-next-line import/no-restricted-paths
import { readWallet } from "../wallet/queries";

export const x = readWallet;
