import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ModeProvider } from "@/lib/mode";
import { ThemeProvider } from "@/lib/theme";

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider>
      <ModeProvider>
        <Outlet />
      </ModeProvider>
    </ThemeProvider>
  ),
});
