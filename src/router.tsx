import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // One client per request: a module-level QueryClient leaks cached data between SSR requests.
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // Start loading the destination as soon as the user touches/focuses a menu link.
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    scrollRestoration: true,
    // Lets Query own freshness; set caching defaults on the QueryClient, not the router.
    // Keep intent-prefetched routes warm long enough for the next tap.
    defaultPreloadStaleTime: 120_000,
  });

  return router;
};
