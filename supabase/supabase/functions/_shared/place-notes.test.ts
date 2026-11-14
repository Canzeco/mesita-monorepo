import { assertEquals } from "jsr:@std/assert@1";
import {
  callerNumber,
  nextNotes,
  notesForCall,
  PLACE_NOTES_MAX_CHARS,
  placeCallKind,
  transcriptText,
} from "./place-notes.ts";

Deno.test("transcriptText: nothing to learn when the place never spoke", () => {
  assertEquals(transcriptText([{ role: "agent", message: "Hola" }]), "");
  assertEquals(transcriptText(null), "");
  assertEquals(
    transcriptText([
      { role: "agent", message: "Hola" },
      { role: "user", message: " Sí, tenemos terraza " },
      { role: "user", message: "" },
    ]),
    "Mesita: Hola\nRestaurante: Sí, tenemos terraza",
  );
});

Deno.test("nextNotes: keeps the notes on no change, cuts a long answer", () => {
  assertEquals(nextNotes("Mesas: terraza.", "SIN_CAMBIOS"), null);
  assertEquals(nextNotes("Mesas: terraza.", "  "), null);
  assertEquals(nextNotes("Mesas: terraza.", "Mesas: terraza."), null);
  assertEquals(nextNotes("", "Mesas: terraza y barra."), "Mesas: terraza y barra.");
  const long = `Mesas: ${"a".repeat(800)}\nOtros: ${"b".repeat(800)}`;
  const cut = nextNotes("", long)!;
  assertEquals(cut.length <= PLACE_NOTES_MAX_CHARS, true);
  assertEquals(cut.startsWith("Mesas: "), true);
  assertEquals(cut.includes("Otros"), false);
});

Deno.test("notesForCall: one line, empty when there are none", () => {
  assertEquals(notesForCall(null), "");
  assertEquals(notesForCall("Mesas: terraza.\nOtros: cierran lunes."), "Mesas: terraza. · Otros: cierran lunes.");
});

Deno.test("placeCallKind: only a1 and a4 are calls with a place", () => {
  const fleet = { a1: "agent_a1", a4: "agent_a4" };
  assertEquals(placeCallKind("agent_a1", fleet), "a1");
  assertEquals(placeCallKind("agent_a4", fleet), "a4");
  assertEquals(placeCallKind("agent_a2", fleet), null);
  assertEquals(placeCallKind(undefined, fleet), null);
  assertEquals(placeCallKind("agent_a1", {}), null);
});

Deno.test("callerNumber: the caller id variable, else the call's external number", () => {
  assertEquals(
    callerNumber({ conversation_initiation_client_data: { dynamic_variables: { system__caller_id: "+525511112222" } } }),
    "+525511112222",
  );
  assertEquals(callerNumber({ metadata: { phone_call: { external_number: "+525533334444" } } }), "+525533334444");
  assertEquals(callerNumber({}), "");
});
