import { getAtlasFields } from "../actions";
import { AtlasSettingsError } from "../AtlasSettingsError";
import { AtlasFieldsClient } from "../AtlasFieldsClient";

export const dynamic = "force-dynamic";

export default async function AtlasConfigPage() {
  const result = await getAtlasFields();
  if (!result.ok) return <AtlasSettingsError error={result.error} />;

  return <AtlasFieldsClient data={result.data} />;
}
