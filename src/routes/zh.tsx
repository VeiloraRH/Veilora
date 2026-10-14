import { createFileRoute } from "@tanstack/react-router";
import { GlassHero } from "@/components/hero/GlassHero";
import { Landing } from "@/components/landing/Landing";

export const Route = createFileRoute("/zh")({
  component: () => (
    <>
      <GlassHero locale="zh" />
      <Landing locale="zh" />
    </>
  ),
});
