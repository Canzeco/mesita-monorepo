import SearchChatPage from "./page";

// /search/chat's Suspense fallback is the page itself (Pato, MESITA-2701:
// "the placeholders must be similar to the page you are loading, like the
// sizes"). Ask AI is Soon (MESITA-2168) and every block on it is fixed: the
// white band with its way back to Search, then the Soon state. So its
// frame IS the page and nothing moves when it lands. Without this file the
// nearest boundary is Search's map skeleton (search/loading.tsx). When Memo
// mounts here and the page fetches, draw that page's skeleton instead.
export default function SearchChatLoading() {
  return <SearchChatPage />;
}
