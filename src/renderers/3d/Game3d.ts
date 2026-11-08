import type { Explosion } from "../../core/Effects";
import * as THREE from "three";
import { Helicopter3d } from "./Helicopter3d";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Game from "../../core/Game";
import type { CarPreset } from "../../cars/carPresets";
import { Vector } from "../../Vector";
import Car3d from "./Car3d";
import Track3d, { disposeGroup } from "./Track3d";
import { CanvasSurface } from "../../ui/CanvasSurface";
import { GameHUD } from "../../ui/GameHUD";
import { tooltip } from "../../utils/tooltip";
import { buildMainMenu } from "../../ui/mainMenu";
import {
  createTrackBuilder,
  editorPressed,
  editorDragged,
  editorReleased,
  editorClick,
} from "../../editor/trackEditor";
import { chooseFile, downloadState, loadGameFile } from "../../ui/files";
import grassImage from "../../../images/grass.jpg";

/** Three.js application adapter. Simulation ticks and saves are inherited from Game. */
export default class Game3d extends Game<Car3d, Track3d> {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(
    45,
    innerWidth / innerHeight,
    5,
    200000,
  );
  readonly renderer = new THREE.WebGLRenderer({
    antialias: true,
    logarithmicDepthBuffer: true,
  });
  readonly controls: OrbitControls;
  readonly overlay = document.createElement("canvas");
  private readonly surface: CanvasSurface;
  private readonly hud: GameHUD;
  private readonly editorGroup = new THREE.Group();
  private readonly keys = new Set<string>();
  private readonly renderedCars = new Set<Car3d>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly mouse = new THREE.Vector2(-2, -2);
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly orbitRay = new THREE.Ray();
  private readonly orbitHit = new THREE.Vector3();
  private renderedTrack: Track3d | null = null;
  private editorSource: unknown = null;
  private editorZoom = 0;
  private pointerStart: { x: number; y: number; editing: boolean; blockCamera: boolean; moved: boolean } | null =
    null;
  private lastPhase = this.phase;
  private lastTime = 0;
  private reference: THREE.Mesh | null = null;
  private referenceOpacity = 0.5;
  private grassTexture: THREE.Texture;
  private explosions = new Map<Explosion, THREE.Points>();
  private helicopters: Helicopter3d[] = [];
  override get helicopterCameraCount() {
    return this.effects.helicopters.length;
  }
  get activeCamera(): THREE.PerspectiveCamera {
    if (
      this.showHelicopters &&
      (this.phase === "running" || this.phase === "breeding") &&
      this.helicopterCamera !== null
    )
      return this.helicopters[this.helicopterCamera]?.camera ?? this.camera;
    return this.camera;
  }
  private abort = new AbortController();
  gameMenu: { remove(): void } | null = null;

  override createCar(
    x: number,
    y: number,
    direction: number,
    generation?: number,
    preset?: CarPreset,
  ) {
    return new Car3d(x, y, direction, generation, preset, this.random);
  }
  override createTrack(data?: any): Track3d {
    return data ? (Track3d.fromData(data) as Track3d) : new Track3d();
  }

