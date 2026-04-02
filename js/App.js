import * as THREE from "./lib/three.js";
import { GUI } from "./lib/lil-gui.js";
import orgData from "../data/orgData.js";
import { CAMERA_DEFAULTS, ENABLE_RANDOM_WALK_CONTROL, MOVEMENT_MODE, VISUAL_FLOOR, MAP_SIZE } from "./config.js";
import { buildRoster, createSpawnRoster, summarizeRoster } from "./OrgDataAdapter.js";
import { installCanvasPolyfills } from "./utils/canvas.js";
import { ResourceRegistry } from "./scene/ResourcePools.js";
import { CharacterManager } from "./scene/CharacterManager.js";
import { FormationController } from "./scene/FormationController.js";
import { FormationMarkerLayer } from "./scene/FormationMarkerLayer.js";
import { AssemblyPointWall } from "./scene/AssemblyPointWall.js";

const RESET_DELAY_MS = 5000;

export class App {
    constructor() {
        this.viewport = document.getElementById("viewport");
        this.hudPanel = document.getElementById("hudPanel");
        this.panelToggleBtn = document.getElementById("panelToggleBtn");
        this.statusText = document.getElementById("statusText");
        this.pauseBtn = document.getElementById("pauseBtn");
        this.assembleBtn = document.getElementById("assembleBtn");
        this.roamBtn = document.getElementById("roamBtn");
        this.resetBtn = document.getElementById("resetBtn");
        this.statsBtn = document.getElementById("statsBtn");
        this.perfPanel = document.getElementById("perfPanel");

        this.summaryTargets = {
            total: document.getElementById("statTotal"),
            supervisor: document.getElementById("statSupervisor"),
            teamLeader: document.getElementById("statTeamLeader"),
            operator: document.getElementById("statOperator"),
            daytime: document.getElementById("statDaytime")
        };

        this.perfTargets = {
            geometries: document.getElementById("perfGeometries"),
            textures: document.getElementById("perfTextures"),
            drawCalls: document.getElementById("perfDrawCalls"),
            triangles: document.getElementById("perfTriangles"),
            vram: document.getElementById("perfVram")
        };

        this.resources = null;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sceneGui = null;
        this.floor = null;
        this.walkAreaGrid = null;
        this.characterManager = null;
        this.formationController = new FormationController();
        this.formationMarkerLayer = null;
        this.assemblyPointWall = null;
        this.formationLayout = new Map();
        this.roster = [];
        this.mode = MOVEMENT_MODE.ROAM;
        this.isPaused = false;
        this.showPerf = false;
        this.formationReady = false;
        this.lastFrameTime = 0;
        this.lastPerfSample = 0;
        this.isHudCollapsed = true;
        this.resetCooldownUntil = 0;
        this.resetCooldownActive = false;
        this.resetCooldownSeconds = 0;
        this.unavailableMemberId = null;
        this.unavailableDisplayName = "";
        this.managerAnnouncementShown = false;
        this.sceneLookControls = {
            background: "#000000",
            fogColor: "#f2f7fa",
            fogNear: 120,
            fogFar: 250,
            floorColor: "#000000",
            gridCenterColor: "#fafcff",
            gridLineColor: "#b6c2bd",
            assemblyBackColor: "#d9e4ea",
            reset: () => this.resetSceneLook()
        };

        this.cameraDistance = CAMERA_DEFAULTS.distance;
        this.cameraPhi = CAMERA_DEFAULTS.phi;
        this.cameraTheta = CAMERA_DEFAULTS.theta;
        this.cameraTarget = new THREE.Vector3(
            CAMERA_DEFAULTS.targetX,
            CAMERA_DEFAULTS.targetY,
            CAMERA_DEFAULTS.targetZ
        );
        this.activePointers = new Map();
        this.lastPinchDistance = 0;
        this.isPointerDown = false;

        this.handleResize = this.onResize.bind(this);
        this.handlePointerDown = this.onPointerDown.bind(this);
        this.handlePointerMove = this.onPointerMove.bind(this);
        this.handlePointerUp = this.onPointerUp.bind(this);
        this.handlePointerCancel = this.onPointerUp.bind(this);
        this.handleWheel = this.onWheel.bind(this);
        this.handleKeyDown = this.onKeyDown.bind(this);
        this.handleBeforeUnload = this.destroy.bind(this);
        this.animate = this.animate.bind(this);
    }

