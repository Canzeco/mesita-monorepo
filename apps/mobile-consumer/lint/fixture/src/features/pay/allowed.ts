// expect: nothing
import { BRAND } from "@/generated/brand";
import { edge } from "@/lib/edge";
import { readWallet } from "@/features/wallet";

import { bill } from "./model";

export const x = [BRAND, edge, readWallet, bill];
