// Mock option data for the discovery FilterSheet (Home Swipe + Search map).
//
// FRONTEND-ONLY (MESITA-632): the sheet is presentational — selections live
// in component state and nothing is wired to the recommenders yet. When the
// filtering backend lands, the zone tree moves to real Atlas geography
// (places.country/state/city/zone) and the category list to the live
// place_categories catalog; the shapes below are chosen to survive that swap.

export type ZoneKind = "country" | "state" | "city" | "zone";

export type ZoneNode = {
  /** Stable slug, unique across the whole tree. */
  id: string;
  name: string;
  kind: ZoneKind;
  children?: ZoneNode[];
};

/** Plural forms for the browse hint ("Cities in Nuevo León"). */
export const ZONE_KIND_PLURAL_LABELS: Record<ZoneKind, string> = {
  country: "Countries",
  state: "States",
  city: "Cities",
  zone: "Zones",
};

// Monterrey metro is the richest branch on purpose — it's the app's home
// market (map default centre). CDMX alcaldías double as "municipality"
// rows; colonias sit at the zone level.
export const ZONE_TREE: ZoneNode[] = [
  {
    id: "mx",
    name: "México",
    kind: "country",
    children: [
      {
        id: "mx-nl",
        name: "Nuevo León",
        kind: "state",
        children: [
          {
            id: "mx-nl-mty",
            name: "Monterrey",
            kind: "city",
            children: [
              { id: "mx-nl-mty-centro", name: "Centro", kind: "zone" },
              { id: "mx-nl-mty-tec", name: "Distrito Tec", kind: "zone" },
              { id: "mx-nl-mty-cumbres", name: "Cumbres", kind: "zone" },
              {
                id: "mx-nl-mty-sanjeronimo",
                name: "San Jerónimo",
                kind: "zone",
              },
              { id: "mx-nl-mty-obispado", name: "Obispado", kind: "zone" },
            ],
          },
          {
            id: "mx-nl-spgg",
            name: "San Pedro Garza García",
            kind: "city",
            children: [
              { id: "mx-nl-spgg-valle", name: "Del Valle", kind: "zone" },
              {
                id: "mx-nl-spgg-valle-ote",
                name: "Valle Oriente",
                kind: "zone",
              },
              { id: "mx-nl-spgg-casco", name: "Casco Urbano", kind: "zone" },
            ],
          },
          { id: "mx-nl-guadalupe", name: "Guadalupe", kind: "city" },
          { id: "mx-nl-apodaca", name: "Apodaca", kind: "city" },
          {
            id: "mx-nl-santacatarina",
            name: "Santa Catarina",
            kind: "city",
          },
          { id: "mx-nl-santiago", name: "Santiago", kind: "city" },
        ],
      },
      {
        id: "mx-cdmx",
        name: "Ciudad de México",
        kind: "state",
        children: [
          {
            id: "mx-cdmx-mh",
            name: "Miguel Hidalgo",
            kind: "city",
            children: [
              { id: "mx-cdmx-mh-polanco", name: "Polanco", kind: "zone" },
              { id: "mx-cdmx-mh-lomas", name: "Lomas", kind: "zone" },
            ],
          },
          {
            id: "mx-cdmx-cuauhtemoc",
            name: "Cuauhtémoc",
            kind: "city",
            children: [
              { id: "mx-cdmx-roma", name: "Roma Norte", kind: "zone" },
              { id: "mx-cdmx-condesa", name: "Condesa", kind: "zone" },
              { id: "mx-cdmx-juarez", name: "Juárez", kind: "zone" },
              {
                id: "mx-cdmx-centro",
                name: "Centro Histórico",
                kind: "zone",
              },
            ],
          },
          { id: "mx-cdmx-coyoacan", name: "Coyoacán", kind: "city" },
        ],
      },
      {
        id: "mx-jal",
        name: "Jalisco",
        kind: "state",
        children: [
          {
            id: "mx-jal-gdl",
            name: "Guadalajara",
            kind: "city",
            children: [
              { id: "mx-jal-gdl-chapultepec", name: "Chapultepec", kind: "zone" },
              { id: "mx-jal-gdl-providencia", name: "Providencia", kind: "zone" },
            ],
          },
          { id: "mx-jal-zapopan", name: "Zapopan", kind: "city" },
        ],
      },
      {
        id: "mx-qroo",
        name: "Quintana Roo",
        kind: "state",
        children: [
          { id: "mx-qroo-cancun", name: "Cancún", kind: "city" },
          { id: "mx-qroo-tulum", name: "Tulum", kind: "city" },
          {
            id: "mx-qroo-playa",
            name: "Playa del Carmen",
            kind: "city",
          },
        ],
      },
    ],
  },
  {
    id: "us",
    name: "United States",
    kind: "country",
    children: [
      {
        id: "us-tx",
        name: "Texas",
        kind: "state",
        children: [
          { id: "us-tx-austin", name: "Austin", kind: "city" },
          { id: "us-tx-houston", name: "Houston", kind: "city" },
          { id: "us-tx-sanantonio", name: "San Antonio", kind: "city" },
        ],
      },
      {
        id: "us-fl",
        name: "Florida",
        kind: "state",
        children: [{ id: "us-fl-miami", name: "Miami", kind: "city" }],
      },
    ],
  },
  {
    id: "es",
    name: "España",
    kind: "country",
    children: [
      {
        id: "es-mad",
        name: "Comunidad de Madrid",
        kind: "state",
        children: [{ id: "es-mad-madrid", name: "Madrid", kind: "city" }],
      },
      {
        id: "es-cat",
        name: "Cataluña",
        kind: "state",
        children: [{ id: "es-cat-bcn", name: "Barcelona", kind: "city" }],
      },
    ],
  },
];

/** Root-to-node trail for a zone id, or null when the id isn't in the tree. */
export function findZoneTrail(id: string): ZoneNode[] | null {
  const walk = (nodes: ZoneNode[], trail: ZoneNode[]): ZoneNode[] | null => {
    for (const node of nodes) {
      const next = [...trail, node];
      if (node.id === id) return next;
      if (node.children) {
        const hit = walk(node.children, next);
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(ZONE_TREE, []);
}

// The What filter's options are the six place FAMILIES — a real contract, so
// they live in @/lib/place-families, not in this mock.

/** "8:00 PM"-style label for a 0–23 hour. */
export function formatHourLabel(hour: number): string {
  const clamped = Math.min(23, Math.max(0, Math.round(hour)));
  const suffix = clamped < 12 ? "AM" : "PM";
  const base = clamped % 12 === 0 ? 12 : clamped % 12;
  return `${base}:00 ${suffix}`;
}

/** Randomness descriptor — 1 plays it safe, 10 is full surprise. */
export function randomnessLabel(level: number): string {
  if (level <= 2) return "Proven favorites";
  if (level <= 4) return "Mostly safe bets";
  if (level <= 6) return "Balanced mix";
  if (level <= 8) return "Adventurous";
  return "Full surprise";
}
