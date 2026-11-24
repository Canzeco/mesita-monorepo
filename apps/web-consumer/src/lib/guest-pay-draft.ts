// The last card picked (MESITA-4124): the card a voucher checkout and Payment
// methods preselect. The typed bill's draft left with its screen (MESITA-4928).

const LAST_CARD_KEY = "mesita.pay.last-card";

function store(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLastCard(): string | null {
  try {
    const id = store()?.getItem(LAST_CARD_KEY);
    return id && id.length > 0 && id.length <= 128 ? id : null;
  } catch {
    return null;
  }
}

export function writeLastCard(cardId: string | null) {
  if (!cardId) return;
  try {
    store()?.setItem(LAST_CARD_KEY, cardId);
  } catch {
    /* storage can be blocked */
  }
}
