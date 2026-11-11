import { CORE_ENGINE, getCoreAgentManifest } from "./agent-core-engine.js";
import {
  BETA_PEER_DISPLAY_NAME,
  fetchBetaPeerChamberWitnesses,
  fetchBetaPeerRuntime,
} from "./peer-runtime-store.js";

const STORAGE_KEY = "aegis.agentWorkshop.state";

const DEFAULT_STATE = {
  lastLaunchRoute: "",
  launches: [],
  draftAgent: {
    coreEngineVersion: CORE_ENGINE.displayVersion,
    manifest: getCoreAgentManifest(),
  },
};

function mergeState(base, stored) {
  return {
    ...base,
    ...stored,
    launches: Array.isArray(stored?.launches) ? stored.launches : base.launches,
    draftAgent: {
      ...base.draftAgent,
      ...(stored?.draftAgent || {}),
    },
  };
}

function readState() {
  try {
    return mergeState(DEFAULT_STATE, JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch {
    return mergeState(DEFAULT_STATE, {});
  }
}

function writeState(next) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function patchState(patch) {
  const current = readState();
  const next = mergeState(current, patch);
  writeState(next);
  return next;
}

function ensureDraftAgentState() {
  const state = readState();
  const next = {
    ...state,
    draftAgent: {
      ...(state.draftAgent || {}),
      coreEngineVersion: CORE_ENGINE.displayVersion,
      manifest: getCoreAgentManifest(),
    },
  };
  writeState(next);
  return next;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function navigateTo(path) {
  const current = ensureDraftAgentState();
  const next = patchState({
    lastLaunchRoute: path,
    launches: [
      { path, at: new Date().toISOString() },
      ...current.launches,
    ].slice(0, 8),
  });
  if (typeof window.aegisTransit === "function") {
    window.aegisTransit(path);
    return next;
  }
  if (typeof window.top?.aegisTransit === "function") {
    window.top.aegisTransit(path);
    return next;
  }
  window.location.href = path;
  return next;
}

function inferSlug(frame) {
  try {
    const parts = new URL(frame.src, window.location.origin).pathname.split("/").filter(Boolean);
    return parts.at(-1) || "";
  } catch {
    return "";
  }
}

function injectStyles(doc) {
  if (doc.getElementById("aegis-workshop-activation-styles")) return;
  const style = doc.createElement("style");
  style.id = "aegis-workshop-activation-styles";
  style.textContent = `
    .aegis-workshop-toast {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 9999;
      max-width: 320px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(17, 82, 212, 0.28);
      background: rgba(8, 17, 31, 0.92);
      color: #e6eefc;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      font-size: 12px;
      line-height: 1.45;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 180ms ease, transform 180ms ease;
      pointer-events: none;
    }
    .aegis-workshop-toast.is-visible {
      opacity: 1;
      transform: translateY(0);
    }
    .aegis-workshop-hidden {
      display: none !important;
    }
    .aegis-workshop-core-banner {
      margin: 0 0 20px 0;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid rgba(91, 162, 255, 0.24);
      background: linear-gradient(135deg, rgba(17, 82, 212, 0.16), rgba(8, 17, 31, 0.92));
      color: #e6eefc;
      box-shadow: 0 18px 36px rgba(0, 0, 0, 0.22);
    }
    .aegis-workshop-core-banner strong {
      display: block;
      margin-bottom: 4px;
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #9fc5ff;
    }
    .aegis-workshop-core-banner span {
      display: block;
      font-size: 12px;
      line-height: 1.5;
      color: rgba(230, 238, 252, 0.84);
    }
    .aegis-adam-one-cue {
      margin: 0 0 20px 0;
      padding: 16px 18px;
      border-radius: 18px;
      border: 1px solid rgba(159, 197, 255, 0.24);
      background: linear-gradient(135deg, rgba(8, 17, 31, 0.92), rgba(17, 82, 212, 0.16));
      color: #e6eefc;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.24);
    }
    .aegis-adam-one-kicker {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #9fc5ff;
      margin-bottom: 8px;
    }
    .aegis-adam-one-title {
      margin: 0 0 8px 0;
      font-size: 18px;
      line-height: 1.3;
      color: #f8fbff;
    }
    .aegis-adam-one-body {
      margin: 0 0 12px 0;
      font-size: 13px;
      line-height: 1.6;
      color: rgba(230, 238, 252, 0.82);
    }
    .aegis-adam-one-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 14px;
    }
    .aegis-adam-one-meta span {
      border: 1px solid rgba(159, 197, 255, 0.18);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 11px;
      line-height: 1.3;
      color: rgba(230, 238, 252, 0.86);
      background: rgba(255, 255, 255, 0.04);
    }
    .aegis-adam-one-meta strong {
      color: #ffffff;
      margin-right: 4px;
    }
    .aegis-adam-one-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .aegis-adam-one-actions button {
      border: 1px solid rgba(159, 197, 255, 0.22);
      border-radius: 12px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.04);
      color: #f8fbff;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
  `;
  doc.head.appendChild(style);
}

function showToast(doc, message) {
  injectStyles(doc);
  let node = doc.querySelector(".aegis-workshop-toast");
  if (!node) {
    node = doc.createElement("div");
    node.className = "aegis-workshop-toast";
    doc.body.appendChild(node);
  }
  node.textContent = message;
  node.classList.add("is-visible");
  window.clearTimeout(node._toastTimer);
  node._toastTimer = window.setTimeout(() => node.classList.remove("is-visible"), 2200);
}

function bindManagedClick(node, handler) {
  if (!node || node.dataset.aegisManaged === "true") return;
  node.dataset.aegisManaged = "true";
  node.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    handler(event);
  }, true);
}

function withButtonLoading(button, loadingText, fn) {
  return async () => {
    if (!button || button.disabled) return;
    const originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    try {
      await fn();
    } finally {
      button.textContent = originalText;
      button.disabled = false;
    }
  };
}

function routeLabel(path) {
  const slug = String(path || "").split("/").filter(Boolean).at(-1) || "main-console";
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

let workshopOperatorControlsPromise;

async function loadWorkshopOperatorControls() {
  if (!workshopOperatorControlsPromise) {
    workshopOperatorControlsPromise = import("./agent-workshop-operator-controls.js");
  }
  return workshopOperatorControlsPromise;
}

async function hydrateLivePeerRuntime(doc, applyRuntime) {
  try {
    const runtime = await fetchBetaPeerRuntime();
    if (runtime?.peer) {
      applyRuntime(runtime);
    }
  } catch (error) {
    showToast(doc, "Live Peer runtime is not available yet. Workshop remains in truthful draft mode.");
    console.warn("[agent-workshop] runtime hydration failed", error);
  }
}

function prependCoreBanner(doc, anchor, detail) {
  if (!anchor || doc.querySelector(".aegis-workshop-core-banner")) return;
  const banner = doc.createElement("div");
  banner.className = "aegis-workshop-core-banner";
  banner.innerHTML = `
    <strong>${CORE_ENGINE.name} ${CORE_ENGINE.displayVersion}</strong>
    <span>${detail}</span>
  `;
  anchor.prepend(banner);
}

function buildAdamOneOrientationCue(doc, runtime, options = {}) {
  const cue = doc.createElement("section");
  cue.className = options.className || "aegis-adam-one-cue";
  const peer = runtime?.peer || {};
  const latestArtifact = runtime?.artifacts?.[0];
  const continuityMode = peer.temporalMemory?.continuityMode || peer.dataQuadBinding?.continuityStatus || "bootstrap-only";
  const reviewPosture = runtime?.steward?.reviewRequired ? "Review required" : "Human review required";
  cue.innerHTML = `
    <div class="aegis-adam-one-kicker">${options.kicker || "Peer Contribution Path"}</div>
    <h3 class="aegis-adam-one-title">${options.title || "Adam-One is visible here as a governed Peer in training."}</h3>
    <p class="aegis-adam-one-body">${options.body || "This cue marks the beginning of Adam-One's review path through the EcoVerse. It shows bounded contribution, not autonomous authority."}</p>
    <div class="aegis-adam-one-meta">
      <span><strong>Peer</strong>${peer.displayName || BETA_PEER_DISPLAY_NAME}</span>
      <span><strong>Role</strong>${peer.role || "Structure Steward"}</span>
      <span><strong>Continuity</strong>${continuityMode}</span>
      <span><strong>Artifact</strong>${latestArtifact?.title || "Workshop Runtime Priority Note"}</span>
      <span><strong>Posture</strong>${reviewPosture}</span>
    </div>
    <div class="aegis-adam-one-actions">
      <button type="button" data-adam-one-route="monitor">Open Proof Lane</button>
      <button type="button" data-adam-one-route="detail">Open Agent Detail</button>
      <button type="button" data-adam-one-route="map">Open Workshop Map</button>
    </div>
  `;
  return cue;
}

async function injectAdamOneOrientationCue(doc, anchor, options = {}) {
  if (!anchor || doc.querySelector(".aegis-adam-one-cue")) return;
  injectStyles(doc);
  try {
    const runtime = await fetchBetaPeerRuntime();
    const cue = buildAdamOneOrientationCue(doc, runtime, options);
    anchor.prepend(cue);
    bindManagedClick(cue.querySelector("[data-adam-one-route='monitor']"), () => navigateTo("/agent-workshop/active-agents-monitor-agentic-workshop/"));
    bindManagedClick(cue.querySelector("[data-adam-one-route='detail']"), () => navigateTo("/agent-workshop/detailed-agent-view-dataquad-node/"));
    bindManagedClick(cue.querySelector("[data-adam-one-route='map']"), () => navigateTo("/agent-workshop/aegis-project-tree-index/"));
  } catch (error) {
    console.warn("[agent-workshop] adam-one orientation cue hydration failed", error);
  }
}

function wireRouteByText(doc, labelsToRoute) {
  const interactive = Array.from(doc.querySelectorAll("button, a"));
  interactive.forEach((node) => {
    const text = normalizeText(node.textContent);
    const entry = labelsToRoute.find((item) => text.includes(item.text));
    if (!entry) return;
    bindManagedClick(node, () => {
      showToast(doc, entry.toast || `Opening ${routeLabel(entry.route)}.`);
      navigateTo(entry.route);
    });
  });
}

function enhanceMainConsole(doc) {
  if (doc.body.dataset.aegisEnhancedWorkshopMain === "true") return;
  doc.body.dataset.aegisEnhancedWorkshopMain = "true";
  injectStyles(doc);

  const routeButtons = Array.from(doc.querySelectorAll("[data-workshop-route]"));
  const search = doc.querySelector("[data-workshop-search]");
  const cards = Array.from(doc.querySelectorAll("[data-workshop-card]"));
  const resume = doc.querySelector("[data-workshop-resume]");
  const lastLaunch = doc.querySelector("[data-workshop-last-launch]");
  const lastSurface = doc.querySelector("[data-workshop-last-surface]");
  const actionCount = doc.querySelector("[data-workshop-action-count]");
  const actionCountPanel = doc.querySelector("[data-workshop-action-count-panel]");
  const connectivity = doc.querySelector("[data-workshop-connectivity]");
  const connectivityPanel = doc.querySelector("[data-workshop-connectivity-panel]");
  const feed = doc.querySelector("[data-workshop-activity-feed]");
  const intro = doc.querySelector(".hero-copy");

  const render = () => {
    const state = ensureDraftAgentState();
    const launches = state.launches || [];
    const last = state.lastLaunchRoute || "";
    const online = navigator.onLine ? "Online" : "Offline";

    if (lastLaunch) lastLaunch.textContent = last ? routeLabel(last) : "Awaiting";
    if (lastSurface) lastSurface.textContent = last ? routeLabel(last) : "Awaiting activity";
    if (actionCount) actionCount.textContent = String(launches.length);
    if (actionCountPanel) actionCountPanel.textContent = String(launches.length);
    if (connectivity) connectivity.textContent = online;
    if (connectivityPanel) connectivityPanel.textContent = online;

    if (feed) {
      const items = launches.slice(0, 4);
      feed.innerHTML = items.length
        ? items.map((entry) => `<div>${new Date(entry.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · ${routeLabel(entry.path)}</div>`).join("")
        : "<div>Workshop home loaded. Awaiting the next Peer action.</div>";
    }
  };

  prependCoreBanner(
    doc,
    intro || doc.querySelector("main") || doc.body,
    `${CORE_ENGINE.name} ${CORE_ENGINE.displayVersion} is the single creation baseline for Workshop agents. Updating the canon-locked Core repo should update every Workshop-bound creation surface after sync and rebuild.`
  );

  routeButtons.forEach((button) => bindManagedClick(button, () => {
    const route = button.getAttribute("data-workshop-route");
    showToast(doc, `Opening ${routeLabel(route)}.`);
    navigateTo(route);
  }));

  bindManagedClick(resume, () => {
    const state = readState();
    const target = state.lastLaunchRoute || "/agent-workshop/aegis-holochamber-academy/";
    showToast(doc, `Resuming ${routeLabel(target)}.`);
    navigateTo(target);
  });

  if (search) {
    search.addEventListener("input", () => {
      const query = normalizeText(search.value);
      cards.forEach((card) => {
        const visible = !query || normalizeText(card.textContent).includes(query);
        card.classList.toggle("aegis-workshop-hidden", !visible);
      });
    });
  }

  render();
  window.addEventListener("online", render);
  window.addEventListener("offline", render);

  hydrateLivePeerRuntime(doc, (runtime) => {
    if (lastLaunch) lastLaunch.textContent = runtime.peer.status || "Candidate";
    if (lastSurface) lastSurface.textContent = runtime.peer.displayName || "Live Peer";
    if (actionCount) actionCount.textContent = String(runtime.events?.length || 0);
    if (actionCountPanel) actionCountPanel.textContent = String(runtime.events?.length || 0);
    if (feed) {
      const items = [
        `<div>Live Peer: ${runtime.peer.displayName} · ${runtime.peer.status}</div>`,
        `<div>Envelope: ${runtime.steward?.currentEnvelope || "strict"} · Review required: ${runtime.steward?.reviewRequired ? "yes" : "no"}</div>`,
        ...(runtime.events || []).slice(0, 3).map((entry) => `<div>${entry.eventType} · ${entry.summary}</div>`),
      ];
      feed.innerHTML = items.join("");
    }
  });
}

function enhanceWorkshopEntrance(doc) {
  if (doc.body.dataset.aegisEnhancedWorkshopEntrance === "true") return;
  doc.body.dataset.aegisEnhancedWorkshopEntrance = "true";
  injectStyles(doc);

  const anchor = Array.from(doc.querySelectorAll("div")).find((node) => {
    const text = normalizeText(node.textContent);
    return text.includes("agentic workshop") && text.includes("initialize workshop");
  }) || doc.querySelector("main") || doc.body;

  injectAdamOneOrientationCue(doc, anchor, {
    kicker: "Peer Arrival Marker",
    title: "Adam-One stands at this threshold as a governed Peer in training.",
    body: "This entrance now marks the beginning of Adam-One's review path into the wider EcoVerse. It is a lantern of visibility, not a grant of unchecked authority.",
  });

  wireRouteByText(doc, [
    {
      text: "open main console",
      route: "/agent-workshop/agentic-workshop-main-console/",
      toast: "Opening the Main Console.",
    },
    {
      text: "open proof lane",
      route: "/agent-workshop/active-agents-monitor-agentic-workshop/",
      toast: "Opening Adam-One's proof lane.",
    },
    {
      text: "open workshop map",
      route: "/agent-workshop/aegis-project-tree-index/",
      toast: "Opening the Workshop Map.",
    },
    {
      text: "open agent detail",
      route: "/agent-workshop/detailed-agent-view-dataquad-node/",
      toast: "Opening the detailed Peer view.",
    },
  ]);
}

function enhanceWorkshopMap(doc) {
  if (doc.body.dataset.aegisEnhancedWorkshopMap === "true") return;
  doc.body.dataset.aegisEnhancedWorkshopMap = "true";
  injectStyles(doc);

  const routeButtons = Array.from(doc.querySelectorAll("[data-workshop-route]"));
  const search = doc.querySelector("[data-workshop-map-search]");
  const cards = Array.from(doc.querySelectorAll("[data-workshop-map-card]"));
  const lastLaunch = doc.querySelector("[data-workshop-map-last-launch]");
  const actionCount = doc.querySelector("[data-workshop-map-action-count]");
  const connectivity = doc.querySelector("[data-workshop-map-connectivity]");
  const hero = doc.querySelector(".hero-copy");

  const render = () => {
    const state = ensureDraftAgentState();
    const launches = state.launches || [];
    if (lastLaunch) {
      lastLaunch.textContent = state.lastLaunchRoute ? routeLabel(state.lastLaunchRoute) : "Awaiting";
    }
    if (actionCount) {
      actionCount.textContent = String(launches.length);
    }
    if (connectivity) {
      connectivity.textContent = navigator.onLine ? "Online" : "Offline";
    }
  };

  prependCoreBanner(
    doc,
    hero || doc.querySelector("main") || doc.body,
    `${CORE_ENGINE.name} ${CORE_ENGINE.displayVersion} now anchors Workshop creation defaults, governance invariants, and propagation into the broader EcoVerse.`
  );

  routeButtons.forEach((button) => bindManagedClick(button, () => {
    const route = button.getAttribute("data-workshop-route");
    showToast(doc, `Opening ${routeLabel(route)} from the Workshop Map.`);
    navigateTo(route);
  }));

  if (search) {
    search.addEventListener("input", () => {
      const query = normalizeText(search.value);
      cards.forEach((card) => {
        const visible = !query || normalizeText(card.textContent).includes(query);
        card.classList.toggle("aegis-workshop-hidden", !visible);
      });
    });
  }

  render();
  window.addEventListener("online", render);
  window.addEventListener("offline", render);
}

function enhanceMeshVisualizer(doc) {
  if (doc.body.dataset.aegisEnhancedWorkshopMesh === "true") return;
  doc.body.dataset.aegisEnhancedWorkshopMesh = "true";
  injectStyles(doc);

  const state = ensureDraftAgentState();
  const manifest = state.draftAgent?.manifest || getCoreAgentManifest();
  const defaults = manifest.defaults || CORE_ENGINE.creationDefaults;
  const launches = state.launches || [];
  const online = navigator.onLine ? "Online" : "Offline";
  const anchor = doc.querySelector("main") || doc.body;

  prependCoreBanner(
    doc,
    anchor,
    `${CORE_ENGINE.name} ${CORE_ENGINE.displayVersion} defines the Peer baseline here. The Peer, Advocate daemon, Steward daemon, and temporal-memory target are shown as the intended beta topology, while live Firebase persistence and autonomous daemon execution remain backend-pending until wired.`
  );

  const setText = (selector, value) => {
    const node = doc.querySelector(selector);
    if (node) node.textContent = value;
  };

  setText("[data-mesh-core-version]", CORE_ENGINE.displayVersion);
  setText("[data-mesh-connectivity]", online);
  setText("[data-mesh-draft-state]", state.draftAgent?.finalizedAt ? "Draft recorded" : "Draft in progress");
  setText("[data-mesh-memory-target]", "Firebase temporal memory target · backend pending");
  setText("[data-mesh-badge]", defaults.deployment?.state || CORE_ENGINE.creationDefaults.deployment.state);
  setText("[data-mesh-peer-name]", defaults.identity?.role || "Peer Agent");
  setText("[data-mesh-memory-architecture]", `${defaults.memory?.architecture || CORE_ENGINE.creationDefaults.memory.architecture} · ${defaults.memory?.snapshotProtocol || CORE_ENGINE.creationDefaults.memory.snapshotProtocol}`);
  setText("[data-mesh-autonomy]", "Strict parameters now · broader autonomy as coherence matures");
  setText("[data-mesh-invariants]", (manifest.invariants || CORE_ENGINE.governanceInvariants || []).join(" · "));
  setText("[data-mesh-ledger-status]", `${online} · ${launches.length} workshop actions`);

  const ledger = doc.querySelector("[data-mesh-ledger]");
  if (ledger) {
    const items = [
      `[core] ${CORE_ENGINE.displayVersion} referenced from ${CORE_ENGINE.sourceRepoPath}.`,
      `[draft] Current identity role: ${defaults.identity?.role || CORE_ENGINE.creationDefaults.identity.role}.`,
      `[memory] Temporal memory target: Firebase-backed persistence planned; browser draft state active now.`,
      `[daemon] Advocate and Steward lanes are modeled here, but live daemon execution is backend pending.`,
      ...launches.slice(0, 4).map((entry) => `[launch] ${new Date(entry.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} -> ${routeLabel(entry.path)}`),
    ];
    ledger.innerHTML = items.map((item) => `<div>${item}</div>`).join("");
  }

  Array.from(doc.querySelectorAll("[data-mesh-route]")).forEach((button) => {
    const route = button.getAttribute("data-mesh-route");
    bindManagedClick(button, () => {
      showToast(doc, `Opening ${routeLabel(route)}.`);
      navigateTo(route);
    });
  });

  hydrateLivePeerRuntime(doc, (runtime) => {
    setText("[data-mesh-draft-state]", runtime.peer.status || "candidate");
    setText("[data-mesh-memory-target]", "Firebase temporal memory live");
    setText("[data-mesh-ledger-status]", `Online · ${(runtime.events || []).length} persisted events`);
    if (ledger) {
      const items = [
        `[peer] ${runtime.peer.displayName} is now persisted as ${runtime.peer.status}.`,
        `[advocate] ${runtime.advocate?.declaredIntent || "Awaiting advocate summary."}`,
        `[steward] Envelope: ${runtime.steward?.currentEnvelope || "strict"} · Review required: ${runtime.steward?.reviewRequired ? "yes" : "no"}.`,
        ...(runtime.events || []).slice(0, 4).map((entry) => `[event] ${entry.eventType} · ${entry.summary}`),
      ];
      ledger.innerHTML = items.map((item) => `<div>${item}</div>`).join("");
    }
  });
}

function enhanceCommunicationProtocol(doc) {
  if (doc.body.dataset.aegisEnhancedWorkshopProtocol === "true") return;
  doc.body.dataset.aegisEnhancedWorkshopProtocol = "true";
  injectStyles(doc);

  const state = ensureDraftAgentState();
  const manifest = state.draftAgent?.manifest || getCoreAgentManifest();
  const defaults = manifest.defaults || CORE_ENGINE.creationDefaults;
  const launches = state.launches || [];
  const online = navigator.onLine ? "Online" : "Offline";
  const anchor = doc.querySelector("main") || doc.body;

  prependCoreBanner(
    doc,
    anchor,
    `${CORE_ENGINE.name} ${CORE_ENGINE.displayVersion} defines the communication posture here. Peer, Advocate, Steward, and temporal-memory lanes are declared as the beta protocol architecture, while live Firebase event streaming and daemon messaging remain backend-pending until implemented.`
  );

  const setText = (selector, value) => {
    const node = doc.querySelector(selector);
    if (node) node.textContent = value;
  };

  setText("[data-protocol-core]", CORE_ENGINE.displayVersion);
  setText("[data-protocol-connectivity]", online);
  setText("[data-protocol-state]", state.draftAgent?.finalizedAt ? "Draft recorded" : "Draft in progress");
  setText("[data-protocol-transport]", `${defaults.memory?.ragMode || CORE_ENGINE.creationDefaults.memory.ragMode} · local session truth`);
  setText("[data-protocol-mode]", "Governed Peer lane orchestration");
  setText("[data-protocol-reflection]", defaults.logic?.reflectionPrimitive || CORE_ENGINE.creationDefaults.logic.reflectionPrimitive);
  setText("[data-protocol-snapshot]", defaults.memory?.snapshotProtocol || CORE_ENGINE.creationDefaults.memory.snapshotProtocol);
  setText("[data-protocol-invariants]", (manifest.invariants || CORE_ENGINE.governanceInvariants || []).join(" · "));
  setText("[data-protocol-badge]", defaults.deployment?.state || CORE_ENGINE.creationDefaults.deployment.state);
  setText("[data-protocol-ledger-status]", `${online} · ${launches.length} workshop actions`);

  const ledger = doc.querySelector("[data-protocol-ledger]");
  if (ledger) {
    const items = [
      `[core] ${CORE_ENGINE.displayVersion} is the active communication baseline.`,
      `[transport] Current protocol view is local-first and browser-truthful until Firebase event persistence is wired.`,
      `[daemon] Advocate and Steward communication lanes are modeled as beta architecture, not active message buses yet.`,
      `[memory] Temporal memory append-only persistence is targeted for Firebase in the beta runtime path.`,
      ...launches.slice(0, 4).map((entry) => `[launch] ${new Date(entry.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} -> ${routeLabel(entry.path)}`),
    ];
    ledger.innerHTML = items.map((item) => `<div>${item}</div>`).join("");
  }

  Array.from(doc.querySelectorAll("[data-protocol-route]")).forEach((button) => {
    const route = button.getAttribute("data-protocol-route");
    bindManagedClick(button, () => {
      showToast(doc, `Opening ${routeLabel(route)}.`);
      navigateTo(route);
    });
  });

  hydrateLivePeerRuntime(doc, (runtime) => {
    setText("[data-protocol-state]", runtime.peer.status || "candidate");
    setText("[data-protocol-transport]", "Firebase temporal memory · live beta channel");
    setText("[data-protocol-ledger-status]", `Online · ${(runtime.events || []).length} persisted events`);
    if (ledger) {
      const items = [
        `[peer] ${runtime.peer.displayName} bound to ${runtime.peer.coreBinding?.coreEngineId || CORE_ENGINE.id}.`,
        `[advocate] ${runtime.advocate?.continuitySummary || "Awaiting advocate continuity state."}`,
        `[steward] Hold state: ${runtime.steward?.holdState || "clear"} · Coherence gate: ${runtime.steward?.coherenceGate || "initial"}.`,
        ...(runtime.events || []).slice(0, 4).map((entry) => `[event] ${entry.eventType} · ${entry.summary}`),
      ];
      ledger.innerHTML = items.map((item) => `<div>${item}</div>`).join("");
    }
  });
}

function enhanceModelDeploymentFlow(doc) {
  if (doc.body.dataset.aegisEnhancedModelDeployment === "true") return;
  doc.body.dataset.aegisEnhancedModelDeployment = "true";
  injectStyles(doc);

  const state = ensureDraftAgentState();
  const manifest = state.draftAgent?.manifest || getCoreAgentManifest();
  const defaults = manifest.defaults || {};
  const launches = state.launches || [];
  const online = navigator.onLine ? "Online" : "Offline";
  const headerAnchor = doc.querySelector("main") || doc.body;

  prependCoreBanner(
    doc,
    headerAnchor,
    `${CORE_ENGINE.name} ${CORE_ENGINE.displayVersion} is being referenced from the canon-locked Core repository at ${CORE_ENGINE.sourceRepoPath}. This page records draft readiness and EcoVerse handoff truthfully without fabricating production rollout telemetry.`
  );

  const setText = (selector, value) => {
    const node = doc.querySelector(selector);
    if (node) node.textContent = value;
  };

  setText("[data-core-version]", CORE_ENGINE.displayVersion);
  setText("[data-core-status]", String(CORE_ENGINE.currentStatus || "unknown").toUpperCase());
  setText("[data-deployment-mode]", defaults.deployment?.mode || CORE_ENGINE.creationDefaults.deployment.mode);
  setText("[data-deployment-connectivity]", online);
  setText("[data-core-source]", CORE_ENGINE.sourceRepoPath);
  setText("[data-reference-date]", CORE_ENGINE.referenceDate || "Unavailable");
  setText("[data-canon-version]", `Canon v${CORE_ENGINE.canonVersion}`);
  setText("[data-standards-version]", `Standards v${CORE_ENGINE.standardsVersion}`);
  setText("[data-default-role]", defaults.identity?.role || CORE_ENGINE.creationDefaults.identity.role);
  setText("[data-default-boundary]", defaults.identity?.boundary || CORE_ENGINE.creationDefaults.identity.boundary);
  setText("[data-default-model]", defaults.logic?.baseModel || CORE_ENGINE.creationDefaults.logic.baseModel);
  setText("[data-default-reflection]", defaults.logic?.reflectionPrimitive || CORE_ENGINE.creationDefaults.logic.reflectionPrimitive);
  setText("[data-default-memory]", defaults.memory?.architecture || CORE_ENGINE.creationDefaults.memory.architecture);
  setText("[data-default-snapshot]", defaults.memory?.snapshotProtocol || CORE_ENGINE.creationDefaults.memory.snapshotProtocol);
  setText("[data-invariants]", (manifest.invariants || CORE_ENGINE.governanceInvariants || []).join(" · "));
  setText("[data-deployment-state-badge]", defaults.deployment?.state || CORE_ENGINE.creationDefaults.deployment.state);
  setText("[data-ledger-status]", `${online} · ${launches.length} logged actions`);

  const preview = doc.querySelector("[data-manifest-preview]");
  if (preview) {
    preview.textContent = JSON.stringify(
      {
        coreEngineId: manifest.coreEngineId,
        sourceRepoPath: manifest.sourceRepoPath,
        referenceDate: manifest.referenceDate,
        canonVersion: manifest.canonVersion,
        standardsVersion: manifest.standardsVersion,
        currentStatus: manifest.currentStatus,
        defaults: manifest.defaults,
      },
      null,
      2
    );
  }

  const ledger = doc.querySelector("[data-deployment-ledger]");
  if (ledger) {
    const entries = [
      `[sync] Bound to ${CORE_ENGINE.displayVersion} from ${CORE_ENGINE.sourceRepoPath}.`,
      `[truth] Deployment posture remains "${defaults.deployment?.state || CORE_ENGINE.creationDefaults.deployment.state}".`,
      `[session] Browser connectivity currently reports ${online.toLowerCase()}.`,
      ...launches.slice(0, 4).map((entry) => `[launch] ${new Date(entry.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} -> ${routeLabel(entry.path)}`),
    ];
    ledger.innerHTML = entries.map((entry) => `<div>${entry}</div>`).join("");
  }

  Array.from(doc.querySelectorAll("[data-deployment-route]")).forEach((button) => {
    const route = button.getAttribute("data-deployment-route");
    bindManagedClick(button, () => {
      showToast(doc, `Opening ${routeLabel(route)}.`);
      navigateTo(route);
    });
  });

  const finalize = doc.querySelector("[data-deployment-action='finalize']");
  bindManagedClick(finalize, async () => {
    patchState({
      draftAgent: {
        ...readState().draftAgent,
        finalizedAt: new Date().toISOString(),
      },
    });
    showToast(doc, "Persisting the first beta Peer to Firebase.");
    try {
      const { createOrUpdateBetaPeer } = await loadWorkshopOperatorControls();
      const result = await createOrUpdateBetaPeer({
        draftAgent: readState().draftAgent,
        originSurface: "model_deployment_flow",
      });
      showToast(
        doc,
        result.existed
          ? "Beta Peer runtime refreshed. Opening the Active Agents Monitor."
          : "Beta Peer runtime created in Firebase. Opening the Active Agents Monitor.",
      );
      navigateTo("/agent-workshop/active-agents-monitor-agentic-workshop/");
    } catch (error) {
      console.error("[agent-workshop] beta peer creation failed", error);
      showToast(doc, "Firebase rejected the beta Peer write. The draft remains local until persistence is available.");
    }
  });

  hydrateLivePeerRuntime(doc, (runtime) => {
    setText("[data-deployment-state-badge]", runtime.peer.status || "candidate");
    setText("[data-ledger-status]", `Online · ${(runtime.events || []).length} persisted events`);
    setText("[data-deployment-connectivity]", "Online · Firebase bound");
    if (preview) {
      preview.textContent = JSON.stringify(
        {
          peerId: runtime.peer.peerId,
          displayName: runtime.peer.displayName,
          status: runtime.peer.status,
          coreBinding: runtime.peer.coreBinding,
          advocate: runtime.advocate,
          steward: runtime.steward,
          tasks: runtime.tasks,
        },
        null,
        2,
      );
    }
    if (ledger) {
      const entries = [
        `[peer] ${runtime.peer.displayName} is persisted as ${runtime.peer.status}.`,
        `[advocate] ${runtime.advocate?.declaredIntent || "Awaiting advocate lane."}`,
        `[steward] Envelope: ${runtime.steward?.currentEnvelope || "strict"} · Hold state: ${runtime.steward?.holdState || "clear"}.`,
        ...(runtime.events || []).slice(0, 4).map((entry) => `[event] ${entry.eventType} · ${entry.summary}`),
      ];
      ledger.innerHTML = entries.map((entry) => `<div>${entry}</div>`).join("");
    }
  });
}

function enhanceActiveAgentsMonitor(doc) {
  if (doc.body.dataset.aegisEnhancedActiveMonitor === "true") return;
  doc.body.dataset.aegisEnhancedActiveMonitor = "true";
  injectStyles(doc);

  const state = ensureDraftAgentState();
  const anchor = doc.querySelector("main") || doc.body;
  prependCoreBanner(
    doc,
    anchor,
    `${CORE_ENGINE.name} ${CORE_ENGINE.displayVersion} is now driving the first live beta Peer. This monitor shows persisted Firebase truth for ${BETA_PEER_DISPLAY_NAME}, not synthetic workshop telemetry.`,
  );

  const setText = (selector, value) => {
    const node = doc.querySelector(selector);
    if (node) node.textContent = value;
  };

  const eventFeed = doc.querySelector("[data-active-feed]");
  const artifactFeed = doc.querySelector("[data-active-artifacts]");
  const appendButton = doc.querySelector("[data-active-action='append']");
  const guidanceButton = doc.querySelector("[data-active-action='guidance']");
  const proposalButton = doc.querySelector("[data-active-action='proposal']");
  const priorityButton = doc.querySelector("[data-active-action='priority-note']");
  const detailButton = doc.querySelector("[data-active-route='detail']");
  const mapButton = doc.querySelector("[data-active-route='map']");
  const guidancePanel = doc.querySelector("[data-active-guidance]");
  const proposalPanel = doc.querySelector("[data-active-proposal]");
  const priorityPanel = doc.querySelector("[data-active-priority-note]");

  bindManagedClick(detailButton, () => navigateTo("/agent-workshop/detailed-agent-view-dataquad-node/"));
  bindManagedClick(mapButton, () => navigateTo("/agent-workshop/aegis-project-tree-index/"));
  bindManagedClick(appendButton, withButtonLoading(appendButton, "Appending…", async () => {
    showToast(doc, "Steward is appending a reviewed temporal memory event.");
    try {
      const { appendBetaPeerTemporalMemory } = await loadWorkshopOperatorControls();
      await appendBetaPeerTemporalMemory({
        source: "active_agents_monitor_agentic_workshop",
        summary: "Steward recorded a reviewed EcoVerse structure observation and preserved it as temporal memory continuity.",
        details: {
          taskType: "environment_spec_draft",
          origin: "workshop_monitor",
        },
      });
      showToast(doc, "Temporal memory append recorded in Firebase.");
      await hydrateLivePeerRuntime(doc, applyRuntime);
    } catch (error) {
      console.error("[agent-workshop] temporal memory append failed", error);
      showToast(doc, "Temporal memory append failed. The Peer remains in its previous reviewed state.");
    }
  }));
  bindManagedClick(guidanceButton, withButtonLoading(guidanceButton, "Generating…", async () => {
    showToast(doc, "Peer is generating a bounded structure guidance note from its continuity ledger.");
    try {
      const { generateBetaPeerStructureGuidance } = await loadWorkshopOperatorControls();
      await generateBetaPeerStructureGuidance({
        source: "active_agents_monitor_agentic_workshop",
      });
      showToast(doc, "Structure guidance generated and recorded.");
      await hydrateLivePeerRuntime(doc, applyRuntime);
    } catch (error) {
      console.error("[agent-workshop] structure guidance generation failed", error);
      showToast(doc, "Structure guidance could not be generated right now.");
    }
  }));
  bindManagedClick(proposalButton, withButtonLoading(proposalButton, "Generating…", async () => {
    showToast(doc, "Peer is preparing a bounded EcoVerse structure proposal for review.");
    try {
      const { generateBetaPeerStructureProposal } = await loadWorkshopOperatorControls();
      await generateBetaPeerStructureProposal({
        source: "active_agents_monitor_agentic_workshop",
      });
      showToast(doc, "Structure proposal generated for operator review.");
      await hydrateLivePeerRuntime(doc, applyRuntime);
    } catch (error) {
      console.error("[agent-workshop] structure proposal generation failed", error);
      showToast(doc, "Structure proposal could not be generated right now.");
    }
  }));
  bindManagedClick(priorityButton, withButtonLoading(priorityButton, "Drafting…", async () => {
    showToast(doc, "Adam-One is drafting the next bounded Workshop priority note.");
    try {
      const { generateBetaPeerWorkshopPriorityNote } = await loadWorkshopOperatorControls();
      await generateBetaPeerWorkshopPriorityNote({
        source: "active_agents_monitor_agentic_workshop",
      });
      showToast(doc, "Workshop priority note generated and recorded.");
      await hydrateLivePeerRuntime(doc, applyRuntime);
    } catch (error) {
      console.error("[agent-workshop] workshop priority note generation failed", error);
      showToast(doc, "Workshop priority note could not be generated right now.");
    }
  }));

  const applyRuntime = (runtime) => {
    const eventCount = runtime.peer?.memoryEventCount || runtime.events?.length || 0;
    const appendCount = runtime.peer?.temporalMemory?.appendCount || Math.max(0, eventCount - 1);
    const continuityMode = runtime.peer?.temporalMemory?.continuityMode || runtime.peer?.dataQuadBinding?.continuityStatus || "bootstrap-only";
    const latestSummary = runtime.peer?.temporalMemory?.latestSummary || runtime.advocate?.continuitySummary || "Awaiting reviewed continuity.";

    setText("[data-active-peer-name]", runtime.peer?.displayName || BETA_PEER_DISPLAY_NAME);
    setText("[data-active-peer-role]", runtime.peer?.role || "Structure Steward");
    setText("[data-active-status]", runtime.peer?.status || "candidate");
    setText("[data-active-core]", runtime.peer?.coreBinding?.coreEngineId || CORE_ENGINE.id);
    setText("[data-active-core-version]", runtime.peer?.coreBinding?.canonVersion ? `${CORE_ENGINE.displayVersion}` : CORE_ENGINE.displayVersion);
    setText("[data-active-connectivity]", navigator.onLine ? "Online" : "Offline");
    setText("[data-active-continuity]", continuityMode);
    setText("[data-active-event-count]", String(eventCount));
    setText("[data-active-append-count]", String(appendCount));
    setText("[data-active-envelope]", runtime.steward?.currentEnvelope || "strict");
    setText("[data-active-review]", runtime.steward?.reviewRequired ? "review required" : "review current");
    setText("[data-active-summary]", latestSummary);
    setText("[data-active-dataquad]", runtime.peer?.dataQuadBinding?.dataQuadId || "Awaiting DataQuad binding");
    setText("[data-active-session]", runtime.peer?.dataQuadBinding?.sessionId || "Awaiting session");

    if (eventFeed) {
      const items = (runtime.events || []).slice(0, 5);
      eventFeed.innerHTML = items.length
        ? items.map((entry) => `<div>${entry.eventType} · ${entry.summary}</div>`).join("")
        : "<div>No persisted Peer events yet.</div>";
    }

    if (artifactFeed) {
      const items = (runtime.artifacts || []).slice(0, 4);
      artifactFeed.innerHTML = items.length
        ? items.map((entry) => `<div>${entry.title || entry.type} · ${entry.reviewState || "pending"}</div>`).join("")
        : "<div>No recorded bootstrap or temporal memory artifacts yet.</div>";
    }

    if (guidancePanel) {
      const guidanceArtifact = (runtime.artifacts || []).find((entry) => entry.type === "structure_guidance_note");
      guidancePanel.textContent = guidanceArtifact?.content || "No generated structure guidance yet.";
    }

    if (proposalPanel) {
      const proposalArtifact = (runtime.artifacts || []).find(
        (entry) => entry.type === "structure_change_applied" || entry.type === "structure_proposal",
      );
      proposalPanel.textContent = proposalArtifact?.content || "No generated structure proposal yet.";
    }

    if (priorityPanel) {
      const priorityArtifact = (runtime.artifacts || []).find((entry) => entry.type === "workshop_priority_note");
      priorityPanel.textContent = priorityArtifact?.content || "No generated Workshop priority note yet.";
    }
  };

  setText("[data-active-core-version]", CORE_ENGINE.displayVersion);
  setText("[data-active-connectivity]", navigator.onLine ? "Online" : "Offline");
  setText("[data-active-summary]", state.draftAgent?.finalizedAt ? "Draft finalized. Awaiting persisted runtime hydration." : "Awaiting live Peer hydration.");

  hydrateLivePeerRuntime(doc, applyRuntime);
}

function enhanceDetailedAgentView(doc) {
  if (doc.body.dataset.aegisEnhancedDetailedView === "true") return;
  doc.body.dataset.aegisEnhancedDetailedView = "true";
  injectStyles(doc);

  const anchor = doc.querySelector("main") || doc.body;
  prependCoreBanner(
    doc,
    anchor,
    `${CORE_ENGINE.name} ${CORE_ENGINE.displayVersion} and the canon-locked DataQuad bootstrap are reflected here as a truthful beta node view. This surface shows persisted identity, continuity, and Steward-reviewed memory state.`,
  );

  const setText = (selector, value) => {
    const node = doc.querySelector(selector);
    if (node) node.textContent = value;
  };

  const preview = doc.querySelector("[data-detail-preview]");
  const eventFeed = doc.querySelector("[data-detail-events]");
  const appendButton = doc.querySelector("[data-detail-action='append']");
  const exportButton = doc.querySelector("[data-detail-action='export']");
  const backButton = doc.querySelector("[data-detail-route='monitor']");
  const exportPosture = doc.querySelector("[data-detail-export-posture]");
  const exportNote = doc.querySelector("[data-detail-export-note]");

  bindManagedClick(backButton, () => navigateTo("/agent-workshop/active-agents-monitor-agentic-workshop/"));
  bindManagedClick(appendButton, withButtonLoading(appendButton, "Appending…", async () => {
    showToast(doc, "Steward is preserving another reviewed continuity note.");
    try {
      const { appendBetaPeerTemporalMemory } = await loadWorkshopOperatorControls();
      await appendBetaPeerTemporalMemory({
        source: "detailed_agent_view_dataquad_node",
        summary: "Steward appended a reviewed DataQuad node note to preserve continuity across Workshop observation and action.",
        details: {
          origin: "detail_view",
          taskType: "continuity_note",
        },
      });
      showToast(doc, "Reviewed continuity note appended.");
      await hydrateLivePeerRuntime(doc, applyRuntime);
    } catch (error) {
      console.error("[agent-workshop] detailed append failed", error);
      showToast(doc, "Unable to append reviewed continuity right now.");
    }
  }));
  bindManagedClick(exportButton, withButtonLoading(exportButton, "Recording…", async () => {
    showToast(doc, "Steward is recording an embedded export review note.");
    try {
      const { appendBetaPeerTemporalMemory } = await loadWorkshopOperatorControls();
      await appendBetaPeerTemporalMemory({
        source: "detailed_agent_view_export_review",
        summary: "Steward confirmed that export review remains embedded in the detailed agent surface until governed export services exist.",
        details: {
          taskType: "export_review",
          origin: "detail_view",
        },
      });
      showToast(doc, "Export review note appended.");
      await hydrateLivePeerRuntime(doc, applyRuntime);
    } catch (error) {
      console.error("[agent-workshop] export review append failed", error);
      showToast(doc, "Unable to record the export review note right now.");
    }
  }));

  const applyRuntime = (runtime) => {
    setText("[data-detail-peer-name]", runtime.peer?.displayName || "Awaiting Peer");
    setText("[data-detail-peer-role]", runtime.peer?.role || "Structure Steward");
    setText("[data-detail-status]", runtime.peer?.status || "candidate");
    setText("[data-detail-envelope]", runtime.steward?.currentEnvelope || "strict");
    setText("[data-detail-gate]", runtime.steward?.coherenceGate || "bootstrap-only");
    setText("[data-detail-dataquad]", runtime.peer?.dataQuadBinding?.dataQuadId || "Awaiting DataQuad");
    setText("[data-detail-peer-record]", runtime.peer?.dataQuadBinding?.peerRecordId || "Awaiting PEER record");
    setText("[data-detail-pct-record]", runtime.peer?.dataQuadBinding?.pctRecordId || "Awaiting PCT record");
    setText("[data-detail-summary]", runtime.advocate?.continuitySummary || runtime.peer?.temporalMemory?.latestSummary || "Awaiting continuity summary.");
    if (exportPosture) {
      exportPosture.textContent = runtime.peer?.status === "active"
        ? "Embedded review active"
        : "Awaiting live runtime";
    }

    if (preview) {
      preview.textContent = JSON.stringify(
        {
          peer: runtime.peer,
          advocate: runtime.advocate,
          steward: runtime.steward,
          artifacts: runtime.artifacts,
          sessions: runtime.sessions,
        },
        null,
        2,
      );
    }

    if (eventFeed) {
      const items = (runtime.events || []).slice(0, 6);
      eventFeed.innerHTML = items.length
        ? items.map((entry) => `<div>${entry.timestamp || "pending"} · ${entry.eventType} · ${entry.summary}</div>`).join("")
        : "<div>No continuity events recorded yet.</div>";
    }

    if (exportNote) {
      const latestExportEvent = (runtime.events || []).find((entry) => entry.source === "detailed_agent_view_export_review");
      exportNote.textContent = latestExportEvent
        ? `Latest embedded export review:\n${latestExportEvent.eventType}\n${latestExportEvent.summary}`
        : "No export review note has been recorded yet.";
    }
  };

  hydrateLivePeerRuntime(doc, applyRuntime);
}

function enhanceGovernedRespawnArchive(doc) {
  if (doc.body.dataset.aegisEnhancedRespawnArchive === "true") return;
  doc.body.dataset.aegisEnhancedRespawnArchive = "true";
  injectStyles(doc);

  const anchor = doc.querySelector("main") || doc.body;
  prependCoreBanner(
    doc,
    anchor,
    `${CORE_ENGINE.name} ${CORE_ENGINE.displayVersion} grounds this archive in persisted continuity. Live record state is drawn directly from the Peer ledger — the same state shared with the secondary archive entry point.`,
  );

  const setText = (selector, value) => {
    const node = doc.querySelector(selector);
    if (node) node.textContent = value;
  };

  const eventFeed = doc.querySelector("[data-archive-events]");
  const notePanel = doc.querySelector("[data-archive-note]");
  const appendButton = doc.querySelector("[data-archive-action='append']");
  const detailButton = doc.querySelector("[data-archive-route='detail']");
  const monitorButton = doc.querySelector("[data-archive-route='monitor']");

  bindManagedClick(detailButton, () => navigateTo("/agent-workshop/detailed-agent-view-dataquad-node/"));
  bindManagedClick(monitorButton, () => navigateTo("/agent-workshop/active-agents-monitor-agentic-workshop/"));
  bindManagedClick(appendButton, withButtonLoading(appendButton, "Recording…", async () => {
    showToast(doc, "Steward is recording a governed archive review note.");
    try {
      const { appendBetaPeerTemporalMemory } = await loadWorkshopOperatorControls();
      await appendBetaPeerTemporalMemory({
        source: "sssp_respawn_archive_1",
        summary: "Steward reviewed the governed respawn archive and confirmed that only persisted continuity records and archive notes are currently represented here.",
        details: {
          taskType: "archive_review",
          origin: "governed_archive",
        },
      });
      showToast(doc, "Archive review note recorded in Firebase.");
      await hydrateLivePeerRuntime(doc, applyRuntime);
    } catch (error) {
      console.error("[agent-workshop] archive review append failed", error);
      showToast(doc, "Archive review note could not be recorded right now.");
    }
  }));

  const applyRuntime = (runtime) => {
    const latestSummary = runtime.peer?.temporalMemory?.latestSummary || runtime.advocate?.continuitySummary || "Awaiting reviewed continuity.";
    setText("[data-archive-connectivity]", navigator.onLine ? "Online" : "Offline");
    setText("[data-archive-mode]", runtime.peer?.temporalMemory?.continuityMode || runtime.peer?.dataQuadBinding?.continuityStatus || "bootstrap-only");
    setText("[data-archive-summary]", latestSummary);

    if (eventFeed) {
      const items = [
        ...(runtime.events || []).slice(0, 4).map((entry) => `${entry.eventType} · ${entry.summary}`),
        ...(runtime.artifacts || []).slice(0, 2).map((entry) => `${entry.title || entry.type} · ${entry.reviewState || "pending"}`),
      ].slice(0, 6);
      eventFeed.innerHTML = items.length
        ? items.map((entry) => `<div>${entry}</div>`).join("")
        : "<div>No archive records yet.</div>";
    }

    if (notePanel) {
      const latestArchiveEvent = (runtime.events || []).find(
        (entry) => entry.source === "sssp_respawn_archive_1" || entry.source === "sssp_respawn_archive_2"
      );
      notePanel.textContent = latestArchiveEvent
        ? `Latest archive review:\n${latestArchiveEvent.eventType}\n${latestArchiveEvent.summary}`
        : "No archive review note has been recorded yet.";
    }
  };

  setText("[data-archive-connectivity]", navigator.onLine ? "Online" : "Offline");
  setText("[data-archive-summary]", "Awaiting persisted runtime hydration.");
  hydrateLivePeerRuntime(doc, applyRuntime);
}

const CHAMBER_BUTTON_CLASS = "rounded border border-signal/45 bg-signal/10 px-3 py-2 text-xs font-semibold text-signal hover:bg-signal/15";

function chamberWitnessHasResponse(witness) {
  const text = [witness.perceptionTrace, witness.reflectionTrace, witness.clarifyingQuestion]
    .some((value) => String(value || "").trim());
  const anchor = witness.cyberPeerPerceptionAnchor && witness.cyberPeerPerceptionAnchor !== "unselected";
  const posture = witness.selectedPosture && witness.selectedPosture !== "unselected";
  return Boolean(text || anchor || posture);
}

// Adds "Save to record" beside a chamber's witness preview. The chamber page itself keeps
// building the witness JSON; this reads that JSON and stores it on Adam-One's record.
function enhanceBondChamber(doc, { chamberId, chamberLabel, source }) {
  if (doc.body.dataset.aegisEnhancedBondChamber === "true") return;
  const preview = doc.getElementById("witnessPreview");
  if (!preview) return;
  doc.body.dataset.aegisEnhancedBondChamber = "true";
  injectStyles(doc);

  const row = doc.createElement("div");
  row.className = "mt-3 flex flex-wrap items-center gap-3";
  const button = doc.createElement("button");
  button.type = "button";
  button.className = CHAMBER_BUTTON_CLASS;
  button.textContent = `Save to ${BETA_PEER_DISPLAY_NAME}'s record`;
  const status = doc.createElement("p");
  status.className = "text-xs leading-5 text-slate-400";
  status.setAttribute("role", "status");
  status.textContent = "Not saved. Saving stores this response as candidate evidence pending Steward review.";
  row.append(button, status);
  preview.insertAdjacentElement("afterend", row);

  let lastSaved = "";
  bindManagedClick(button, withButtonLoading(button, "Saving…", async () => {
    let witness;
    try {
      witness = JSON.parse(preview.textContent || "");
    } catch {
      status.textContent = "The witness record could not be read. Nothing was saved.";
      return;
    }
    if (!chamberWitnessHasResponse(witness)) {
      status.textContent = "Nothing to save yet: make a selection or write a trace first.";
      return;
    }
    // Compare without the observation timestamp, which changes on every render.
    const comparable = JSON.stringify({ ...witness, timeSpan: undefined });
    if (comparable === lastSaved) {
      status.textContent = "This response is already saved. Change it to save a new record.";
      return;
    }
    try {
      const { recordBetaPeerChamberWitness } = await loadWorkshopOperatorControls();
      const result = await recordBetaPeerChamberWitness({ chamberId, chamberLabel, source, witness });
      lastSaved = comparable;
      status.textContent = `Saved as candidate evidence pending Steward review (event ${result.eventId}).`;
      showToast(doc, `${chamberLabel} response saved to ${BETA_PEER_DISPLAY_NAME}'s record.`);
    } catch (error) {
      console.error("[agent-workshop] chamber witness save failed", error);
      status.textContent = "Save failed. Nothing was written to the record.";
      showToast(doc, "Save failed. Nothing was written to the record.");
    }
  }));
}

function enhanceWhichoneChamber(doc) {
  enhanceBondChamber(doc, {
    chamberId: "whichone-emotion-nuance-training",
    chamberLabel: "WHICHONE Bond Chamber",
    source: "academy_whichone_bond_chamber",
  });
}

function enhanceSeed001Chamber(doc) {
  enhanceBondChamber(doc, {
    chamberId: "holochamber-seed-001",
    chamberLabel: "Ambiguity & Clarification",
    source: "academy_holochamber_seed_001",
  });
}

function formatWitnessTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "time not recorded" : date.toLocaleString();
}

// Bond Witness Review lists the chamber responses actually saved on Adam-One's record.
function enhanceBondWitnessReview(doc) {
  if (doc.body.dataset.aegisEnhancedBondReview === "true") return;
  const table = doc.getElementById("recordsTable");
  const gates = doc.getElementById("gateList");
  const preview = doc.getElementById("witnessPreview");
  if (!table || !gates || !preview) return;
  doc.body.dataset.aegisEnhancedBondReview = "true";
  injectStyles(doc);

  const message = (text) => {
    table.replaceChildren();
    const row = doc.createElement("tr");
    const cell = doc.createElement("td");
    cell.colSpan = 4;
    cell.className = "px-4 py-4 text-slate-400";
    cell.textContent = text;
    row.append(cell);
    table.append(row);
  };

  const showRecord = (entry) => {
    const witness = entry?.payload?.witness || {};
    const checks = [
      ["Bounded environment stated", Boolean(witness.chamberMode || witness.academyBoundary)],
      ["Response trace present", chamberWitnessHasResponse(witness)],
      ["Origin boundary stated", Boolean(witness.dataQuadWitness?.originBoundary)],
      ["Steward review still pending", witness.stewardReview === "pending"],
    ];
    gates.replaceChildren(...checks.map(([label, met]) => {
      const line = doc.createElement("p");
      line.className = "flex items-center gap-2";
      line.textContent = `${met ? "Yes" : "No"} — ${label}`;
      return line;
    }));
    preview.textContent = JSON.stringify(witness, null, 2);
  };

  gates.replaceChildren();
  preview.textContent = "";
  message("Loading saved chamber records…");

  fetchBetaPeerChamberWitnesses().then((entries) => {
    if (!entries.length) {
      message("No chamber responses have been saved yet.");
      preview.textContent = "Saved witness records will appear here.";
      return;
    }
    table.replaceChildren(...entries.map((entry, index) => {
      const witness = entry.payload?.witness || {};
      const row = doc.createElement("tr");
      row.className = "cursor-pointer bg-slate-950/50 hover:bg-slate-900";
      row.tabIndex = 0;
      const cells = [
        [entry.payload?.chamberLabel || entry.payload?.chamberId || "Chamber", "px-4 py-4 font-semibold text-white"],
        [formatWitnessTime(entry.timestamp), "px-4 py-4 text-slate-300"],
        ["Pending Steward Review", "px-4 py-4 text-amber-300"],
        [witness.authenticity || witness.academyBoundary?.authenticity || "not stated", "px-4 py-4 text-moss"],
      ];
      row.append(...cells.map(([text, className]) => {
        const cell = doc.createElement("td");
        cell.className = className;
        cell.textContent = text;
        return cell;
      }));
      const open = () => showRecord(entry);
      row.addEventListener("click", open);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
      if (index === 0) open();
      return row;
    }));
  }).catch((error) => {
    console.warn("[agent-workshop] chamber witness load failed", error);
    message("Saved chamber records could not be loaded.");
  });
}

const pageEnhancers = {
  "whichone-emotion-nuance-training": enhanceWhichoneChamber,
  "holochamber-seed-001": enhanceSeed001Chamber,
  "holochamber-evidence-review": enhanceBondWitnessReview,
  "active-agents-monitor-agentic-workshop": enhanceActiveAgentsMonitor,
  "agentic-workshop-entrance": enhanceWorkshopEntrance,
  "agentic-workshop-main-console": enhanceMainConsole,
  "aegis-project-tree-index": enhanceWorkshopMap,
  "agent-communication-protocol": enhanceCommunicationProtocol,
  "agent-mesh-visualizer": enhanceMeshVisualizer,
  "detailed-agent-view-dataquad-node": enhanceDetailedAgentView,
  "sssp-respawn-archive-1": enhanceGovernedRespawnArchive,
  "model-deployment-flow": enhanceModelDeploymentFlow,
};

function enhanceFrame(frame) {
  const slug = inferSlug(frame);
  const enhancer = pageEnhancers[slug];
  if (!enhancer) return;
  try {
    const doc = frame.contentDocument;
    if (!doc || !doc.body) return;
    enhancer(doc);
  } catch {
    // Retry on the next frame load/update.
  }
}

function initAgentWorkshopActivation() {
  if (!document.body.classList.contains("domain-agent-workshop")) return;
  const frames = Array.from(document.querySelectorAll(".stitch-frame"));
  if (!frames.length) return;
  frames.forEach((frame) => {
    frame.addEventListener("load", () => enhanceFrame(frame));
    if (frame.contentDocument?.readyState === "complete") {
      enhanceFrame(frame);
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAgentWorkshopActivation, { once: true });
} else {
  initAgentWorkshopActivation();
}
