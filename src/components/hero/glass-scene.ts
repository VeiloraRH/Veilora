import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const MODEL_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260929_212926_92423081-b0e4-4f5a-b650-14af6c05c058.glb";

const HEADLINE = ["Shield", "Every", "Move"];
// Brand colours (logo navy, glow and cream).
const BG = "#0c142b";
const GLOW = "#1b2b4a";
const INK = "#f4ead8";
const FOV = 30;
const CAM_Z = 10;

export interface GlassScene {
  spin(direction: -1 | 1): void;
  dispose(): void;
}

const bgVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const bgFragment = /* glsl */ `
uniform sampler2D uTex;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(uTex, vUv);
#include <colorspace_fragment>
}
`;

const glassVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vEye;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vec4 mvPos = viewMatrix * worldPos;
  gl_Position = projectionMatrix * mvPos;
  vNormal = normalize(normalMatrix * normal);
  vEye = normalize(mvPos.xyz);
}
`;

const glassFragment = /* glsl */ `
uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uIorR;
uniform float uIorY;
uniform float uIorG;
uniform float uIorC;
uniform float uIorB;
uniform float uIorP;
uniform float uRefractPower;
uniform float uChromatic;
uniform float uSaturation;
uniform float uShininess;
uniform float uDiffuseness;
uniform float uFresnelPower;
uniform float uBackside;
uniform vec3 uLight;

varying vec3 vNormal;
varying vec3 vEye;

const int LOOP = 16;

vec3 saturate3(vec3 rgb, float amount) {
  float l = dot(rgb, vec3(0.2125, 0.7154, 0.0721));
  return mix(vec3(l), rgb, amount);
}

