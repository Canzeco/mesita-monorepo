// THE MARKS — one emoji per product, and the file they live in is shared now
// (MESITA-1981). Setup's LIST draws them on the left and `ProductPane` draws
// the selected one on the right, so a record that lived inside the page
// component would have been copied to be reached. One record, two readers.
import type { ProductKey } from "@/lib/product-keys";

// THE MARK, AND ONLY THE MARK (MESITA-1946) — AN EMOJI SINCE MESITA-1952.
//
// Pato: *"maybe some icon to each product"*, then, at the same grid once it
// had gone grey: *"add fuckjing emojis or something"*.
//
// The lucide glyphs came across from `web-business` and the TINTS did not,
// because this app has no hues to draw them in (MESITA-1934) — which left a
// grid of grey squares holding grey marks. An emoji carries its own colour and
// costs the palette nothing.
//
// THE CHIP STILL DOES NOT BRIGHTEN WHEN A PRODUCT IS ON. State is the badge's
// fact, and there is never a second badge for one fact — on a screen whose
// whole job is saying which products are on, a quieter second state signal is
// the one that gets misread.
export const PRODUCT_MARK: Record<ProductKey, string> = {
  profile: "\u{1F3EA}",
  // A STAR, because that is the unit this product deals in — not 💬, which
  // would say the subject is the WRITING rather than the score, and not a
  // second 🏪, which would say Reviews is a view of Profile. It is the only
  // star in the list, so the row is findable by its mark alone.
  // THE DISHES, not a document: 🍽️ over 📄 or 📋, because the thing this
  // product turns into data is the food, and a page mark would read as the
  // PDF on Profile that this card exists to stop being the answer.
  menu: "\u{1F37D}\u{FE0F}",
  website: "\u{1F310}",
  customers: "\u{1F465}",
  ads: "\u{1F4E3}",
  visits: "\u{1F39F}\u{FE0F}",
  orders: "\u{1F6CD}\u{FE0F}",
  // THE TABLE, because the table is the only thing separating this from
  // Online Orders: the same order, placed where the guest is already sitting.
  tableorders: "\u{1F374}",
  reservations: "\u{1F4C5}",
  pay: "\u{1F4B3}",
  // THE READER, NOT A SECOND CARD: 📲 is the tap, the part of Terminal that is
  // not Payments — never a second 💳 in the same list.
  terminal: "\u{1F4F2}",
  // THE ITEMS, the half of the counter Terminal is not: 🧾 is what was rung up
  // before anybody tapped anything.
  pos: "\u{1F9FE}",
  // A COIN, NOT A WALLET — Pay › Wallet is the guest's; credits are a balance
  // the place sold.
  // A PAD IN A HAND, not a till: `pos` is the station you walk to and this is
  // the thing the floor carries to the table.
  orderpad: "\u{1F4DD}",
  credits: "\u{1FA99}",
  // The BANK'S FRONT, the same mark the landing page gives Capital.
  capital: "\u{1F3E6}",
  // NOT A HANDSET AND NOT A CHAT BUBBLE (MESITA-1951): either one would make
  // the row look like one channel's product again, which is the whole thing
  // the merge undid. 🤖 is what the name now says out loud.
  line: "\u{1F916}",
  // A PLUG (MESITA-1991). The door was Omnichannel Access's mark, for a
  // product about ways in; this one is about something you connect a system TO,
  // and a door on a developer platform reads as a login screen.
  access: "\u{1F50C}",
  intelligence: "\u{2728}",
};
