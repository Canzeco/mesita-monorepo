import { FlaskIcon } from "@phosphor-icons/react/dist/ssr";

// Extra › Story (MESITA-4522). The route is /story-test so it is not a child
// of /stories-config: the rail lights a row by prefix.
export const STORY_TEST_PARENT = {
  href: "/story-test",
  label: "Story",
  Icon: FlaskIcon,
} as const;