float specular(vec3 light, float shininess, float diffuseness, vec3 n, vec3 eye) {
  vec3 lightVector = normalize(-light);
  vec3 halfVector = normalize(-eye + lightVector);
  float kDiffuse = max(0.0, dot(n, lightVector));
  return pow(max(dot(n, halfVector), 0.0), shininess) + kDiffuse * diffuseness;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec3 n = normalize(vNormal);
  // three.js flips winding for BackSide, so gl_FrontFacing is unreliable here.
  if (uBackside > 0.5) n = -n;
  vec3 eye = normalize(vEye);

  vec3 rR = refract(eye, n, 1.0 / uIorR);
  vec3 rY = refract(eye, n, 1.0 / uIorY);
  vec3 rG = refract(eye, n, 1.0 / uIorG);
  vec3 rC = refract(eye, n, 1.0 / uIorC);
  vec3 rB = refract(eye, n, 1.0 / uIorB);
  vec3 rP = refract(eye, n, 1.0 / uIorP);

  vec3 color = vec3(0.0);
  for (int i = 0; i < LOOP; i++) {
    float slide = float(i) / float(LOOP) * 0.045;

    float r = texture2D(uTexture, uv + rR.xy * (uRefractPower + slide * 1.0) * uChromatic).x * 0.5;
    vec3 tY = texture2D(uTexture, uv + rY.xy * (uRefractPower + slide * 1.0) * uChromatic).rgb;
    float y = (tY.x * 2.0 + tY.y * 2.0 - tY.z) / 6.0;
    float g = texture2D(uTexture, uv + rG.xy * (uRefractPower + slide * 2.0) * uChromatic).y * 0.5;
    vec3 tC = texture2D(uTexture, uv + rC.xy * (uRefractPower + slide * 2.5) * uChromatic).rgb;
    float c = (tC.y * 2.0 + tC.z * 2.0 - tC.x) / 6.0;
    float b = texture2D(uTexture, uv + rB.xy * (uRefractPower + slide * 3.0) * uChromatic).z * 0.5;
    vec3 tP = texture2D(uTexture, uv + rP.xy * (uRefractPower + slide * 1.0) * uChromatic).rgb;
    float p = (tP.z * 2.0 + tP.x * 2.0 - tP.y) / 6.0;

    float R = r + (2.0 * p + 2.0 * y - c) / 3.0;
    float G = g + (2.0 * y + 2.0 * c - p) / 3.0;
    float B = b + (2.0 * c + 2.0 * p - y) / 3.0;
    color += vec3(R, G, B);
  }
  color /= float(LOOP);
  color = saturate3(color, uSaturation);

  float spec = specular(uLight, uShininess, uDiffuseness, n, eye)
    + 0.6 * specular(vec3(1.0, 1.0, -1.0), uShininess * 0.6, uDiffuseness * 0.5, n, eye);
  color += spec * (uBackside > 0.5 ? 0.35 : 1.0);

  float f = pow(1.0 + dot(eye, n), uFresnelPower);
  color = mix(color, vec3(1.0, 0.93, 0.80), f * (uBackside > 0.5 ? 0.25 : 0.55));

  color += vec3(0.004, 0.005, 0.007);
  gl_FragColor = vec4(color, 1.0);
#include <colorspace_fragment>
}
`;

function glassMaterial(backside: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: glassVertex,
    fragmentShader: glassFragment,
    side: backside ? THREE.BackSide : THREE.FrontSide,
    uniforms: {
      uTexture: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uIorR: { value: 1.15 },
      uIorY: { value: 1.16 },
      uIorG: { value: 1.18 },
      uIorC: { value: 1.22 },
      uIorB: { value: 1.22 },
      uIorP: { value: 1.22 },
      uRefractPower: { value: backside ? 0.22 : 0.3 },
      uChromatic: { value: 0.5 },
      uSaturation: { value: 1.08 },
      uShininess: { value: 90 },
      uDiffuseness: { value: 0.02 },
      uFresnelPower: { value: 5.0 },
      uLight: { value: new THREE.Vector3(-1, 1, 1) },
      uBackside: { value: backside ? 1 : 0 },
    },
  });
}

function isMobile(W: number, H: number): boolean {
  return W < 768 || W / H < 1;
}

export function createGlassScene(canvas: HTMLCanvasElement, onModelLoaded: () => void): GlassScene {
  let disposed = false;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setClearColor(BG, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);
  camera.lookAt(0, 0, 0);

  // Background headline: 2D canvas → texture → fullscreen quad.
  const textCanvas = document.createElement("canvas");
  const ctx = textCanvas.getContext("2d")!;
  const bgTex = new THREE.CanvasTexture(textCanvas);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  bgTex.minFilter = THREE.LinearFilter;
  bgTex.magFilter = THREE.LinearFilter;
  bgTex.generateMipmaps = false;

  const bgScene = new THREE.Scene();
  const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: bgVertex,
    fragmentShader: bgFragment,
    uniforms: { uTex: { value: bgTex } },
    depthTest: false,
    depthWrite: false,
  });
  const bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bgQuad.frustumCulled = false;
  bgScene.add(bgQuad);

  // Cube scene graph: scene → pivot (position + scale) → spinner (rotation) → cube.
  const scene = new THREE.Scene();
  const pivot = new THREE.Object3D();
  const spinner = new THREE.Object3D();
  spinner.quaternion.setFromEuler(new THREE.Euler(-0.42, 0.62, 0.18));
  pivot.add(spinner);
  scene.add(pivot);

  const backMat = glassMaterial(true);
  const frontMat = glassMaterial(false);
  let cube: THREE.Mesh | null = null;

  const rtOptions = { type: THREE.HalfFloatType };
  const rtBack = new THREE.WebGLRenderTarget(1, 1, rtOptions);
  const rtFront = new THREE.WebGLRenderTarget(1, 1, rtOptions);
  backMat.uniforms.uTexture.value = rtBack.texture;
  frontMat.uniforms.uTexture.value = rtFront.texture;

  let W = 1;
  let H = 1;
  let dpr = 1;

  function drawHeadline() {
    const cw = Math.round(W * dpr);
    const ch = Math.round(H * dpr);
    if (textCanvas.width !== cw || textCanvas.height !== ch) {
      textCanvas.width = cw;
      textCanvas.height = ch;
      // Canvas size changed: drop the GPU texture so it is reallocated at the new size.
      bgTex.dispose();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const mobile = isMobile(W, H);
    const glow = ctx.createRadialGradient(W * 0.5, H * 0.47, 0, W * 0.5, H * 0.47, Math.max(W, H) * 0.6);
    glow.addColorStop(0, GLOW);
    glow.addColorStop(1, BG);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    let fs = Math.min(H * 0.21, W * (mobile ? 0.21 : 0.118));
    ctx.font = `800 ${fs}px Poppins`;
    const widest = Math.max(...HEADLINE.map((l) => ctx.measureText(l).width));
    const maxW = W * (mobile ? 0.9 : 0.5);
    if (widest > maxW) {
      fs *= maxW / widest;
      ctx.font = `800 ${fs}px Poppins`;
    }

    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const cx = W * (mobile ? 0.5 : 0.505);
    const cy = H * (mobile ? 0.45 : 0.468);
    const gap = fs * 1.07;
    const cap = fs * 0.7;
    HEADLINE.forEach((line, i) => {
      ctx.fillText(line, cx, cy + cap / 2 + (i - 1) * gap);
    });
    bgTex.needsUpdate = true;
  }

  function placeCube() {
    const mobile = isMobile(W, H);
    const visH = 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * CAM_Z;
    const visW = visH * (W / H);
    const sx = mobile ? 0.5 : 0.517;
    const sy = mobile ? 0.45 : 0.488;
    pivot.position.set((sx - 0.5) * visW, (0.5 - sy) * visH, 0);
    const px = Math.min(H * 0.44, W * (mobile ? 0.45 : 0.29));
    pivot.scale.setScalar((px / H) * visH);
  }

  function layout() {
    W = Math.max(1, canvas.clientWidth);
    H = Math.max(1, canvas.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();

    const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
    rtBack.setSize(buf.x, buf.y);
    rtFront.setSize(buf.x, buf.y);
    backMat.uniforms.uResolution.value.copy(buf);
    frontMat.uniforms.uResolution.value.copy(buf);

    drawHeadline();
    placeCube();
  }

  function setGeometry(geometry: THREE.BufferGeometry) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    geometry.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);

    cube = new THREE.Mesh(geometry, frontMat);
    spinner.add(cube);
    onModelLoaded();
  }

  function fallbackGeometry() {
    if (!disposed) setGeometry(new RoundedBoxGeometry(1, 1, 1, 8, 0.12));
  }

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      if (disposed) return;
      gltf.scene.updateMatrixWorld(true);
      const parts: THREE.BufferGeometry[] = [];
      gltf.scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        let g = mesh.geometry.clone();
        g.deleteAttribute("uv");
        g.deleteAttribute("color");
        g.deleteAttribute("tangent");
        g = mergeVertices(g, 1e-4);
        g.computeVertexNormals();
        g.applyMatrix4(mesh.matrixWorld);
        parts.push(g);
      });
      const merged = parts.length ? mergeGeometries(parts) : null;
      if (merged) setGeometry(merged);
      else fallbackGeometry();
    },
    undefined,
    () => fallbackGeometry(),
  );

  // ---- Interaction -------------------------------------------------------
  const AXIS_X = new THREE.Vector3(1, 0, 0);
  const AXIS_Y = new THREE.Vector3(0, 1, 0);
  const qx = new THREE.Quaternion();
  const qy = new THREE.Quaternion();

  function rotate(dx: number, dy: number) {
    qy.setFromAxisAngle(AXIS_Y, dx);
    qx.setFromAxisAngle(AXIS_X, dy);
    spinner.quaternion.premultiply(qy).premultiply(qx);
  }

  const FRAME_MS = 1000 / 60;
  let dragging = false;
  let pointerId = -1;
  let lastX = 0;
  let lastY = 0;
  let lastMoveT = 0;
  let velX = 0;
  let velY = 0;
  // Drift ramps in 0.6s after "release"; start as if released 0.6s before load.
  let releaseT = performance.now() - 600;
  let spinRemaining = 0;

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");
    lastX = e.clientX;
    lastY = e.clientY;
    lastMoveT = performance.now();
    velX = 0;
    velY = 0;
    spinRemaining = 0;
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || e.pointerId !== pointerId) return;
    const now = performance.now();
    const dx = (e.clientX - lastX) * 0.008;
    const dy = (e.clientY - lastY) * 0.008;
    rotate(dx, dy);
    const frames = Math.max(now - lastMoveT, 1) / FRAME_MS;
    velX = dx / frames;
    velY = dy / frames;
    lastX = e.clientX;
    lastY = e.clientY;
    lastMoveT = now;
  }

  function onPointerUp(e: PointerEvent) {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = -1;
    canvas.classList.remove("dragging");
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    // A pause before release means the pointer had stopped: no fling.
    if (performance.now() - lastMoveT > 80) {
      velX = 0;
      velY = 0;
    }
    releaseT = performance.now();
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  // ---- Frame loop --------------------------------------------------------
  let raf = 0;
  let lastFrameT = 0;
  let ready = false;
  let visible = true;
  let running = false;

  function start() {
    if (running || !ready || !visible || disposed) return;
    running = true;
    lastFrameT = 0;
    raf = requestAnimationFrame(frame);
  }

  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
  });
  observer.observe(canvas);

  function render() {
    renderer.autoClear = true;
    renderer.setRenderTarget(rtBack);
    renderer.render(bgScene, bgCamera);

    renderer.setRenderTarget(rtFront);
    renderer.render(bgScene, bgCamera);
    if (cube) {
      cube.material = backMat;
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = true;
    }

    renderer.setRenderTarget(null);
    renderer.render(bgScene, bgCamera);
    if (cube) {
      cube.material = frontMat;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = true;
    }
  }

  function frame(now: number) {
    if (!visible) {
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - (lastFrameT || now)) / 1000, 0.05);
    lastFrameT = now;
    const f = dt * 60;

    if (!dragging) {
      if (velX !== 0 || velY !== 0) {
        rotate(velX * f, velY * f);
        const damp = Math.pow(0.94, f);
        velX *= damp;
        velY *= damp;
        if (Math.abs(velX) < 1e-5 && Math.abs(velY) < 1e-5) {
          velX = 0;
          velY = 0;
        }
      }

      const since = (now - releaseT) / 1000;
      const blend = THREE.MathUtils.clamp(since - 0.6, 0, 1);
      if (blend > 0) rotate(0.0035 * blend * f, 0.0012 * blend * f);

      if (spinRemaining !== 0) {
        const step = spinRemaining * Math.min(1, 0.09 * f);
        rotate(step, 0);
        spinRemaining -= step;
        if (Math.abs(spinRemaining) < 0.0005) {
          rotate(spinRemaining, 0);
          spinRemaining = 0;
        }
      }
    }

    render();
  }

  const onResize = () => layout();
  const onFontsLoaded = () => drawHeadline();
  window.addEventListener("resize", onResize);
  document.fonts.addEventListener("loadingdone", onFontsLoaded);

  const fontsReady = Promise.all([document.fonts.load("800 100px Poppins"), document.fonts.ready]);
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  Promise.race([fontsReady, timeout])
    .catch(() => undefined)
    .then(() => {
      if (disposed) return;
      layout();
      ready = true;
      start();
    });

  return {
    spin(direction) {
      velX = 0;
      velY = 0;
      spinRemaining += direction * (Math.PI / 2);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      document.fonts.removeEventListener("loadingdone", onFontsLoaded);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      cube?.geometry.dispose();
      bgQuad.geometry.dispose();
      bgMat.dispose();
      bgTex.dispose();
      backMat.dispose();
      frontMat.dispose();
      rtBack.dispose();
      rtFront.dispose();
      renderer.dispose();
    },
  };
}
