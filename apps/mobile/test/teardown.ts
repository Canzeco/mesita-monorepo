// The cache keeps reads for a day and Auth refreshes on a timer: both would
// hold a finished jest worker open. Required late, so a file's own mocks hold.
afterAll(() => {
  jest.useRealTimers();
  const { queryClient } = jest.requireActual<typeof import("@/lib/query")>("@/lib/query");
  const { supabase } = jest.requireActual<typeof import("@/lib/supabase")>("@/lib/supabase");
  queryClient.clear();
  return supabase.auth.stopAutoRefresh();
});
