import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppShell } from "@/components/app/AppShell";
import { PageLoader } from "@/components/app/ui-bits";
import { getSupabase } from "@/lib/supabase";

// Session lives in localStorage, so the protected area renders client-side only.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const sb = getSupabase();
    if (!sb) throw redirect({ to: "/setup" });
    const { data } = await sb.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { userEmail: data.session.user.email ?? null };
  },
  pendingComponent: PageLoader,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { userEmail } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = sb.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        qc.clear();
        navigate({ to: "/login", replace: true });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, qc]);

  return (
    <AppShell email={userEmail}>
      <Outlet />
    </AppShell>
  );
}
