// What the operator actually changes. Fixtures stay the database; this is the
// write path the screens were missing — Publish, a dish, a template, a domain.
//
// IN MEMORY, same reason Profile edits are: a photo or a long menu must not
// depend on localStorage's quota, and a reload returning to the fixtures is
// what this app already promises. One object, replaced on every write, so
// useSyncExternalStore can compare it by identity.
import { MENU_SECTIONS, MOCK_NOW } from "@/mock/fixtures";
import type { World } from "@/mock/scenario";
import type {
  CampaignState,
  LineState,
  MockCreditCampaign,
  MockDish,
  MockMenuSection,
  MockOrdersConfig,
  MockPlace,
  OrderChannel,
  OrderChannelState,
  ReviewSource,
  ReviewSourceState,
  WebsiteState,
  WebsiteTemplate,
} from "@/mock/types";

export type MenuDoc = { sections: MockMenuSection[] };

export type PlaceDesk = {
  menu?: MenuDoc;
  /** The version guests and the Express Website read. Edits live on `menu` until Publish. */
  publishedMenu?: MenuDoc;
  menuPublishedAt?: string | null;
  websiteState?: WebsiteState;
  websiteTemplate?: WebsiteTemplate | null;
  websiteDomain?: string | null;
  websiteAdsPaused?: boolean;
  ordersPaused?: boolean;
  orderChannels?: Partial<Record<OrderChannel, OrderChannelState>>;
  reviewSources?: Partial<Record<ReviewSource, ReviewSourceState>>;
  lineState?: LineState;
  notificationsNumber?: string | null;
  reservationProvider?: string;
  campaignOverrides?: Record<string, Partial<MockCreditCampaign>>;
  extraCampaigns?: MockCreditCampaign[];
};

export type DeskState = {
  places: Record<string, PlaceDesk>;
  tick: number;
};

const EMPTY: DeskState = Object.freeze({ places: Object.freeze({}), tick: 0 });