  constructor() {
    super();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = "scene-3d";
    document.body.append(this.renderer.domElement);
    Object.assign(this.overlay.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
    });
    document.body.append(this.overlay);
    this.surface = new CanvasSurface(this.overlay);
    this.hud = new GameHUD(this, this.surface);
    this.scene.background = new THREE.Color(0x9abbd2);
    this.scene.fog = new THREE.Fog(0x9abbd2, 12000, 50000);
    this.scene.add(new THREE.HemisphereLight(0xe4f3ff, 0x39482b, 2.5));
    const sun = new THREE.DirectionalLight(0xfff4dc, 3);
    sun.position.set(800, 1600, 400);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -1600,
      right: 1600,
      top: 1600,
      bottom: -1600,
      far: 5000,
    });
    this.scene.add(sun);
    this.grassTexture = new THREE.TextureLoader().load(grassImage);
    this.grassTexture.wrapS = this.grassTexture.wrapT = THREE.RepeatWrapping;
    this.grassTexture.repeat.set(800, 800);
    this.grassTexture.colorSpace = THREE.SRGBColorSpace;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200000, 200000),
      new THREE.MeshStandardMaterial({ map: this.grassTexture, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.scene.add(this.editorGroup);
    this.camera.position.set(0, 900, 700);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 100;
    this.controls.maxDistance = 80000;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.06;
    this.controls.addEventListener("change", this.anchorFreeCamera);
    this.installInput();
    this.events.addEventListener("gameLoaded", () => this.fitCamera(), {
      signal: this.abort.signal,
    });
    this.events.addEventListener(
      "phaseChanged",
      () => {
        if (this.phase === "running" && this.lastPhase === "setup")
          this.fitCamera();
        this.lastPhase = this.phase;
        if (this.phase === "setStart") {
          this.gameMenu?.remove();
          this.gameMenu = null;
          this.controls.target.set(0, 0, 0);
          this.camera.position.set(0, 1200, 0.01);
        }
      },
      { signal: this.abort.signal },
    );
    this.resize();
    buildMainMenu(this);
    this.renderer.setAnimationLoop(this.frame);
    window.addEventListener("pagehide", () => this.dispose(), { once: true });
  }

  private resize = () => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.overlay.width = innerWidth;
    this.overlay.height = innerHeight;
  };

  private anchorFreeCamera = () => {
    if (
      this.activeCamera !== this.camera ||
      this.playerDrive ||
      this.getFollowedCar()
    )
      return;
    this.orbitRay.origin.copy(this.camera.position);
    this.camera.getWorldDirection(this.orbitRay.direction);
    // Reanchor along the existing sightline, preserving position and orientation.
    // A horizontal/upward view has no usable intersection with the track plane.
    if (
      this.orbitRay.direction.y < -1e-6 &&
      this.orbitRay.intersectPlane(this.groundPlane, this.orbitHit)
    ) {
      this.controls.target.copy(this.orbitHit);
    }
  };

  private fitCamera() {
    this.track.render(this.scene);
    const box = new THREE.Box3().setFromObject(this.track.object);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3());
    center.y = 0;
    const distance = Math.max(
      500,
      Math.max(size.x / this.camera.aspect, size.z) * 1.4,
    );
    this.controls.target.copy(center);
    this.camera.position
      .copy(center)
      .add(new THREE.Vector3(0, distance, distance * 0.7));
    this.controls.update();
  }

  private worldPoint(event: PointerEvent) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = this.raycaster.ray.intersectPlane(
      this.groundPlane,
      new THREE.Vector3(),
    );
    return hit ? new Vector(hit.x, hit.z) : null;
  }

  private get zoom() {
    return (
      innerHeight /
      (2 *
        Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) *
        this.camera.position.distanceTo(this.controls.target))
    );
  }

  private installInput() {
    const canvas = this.renderer.domElement,
      signal = this.abort.signal;
    window.addEventListener("resize", this.resize, { signal });
    window.addEventListener("blur", () => this.keys.clear(), { signal });
    window.addEventListener(
      "keydown",
      (event) => {
        if ((event.target as HTMLElement).matches("input,textarea,select"))
          return;
        this.keys.add(event.code);
        if (event.repeat || event.ctrlKey || event.metaKey) return;
        if (event.code === "KeyS" && !this.playerDrive) this.saveGame();
        if (event.code === "KeyL") this.loadGame();
        if (
          this.reference &&
          (event.key === "+" ||
            event.key === "=" ||
            event.key === "-" ||
            event.key === "_")
        ) {
          this.referenceOpacity = Math.max(
            0.1,
            Math.min(
              1,
              this.referenceOpacity +
                (event.key === "+" || event.key === "=" ? 0.1 : -0.1),
            ),
          );
          (this.reference.material as THREE.MeshBasicMaterial).opacity =
            this.referenceOpacity;
        }
      },
      { signal },
    );
    window.addEventListener("keyup", (event) => this.keys.delete(event.code), {
      signal,
    });
    canvas.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button !== 0) return;
        const editing =
          this.phase !== "running" && this.phase !== "menu" && !event.ctrlKey;
        let blockCamera = editing;
        if (editing) {
          const point = this.worldPoint(event);
          if (this.phase === "buildTrack")
            blockCamera = point ? editorPressed(this.track, point, this.zoom) : false;
        }
        this.pointerStart = { x: event.clientX, y: event.clientY, editing, blockCamera, moved: false };
        this.controls.enabled = this.activeCamera === this.camera && !blockCamera;
        // Empty editor space pans directly; Ctrl + ROTATE also maps to pan.
        this.controls.mouseButtons.LEFT = editing && !blockCamera ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
      },
      // Disable OrbitControls before its pointerdown handler can begin a pan.
      { signal, capture: true },
    );
    canvas.addEventListener(
      "pointermove",
      (event) => {
        const bounds = canvas.getBoundingClientRect();
        this.mouse.set(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
        );
        if (this.pointerStart && Math.hypot(event.clientX-this.pointerStart.x,event.clientY-this.pointerStart.y)>3)
          this.pointerStart.moved = true;
        if (!this.pointerStart?.editing || !this.pointerStart.blockCamera || this.phase !== "buildTrack") return;
        const point = this.worldPoint(event);
        if (point) editorDragged(this, point, this.zoom);
      },
      { signal },
    );
    window.addEventListener(
      "pointerup",
      (event) => {
        const start = this.pointerStart;
        this.pointerStart = null;
        this.controls.enabled = this.activeCamera === this.camera;
        if (!start?.editing) return;
        const point = this.worldPoint(event);
        editorReleased();
        if (!point) return;
        if (this.phase === "buildTrack") {
          if (!start.moved || start.blockCamera) editorClick(this, point, this.zoom);
        }
        else if (
          Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5
        ) {
          if (this.phase === "setStart") {
            this.placeStart(point);
          } else if (this.phase === "rotateStart") {
            this.orientStart(point);
            const end = new Vector(
              this.start.x + 120 * Math.cos(this.direction),
              this.start.y + 120 * Math.sin(this.direction),
            );
            createTrackBuilder(end, this.direction, 120, this, this.track);
          }
        }
      },
      { signal },
    );
    window.addEventListener("pointercancel", () => {
      this.pointerStart = null;
      editorReleased();
      this.controls.enabled = this.activeCamera === this.camera;
    }, { signal });
  }

  saveGame() {
    downloadState(this.exportState());
  }
  loadGame(onLoad?: () => void) {
    loadGameFile(this, onLoad);
  }
  loadReferenceImage(onLoad?: () => void) {
    chooseFile("image/*", (file) => {
      const input = prompt(
        "Enter the distance from top to bottom of the image in meters:",
      );
      if (input === null) return;
      const distance = Number(input);
      if (!Number.isFinite(distance) || distance <= 0) {
        alert("Please enter a valid positive number for distance");
        return;
      }
      const url = URL.createObjectURL(file);
      new THREE.TextureLoader().load(
        url,
        (texture) => {
          URL.revokeObjectURL(url);
          this.removeReference();
          texture.colorSpace = THREE.SRGBColorSpace;
          const image = texture.image as HTMLImageElement,
            height = distance * 10;
          this.reference = new THREE.Mesh(
            new THREE.PlaneGeometry(
              (height * image.width) / image.height,
              height,
            ),
            new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              opacity: this.referenceOpacity,
              depthWrite: false,
            }),
          );
          this.reference.rotation.x = -Math.PI / 2;
          this.reference.position.y = -1;
          this.scene.add(this.reference);
          this.setPhase("setStart");
          onLoad?.();
        },
        undefined,
        () => {
          URL.revokeObjectURL(url);
          alert("Failed to load image. Please try a different file.");
        },
      );
    });
  }
  private removeReference() {
    if (!this.reference) return;
    this.reference.removeFromParent();
    this.reference.geometry.dispose();
    const material = this.reference.material as THREE.MeshBasicMaterial;
    material.map?.dispose();
    material.dispose();
    this.reference = null;
  }

  private drawEditor() {
    const editing = this.phase === "buildTrack";
    this.editorGroup.visible = editing;
    if (!editing) return;
    if (
      this.editorSource === this.track.analyticPieces &&
      Math.abs(this.editorZoom - this.zoom) < 0.002
    )
      return;
    this.editorSource = this.track.analyticPieces;
    this.editorZoom = this.zoom;
    disposeGroup(this.editorGroup);
    const radius = 6 / this.zoom;
    for (const piece of this.track.pieces) {
      if (piece.type !== "Spline") continue;
      const vertices = [
        piece.start,
        piece.control1,
        piece.end,
        piece.control2,
      ].flatMap((p) => [p.x, 3, p.y]);
      this.editorGroup.add(
        new THREE.LineSegments(
          new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.Float32BufferAttribute(vertices, 3),
          ),
          new THREE.LineBasicMaterial({ color: 0x55bfff }),
        ),
      );
      for (const [index, point] of [
        piece.start,
        piece.end,
        piece.control1,
        piece.control2,
      ].entries()) {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 10, 8),
          new THREE.MeshBasicMaterial({
            color: index < 2 ? 0xffffff : 0x55bfff,
          }),
        );
        marker.position.set(point.x, 4, point.y);
        this.editorGroup.add(marker);
      }
    }
    const first = this.track.pieces[0];
    if (first) {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(13 / this.zoom, 12, 8),
        new THREE.MeshBasicMaterial({
          color: this.track.closed ? 0xf8b84e : 0x60e5a0,
        }),
      );
      marker.position.set(
        first.start.x,
        4,
        first.start.y - first.width / 2 - 24 / this.zoom,
      );
      this.editorGroup.add(marker);
    }
  }

  private updateEffects() {
    const active = new Set(this.effects.explosions);
    for (const [effect, object] of this.explosions)
      if (!active.has(effect)) {
        object.removeFromParent();
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
        this.explosions.delete(effect);
      }
    for (const effect of this.effects.explosions) {
      let object = this.explosions.get(effect);
      if (!object) {
        const geometry = new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.Float32BufferAttribute(
            new Float32Array(effect.particles.length * 3),
            3,
          ),
        );
        object = new THREE.Points(
          geometry,
          new THREE.PointsMaterial({
            color: 0xffa832,
            size: 12,
            transparent: true,
            depthWrite: false,
          }),
        );
        object.position.set(effect.x, 8, effect.y);
        this.scene.add(object);
        this.explosions.set(effect, object);
      }
      object.visible = this.showExplosions;
      const progress = effect.age / this.effects.duration;
      const position = object.geometry.getAttribute(
        "position",
      ) as THREE.BufferAttribute;
      effect.particles.forEach((particle, i) => {
        const distance = particle.speed * progress * this.effects.maxRadius;
        position.setXYZ(
          i,
          Math.cos(particle.angle) * distance,
          Math.sin(progress * Math.PI) * 12,
          Math.sin(particle.angle) * distance,
        );
      });
      position.needsUpdate = true;
      (object.material as THREE.PointsMaterial).opacity = 1 - progress;
    }
    while (this.helicopters.length < this.effects.helicopters.length) {
      const helicopter = new Helicopter3d(this.helicopters.length);
      this.scene.add(helicopter.object);
      this.helicopters.push(helicopter);
    }
    this.helicopters.forEach((heli, i) => {
      heli.object.visible =
        this.showHelicopters &&
        this.population.length > 0 &&
        (this.phase === "running" || this.phase === "breeding");
      if (heli.object.visible)
        heli.update(this.effects.helicopters[i], innerWidth / innerHeight);
    });
  }

  private frame = (time: number) => {
    const elapsed = this.lastTime
      ? Math.min((time - this.lastTime) / 1000, 0.25)
      : 0;
    this.lastTime = time;
    if (this.playerDrive && this.player)
      this.player.lastInputs = [
        this.keys.has("KeyW") ? 1 : this.keys.has("KeyS") ? -1 : 0,
        this.keys.has("KeyA") ? -1 : this.keys.has("KeyD") ? 1 : 0,
      ];
    this.advance(elapsed);
    if (this.renderedTrack !== this.track) {
      this.renderedTrack?.dispose();
      this.renderedTrack = this.track;
    }
    this.track.render(this.scene);
    const racers =
      this.phase === "running" || this.phase === "breeding"
        ? this.playerDrive && this.player
          ? [...this.population, this.player]
          : this.population
        : [];
    this.raycaster.setFromCamera(this.mouse, this.activeCamera);
    const mouseWorld = this.raycaster.ray.intersectPlane(
      this.groundPlane,
      new THREE.Vector3(),
    );
    const hovered =
      this.phase === "running" && mouseWorld
        ? racers.find(
            (car) =>
              Math.abs(car.pos.x - mouseWorld.x) < 10 &&
              Math.abs(car.pos.y - mouseWorld.z) < 10,
          )
        : undefined;
    const current = new Set(racers);
    for (const car of this.renderedCars)
      if (!current.has(car)) {
        car.dispose();
        this.renderedCars.delete(car);
      }
    const followed = this.playerDrive ? this.player : this.getFollowedCar();
    const activeBest = this.population
      .filter((car) => car.speed > 0.001)
      .sort((a, b) => b.neuralNet.fitness - a.neuralNet.fitness)[0];
    const best = this.population.reduce<Car3d | null>(
      (a, b) => (!a || b.neuralNet.fitness > a.neuralNet.fitness ? b : a),
      null,
    );
    for (const car of racers) {
      const tint = this.showClustering ? this.getClusterTint(car) : undefined;
      const inputs =
        this.showInputs === "all" ||
        (this.showInputs === "best" && car === best) ||
        (this.showInputs === "bestActive" && car === activeBest) ||
        (this.showInputs === "none" && car === hovered);
      car.render(this.scene, tint, inputs);
      this.renderedCars.add(car);
    }
    if (followed && this.phase === "running") {
      const delta = new THREE.Vector3(followed.pos.x, 0, followed.pos.y).sub(
        this.controls.target,
      );
      this.controls.target.add(delta);
      this.camera.position.add(delta);
    }
    this.controls.enableRotate =
      this.phase === "running" || this.phase === "menu";
    this.controls.enabled = this.activeCamera === this.camera && !this.pointerStart?.blockCamera;
    if (this.controls.enabled) this.controls.update();
    this.drawEditor();
    this.updateEffects();
    this.renderer.render(this.scene, this.activeCamera);
    this.surface.clear();
    this.hud.draw();
    if (hovered) {
      const screen = new THREE.Vector3(
        hovered.pos.x,
        10,
        hovered.pos.y,
      ).project(this.activeCamera);
      tooltip(
        this.surface,
        [
          hovered === this.player
            ? "Player Car"
            : hovered.driverName || "Unknown Driver",
          `Fitness: ${hovered.neuralNet.fitness.toFixed(2)}`,
          `Gen: ${hovered.generation} (age: ${this.generation - hovered.generation})`,
          `Speed: ${(hovered.speed * 3.6).toFixed(2)} km/h`,
        ],
        ((screen.x + 1) * innerWidth) / 2 + 20,
        ((1 - screen.y) * innerHeight) / 2 + 15,
      );
    }
    if (this.phase === "setStart" || this.phase === "rotateStart") {
      this.surface.fill("white");
      this.surface.textAlign("center", "top");
      this.surface.textSize(16);
      this.surface.text(
        this.phase === "setStart"
          ? "Click the ground to place the start"
          : "Click the ground to set the starting direction",
        innerWidth / 2,
        24,
      );
    }
  };

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.abort.abort();
    this.controls.dispose();
    this.gameMenu?.remove();
    for (const car of this.renderedCars) car.dispose();
    this.track.dispose();
    this.removeReference();
    this.grassTexture.dispose();
    for (const object of this.explosions.values()) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
    for (const heli of this.helicopters) heli.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.overlay.remove();
  }
}
