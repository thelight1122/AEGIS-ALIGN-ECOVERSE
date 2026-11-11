// The Aether backdrop: a full-screen shader canvas behind the page content.
// Mounts on <canvas id="aether-canvas">; nexus-ether.js imports this for the immersive shells.
import { Clock, OrthographicCamera, Scene, WebGLRenderer } from "three";
import { createAetherBackground } from "./aether-background.js";

// Pages that carry the 3D scene canvas but no Aether canvas get one created here,
// so every immersive shell shares the same backdrop without template changes.
function findOrCreateCanvas() {
  const existing = document.getElementById("aether-canvas");
  if (existing) return existing;
  const sceneCanvas = document.getElementById("ether-canvas");
  if (!sceneCanvas) return null;
  const created = document.createElement("canvas");
  created.id = "aether-canvas";
  created.setAttribute("aria-hidden", "true");
  sceneCanvas.before(created);
  return created;
}

const canvas = findOrCreateCanvas();

if (canvas) {
  let renderer = null;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false });
  } catch {
    // No WebGL: the canvas stays hidden and the page's CSS background shows.
    canvas.hidden = true;
  }

  if (renderer) {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const aether = createAetherBackground();
    const clock = new Clock();
    let frame = 0;
    let lost = false;

    scene.add(aether.mesh);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));

    const draw = () => {
      aether.setTime(motionPreference.matches ? 0 : clock.getElapsedTime());
      renderer.render(scene, camera);
    };

    const stop = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
    };

    const tick = () => {
      frame = 0;
      if (lost || document.hidden || motionPreference.matches) return;
      draw();
      frame = window.requestAnimationFrame(tick);
    };

    // One owned animation frame at a time. Hidden or lost views never schedule;
    // reduced motion draws a single still frame.
    const reconcile = () => {
      stop();
      if (lost || document.hidden) return;
      draw();
      if (!motionPreference.matches) frame = window.requestAnimationFrame(tick);
    };

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      aether.setSize(window.innerWidth, window.innerHeight);
      reconcile();
    };

    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      lost = true;
      stop();
      canvas.style.visibility = "hidden";
      document.documentElement.classList.remove("aether-live");
    });
    canvas.addEventListener("webglcontextrestored", () => {
      lost = false;
      canvas.style.visibility = "";
      document.documentElement.classList.add("aether-live");
      reconcile();
    });
    motionPreference.addEventListener("change", reconcile);
    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("resize", resize);
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", reconcile);

    resize();
    document.documentElement.classList.add("aether-live");
  }
}
