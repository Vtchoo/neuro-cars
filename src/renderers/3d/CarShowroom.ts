import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Car3d from "./Car3d";
import { carModelNames } from "./carModels";
import {
  supercarPreset,
  f1CarPreset,
  unoWithLadderPreset,
} from "../../cars/carPresets";

/** A standalone preview using exactly the same Car3d objects as the race. */
export class CarShowroom {
  readonly scene = new THREE.Scene();
  readonly cars = [supercarPreset, f1CarPreset, unoWithLadderPreset].map(
    (preset) => new Car3d(0, 0, 0, 0, preset),
  );
  readonly renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);
  readonly controls: OrbitControls;
  private stage: HTMLElement;
  private labels: HTMLElement[] = [];
  private stats: HTMLElement;
  private colors = ["#e74739", "#428bdb", "#e5d4a4"];
  private selected = "all";
  private steering = 0;
  private wheelSpeed = 0;
  private wireframe = false;

  constructor() {
    document.body.innerHTML = `<aside>
            <a href="../">← Back to race</a><h1>Car showroom</h1>
            <p>Inspect the models used in the 3D simulation.</p>
            <label>Car preset<select id="preset"><option value="all">All presets</option>${this.cars.map((car) => `<option value="${car.modelKey}">${carModelNames[car.modelKey]}</option>`).join("")}</select></label>
            <fieldset><legend>Camera</legend><div class="views">${["Isometric", "Front", "Rear", "Side", "Top"].map((view) => `<button data-view="${view}">${view}</button>`).join("")}</div></fieldset>
            <label>Steering <output id="steering-value">0°</output><input id="steering" type="range" min="-36" max="36" value="0"></label>
            <label>Wheel speed<input id="speed" type="range" min="0" max="50" value="0"></label>
            <label class="toggle">Paint<input id="paint" type="color" value="#e74739"></label>
            <label class="toggle">Wireframe<input id="wireframe" type="checkbox"></label>
            <label class="toggle">Auto orbit<input id="orbit" type="checkbox"></label>
            <button id="screenshot">Save PNG</button><p class="hint">Drag to orbit · Scroll to zoom · Right drag to pan</p>
            <pre id="stats"></pre>
        </aside><main id="showroom"><div class="badge">PRESET MODEL PREVIEW</div></main>`;
    this.stage = document.querySelector("#showroom")!;
    this.stats = document.querySelector("#stats")!;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x161e29);
    this.renderer.domElement.id = "car-preview";
    this.stage.append(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotateSpeed = 1;
    this.scene.add(new THREE.HemisphereLight(0xdceaff, 0x5b5861, 2.5));
    const key = new THREE.DirectionalLight(0xffeddb, 3.5);
    key.position.set(60, 150, 90);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, {
      left: -160,
      right: 160,
      top: 100,
      bottom: -100,
      near: 1,
      far: 400,
    });
    key.shadow.normalBias = 0.2;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x84b6ff, 2);
    rim.position.set(-80, 60, -90);
    this.scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({ color: 0x293240, roughness: 0.85 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(500, 50, 0x526174, 0x354353);
    grid.position.y = -0.05;
    this.scene.add(grid);
    for (const car of this.cars) {
      const label = document.createElement("div");
      label.className = "car-label";
      label.textContent = carModelNames[car.modelKey];
      this.labels.push(label);
      this.stage.append(label);
    }
    this.input<HTMLSelectElement>("preset").onchange = (event) => {
      this.selected = (event.target as HTMLSelectElement).value;
      this.layout();
      this.view("Isometric");
      const index = this.cars.findIndex(
        (car) => car.modelKey === this.selected,
      );
      this.input<HTMLInputElement>("paint").value =
        this.colors[Math.max(0, index)];
    };
    document
      .querySelectorAll<HTMLButtonElement>("[data-view]")
      .forEach(
        (button) => (button.onclick = () => this.view(button.dataset.view!)),
      );
    this.input<HTMLInputElement>("steering").oninput = (event) => {
      this.steering =
        (Number((event.target as HTMLInputElement).value) * Math.PI) / 180;
      document.querySelector("#steering-value")!.textContent =
        `${Math.round((this.steering * 180) / Math.PI)}°`;
    };
    this.input<HTMLInputElement>("speed").oninput = (event) =>
      (this.wheelSpeed = Number((event.target as HTMLInputElement).value));
    this.input<HTMLInputElement>("paint").oninput = (event) => {
      const color = (event.target as HTMLInputElement).value;
      this.cars.forEach((car, i) => {
        if (this.selected === "all" || this.selected === car.modelKey)
          this.colors[i] = color;
      });
    };
    this.input<HTMLInputElement>("wireframe").onchange = (event) => {
      this.wireframe = (event.target as HTMLInputElement).checked;
      this.scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh &&
          this.cars.some((car) => car.object.getObjectById(object.id))
        ) {
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            if (material instanceof THREE.MeshStandardMaterial)
              material.wireframe = this.wireframe;
          }
        }
      });
    };
    this.input<HTMLInputElement>("orbit").onchange = (event) =>
      (this.controls.autoRotate = (event.target as HTMLInputElement).checked);
    this.input<HTMLButtonElement>("screenshot").onclick = () => this.savePNG();
    new ResizeObserver(() => this.resize()).observe(this.stage);
    this.layout();
    this.resize();
    this.view("Isometric");
    let previous = performance.now();
    this.renderer.setAnimationLoop((now) => {
      const delta = Math.min((now - previous) / 1000, 0.1);
      previous = now;
      this.cars.forEach((car, i) => {
        car.steeringAngle = THREE.MathUtils.clamp(
          this.steering,
          -car.maxSteeringAngle,
          car.maxSteeringAngle,
        );
        car.render(this.scene, this.colors[i]);
        car.rollWheels(this.wheelSpeed * delta);
        car.object.visible =
          this.selected === "all" || this.selected === car.modelKey;
      });
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.updateLabels();
      const visible = this.cars.filter((car) => car.object.visible);
      this.stats.textContent =
        visible
          .map(
            (car) =>
              `${carModelNames[car.modelKey]} · ${car.wheelbase.toFixed(2)} m wheelbase`,
          )
          .join("\n") +
        `\n\n${this.renderer.info.render.calls} draw calls\n${this.renderer.info.render.triangles.toLocaleString()} triangles`;
    });
  }

  private input<T extends HTMLElement>(id: string) {
    return document.getElementById(id) as T;
  }

  private layout() {
    this.cars.forEach((car, i) => {
      car.pos.x = this.selected === "all" ? (i - 1) * 76 : 0;
      car.render(this.scene, this.colors[i]);
      car.object.visible =
        this.selected === "all" || this.selected === car.modelKey;
    });
  }

  private resize() {
    this.renderer.setSize(this.stage.clientWidth, this.stage.clientHeight);
    this.camera.aspect = this.stage.clientWidth / this.stage.clientHeight;
    this.camera.updateProjectionMatrix();
  }

  view(name: string) {
    const bounds = new THREE.Box3();
    this.cars
      .filter((car) => car.object.visible)
      .forEach((car) => bounds.expandByObject(car.object));
    const center = bounds.getCenter(new THREE.Vector3()),
      size = bounds.getSize(new THREE.Vector3());
    const radius = size.length() / 2;
    const fov = (this.camera.fov * Math.PI) / 180;
    const distance =
      (radius /
        Math.sin(
          Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect)) /
            2,
        )) *
      1.15;
    const direction = (
      {
        Front: [1, 0.12, 0],
        Rear: [-1, 0.12, 0],
        Side: [0, 0.15, 1],
        Top: [0, 1, 0],
        Isometric: [1, 0.8, 1.25],
      } as Record<string, number[]>
    )[name];
    this.camera.up.set(0, name === "Top" ? 0 : 1, name === "Top" ? -1 : 0);
    this.camera.position
      .copy(center)
      .add(
        new THREE.Vector3(...direction).normalize().multiplyScalar(distance),
      );
    this.controls.target.copy(center);
    this.camera.lookAt(center);
    this.controls.update();
  }

  private updateLabels() {
    const point = new THREE.Vector3();
    this.cars.forEach((car, i) => {
      const label = this.labels[i];
      label.hidden = !car.object.visible;
      point.set(car.pos.x, 0, car.pos.y + 20).project(this.camera);
      label.style.left = `${(point.x * 0.5 + 0.5) * this.stage.clientWidth}px`;
      label.style.top = `${(-point.y * 0.5 + 0.5) * this.stage.clientHeight + 16}px`;
    });
  }

  private savePNG() {
    this.renderer.render(this.scene, this.camera);
    this.renderer.domElement.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `cars-${this.selected}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
}