    start() {
        installCanvasPolyfills();
        this.setupScene();
        this.setupData();
        this.setupUi();
        requestAnimationFrame(this.animate);
    }

    setupScene() {
        this.resources = new ResourceRegistry();
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(this.sceneLookControls.background);
        this.scene.fog = new THREE.Fog(
            this.sceneLookControls.fogColor,
            this.sceneLookControls.fogNear,
            this.sceneLookControls.fogFar
        );

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.viewport.appendChild(this.renderer.domElement);

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.76));

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(28, 48, 14);
        this.scene.add(directionalLight);

        const fillLight = new THREE.DirectionalLight(0xd8ecff, 0.28);
        fillLight.position.set(-18, 24, -12);
        this.scene.add(fillLight);

        this.floor = new THREE.Mesh(
            new THREE.PlaneGeometry(VISUAL_FLOOR, VISUAL_FLOOR),
            new THREE.MeshLambertMaterial({ color: this.sceneLookControls.floorColor })
        );
        this.floor.rotation.x = -Math.PI / 2;
        this.scene.add(this.floor);

        this.walkAreaGrid = new THREE.GridHelper(
            MAP_SIZE * 2,
            14,
            this.sceneLookControls.gridCenterColor,
            this.sceneLookControls.gridLineColor
        );
        this.walkAreaGrid.position.y = 0.05;
        this.scene.add(this.walkAreaGrid);

        this.characterManager = new CharacterManager(this.scene, this.resources);
        this.formationMarkerLayer = new FormationMarkerLayer(this.scene, this.resources);
        this.assemblyPointWall = new AssemblyPointWall(this.scene, this.resources);
        this.setupSceneGui();

        this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
        this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);
        this.renderer.domElement.addEventListener("pointerup", this.handlePointerUp);
        this.renderer.domElement.addEventListener("pointercancel", this.handlePointerCancel);
        this.renderer.domElement.addEventListener("lostpointercapture", this.handlePointerCancel);
        this.renderer.domElement.addEventListener("wheel", this.handleWheel, { passive: false });
        window.addEventListener("resize", this.handleResize);
        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("beforeunload", this.handleBeforeUnload);
    }

    setupData() {
        const normalizedRoster = buildRoster(orgData);
        this.roster = createSpawnRoster(normalizedRoster);
        this.characterManager.load(this.roster);

        const summary = summarizeRoster(this.roster);
        this.summaryTargets.total.textContent = String(summary.total);
        this.summaryTargets.supervisor.textContent = String(summary.supervisor);
        this.summaryTargets.teamLeader.textContent = String(summary.teamLeader);
        this.summaryTargets.operator.textContent = String(summary.operator);
        this.summaryTargets.daytime.textContent = String(summary.daytime);
    }

    setupUi() {
        this.pauseBtn.addEventListener("click", () => this.togglePause());
        this.assembleBtn.addEventListener("click", () => this.setMode(MOVEMENT_MODE.ASSEMBLE));
        if (ENABLE_RANDOM_WALK_CONTROL) {
            this.roamBtn.addEventListener("click", () => this.setMode(MOVEMENT_MODE.ROAM));
        }
        this.resetBtn.addEventListener("click", () => this.resetScenario());
        this.statsBtn.addEventListener("click", () => this.togglePerfPanel());
        this.panelToggleBtn.addEventListener("click", () => this.toggleHudPanel());
        this.roamBtn.hidden = !ENABLE_RANDOM_WALK_CONTROL;
        this.roamBtn.disabled = !ENABLE_RANDOM_WALK_CONTROL;
        this.updateStatus("Characters are already roaming. Press Assemble when the team is ready to gather.");
        this.syncHudPanelState();
        this.refreshButtonState();
    }

    setupSceneGui() {
        this.sceneGui?.destroy();
        this.sceneGui = new GUI({ title: "Scene Look" });
        this.sceneGui.domElement.classList.add("scene-look-gui");

        const atmosphereFolder = this.sceneGui.addFolder("Atmosphere");
        atmosphereFolder.addColor(this.sceneLookControls, "background").name("BG color").onChange((value) => {
            this.scene.background = new THREE.Color(value);
        });
        atmosphereFolder.addColor(this.sceneLookControls, "fogColor").name("Fog color").onChange((value) => {
            this.scene.fog.color.set(value);
        });
        atmosphereFolder.add(this.sceneLookControls, "fogNear", 20, 240, 1).name("Fog near").onChange((value) => {
            this.sceneLookControls.fogNear = Math.min(value, this.sceneLookControls.fogFar - 1);
            this.scene.fog.near = this.sceneLookControls.fogNear;
        });
        atmosphereFolder.add(this.sceneLookControls, "fogFar", 60, 420, 1).name("Fog far").onChange((value) => {
            this.sceneLookControls.fogFar = Math.max(value, this.sceneLookControls.fogNear + 1);
            this.scene.fog.far = this.sceneLookControls.fogFar;
        });
        atmosphereFolder.open();

        const groundFolder = this.sceneGui.addFolder("Ground");
        groundFolder.addColor(this.sceneLookControls, "floorColor").name("Floor color").onChange((value) => {
            this.floor.material.color.set(value);
        });
        groundFolder.addColor(this.sceneLookControls, "gridCenterColor").name("Grid center").onChange((value) => {
            this.walkAreaGrid.material[0].color.set(value);
        });
        groundFolder.addColor(this.sceneLookControls, "gridLineColor").name("Grid lines").onChange((value) => {
            this.walkAreaGrid.material[1].color.set(value);
        });

        const signFolder = this.sceneGui.addFolder("Assembly Sign");
        signFolder.addColor(this.sceneLookControls, "assemblyBackColor").name("Rear board").onChange((value) => {
            this.assemblyPointWall.setBackLogoBoardColor(value);
        });

        this.sceneGui.add(this.sceneLookControls, "reset").name("Reset Look");
        this.sceneGui.close();
    }

    resetSceneLook() {
        this.sceneLookControls.background = "#e8f0f6";
        this.sceneLookControls.fogColor = "#f2f7fa";
        this.sceneLookControls.fogNear = 120;
        this.sceneLookControls.fogFar = 250;
        this.sceneLookControls.floorColor = "#d8ddd8";
        this.sceneLookControls.gridCenterColor = "#fafcff";
        this.sceneLookControls.gridLineColor = "#b6c2bd";
        this.sceneLookControls.assemblyBackColor = "#d9e4ea";
        this.scene.background = new THREE.Color(this.sceneLookControls.background);
        this.scene.fog.color.set(this.sceneLookControls.fogColor);
        this.scene.fog.near = this.sceneLookControls.fogNear;
        this.scene.fog.far = this.sceneLookControls.fogFar;
        this.floor.material.color.set(this.sceneLookControls.floorColor);
        this.walkAreaGrid.material[0].color.set(this.sceneLookControls.gridCenterColor);
        this.walkAreaGrid.material[1].color.set(this.sceneLookControls.gridLineColor);
        this.assemblyPointWall.setBackLogoBoardColor(this.sceneLookControls.assemblyBackColor);
        this.sceneGui?.controllersRecursive().forEach((controller) => controller.updateDisplay());
    }

    clearUnavailableIncident() {
        this.unavailableMemberId = null;
        this.unavailableDisplayName = "";
        this.managerAnnouncementShown = false;
        this.characterManager.clearUnavailableState();
        this.characterManager.clearManagerAnnouncement();
    }

    toggleHudPanel() {
        this.isHudCollapsed = !this.isHudCollapsed;
        this.syncHudPanelState();
    }

    syncHudPanelState() {
        this.hudPanel.classList.toggle("is-collapsed", this.isHudCollapsed);
        this.panelToggleBtn.textContent = this.isHudCollapsed ? "Show Info" : "Hide Info";
        this.panelToggleBtn.setAttribute("aria-expanded", String(!this.isHudCollapsed));
    }

    setMode(mode) {
        if (mode === MOVEMENT_MODE.ASSEMBLE && this.resetCooldownActive) {
            return;
        }

        this.mode = mode;
        this.formationReady = false;
        this.managerAnnouncementShown = false;
        this.characterManager.clearManagerAnnouncement();

        if (mode === MOVEMENT_MODE.ASSEMBLE) {
            this.formationLayout = this.formationController.buildLayout(this.roster);
            this.characterManager.clearUnavailableState();
            const unavailableIncident = this.characterManager.selectUnavailableOperator(this.formationLayout);
            this.unavailableMemberId = unavailableIncident?.id ?? null;
            this.unavailableDisplayName = unavailableIncident?.displayName ?? "";
            this.characterManager.applyFormation(this.formationLayout);
            if (this.unavailableMemberId) {
                this.characterManager.markUnavailable(this.unavailableMemberId);
            }
            this.formationMarkerLayer.show(this.formationLayout, this.roster, this.unavailableMemberId);
            this.updateStatus("Assembling exact-slot formation. Each character is moving to a marked standing position.");
        } else {
            this.clearUnavailableIncident();
            this.characterManager.setRoamMode();
            this.formationMarkerLayer.hide();
            this.updateStatus("Characters are dispersing back into free movement.");
        }

        this.refreshButtonState();
    }

    resetScenario() {
        this.isPaused = false;
        this.pauseBtn.textContent = "Pause";
        this.pauseBtn.dataset.active = "false";
        this.mode = MOVEMENT_MODE.ROAM;
        this.formationReady = false;
        this.clearUnavailableIncident();
        this.characterManager.setRoamMode(true);
        this.formationMarkerLayer.hide();
        this.resetCooldownActive = true;
        this.resetCooldownUntil = performance.now() + RESET_DELAY_MS;
        this.resetCooldownSeconds = Math.ceil(RESET_DELAY_MS / 1000);
        this.updateStatus(`Resetting scenario. Characters are dispersing before the next assembly. Assemble unlocks in ${this.resetCooldownSeconds}s.`);
        this.refreshButtonState();
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.pauseBtn.textContent = this.isPaused ? "Resume" : "Pause";
        this.pauseBtn.dataset.active = String(this.isPaused);

        if (this.isPaused) {
            this.updateStatus("Animation paused. Press Resume to continue the current movement mode.");
            return;
        }

        if (this.mode === MOVEMENT_MODE.ASSEMBLE && this.formationReady) {
            this.updateStatus(`Formation is locked in. Press ${this.getDisperseControlLabel()} when you want to restart the dispersal cycle.`);
            return;
        }

        if (this.resetCooldownActive) {
            this.updateStatus(`Reset in progress. Characters are dispersing before the next assembly. Assemble unlocks in ${this.resetCooldownSeconds}s.`);
            return;
        }

        if (this.mode === MOVEMENT_MODE.ASSEMBLE) {
            this.updateStatus("Assembling hierarchy. Characters are still walking toward their assigned slots.");
            return;
        }

        this.updateStatus("Roaming resumed.");
    }

    togglePerfPanel() {
        this.showPerf = !this.showPerf;
        this.perfPanel.classList.toggle("is-visible", this.showPerf);
        this.statsBtn.dataset.active = String(this.showPerf);
        if (this.showPerf) {
            this.refreshPerfStats();
        }
    }

    refreshButtonState() {
        this.assembleBtn.dataset.active = String(this.mode === MOVEMENT_MODE.ASSEMBLE);
        this.roamBtn.dataset.active = String(this.mode === MOVEMENT_MODE.ROAM);
        this.roamBtn.disabled = !ENABLE_RANDOM_WALK_CONTROL;
        this.assembleBtn.disabled = this.resetCooldownActive;
        this.resetBtn.disabled = this.resetCooldownActive;

        if (this.resetCooldownActive) {
            this.assembleBtn.textContent = `Assemble (${this.resetCooldownSeconds}s)`;
            this.resetBtn.textContent = `Resetting ${this.resetCooldownSeconds}s`;
            return;
        }

        this.assembleBtn.textContent = "Assemble";
        this.resetBtn.textContent = "Reset";
    }

    updateStatus(message) {
        this.statusText.textContent = message;
    }

    getDisperseControlLabel() {
        return ENABLE_RANDOM_WALK_CONTROL ? "Random Walk" : "Reset";
    }

    refreshPerfStats() {
        if (!this.renderer) {
            return;
        }

        const { memory, render } = this.renderer.info;
        const textureStats = this.resources.textures.getStats();
        const estimatedVram = (memory.geometries * 0.05 + memory.textures * 0.3).toFixed(1);

        this.perfTargets.geometries.textContent = String(memory.geometries);
        this.perfTargets.textures.textContent = `${memory.textures} / cache ${textureStats.cacheSize}`;
        this.perfTargets.drawCalls.textContent = String(render.calls);
        this.perfTargets.triangles.textContent = render.triangles.toLocaleString();
        this.perfTargets.vram.textContent = `${estimatedVram} MB`;
    }

    onResize() {
        if (!this.camera || !this.renderer) {
            return;
        }

        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateCameraRotation(deltaX, deltaY) {
        this.cameraTheta -= deltaX * 0.005;
        this.cameraPhi -= deltaY * 0.005;
        this.cameraPhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.12, this.cameraPhi));
    }

    adjustCameraDistance(delta) {
        this.cameraDistance = Math.max(16, Math.min(120, this.cameraDistance + delta));
    }

    getPointerDistance(firstPointer, secondPointer) {
        const deltaX = secondPointer.x - firstPointer.x;
        const deltaY = secondPointer.y - firstPointer.y;
        return Math.hypot(deltaX, deltaY);
    }

    onPointerDown(event) {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }

        event.preventDefault();

        try {
            this.renderer?.domElement?.setPointerCapture(event.pointerId);
        } catch {
            // Some browsers may reject pointer capture for synthetic or canceled events.
        }

        this.activePointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY
        });
        this.isPointerDown = true;

        if (this.activePointers.size >= 2) {
            const [firstPointer, secondPointer] = [...this.activePointers.values()];
            this.lastPinchDistance = this.getPointerDistance(firstPointer, secondPointer);
            return;
        }

        this.lastPinchDistance = 0;
    }

    onPointerMove(event) {
        const previousPointer = this.activePointers.get(event.pointerId);
        if (!previousPointer) {
            return;
        }

        event.preventDefault();

        const nextPointer = {
            x: event.clientX,
            y: event.clientY
        };
        this.activePointers.set(event.pointerId, nextPointer);

        if (this.activePointers.size === 1) {
            this.updateCameraRotation(nextPointer.x - previousPointer.x, nextPointer.y - previousPointer.y);
            return;
        }

        if (this.activePointers.size !== 2) {
            return;
        }

        const [firstPointer, secondPointer] = [...this.activePointers.values()];
        const pinchDistance = this.getPointerDistance(firstPointer, secondPointer);

        if (this.lastPinchDistance > 0) {
            this.adjustCameraDistance((this.lastPinchDistance - pinchDistance) * 0.08);
        }

        this.lastPinchDistance = pinchDistance;
    }

    onPointerUp(event) {
        if (typeof event.pointerId === "number") {
            this.activePointers.delete(event.pointerId);
        }

        try {
            if (typeof event.pointerId === "number" && this.renderer?.domElement?.hasPointerCapture?.(event.pointerId)) {
                this.renderer.domElement.releasePointerCapture(event.pointerId);
            }
        } catch {
            // Ignore browsers that have already released capture.
        }

        this.isPointerDown = this.activePointers.size > 0;
        if (this.activePointers.size < 2) {
            this.lastPinchDistance = 0;
        }
    }

    onWheel(event) {
        event.preventDefault();
        this.adjustCameraDistance(event.deltaY * 0.05);
    }

    onKeyDown(event) {
        const key = event.key.toLowerCase();

        if (key === "p") {
            this.togglePause();
            return;
        }

        if (key === "a") {
            this.setMode(MOVEMENT_MODE.ASSEMBLE);
            return;
        }

        if (key === "r") {
            if (!ENABLE_RANDOM_WALK_CONTROL) {
                return;
            }
            this.setMode(MOVEMENT_MODE.ROAM);
            return;
        }

        if (key === "s") {
            this.togglePerfPanel();
        }
    }

    updateCamera() {
        this.camera.position.x = this.cameraTarget.x + this.cameraDistance * Math.sin(this.cameraPhi) * Math.cos(this.cameraTheta);
        this.camera.position.y = this.cameraTarget.y + this.cameraDistance * Math.cos(this.cameraPhi);
        this.camera.position.z = this.cameraTarget.z + this.cameraDistance * Math.sin(this.cameraPhi) * Math.sin(this.cameraTheta);
        this.camera.lookAt(this.cameraTarget);
    }

    updateResetCooldown(now) {
        if (!this.resetCooldownActive) {
            return;
        }

        if (this.isPaused) {
            return;
        }

        const remainingMs = Math.max(0, this.resetCooldownUntil - now);
        const remainingSeconds = Math.ceil(remainingMs / 1000);

        if (remainingSeconds !== this.resetCooldownSeconds) {
            this.resetCooldownSeconds = remainingSeconds;
            this.refreshButtonState();
        }

        if (remainingMs > 0) {
            return;
        }

        this.resetCooldownActive = false;
        this.resetCooldownSeconds = 0;
        this.refreshButtonState();

        if (!this.isPaused && this.mode === MOVEMENT_MODE.ROAM) {
            this.updateStatus("Reset complete. Characters have dispersed and Assemble is ready again.");
        }
    }

    showManagerUnavailableAnnouncement() {
        if (!this.unavailableDisplayName || this.managerAnnouncementShown) {
            return;
        }

        this.characterManager.setManagerAnnouncement(`${this.unavailableDisplayName} unavailable`);
        this.managerAnnouncementShown = true;
    }

    animate(now) {
        const seconds = now * 0.001;
        const deltaTime = Math.min(0.1, seconds - this.lastFrameTime || 0);
        this.lastFrameTime = seconds;

        this.updateResetCooldown(now);

        if (!this.isPaused) {
            this.characterManager.updateAll(deltaTime);
        }

        if (this.mode === MOVEMENT_MODE.ASSEMBLE && !this.formationReady && this.characterManager.areAllInFormation()) {
            this.formationReady = true;
            this.showManagerUnavailableAnnouncement();
            if (!this.isPaused) {
                const unavailableMessage = this.unavailableDisplayName
                    ? `${this.unavailableDisplayName} unavailable. `
                    : "";
                this.updateStatus(`Formation ready. ${unavailableMessage}Press ${this.getDisperseControlLabel()} to restart the dispersal cycle.`);
            }
        }

        this.updateCamera();

        if (this.showPerf && now - this.lastPerfSample > 500) {
            this.refreshPerfStats();
            this.lastPerfSample = now;
        }

        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.animate);
    }

    destroy() {
        window.removeEventListener("resize", this.handleResize);
        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("beforeunload", this.handleBeforeUnload);
        this.activePointers.clear();

        if (this.renderer?.domElement) {
            this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
            this.renderer.domElement.removeEventListener("pointermove", this.handlePointerMove);
            this.renderer.domElement.removeEventListener("pointerup", this.handlePointerUp);
            this.renderer.domElement.removeEventListener("pointercancel", this.handlePointerCancel);
            this.renderer.domElement.removeEventListener("lostpointercapture", this.handlePointerCancel);
            this.renderer.domElement.removeEventListener("wheel", this.handleWheel);
        }

        this.characterManager?.disposeAll();
        this.formationMarkerLayer?.dispose();
        this.assemblyPointWall?.dispose();
        this.sceneGui?.destroy();
        this.resources?.disposeAll();
        this.renderer?.dispose();
    }
}