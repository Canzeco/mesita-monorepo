// supabase-edgefunc-sync-reservationist · mode "knowledge".
//
// One KB doc per agent — knowledgeFor(agent): the shared facts plus the
// agent's role — attached as that agent's sole doc on Main.

import { failedVerification, type WorkspaceCtx } from "./context.ts";
import { elFetch, resolveMainBranchId, type VersionedAgentShape } from "../el-client.ts";
import { json } from "../../_shared/http.ts";
import { FLEET, kbDocName, knowledgeFor } from "../../_shared/reservationist/index.ts";

/** Pre-fleet shared doc — deleted once no agent references it. */
const LEGACY_DOC_NAME = "mesita-reservationist-context (es-mx)";

export async function knowledge(ctx: WorkspaceCtx): Promise<Response> {
  const { key, mode, agentsConfig, configuredAgents, saveAgentsConfig } = ctx;
  // Each agent's KB page ends with EXACTLY one doc, named a1-kb-v6 … (the
  // name says owner + content version). Saved ids are renamed in place.
  const savedDocIds = (agentsConfig.knowledgeDocIds ?? {}) as Record<
    string,
    string | undefined
  >;
  const legacySavedId = typeof agentsConfig.knowledgeDocId === "string"
    ? agentsConfig.knowledgeDocId.trim()
    : "";

  // Workspace docs by name — adopt console-created docs instead of duplicating.
  const docIdByName = new Map<string, string>();
  {
    const listed = await elFetch(key, "/v1/convai/knowledge-base?page_size=100");
    if (listed.ok) {
      const docs = (listed.body as {
        documents?: Array<{ id?: string; name?: string }>;
      } | null)?.documents ??
        (Array.isArray(listed.body)
          ? listed.body as Array<{ id?: string; name?: string }>
          : []);
      for (const d of docs) {
        if (d.id && d.name) docIdByName.set(d.name, d.id);
      }
    }
  }

  const docsOut: Record<string, string> = {};
  const retired: string[] = [];
  const attachReport: Array<Record<string, unknown>> = [];

  for (const spec of FLEET) {
    const id = configuredAgents[spec.key]?.id?.trim();
    if (!id) {
      return json({
        ok: false,
        error: `agents_config.agents.${spec.key}.id missing — run mode fleet first`,
        attachReport,
      }, 400);
    }
    const docName = kbDocName(spec.key);
    const text = knowledgeFor(spec);

    // 1 · Reuse this agent's doc (saved id, else exact name) only when a
    // read-back shows the new text landed; otherwise create a fresh doc and
    // retire the old one once the new one is attached.
    let docId = "";
    let docAction = "created";
    const candidate = (savedDocIds[spec.key] ?? "").trim() || docIdByName.get(docName) || "";
    if (candidate) {
      const path = `/v1/convai/knowledge-base/${encodeURIComponent(candidate)}`;
      await elFetch(key, path, { method: "PATCH", body: { name: docName, content: text } });
      const got = await elFetch(key, path);
      const html = got.ok ? String((got.body as { extracted_inner_html?: unknown }).extracted_inner_html ?? "") : "";
      const name = got.ok ? (got.body as { name?: string }).name : null;
      if (name === docName && docHasText(html, spec.roleLines)) {
        docId = candidate;
        docAction = "updated";
      } else if (got.ok) {
        retired.push(candidate);
      }
    }
    if (!docId) {
      const crt = await elFetch(key, "/v1/convai/knowledge-base/text", {
        method: "POST",
        body: { name: docName, text },
      });
      if (!crt.ok) {
        return json({ ok: false, error: `kb create ${docName}: ${crt.error}` }, 502);
      }
      docId = ((crt.body as { id?: string } | null)?.id) ?? "";
      if (!docId) {
        return json({
          ok: false,
          error: `kb create ${docName} returned no id: ${
            JSON.stringify(crt.body).slice(0, 300)
          }`,
        }, 502);
      }
    }
    docsOut[spec.key] = docId;
    docIdByName.set(docName, docId);

    // 2 · Attach as the SOLE doc on Main (replace, never merge).
    const before = await elFetch(key, `/v1/convai/agents/${encodeURIComponent(id)}`);
    if (!before.ok) {
      return json({ ok: false, error: `get ${spec.key}: ${before.error}`, attachReport }, 502);
    }
    const tip = before.body as VersionedAgentShape;
    const branch = await resolveMainBranchId(key, id, tip);
    if (!branch.ok) {
      return json({ ok: false, error: `branch ${spec.key}: ${branch.error}`, attachReport }, 502);
    }
    const path = `/v1/convai/agents/${encodeURIComponent(id)}?branch_id=${
      encodeURIComponent(branch.branchId)
    }`;
    const patch = await elFetch(key, path, {
      method: "PATCH",
      body: {
        conversation_config: {
          agent: {
            prompt: {
              knowledge_base: [
                { type: "text", name: docName, id: docId, usage_mode: "prompt" },
              ],
            },
          },
        },
        version_description: `Mesita KB ${docName} — sole doc (ASDM sync)`,
      },
    });
    if (!patch.ok) {
      return json({ ok: false, error: `attach ${spec.key}: ${patch.error}`, attachReport }, 502);
    }
    const after = await elFetch(key, path);
    const afterKb = after.ok
      ? ((after.body as {
        conversation_config?: {
          agent?: { prompt?: { knowledge_base?: Array<{ id?: string; name?: string }> } };
        };
      }).conversation_config?.agent?.prompt?.knowledge_base ?? [])
      : [];
    const sole = afterKb.length === 1 && afterKb[0]?.id === docId;
    attachReport.push({
      key: spec.key,
      id,
      branch_id: branch.branchId,
      document: { id: docId, name: docName, action: docAction },
      knowledge_base: afterKb.map((d) => ({ id: d.id, name: d.name })),
      ok: sole,
    });
  }

  // 3 · The shared pre-fleet doc is unreferenced now — delete it (best effort).
  const fleetDocIds = new Set(Object.values(docsOut));
  const legacyId = legacySavedId || docIdByName.get(LEGACY_DOC_NAME) || "";
  let legacyCleanup: Record<string, unknown> | null = null;
  if (legacyId && !fleetDocIds.has(legacyId)) {
    let del = await elFetch(
      key,
      `/v1/convai/knowledge-base/${encodeURIComponent(legacyId)}`,
      { method: "DELETE" },
    );
    if (!del.ok) {
      del = await elFetch(
        key,
        `/v1/convai/knowledge-base/${encodeURIComponent(legacyId)}?force=true`,
        { method: "DELETE" },
      );
    }
    legacyCleanup = {
      id: legacyId,
      action: del.ok ? "deleted" : "delete-failed (non-fatal)",
      error: del.ok ? null : del.error,
    };
  }

  // Docs replaced by fresh ones this run (now detached) — best effort.
  const retiredCleanup: Array<Record<string, unknown>> = [];
  for (const old of retired) {
    if (fleetDocIds.has(old)) continue;
    const del = await elFetch(key, `/v1/convai/knowledge-base/${encodeURIComponent(old)}?force=true`, {
      method: "DELETE",
    });
    retiredCleanup.push({ id: old, action: del.ok ? "deleted" : "delete-failed (non-fatal)" });
  }

  // 4 · Persist the per-agent ids (drop the legacy single-doc key).
  const nextConfig: Record<string, unknown> = {
    ...agentsConfig,
    knowledgeDocIds: docsOut,
    knowledgeSyncedAt: new Date().toISOString(),
  };
  delete nextConfig.knowledgeDocId;
  const { error: saveErr } = await saveAgentsConfig(nextConfig);

  const result = {
    mode,
    documents: FLEET.map((s) => ({
      key: s.key,
      id: docsOut[s.key] ?? null,
      name: kbDocName(s.key),
      chars: knowledgeFor(s).length,
    })),
    agents: attachReport,
    legacy: legacyCleanup,
    retired: retiredCleanup,
    config_saved: !saveErr,
    config_error: saveErr?.message ?? null,
  };
  if (saveErr) {
    return json({ ok: false, error: `config_save: ${saveErr.message}`, ...result }, 500);
  }
  const failed = failedVerification(attachReport);
  if (failed) return json({ ok: false, error: failed, ...result }, 502);
  return json({ ok: true, ...result });
}

/** Plain letters and digits only — HTML wrapping and punctuation fall away. */
function plain(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** True when the doc read back holds this text: the money line and the
 *  agent's own role lines. */
function docHasText(html: string, roleLines: string[]): boolean {
  const h = plain(html);
  return h.includes(plain("Mesita sí maneja dinero, siempre dentro de la app")) &&
    roleLines.slice(1).every((l) => h.includes(plain(l)));
}
