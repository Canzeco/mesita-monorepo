export type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const TOOLS: ToolDef[] = [
  {
    name: "get_profile",
    description:
      "Get the connected Mesita consumer profile: name, class (Standard/Premium/Influencer/Aura), reservation usage, Instagram handle.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "list_saved_places",
    description: "List places the consumer has saved (favorites).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "save_place",
    description:
      "Save or unsave a place to the consumer's favorites. Rewards are earned via tickets/check actions, not by saving.",
    inputSchema: {
      type: "object",
      properties: {
        place_id: { type: "string", description: "Place UUID" },
        saved: { type: "boolean" },
      },
      required: ["place_id", "saved"],
      additionalProperties: false,
    },
  },
  {
    name: "suggest_places",
    description:
      "Search Mesita + Google for places by name or vibe query (autocomplete-style).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_place",
    description: "Get a single place profile by id (UUID) or slug.",
    inputSchema: {
      type: "object",
      properties: {
        id_or_slug: { type: "string" },
      },
      required: ["id_or_slug"],
      additionalProperties: false,
    },
  },
  {
    name: "list_reservations",
    description: "List the consumer's reservations (upcoming, past, or all).",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["upcoming", "past", "all"] },
        limit: { type: "number", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_reservation",
    description:
      "Book a table at a place. Requires place_id, ISO reserved_at, and party_size (1–20).",
    inputSchema: {
      type: "object",
      properties: {
        place_id: { type: "string" },
        reserved_at: {
          type: "string",
          description: "ISO 8601 datetime for the reservation",
        },
        party_size: { type: "number", minimum: 1, maximum: 20 },
        notes: { type: "string" },
        consumer_notify: {
          type: "string",
          enum: ["call", "app"],
          description:
            "How Mesita confirms with the guest after the place answers (default call).",
        },
      },
      required: ["place_id", "reserved_at", "party_size"],
      additionalProperties: false,
    },
  },
];
