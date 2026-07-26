import { getAtlasFields } from "../actions";
import { AtlasSettingsError } from "@/components/AtlasSettingsError";
import { AtlasFieldsClient } from "../AtlasFieldsClient";

// Atlas Config · Config — the profile spec: the edit matrix, the controlled
// vocabulary (categories, tags, facets), and the field limits.
export const dynamic = "force-dynamic";

export default async function AtlasConfigPage() {
  const result = await getAtlasFields();
  if (!result.ok) return <AtlasSettingsError error={result.error} />;

  return <AtlasFieldsClient data={result.data} />;
}
