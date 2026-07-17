// Place selection + session persistence for staff WhatsApp Type A.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type {
  SessionRow,
  StaffContext,
  StaffIdentity,
  StaffPlace,
  PlaceOption,
} from "./staff-whatsapp-types.ts";

export async function loadSession(
  admin: SupabaseClient,
  phoneE164: string,
): Promise<SessionRow | null> {
  const existing = await admin
    .from("staff_whatsapp_sessions")
    .select("*")
    .eq("phone_e164", phoneE164)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  return existing.data ? (existing.data as SessionRow) : null;
}

export async function enterPlaceSelection(
  admin: SupabaseClient,
  identity: StaffIdentity,
  session: SessionRow | null,
  places: StaffPlace[],
): Promise<SessionRow> {
  const options: PlaceOption[] = places.map((v) => ({
    project_id: v.projectId,
    name: v.placeName,
  }));

  if (session) {
    const updated = await admin
      .from("staff_whatsapp_sessions")
      .update({
        state: "selecting_project",
        project_id: null,
        consumer_id: null,
        ticket_id: null,
        pending_consumer_code: null,
        context: { place_options: options },
      })
      .eq("id", session.id)
      .select("*")
      .single();
    if (updated.error) throw new Error(updated.error.message);
    return updated.data as SessionRow;
  }

  const inserted = await admin
    .from("staff_whatsapp_sessions")
    .insert({
      phone_e164: identity.phoneE164,
      staff_user_id: identity.staffUserId,
      project_id: null,
      state: "selecting_project",
      context: { place_options: options },
    })
    .select("*")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  return inserted.data as SessionRow;
}

export async function applyActivePlace(
  admin: SupabaseClient,
  identity: StaffIdentity,
  session: SessionRow | null,
  place: StaffPlace,
): Promise<SessionRow> {
  if (session) {
    const updated = await admin
      .from("staff_whatsapp_sessions")
      .update({
        project_id: place.projectId,
        state: "idle",
        staff_user_id: identity.staffUserId,
        consumer_id: null,
        ticket_id: null,
        pending_consumer_code: null,
        context: {},
      })
      .eq("id", session.id)
      .select("*")
      .single();
    if (updated.error) throw new Error(updated.error.message);
    return updated.data as SessionRow;
  }

  const inserted = await admin
    .from("staff_whatsapp_sessions")
    .insert({
      phone_e164: identity.phoneE164,
      staff_user_id: identity.staffUserId,
      project_id: place.projectId,
      state: "idle",
    })
    .select("*")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  return inserted.data as SessionRow;
}

export async function resolveActivePlace(
  admin: SupabaseClient,
  identity: StaffIdentity,
  session: SessionRow | null,
): Promise<
  | { kind: "ok"; staff: StaffContext; session: SessionRow }
  | { kind: "need_selection"; session: SessionRow }
> {
  const places = identity.places;
  if (places.length === 0) {
    throw new Error("staff has no project_roles");
  }

  if (places.length === 1) {
    const sessionOut = await applyActivePlace(admin, identity, session, places[0]);
    return {
      kind: "ok",
      staff: { ...identity, ...places[0] },
      session: sessionOut,
    };
  }

  if (!session) {
    const created = await enterPlaceSelection(admin, identity, null, places);
    return { kind: "need_selection", session: created };
  }

  if (session.state === "selecting_project" || !session.project_id) {
    return { kind: "need_selection", session };
  }

  const active = places.find((v) => v.projectId === session.project_id);
  if (!active) {
    const created = await enterPlaceSelection(admin, identity, session, places);
    return { kind: "need_selection", session: created };
  }

  if (session.staff_user_id !== identity.staffUserId) {
    await admin
      .from("staff_whatsapp_sessions")
      .update({ staff_user_id: identity.staffUserId })
      .eq("id", session.id);
  }

  return {
    kind: "ok",
    staff: { ...identity, ...active },
    session,
  };
}

export async function resetSession(
  admin: SupabaseClient,
  sessionId: string,
  projectId: string | null,
) {
  await admin
    .from("staff_whatsapp_sessions")
    .update({
      state: projectId ? "idle" : "selecting_project",
      consumer_id: null,
      ticket_id: null,
      pending_consumer_code: null,
      context: {},
    })
    .eq("id", sessionId);
}
