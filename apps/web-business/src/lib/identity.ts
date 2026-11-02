import { cache } from "react";
import { getIdentity } from "@/lib/business-api";

// One identity read per request: the console layout and its pages each ask,
// one EF call happens.
export const getIdentityCached = cache(getIdentity);
