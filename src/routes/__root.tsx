import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ModeProvider } from "@/lib/mode";

export const Route = createRootRoute({
  component: () => (
    <ModeProvider>
      <Outlet />
    </ModeProvider>
  ),
});
