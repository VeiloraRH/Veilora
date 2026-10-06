import { createFileRoute } from "@tanstack/react-router";
import { GlassHero } from "@/components/hero/GlassHero";
import { Landing } from "@/components/landing/Landing";

export const Route = createFileRoute("/")({
  component: () => (
    <>
      <GlassHero />
      <Landing />
    </>
  ),
});