let state: DeskState = EMPTY;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeDesk(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function getDesk(): DeskState {
  return state;
}

export function getServerDesk(): DeskState {
  return EMPTY;
}

export function resetDesk(): void {
  state = EMPTY;
  emit();
}

function patch(placeId: string, next: PlaceDesk): void {
  state = {
    tick: state.tick,
    places: { ...state.places, [placeId]: { ...state.places[placeId], ...next } },
  };
  emit();
}

function bumpTick(): string {
  const tick = state.tick + 1;
  state = { ...state, tick };
  return new Date(MOCK_NOW.getTime() + tick * 1000).toISOString();
}

export function menuSectionsOf(placeId: string, desk: DeskState = state): MockMenuSection[] {
  return desk.places[placeId]?.menu?.sections ?? (MENU_SECTIONS as MockMenuSection[]);
}

/** What a guest and the live site read. A place that has never published
 *  returns nothing. A published place with no newer stamp still reads the
 *  fixture menu. */
export function publishedSectionsOf(
  placeId: string,
  publishedAt: string | null,
  desk: DeskState = state,
): MockMenuSection[] {
  if (!publishedAt) return [];
  return desk.places[placeId]?.publishedMenu?.sections ?? (MENU_SECTIONS as MockMenuSection[]);
}

function writeMenu(placeId: string, sections: MockMenuSection[]): void {
  patch(placeId, { menu: { sections } });
}

function cloneMenu(placeId: string): MockMenuSection[] {
  return structuredClone(menuSectionsOf(placeId));
}

export function publishMenu(placeId: string): void {
  const sections = cloneMenu(placeId);
  const at = bumpTick();
  patch(placeId, { menuPublishedAt: at, publishedMenu: { sections } });
}

export function addSection(placeId: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const sections = cloneMenu(placeId);
  sections.push({ id: `sec_${state.tick}_${sections.length}`, name: trimmed, dishes: [] });
  writeMenu(placeId, sections);
}

export function addDish(placeId: string, sectionId: string, dish: Omit<MockDish, "id">): void {
  const sections = cloneMenu(placeId);
  const section = sections.find((s) => s.id === sectionId);
  if (!section || !dish.name.trim()) return;
  section.dishes.push({ ...dish, id: `dish_${state.tick}_${section.dishes.length}`, name: dish.name.trim() });
  writeMenu(placeId, sections);
}

export function updateDish(placeId: string, dishId: string, dish: Omit<MockDish, "id">): void {
  const sections = cloneMenu(placeId);
  for (const section of sections) {
    const i = section.dishes.findIndex((d) => d.id === dishId);
    if (i >= 0) {
      section.dishes[i] = { ...dish, id: dishId, name: dish.name.trim() || section.dishes[i].name };
      writeMenu(placeId, sections);
      return;
    }
  }
}

export function deleteDish(placeId: string, dishId: string): void {
  const sections = cloneMenu(placeId).map((s) => ({
    ...s,
    dishes: s.dishes.filter((d) => d.id !== dishId),
  }));
  writeMenu(placeId, sections);
}

/** Seed the fixture menu when a place has none of its own yet. */
export function buildMenuDraft(placeId: string): void {
  if (state.places[placeId]?.menu) return;
  writeMenu(placeId, structuredClone(MENU_SECTIONS) as MockMenuSection[]);
}

export function pickWebsiteTemplate(placeId: string, template: WebsiteTemplate, current: WebsiteState): void {
  const websiteState: WebsiteState = current === "none" ? "picked" : current;
  patch(placeId, { websiteTemplate: template, websiteState });
}

export function generateWebsite(placeId: string): void {
  patch(placeId, { websiteState: "preview" });
}

export function publishWebsite(placeId: string): void {
  patch(placeId, { websiteState: "published" });
}

export function setWebsiteDomain(placeId: string, domain: string): void {
  const trimmed = domain.trim();
  patch(placeId, { websiteDomain: trimmed || null });
}

export function toggleWebsiteAds(placeId: string, paused: boolean): void {
  patch(placeId, { websiteAdsPaused: paused });
}

export function setOrdersPaused(placeId: string, paused: boolean): void {
  patch(placeId, { ordersPaused: paused });
}

const CHANNEL_NEXT: Partial<Record<OrderChannelState, OrderChannelState>> = {
  disconnected: "connected",
  token_expired: "connected",
  catalog_conflict: "connected",
};

export function advanceOrderChannel(placeId: string, channel: OrderChannel, current: OrderChannelState): void {
  const next = CHANNEL_NEXT[current];
  if (!next) return;
  const prev = state.places[placeId]?.orderChannels ?? {};
  patch(placeId, { orderChannels: { ...prev, [channel]: next } });
}

export function toggleReviewSource(placeId: string, source: ReviewSource, current: ReviewSourceState): void {
  const prev = state.places[placeId]?.reviewSources ?? {};
  patch(placeId, {
    reviewSources: {
      ...prev,
      [source]: {
        connected: !current.connected,
        lastSyncedAt: current.connected ? null : bumpTick(),
      },
    },
  });
}

export function turnOnLine(placeId: string): void {
  patch(placeId, { lineState: "activating" });
}

export function setNotificationsNumber(placeId: string, value: string): void {
  patch(placeId, { notificationsNumber: value });
}

const PROVIDERS = ["Mesita", "OpenTable", "SevenRooms"] as const;

export function cycleReservationProvider(placeId: string): void {
  const current = state.places[placeId]?.reservationProvider ?? "Mesita";
  const i = PROVIDERS.indexOf(current as (typeof PROVIDERS)[number]);
  patch(placeId, { reservationProvider: PROVIDERS[(i + 1) % PROVIDERS.length] });
}

const CAMPAIGN_NEXT: Partial<Record<CampaignState, CampaignState>> = {
  draft: "selling",
  scheduled: "selling",
  selling: "closed",
  sold_out: "selling",
  expired: "redeeming",
};

export function advanceCampaign(placeId: string, campaign: MockCreditCampaign): void {
  const next = CAMPAIGN_NEXT[campaign.state];
  if (!next) return;
  const prev = state.places[placeId]?.campaignOverrides ?? {};
  const cap = next === "selling" && campaign.state === "sold_out" ? campaign.capCents + 50000 : campaign.capCents;
  patch(placeId, { campaignOverrides: { ...prev, [campaign.id]: { state: next, capCents: cap } } });
}

export function addCampaign(placeId: string): void {
  const start = MOCK_NOW.toISOString();
  const end = new Date(MOCK_NOW.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const campaign: MockCreditCampaign = {
    id: `cmp_${state.tick}_${placeId}`,
    placeId,
    name: "Lunch credit",
    payCents: 80000,
    getCents: 100000,
    capCents: 500000,
    soldCents: 0,
    perGuestCents: 80000,
    startsAt: start,
    endsAt: end,
    redeemUntil: end,
    state: "draft",
  };
  const extra = state.places[placeId]?.extraCampaigns ?? [];
  patch(placeId, { extraCampaigns: [...extra, campaign] });
}

export function campaignsFor(placeId: string, fixtures: readonly MockCreditCampaign[], desk: DeskState = state): MockCreditCampaign[] {
  const d = desk.places[placeId];
  const overrides = d?.campaignOverrides ?? {};
  const extra = d?.extraCampaigns ?? [];
  return [...fixtures, ...extra].map((c) => ({ ...c, ...overrides[c.id] }));
}

export function applyDesk(world: World, desk: DeskState): World {
  if (desk === EMPTY || Object.keys(desk.places).length === 0) return world;
  return {
    ...world,
    places: world.places.map((place) => applyPlace(place, desk.places[place.id])),
  };
}

function applyPlace(place: MockPlace, d: PlaceDesk | undefined): MockPlace {
  if (!d) return place;
  let orders: MockOrdersConfig | null = place.orders;
  if (d.ordersPaused !== undefined && orders) orders = { ...orders, paused: d.ordersPaused };
  return {
    ...place,
    ...(d.menuPublishedAt !== undefined ? { menuPublishedAt: d.menuPublishedAt } : {}),
    ...(d.websiteState !== undefined ? { websiteState: d.websiteState } : {}),
    ...(d.websiteTemplate !== undefined ? { websiteTemplate: d.websiteTemplate } : {}),
    ...(d.websiteDomain !== undefined ? { websiteDomain: d.websiteDomain } : {}),
    ...(d.lineState !== undefined ? { lineState: d.lineState } : {}),
    ...(d.notificationsNumber !== undefined ? { notificationsNumber: d.notificationsNumber } : {}),
    ...(orders !== place.orders ? { orders } : {}),
    ...(d.orderChannels ? { orderChannels: { ...place.orderChannels, ...d.orderChannels } } : {}),
    ...(d.reviewSources ? { reviewSources: { ...place.reviewSources, ...d.reviewSources } } : {}),
  };
}
