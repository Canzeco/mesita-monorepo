import { getAtlasFields } from "./actions";
import { ErrorNote } from "@/components/ErrorNote";
import { AtlasFieldsClient } from "./AtlasFieldsClient";

export default async function AtlasConfigPage() {
  const result = await getAtlasFields();
  if (!result.ok) return <ErrorNote message={result.error} size="page" />;

  return <AtlasFieldsClient data={result.data} />;
}
