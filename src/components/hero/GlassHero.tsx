import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { createGlassScene, type GlassScene } from "./glass-scene";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { useTheme } from "@/lib/theme";
import "./hero.css";

const DOTS = [0, 1, 2];

export function GlassHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<GlassScene | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [activeDot, setActiveDot] = useState(1);
  const { theme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const scene = createGlassScene(canvasRef.current!, () => setLoaded(true), themeRef.current);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setTheme(theme);
  }, [theme]);

  return (
    <section className="hero" id="hero" data-theme={theme}>
      <canvas id="scene" ref={canvasRef} aria-label="Rotatable glass cube. Drag to rotate." />
      <div className="ui">
        <h1 className="sr-only">Veilora: shield every move</h1>
        <header className="nav">
          <a href="/" className="logo" aria-label="Veilora home">
            <img className="logo-mark" src="/brand/veilora-mark.png" alt="" width={40} height={40} />
            <span>Veilora</span>
          </a>
          <ul className="nav-links">
            <li><a href="#how-it-works">Product</a></li>
            <li><a href="#privacy">Privacy</a></li>
            <li><Link to="/roadmap">Roadmap</Link></li>
            <li><Link to="/whitepaper">Whitepaper</Link></li>
            <li><Link to="/app">Launch App</Link></li>
            <li className="theme-li"><ThemeToggle className="hero-toggle" /></li>
          </ul>
        </header>

        <div className="arrows">
          <button className="arrow" id="prev" aria-label="Previous" onClick={() => sceneRef.current?.spin(-1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </button>
          <button className="arrow" id="next" aria-label="Next" onClick={() => sceneRef.current?.spin(1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>

        <nav className="dots">
          {DOTS.map((i) => (
            <button
              key={i}
              className={i === activeDot ? "dot active" : "dot"}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === activeDot}
              onClick={() => setActiveDot(i)}
            />
          ))}
        </nav>

        <p className="tagline">
          Move quietly.
          <br />
          Stay in <strong>control.</strong>
        </p>

        <div className="cta-row">
          <Link to="/app" className="cta">Plan your first move</Link>
          <span className="cta-line" />
          <span className="count" aria-hidden="true">01</span>
        </div>

        <div className={loaded ? "loader done" : "loader"} id="loader">Loading model</div>
      </div>
    </section>
  );
}
