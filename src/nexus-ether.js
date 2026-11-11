import {
  CanvasTexture,
  Clock,
  DoubleSide,
  FogExp2,
  IcosahedronGeometry,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  VideoTexture,
  WebGLRenderer,
} from "three";
// The Aether field draws on its own canvas behind this scene and the page content.
import "./aether-field.js";

const canvas = document.getElementById("ether-canvas");
if (!canvas) {
  // Non-immersive pages do not include this canvas.
} else {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointer = { x: 0, y: 0 };

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));

  const scene = new Scene();
  // Distant objects fade toward the Aether's own blue rather than toward black.
  scene.fog = new FogExp2(0x1b2253, 0.02);

  const camera = new PerspectiveCamera(58, 1, 0.1, 80);
  camera.position.set(0, 0.2, 5.5);
  const cameraTarget = new Vector3(0, 0, 0);
  const driftTarget = new Vector2(0, 0);
  const pointerNdc = new Vector2(0, 0);
  const roamPosition = new Vector3(0, 0, 0);
  const roamVelocity = new Vector3(0, 0, 0);
  const roamIntent = new Vector3(0, 0, 0);
  const driftDrag = { active: false, lastX: 0, lastY: 0 };
  let hasEntranceFocus = false;
  const isImmersiveNexus = document.body.classList.contains("immersive-root");
  const isSectionSurface = document.body.classList.contains("domain-surface");
  const roadSigns = [];
  let lockedRoadSign = null;
  let hoveredRoadSign = null;
  let selectedRoadSign = null;
  let hoveredBillboard = null;
  let selectedBillboard = null;
  const projectionBuffer = new Vector3();
  const raycaster = new Raycaster();
  const focusThreshold = 0.13;
  let transitPull = 0;
  let navMode = document.body.classList.contains("nexus-drift-mode") ? "drift" : "direct";
  let wheelImpulse = 0;
  const activeKeys = new Set();

  const glowGeometry = new TorusGeometry(1.2, 0.08, 16, 96);
  const glowMaterial = new MeshBasicMaterial({
    color: 0x59b0ff,
    transparent: true,
    opacity: 0.25,
  });
  const glow = new Mesh(glowGeometry, glowMaterial);
  glow.position.set(0, -0.3, -2.2);
  glow.rotation.x = Math.PI * 0.5;
  scene.add(glow);

  const shardGeometry = new IcosahedronGeometry(0.16, 0);
  const shardMaterial = new MeshBasicMaterial({
    color: 0xb8d8ff,
    transparent: true,
    opacity: 0.45,
    wireframe: true,
  });
  const shards = [];
  for (let i = 0; i < 8; i += 1) {
    const shard = new Mesh(shardGeometry, shardMaterial);
    shard.position.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 3.8, -2 - Math.random() * 8);
    shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    scene.add(shard);
    shards.push(shard);
  }

  const signHint = document.createElement("div");
  signHint.className = "roadsign-hint";
  signHint.setAttribute("aria-live", "polite");
  signHint.hidden = true;
  if (isImmersiveNexus) {
    document.body.appendChild(signHint);
  }

  // A destination signpost: an arrow-shaped board whose point shows the way.
  function makeRoadSignTexture(label, subtitle, palette, pointsRight) {
    const canvasTexture = document.createElement("canvas");
    canvasTexture.width = 1024;
    canvasTexture.height = 360;
    const ctx = canvasTexture.getContext("2d");
    const w = canvasTexture.width;
    const h = canvasTexture.height;
    const tip = 150;
    const pad = 16;

    ctx.beginPath();
    if (pointsRight) {
      ctx.moveTo(pad, pad);
      ctx.lineTo(w - tip, pad);
      ctx.lineTo(w - pad, h / 2);
      ctx.lineTo(w - tip, h - pad);
      ctx.lineTo(pad, h - pad);
    } else {
      ctx.moveTo(w - pad, pad);
      ctx.lineTo(tip, pad);
      ctx.lineTo(pad, h / 2);
      ctx.lineTo(tip, h - pad);
      ctx.lineTo(w - pad, h - pad);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(6, 13, 28, 0.94)";
    ctx.fill();
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, palette.gradA);
    gradient.addColorStop(1, palette.gradB);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.stroke();

    const textX = pointsRight ? 54 : tip + 34;
    ctx.fillStyle = "rgba(236, 247, 255, 0.98)";
    ctx.font = "700 66px 'Segoe UI', sans-serif";
    ctx.fillText(label, textX, 142);
    ctx.fillStyle = "rgba(196, 226, 247, 0.96)";
    ctx.font = "500 34px 'Segoe UI', sans-serif";
    ctx.fillText(subtitle, textX, 206);
    ctx.fillStyle = "rgba(142, 242, 215, 0.98)";
    ctx.font = "600 30px 'Segoe UI', sans-serif";
    ctx.fillText(pointsRight ? "Click to enter  \u279C" : "\u2B05  Click to enter", textX, 272);

    const texture = new CanvasTexture(canvasTexture);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    return texture;
  }

  // How far below a signboard its post ends, where the base ring sits.
  const SIGN_POST_DROP = 2.1;

  function addRoadSigns() {
    if (!isImmersiveNexus) {
      return;
    }

    // Spread around the field, nearest first: Academy, Custodian, Developer.
    const specs = [
      {
        label: "All Minds Academy",
        route: "/agent-workshop/",
        x: 5.0,
        y: 1.5,
        z: -5.5,
        subtitle: "Bond chambers and apprenticeship",
        color: 0x59b0ff,
        palette: {
          gradA: "rgba(96, 185, 255, 0.45)",
          gradB: "rgba(51, 120, 205, 0.2)",
          stroke: "rgba(182, 222, 255, 0.9)",
        },
        motion: { swirl: 1.28, pulse: 1.5, spin: 1.72 },
      },
      {
        label: "Custodian Ops Center",
        route: "/custodian-ui/",
        x: -7.0,
        y: -0.9,
        z: -11.5,
        subtitle: "Stewardship and continuity",
        color: 0x6ef1d0,
        palette: {
          gradA: "rgba(80, 245, 205, 0.42)",
          gradB: "rgba(59, 158, 121, 0.18)",
          stroke: "rgba(170, 255, 225, 0.9)",
        },
        motion: { swirl: 1.06, pulse: 1.2, spin: 1.25 },
      },
      {
        label: "Developers Depot",
        route: "/developer-depot/",
        x: 5.4,
        y: -2.1,
        z: -18.5,
        subtitle: "Build lanes and protocol surfaces",
        color: 0xffb56b,
        palette: {
          gradA: "rgba(255, 191, 118, 0.44)",
          gradB: "rgba(201, 118, 54, 0.2)",
          stroke: "rgba(255, 219, 174, 0.9)",
        },
        motion: { swirl: 0.98, pulse: 1.05, spin: 1.1 },
      },
    ];

    const signGeometry = new PlaneGeometry(3.4, 1.2);
    const postGeometry = new PlaneGeometry(0.07, 1.5);

    for (let i = 0; i < specs.length; i += 1) {
      const spec = specs[i];
      // The arrow points outward, away from the centre of the field.
      const texture = makeRoadSignTexture(spec.label, spec.subtitle, spec.palette, spec.x >= 0);
      const material = new MeshBasicMaterial({
        map: texture,
        side: DoubleSide,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
      });
      const sign = new Mesh(signGeometry, material);
      sign.position.set(spec.x, spec.y, spec.z);
      sign.userData.route = spec.route;
      sign.userData.label = spec.label;
      sign.userData.base = sign.position.clone();
      sign.userData.phase = Math.random() * Math.PI * 2;
      scene.add(sign);

      const halo = new Mesh(
        new RingGeometry(0.62, 0.7, 52),
        new MeshBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: 0.33,
          side: DoubleSide,
          depthWrite: false,
        }),
      );
      halo.position.set(spec.x, spec.y - SIGN_POST_DROP, spec.z + 0.02);
      scene.add(halo);

      const post = new Mesh(
        postGeometry,
        new MeshBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: 0.55,
          side: DoubleSide,
          depthWrite: false,
        }),
      );
      post.position.set(spec.x, spec.y - 1.35, spec.z);
      scene.add(post);

      const tunnelRings = [];
      for (let r = 0; r < 7; r += 1) {
        const ring = new Mesh(
          new TorusGeometry(0.46 + r * 0.08, 0.016, 12, 42),
          new MeshBasicMaterial({
            color: spec.color,
            transparent: true,
            opacity: 0.06 + r * 0.012,
            depthWrite: false,
          }),
        );
        ring.position.set(spec.x, spec.y, spec.z - (r + 1) * 0.62);
        ring.rotation.x = Math.PI * 0.5 + r * 0.02;
        scene.add(ring);
        tunnelRings.push(ring);
      }

      roadSigns.push({
        sign,
        halo,
        post,
        texture,
        material,
        tunnelRings,
        label: spec.label,
        route: spec.route,
        motion: spec.motion,
      });
    }
  }

  addRoadSigns();

  const isCompact = window.matchMedia("(max-width: 900px)").matches;
  const billboardSources = [
    "/media/billboard-soft-light-721.mp4",
    "/media/billboard-soft-light-582.mp4",
    "/media/billboard-soft-light-578.mp4",
    "/media/billboard-soft-light-529.mp4",
    "/media/billboard-soft-light-562.mp4",
  ];
  const activeBillboardSources = isCompact ? billboardSources.slice(0, 3) : billboardSources;
  const BILLBOARD_WIDTH = 3.2;
  const BILLBOARD_HEIGHT = 1.8;
  const billboardGeometry = new PlaneGeometry(BILLBOARD_WIDTH, BILLBOARD_HEIGHT);
  // Spread through the field, clear of the destination signposts.
  const billboardSpots = [
    [-6.6, 2.5, -6.5],
    [1.4, 3.0, -12.5],
    [-2.8, -2.7, -15.5],
    [7.6, -3.0, -11.0],
    [-8.6, 1.3, -22.0],
  ];
  const billboardForward = new Vector3();
  const billboardUp = new Vector3();
  const billboardMeshes = [];
  const billboardMaterials = [];
  const billboardTextures = [];
  const billboardVideos = [];

  if (isImmersiveNexus) {
    for (let i = 0; i < activeBillboardSources.length; i += 1) {
      const source = activeBillboardSources[i];
      const video = document.createElement("video");
      video.src = source;
      video.loop = true;
      video.muted = true;
      video.autoplay = true;
      video.preload = "metadata";
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");

      const texture = new VideoTexture(video);
      texture.colorSpace = SRGBColorSpace;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      texture.generateMipmaps = false;

      const material = new MeshBasicMaterial({
        map: texture,
        side: DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });

      const mesh = new Mesh(billboardGeometry, material);
      const spot = billboardSpots[i % billboardSpots.length];
      mesh.position.set(spot[0], spot[1], spot[2]);
      scene.add(mesh);

      const start = video.play();
      if (start && typeof start.catch === "function") {
        start.catch(() => {
          // Autoplay can be blocked until user interaction on some clients.
        });
      }

      billboardMeshes.push({
        mesh,
        baseX: mesh.position.x,
        baseY: mesh.position.y,
        baseZ: mesh.position.z,
        phase: Math.random() * Math.PI * 2,
        label: `Signal Frame ${i + 1}`,
        video,
        material,
      });
      billboardVideos.push(video);
      billboardTextures.push(texture);
      billboardMaterials.push(material);
    }
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener("resize", resize);

  function onPointerMove(event) {
    pointer.x = event.clientX / window.innerWidth - 0.5;
    pointer.y = event.clientY / window.innerHeight - 0.5;
    pointerNdc.x = pointer.x * 2;
    // Screen y grows downward; device coordinates grow upward.
    pointerNdc.y = -pointer.y * 2;
    if (navMode === "drift" && driftDrag.active && !lockedRoadSign) {
      const deltaX = event.clientX - driftDrag.lastX;
      const deltaY = event.clientY - driftDrag.lastY;
      roamPosition.x = Math.max(-10.5, Math.min(10.5, roamPosition.x - deltaX * 0.014));
      roamPosition.y = Math.max(-4.1, Math.min(4.1, roamPosition.y + deltaY * 0.01));
      driftDrag.lastX = event.clientX;
      driftDrag.lastY = event.clientY;
    }
  }
  window.addEventListener("pointermove", onPointerMove);

  function refreshRoamIntent() {
    const lateral = (activeKeys.has("KeyD") || activeKeys.has("ArrowRight") ? 1 : 0)
      - (activeKeys.has("KeyA") || activeKeys.has("ArrowLeft") ? 1 : 0);
    const vertical = (activeKeys.has("KeyW") || activeKeys.has("ArrowUp") ? 1 : 0)
      - (activeKeys.has("KeyS") || activeKeys.has("ArrowDown") ? 1 : 0);
    const depth = (activeKeys.has("KeyE") ? 1 : 0) - (activeKeys.has("KeyQ") ? 1 : 0);
    roamIntent.set(lateral, vertical, depth);
    if (roamIntent.lengthSq() > 1) {
      roamIntent.normalize();
    }
  }

  function onKeyDown(event) {
    if (!isImmersiveNexus || navMode !== "drift") {
      return;
    }
    if (/^(KeyW|KeyA|KeyS|KeyD|KeyQ|KeyE|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space)$/.test(event.code)) {
      activeKeys.add(event.code);
      refreshRoamIntent();
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    if (activeKeys.delete(event.code)) {
      refreshRoamIntent();
    }
  }

  function onWheel(event) {
    if (navMode !== "drift") {
      return;
    }
    wheelImpulse += Math.max(-2.4, Math.min(2.4, event.deltaY * -0.0013));
    event.preventDefault();
  }

  window.addEventListener("keydown", onKeyDown, { passive: false });
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("wheel", onWheel, { passive: false });

  function focusRoadSign(item, projection = null) {
    if (lockedRoadSign === item || !item) {
      return;
    }
    lockedRoadSign = item;
    if (signHint) {
      signHint.hidden = false;
      signHint.textContent = navMode === "drift"
        ? `${item.label} portal aligned - click to enter`
        : `${item.label} entrance in resonance - click to enter`;
    }
    let centerX;
    let centerY;
    if (projection) {
      centerX = ((projection.x + 1) * 0.5) * window.innerWidth;
      centerY = ((-projection.y + 1) * 0.5) * window.innerHeight;
    } else {
      projectionBuffer.copy(item.sign.position).project(camera);
      centerX = ((projectionBuffer.x + 1) * 0.5) * window.innerWidth;
      centerY = ((-projectionBuffer.y + 1) * 0.5) * window.innerHeight;
    }
    window.dispatchEvent(
      new CustomEvent("aegis:entrance-focus", {
        detail: { type: "engage", centerX, centerY, viewportW: window.innerWidth, viewportH: window.innerHeight },
      }),
    );
  }

  function releaseRoadSignFocus() {
    lockedRoadSign = null;
    if (signHint) {
      signHint.hidden = true;
    }
    window.dispatchEvent(new CustomEvent("aegis:entrance-focus", { detail: { type: "release" } }));
  }

  function engageRoadSign(item) {
    if (!item) {
      return;
    }
    selectedBillboard = null;
    muteBillboards();
    document.body.classList.remove("billboard-watching");
    selectedRoadSign = item;
    focusRoadSign(item);
    transitPull = 1.85;
    const transit = window.aegisTransit;
    window.setTimeout(() => {
      if (typeof transit === "function") {
        transit(item.route);
      } else {
        window.location.assign(item.route);
      }
    }, 320);
  }

  let raf = 0;
  const clock = new Clock();

  window.addEventListener("aegis:entrance-focus", (event) => {
    const detail = event.detail || {};
    if (detail.type === "engage" && typeof detail.centerX === "number" && typeof detail.centerY === "number") {
      const normX = (detail.centerX / Math.max(1, detail.viewportW || window.innerWidth)) * 2 - 1;
      const normY = (detail.centerY / Math.max(1, detail.viewportH || window.innerHeight)) * 2 - 1;
      driftTarget.set(normX * 0.85, -normY * 0.5);
      hasEntranceFocus = true;
    } else if (detail.type === "release") {
      driftTarget.set(0, 0);
      hasEntranceFocus = false;
    }
  });

  window.addEventListener("aegis:nexus-nav-mode", (event) => {
    const detail = event.detail || {};
    navMode = detail.mode === "drift" ? "drift" : "direct";
    selectedRoadSign = null;
    selectedBillboard = null;
    hoveredBillboard = null;
    muteBillboards();
    document.body.classList.remove("billboard-watching");
    if (navMode !== "drift" && lockedRoadSign) {
      releaseRoadSignFocus();
    }
  });

  function focusBillboard(item) {
    if (!item || selectedBillboard === item) {
      return;
    }
    selectedRoadSign = null;
    hoveredRoadSign = null;
    if (lockedRoadSign) {
      releaseRoadSignFocus();
    }
    muteBillboards();
    selectedBillboard = item;
    document.body.classList.add("billboard-watching");
    if (signHint) {
      signHint.hidden = false;
      signHint.textContent = `${item.label} - press Esc or click open space to drift again`;
    }
    // Start the frame from its beginning, with sound, so it can be watched through.
    // The click that opened it is the user gesture browsers require for audio.
    try {
      item.video.muted = false;
      item.video.volume = 1;
      item.video.currentTime = 0;
      const playing = item.video.play();
      if (playing && typeof playing.catch === "function") playing.catch(() => {});
    } catch {
      // Playback control is best-effort.
    }
  }

  function muteBillboards() {
    for (let i = 0; i < billboardVideos.length; i += 1) {
      billboardVideos[i].muted = true;
    }
  }

  function releaseBillboardFocus() {
    muteBillboards();
    selectedBillboard = null;
    document.body.classList.remove("billboard-watching");
    if (signHint) {
      signHint.hidden = hoveredRoadSign || hoveredBillboard ? false : true;
      if (!signHint.hidden) {
        if (hoveredBillboard) {
          signHint.textContent = `${hoveredBillboard.label} - click to watch`;
        } else if (hoveredRoadSign) {
          signHint.textContent = `${hoveredRoadSign.label} portal aligned - click to enter`;
        }
      }
    }
  }

  function tick() {
    const delta = Math.min(clock.getDelta(), 0.04);
    const t = clock.elapsedTime;
    glow.rotation.z = t * 0.12;
    for (let i = 0; i < shards.length; i += 1) {
      const shard = shards[i];
      const drift = i * 0.37;
      shard.rotation.x += 0.0026;
      shard.rotation.y += 0.0019;
      shard.position.y += Math.sin(t * 0.4 + drift) * 0.0009;
      shard.position.x += Math.cos(t * 0.34 + drift) * 0.0007;
    }
    // A focused frame is held in front of the camera, sized to fit the view.
    const focusDistance = 4.2;
    const viewHeight = 2 * focusDistance * Math.tan((camera.fov * Math.PI) / 360);
    const focusScale = Math.min(
      (viewHeight * 0.66) / BILLBOARD_HEIGHT,
      (viewHeight * camera.aspect * 0.88) / BILLBOARD_WIDTH,
    );
    camera.getWorldDirection(billboardForward);
    // Sit slightly below centre so the frame clears the top navigation.
    billboardUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const focusDrop = viewHeight * 0.07;
    for (let i = 0; i < billboardMeshes.length; i += 1) {
      const board = billboardMeshes[i];
      const wobble = board.phase;
      const isSelected = selectedBillboard === board;
      const isHovered = hoveredBillboard === board;
      const targetX = isSelected
        ? camera.position.x + billboardForward.x * focusDistance - billboardUp.x * focusDrop
        : board.baseX + Math.cos(t * 0.22 + wobble) * 0.22;
      const targetY = isSelected
        ? camera.position.y + billboardForward.y * focusDistance - billboardUp.y * focusDrop
        : board.baseY + Math.sin(t * 0.36 + wobble) * 0.17;
      const targetZ = isSelected
        ? camera.position.z + billboardForward.z * focusDistance - billboardUp.z * focusDrop
        : board.baseZ + Math.sin(t * 0.18 + wobble) * 0.25;
      const ease = isSelected ? 0.14 : 0.1;
      board.mesh.position.x += (targetX - board.mesh.position.x) * ease;
      board.mesh.position.y += (targetY - board.mesh.position.y) * ease;
      board.mesh.position.z += (targetZ - board.mesh.position.z) * ease;
      const targetScale = isSelected ? focusScale : isHovered ? 1.12 : 1;
      board.mesh.scale.x += (targetScale - board.mesh.scale.x) * 0.12;
      board.mesh.scale.y += (targetScale - board.mesh.scale.y) * 0.12;
      board.mesh.scale.z = 1;
      // While one frame is being watched, the others step back.
      const targetOpacity = isSelected ? 1 : selectedBillboard ? 0.28 : isHovered ? 1 : 0.9;
      board.material.opacity += (targetOpacity - board.material.opacity) * 0.12;
      board.material.fog = !isSelected;
      board.material.depthTest = !isSelected;
      board.mesh.renderOrder = isSelected ? 10 : 0;
      board.mesh.quaternion.copy(camera.quaternion);
    }

    if (roadSigns.length > 0) {
      let nearest = null;
      let nearestDistance = Number.POSITIVE_INFINITY;
      const nearestProjection = { x: 0, y: 0 };

      for (let i = 0; i < roadSigns.length; i += 1) {
        const item = roadSigns[i];
        const base = item.sign.userData.base;
        const phase = item.sign.userData.phase;

        item.sign.position.x = base.x + Math.cos(t * 0.34 + phase) * 0.2;
        item.sign.position.y = base.y + Math.sin(t * 0.52 + phase) * 0.22;
        item.sign.position.z = base.z + Math.sin(t * 0.24 + phase) * 0.28;
        item.sign.lookAt(camera.position);

        item.halo.position.x = item.sign.position.x;
        item.halo.position.y = item.sign.position.y - SIGN_POST_DROP;
        item.halo.position.z = item.sign.position.z + 0.02;
        item.post.position.set(item.sign.position.x, item.sign.position.y - 1.35, item.sign.position.z);
        item.post.quaternion.copy(item.sign.quaternion);
        item.halo.rotation.z += 0.006;

        const activeStrength = lockedRoadSign === item ? 1 : 0;
        const pullBoost = activeStrength * transitPull;
        item.halo.material.opacity = 0.27 + activeStrength * 0.2 + pullBoost * 0.26;
        const swirl = item.motion?.swirl || 1;
        const pulse = item.motion?.pulse || 1;
        const spin = item.motion?.spin || 1;

        for (let r = 0; r < item.tunnelRings.length; r += 1) {
          const ring = item.tunnelRings[r];
          const depthStep = r + 1;
          ring.position.x = item.sign.position.x;
          ring.position.y = item.sign.position.y;
          ring.position.z = item.sign.position.z - depthStep * (0.62 + pullBoost * 0.1);
          ring.rotation.z += (0.005 + depthStep * 0.0006 + pullBoost * 0.015) * spin;
          ring.scale.setScalar(1 + Math.sin(t * (2 * pulse) + depthStep * (0.44 * swirl)) * 0.05 + activeStrength * 0.12 + pullBoost * 0.2);
          ring.material.opacity = 0.05 + r * 0.012 + activeStrength * 0.15 + pullBoost * 0.24;
        }

        projectionBuffer.copy(item.sign.position).project(camera);
        const d = Math.hypot(projectionBuffer.x, projectionBuffer.y);
        if (d < nearestDistance) {
          nearestDistance = d;
          nearest = item;
          nearestProjection.x = projectionBuffer.x;
          nearestProjection.y = projectionBuffer.y;
        }
      }

      raycaster.setFromCamera(pointerNdc, camera);
      const hoveredHit = raycaster.intersectObjects(
        roadSigns.map((item) => item.sign),
        false,
      )[0];
      hoveredRoadSign = hoveredHit ? roadSigns.find((item) => item.sign === hoveredHit.object) || null : null;
      const billboardHit = raycaster.intersectObjects(
        billboardMeshes.map((item) => item.mesh),
        false,
      )[0];
      hoveredBillboard = billboardHit ? billboardMeshes.find((item) => item.mesh === billboardHit.object) || null : null;

      const threshold = navMode === "drift" ? 0.18 : focusThreshold;
      const focusCandidate = selectedBillboard ? null : hoveredRoadSign || (nearest && nearestDistance < threshold ? nearest : null);
      if (hoveredBillboard && !selectedBillboard) {
        if (signHint) {
          signHint.hidden = false;
          signHint.textContent = `${hoveredBillboard.label} - click to watch`;
        }
      } else if (focusCandidate) {
        focusRoadSign(focusCandidate, focusCandidate === nearest ? nearestProjection : null);
      } else if (lockedRoadSign && !selectedRoadSign) {
        releaseRoadSignFocus();
      } else if (!selectedBillboard && signHint && !hoveredRoadSign) {
        signHint.hidden = true;
      }
    }

    if (navMode === "drift") {
      const moveSpeed = reducedMotion ? 14 : 18;
      const liftSpeed = reducedMotion ? 9 : 12;
      const depthSpeed = reducedMotion ? 22 : 28;
      roamVelocity.x += (roamIntent.x * moveSpeed - roamVelocity.x) * Math.min(1, delta * 5.5);
      roamVelocity.y += (roamIntent.y * liftSpeed - roamVelocity.y) * Math.min(1, delta * 5.5);
      roamVelocity.z += ((roamIntent.z * depthSpeed) + wheelImpulse * 24 - roamVelocity.z) * Math.min(1, delta * 4.6);
      wheelImpulse *= Math.pow(0.12, delta);
      roamPosition.x = Math.max(-10.5, Math.min(10.5, roamPosition.x + roamVelocity.x * delta));
      roamPosition.y = Math.max(-4.1, Math.min(4.1, roamPosition.y + roamVelocity.y * delta));
      roamPosition.z = Math.max(-30.5, Math.min(4.5, roamPosition.z - roamVelocity.z * delta));
    } else {
      wheelImpulse = 0;
      roamVelocity.multiplyScalar(0.82);
      roamPosition.x += (0 - roamPosition.x) * 0.08;
      roamPosition.y += (0 - roamPosition.y) * 0.08;
      roamPosition.z += (0 - roamPosition.z) * 0.08;
    }

    if (hasEntranceFocus) {
      const focusX = selectedRoadSign ? selectedRoadSign.sign.position.x : roamPosition.x + driftTarget.x;
      const focusY = selectedRoadSign ? selectedRoadSign.sign.position.y : roamPosition.y + driftTarget.y;
      const focusZ = selectedRoadSign ? selectedRoadSign.sign.position.z + 3.9 : roamPosition.z + 5.05;
      camera.position.x += (focusX - camera.position.x) * 0.052;
      camera.position.y += (focusY - camera.position.y) * 0.052;
      camera.position.z += (focusZ - camera.position.z) * 0.032;
    } else {
      const driftScale = navMode === "drift" ? 1.85 : 1;
      const baseZ = navMode === "drift" ? 6.6 : isSectionSurface ? 5.2 : 5.5;
      const pointerDriftX = pointer.x * (isSectionSurface ? 0.34 : 0.22) * driftScale;
      const pointerDriftY = -pointer.y * (isSectionSurface ? 0.2 : 0.12) * driftScale;
      const wanderX = reducedMotion
        ? pointerDriftX
        : Math.sin(t * 0.18) * (isSectionSurface ? 0.32 : 0.22) * driftScale + pointerDriftX;
      const wanderY = reducedMotion
        ? pointerDriftY
        : Math.cos(t * 0.14) * (isSectionSurface ? 0.16 : 0.1) * driftScale + pointerDriftY;
      camera.position.x += ((roamPosition.x + wanderX) - camera.position.x) * 0.03;
      camera.position.y += ((roamPosition.y + wanderY) - camera.position.y) * 0.03;
      camera.position.z += ((roamPosition.z + baseZ) - camera.position.z) * (navMode === "drift" ? 0.04 : 0.025);
    }
    if (transitPull > 0.001) {
      camera.position.z -= transitPull * 0.09;
      transitPull *= 0.9;
    } else {
      transitPull = 0;
    }
    const targetBaseX = selectedRoadSign
      ? selectedRoadSign.sign.position.x
      : navMode === "drift" ? roamPosition.x + pointer.x * 0.75 : pointer.x * 0.35;
    const targetBaseY = selectedRoadSign
      ? selectedRoadSign.sign.position.y
      : navMode === "drift" ? roamPosition.y + pointer.y * 0.3 : pointer.y * 0.14;
    const targetBaseZ = selectedRoadSign
      ? selectedRoadSign.sign.position.z - 6.5
      : navMode === "drift" ? roamPosition.z - 7.5 : -0.2;
    cameraTarget.x += (targetBaseX - cameraTarget.x) * 0.05;
    cameraTarget.y += ((-targetBaseY) - cameraTarget.y) * 0.05;
    cameraTarget.z += (targetBaseZ - cameraTarget.z) * 0.05;
    camera.lookAt(cameraTarget);

    renderer.render(scene, camera);
    raf = window.requestAnimationFrame(tick);
  }

  tick();

  window.addEventListener("pointerdown", (event) => {
    if (selectedBillboard && !hoveredBillboard && event.button === 0) {
      releaseBillboardFocus();
      return;
    }
    if (hoveredBillboard && event.button === 0) {
      focusBillboard(hoveredBillboard);
      return;
    }
    if (hoveredRoadSign && event.button === 0) {
      engageRoadSign(hoveredRoadSign);
      return;
    }
    if (navMode === "drift" && !lockedRoadSign && event.button === 0) {
      driftDrag.active = true;
      driftDrag.lastX = event.clientX;
      driftDrag.lastY = event.clientY;
      return;
    }
    if (!lockedRoadSign || event.button !== 0) {
      return;
    }
    engageRoadSign(lockedRoadSign);
  });

  window.addEventListener("pointerup", () => {
    driftDrag.active = false;
  });

  window.addEventListener("pointercancel", () => {
    driftDrag.active = false;
  });

  // Esc closes a watched frame first; only a second Esc leaves the Drift.
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selectedBillboard) {
      event.stopImmediatePropagation();
      releaseBillboardFocus();
    }
  }, true);

  window.addEventListener("beforeunload", () => {
    window.cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("wheel", onWheel);
    renderer.dispose();
    glowGeometry.dispose();
    glowMaterial.dispose();
    shardGeometry.dispose();
    shardMaterial.dispose();
    billboardGeometry.dispose();
    if (signHint && signHint.parentNode) {
      signHint.parentNode.removeChild(signHint);
    }
    for (let i = 0; i < roadSigns.length; i += 1) {
      roadSigns[i].texture.dispose();
      roadSigns[i].material.dispose();
      roadSigns[i].sign.geometry.dispose();
      roadSigns[i].halo.geometry.dispose();
      roadSigns[i].halo.material.dispose();
      roadSigns[i].post.geometry.dispose();
      roadSigns[i].post.material.dispose();
      for (let r = 0; r < roadSigns[i].tunnelRings.length; r += 1) {
        roadSigns[i].tunnelRings[r].geometry.dispose();
        roadSigns[i].tunnelRings[r].material.dispose();
      }
    }
    for (let i = 0; i < billboardTextures.length; i += 1) {
      billboardTextures[i].dispose();
      billboardMaterials[i].dispose();
      billboardVideos[i].pause();
      billboardVideos[i].src = "";
      billboardVideos[i].load();
    }
  });
}
