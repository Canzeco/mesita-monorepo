export type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const TOOLS: ToolDef[] = [
  {
    name: "get_profile",
    description:
      "Get the connected Mesita consumer profile: name, class (Free/Premium), reservation usage, Instagram handle.",
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
      "Save or unsave a place. Saving a Verified Partner also issues a reward coupon when eligible.",
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
      "Book a table at a place. Requires place_id, ISO reserved_at, and party_size.",
    inputSchema: {
      type: "object",
      properties: {
        place_id: { type: "string" },
        reserved_at: {
          type: "string",
          description: "ISO 8601 datetime for the reservation",
        },
        party_size: { type: "number", minimum: 1, maximum: 50 },
        notes: { type: "string" },
      },
      required: ["place_id", "reserved_at", "party_size"],
      additionalProperties: false,
    },
  },
  {
    name: "list_rewards",
    description:
      "List active reward coupons (at-the-bill discounts) available to the consumer.",
    inputSchema: {
      type: "object",
      properties: {
        include_inactive: { type: "boolean" },
        limit: { type: "number", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
];
