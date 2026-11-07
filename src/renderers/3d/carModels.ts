import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CarModelKey } from "../../cars/carPresets";

export const carModelNames: Record<CarModelKey, string> = {
  supercar: "Supercar",
  formula1: "Formula 1",
  uno: "Uno + ladder",
};

export type CarModel = {
  root: THREE.Group;
  frontWheels: THREE.Group[];
  wheelRotors: THREE.Group[];
  wheelRadius: number;
};

// Shared immutable geometry/materials keep a population of cars inexpensive.
const geometries = new Map<string, THREE.BufferGeometry>();
const geometry = (key: string, make: () => THREE.BufferGeometry) => {
  let result = geometries.get(key);
  if (!result) {
    result = make();
    geometries.set(key, result);
  }
  return result;
};
const cube = geometry("cube", () => new THREE.BoxGeometry(1, 1, 1));
const rubber = new THREE.MeshStandardMaterial({
  color: 0x14161b,
  roughness: 0.95,
});
const carbon = new THREE.MeshStandardMaterial({
  color: 0x23272e,
  roughness: 0.7,
  metalness: 0.15,
});
const glass = new THREE.MeshStandardMaterial({
  color: 0x294352,
  roughness: 0.16,
  metalness: 0.45,
});
const alloy = new THREE.MeshStandardMaterial({
  color: 0xc6cdd5,
  roughness: 0.3,
  metalness: 0.8,
});
const rim = new THREE.MeshStandardMaterial({
  color: 0x77818e,
  roughness: 0.32,
  metalness: 0.75,
});
const white = new THREE.MeshStandardMaterial({
  color: 0xe6e8eb,
  roughness: 0.4,
});
const headlight = new THREE.MeshStandardMaterial({
  color: 0xfff4d1,
  emissive: 0xffe6ad,
  emissiveIntensity: 0.8,
});
const tailLight = new THREE.MeshStandardMaterial({
  color: 0xd42732,
  emissive: 0xdd1424,
  emissiveIntensity: 0.6,
});

function box(
  parent: THREE.Group,
  name: string,
  size: number[],
  position: number[],
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(cube, material);
  mesh.name = name;
  mesh.scale.set(size[0], size[1], size[2]);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function prism(
  parent: THREE.Group,
  name: string,
  profile: number[][],
  width: number,
  material: THREE.Material,
  arches?: { axles: number[]; radius: number; y: number; bottom: number },
) {
  const key = JSON.stringify([name, profile, width, arches]);
  const shape = geometry(key, () => {
    const outline = new THREE.Shape();
    outline.moveTo(profile[0][0], profile[0][1]);
    for (const [x, y] of profile.slice(1)) outline.lineTo(x, y);
    if (arches) {
      const angle = Math.asin((arches.bottom - arches.y) / arches.radius);
      for (const axle of [...arches.axles].sort((a, b) => b - a)) {
        outline.lineTo(axle + Math.cos(angle) * arches.radius, arches.bottom);
        outline.absarc(
          axle,
          arches.y,
          arches.radius,
          angle,
          Math.PI - angle,
          false,
        );
      }
    }
    outline.closePath();
    return new THREE.ExtrudeGeometry(outline, {
      depth: width,
      bevelEnabled: false,
      curveSegments: 10,
    }).translate(0, 0, -width / 2);
  });
  const mesh = new THREE.Mesh(shape, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: THREE.Group,
  name: string,
  radius: number,
  width: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
) {
  const geom = geometry(
    `cylinder:${radius}:${width}`,
    () => new THREE.CylinderGeometry(radius, radius, width, 16),
  );
  const mesh = new THREE.Mesh(geom, material);
  mesh.name = name;
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function wheels(
  model: CarModel,
  halfAxle: number,
  track: number,
  radius: number,
  width: number,
  openWheel = false,
) {
  for (const x of [-halfAxle, halfAxle])
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.name = x > 0 ? "front-wheel-pivot" : "rear-wheel-pivot";
      pivot.position.set(x, radius, (side * track) / 2);
      model.root.add(pivot);
      const rotor = new THREE.Group();
      rotor.name = "wheel-rotor";
      pivot.add(rotor);
      cylinder(rotor, "tire", radius, width, 0, 0, 0, rubber);
      cylinder(
        rotor,
        "wheel-rim",
        radius * 0.62,
        width + 0.08,
        0,
        0,
        0,
        openWheel ? carbon : rim,
      );
      if (!openWheel)
        for (let i = 0; i < 5; i++) {
          const spoke = box(
            rotor,
            "alloy-spoke",
            [radius * 1.1, 0.3, width + 0.13],
            [0, 0, 0],
            alloy,
          );
          spoke.rotation.z = (i * Math.PI) / 5;
        }
      cylinder(rotor, "hub", radius * 0.18, width + 0.2, 0, 0, 0, alloy);
      if (openWheel)
        for (const edge of [-1, 1]) {
          const stripe = geometry(
            `tire-ring:${radius}`,
            () => new THREE.TorusGeometry(radius * 0.84, 0.1, 4, 20),
          );
          const ring = new THREE.Mesh(stripe, white);
          ring.name = "tire-sidewall";
          ring.position.z = edge * (width / 2 + 0.04);
          rotor.add(ring);
        }
      if (x > 0) model.frontWheels.push(pivot);
      batchMeshes(rotor, `wheel:${radius}:${width}:${openWheel}`);
      model.wheelRotors.push(rotor);
    }
}

// Bake static details into one mesh per material, rather than one draw per detail.
// Cache the baked buffers too: every racer with this preset shares the geometry.
function batchMeshes(parent: THREE.Group, key: string, paint?: THREE.Material) {
  const groups = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of [...parent.children])
    if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
      const meshes = groups.get(child.material) ?? [];
      meshes.push(child);
      groups.set(child.material, meshes);
    }
  for (const [material, meshes] of groups) {
    const merged = geometry(
      `batch:${key}:${material === paint ? "paint" : material.uuid}`,
      () => {
        const transformed = meshes.map((mesh) => {
          mesh.updateMatrix();
          const buffer = mesh.geometry.index
            ? mesh.geometry.toNonIndexed()
            : mesh.geometry.clone();
          return buffer.applyMatrix4(mesh.matrix);
        });
        const result = mergeGeometries(transformed)!;
        transformed.forEach((buffer) => buffer.dispose());
        return result;
      },
    );
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = meshes[0].name;
    mesh.userData.parts = meshes.map((part) => part.name);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    meshes.forEach((part) => parent.remove(part));
    parent.add(mesh);
  }
}

function supercar(model: CarModel, halfAxle: number, paint: THREE.Material) {
  const rear = -halfAxle - 7,
    front = halfAxle + 7;
  prism(
    model.root,
    "supercar-body",
    [
      [rear, 2.6],
      [rear, 6.8],
      [-halfAxle, 8.8],
      [-8, 9],
      [8, 8.8],
      [halfAxle, 8.3],
      [front, 6.2],
      [front, 2.6],
    ],
    19,
    paint,
    { axles: [-halfAxle, halfAxle], radius: 4.15, y: 3.7, bottom: 2.6 },
  );
  prism(
    model.root,
    "coupe-glass",
    [
      [-11, 8.8],
      [-7, 12.2],
      [3, 12.2],
      [10, 8.8],
    ],
    14.4,
    glass,
  );
  box(model.root, "coupe-roof", [9, 0.55, 13], [-2, 12.35, 0], paint);
  box(
    model.root,
    "front-splitter",
    [3, 0.65, 19.5],
    [front - 1, 2.7, 0],
    carbon,
  );
  box(
    model.root,
    "front-grille",
    [0.35, 1.7, 8],
    [front + 0.05, 4.2, 0],
    carbon,
  );
  box(model.root, "rear-diffuser", [2, 1.1, 17], [rear, 2.8, 0], carbon);
  for (const side of [-1, 1]) {
    box(
      model.root,
      "headlight",
      [3, 0.65, 3.4],
      [front - 1.3, 6.35, side * 6.4],
      headlight,
    );
    box(model.root, "side-intake", [5, 2, 0.3], [-8, 6.5, side * 9.6], carbon);
    box(model.root, "side-mirror", [2, 0.9, 2], [6, 9, side * 10.8], paint);
    for (const offset of [3.7, 6.5]) {
      const lamp = new THREE.Mesh(
        geometry("rear-lamp", () => new THREE.SphereGeometry(0.65, 8, 6)),
        tailLight,
      );
      lamp.name = "round-tail-light";
      lamp.position.set(rear - 0.1, 5.7, side * offset);
      model.root.add(lamp);
    }
    const exhaust = cylinder(
      model.root,
      "exhaust",
      0.65,
      2,
      rear - 0.6,
      3.8,
      side * 4,
      alloy,
    );
    exhaust.rotation.set(0, 0, Math.PI / 2);
  }
  for (let i = 0; i < 4; i++)
    box(
      model.root,
      "engine-louver",
      [0.55, 0.2, 10],
      [-halfAxle - 1 + i * 1.35, 9, 0],
      carbon,
    );
  wheels(model, halfAxle, 20, 3.7, 2.6);
}

function formula1(model: CarModel, halfAxle: number, paint: THREE.Material) {
  const rear = -halfAxle - 9,
    front = halfAxle + 12;
  prism(
    model.root,
    "f1-monocoque",
    [
      [rear, 2.1],
      [rear, 4],
      [-9, 6.2],
      [-2, 8],
      [6, 7.8],
      [front, 3.5],
      [front, 2.1],
    ],
    5.6,
    paint,
  );
  for (const side of [-1, 1]) {
    const sidepod = prism(
      model.root,
      "f1-sidepod",
      [
        [-halfAxle + 5, 2.7],
        [-halfAxle + 5, 6],
        [-3, 7],
        [6, 6.5],
        [9, 3],
        [9, 2.7],
      ],
      5.3,
      paint,
    );
    sidepod.position.z = side * 5.3;
    box(
      model.root,
      "sidepod-intake",
      [0.55, 2.1, 4.4],
      [7.5, 5.2, side * 5.3],
      carbon,
    );
    box(
      model.root,
      "rear-wing-endplate",
      [5.5, 5.5, 0.5],
      [rear + 1, 8.6, side * 10.7],
      paint,
    );
    box(
      model.root,
      "front-wing-endplate",
      [5.5, 2.1, 0.4],
      [front - 1, 2.7, side * 12],
      paint,
    );
    for (const axle of [-halfAxle, halfAxle])
      for (const offset of [-4, 4]) {
        const dx = -offset,
          dz = side * 8;
        const arm = box(
          model.root,
          "suspension-arm",
          [Math.hypot(dx, dz), 0.4, 0.45],
          [axle + offset / 2, 3.7, side * 7],
          carbon,
        );
        arm.rotation.y = -Math.atan2(dz, dx);
      }
  }
  box(model.root, "floor", [halfAxle * 1.6, 0.55, 18], [-3, 2, 0], carbon);
  for (let i = 0; i < 3; i++)
    box(
      model.root,
      "front-wing-element",
      [1.1, 0.45, 24 - i * 1.8],
      [front - 3 + i * 1.3, 1.9 + i * 0.45, 0],
      i === 2 ? paint : carbon,
    );
  for (let i = 0; i < 2; i++)
    box(
      model.root,
      "rear-wing-element",
      [4, 0.6, 21],
      [rear + 1, 8.8 + i * 2.2, 0],
      i ? paint : carbon,
    );
  box(model.root, "rear-wing-support", [1, 5, 0.8], [rear + 1, 5.8, 0], carbon);
  prism(
    model.root,
    "engine-cover",
    [
      [-halfAxle + 3, 5],
      [-halfAxle + 5, 7],
      [-6, 11],
      [-4, 10],
      [0, 6],
    ],
    3.5,
    paint,
  );
  box(model.root, "open-cockpit", [7, 0.5, 4], [-0.8, 8, 0], carbon);
  const helmet = new THREE.Mesh(
    geometry("helmet", () => new THREE.SphereGeometry(1.25, 12, 8)),
    white,
  );
  helmet.name = "driver-helmet";
  helmet.position.set(-1.5, 9, 0);
  model.root.add(helmet);
  const haloGeometry = geometry(
    "halo",
    () => new THREE.TorusGeometry(2.9, 0.25, 5, 16, Math.PI * 1.5),
  );
  const halo = new THREE.Mesh(haloGeometry, carbon);
  halo.name = "cockpit-halo";
  halo.rotation.x = Math.PI / 2;
  halo.position.set(-0.5, 10, 0);
  model.root.add(halo);
  box(model.root, "halo-pillar", [0.45, 2.6, 0.45], [2.2, 9, 0], carbon);
  wheels(model, halfAxle, 22, 4.3, 4.5, true);
}

function uno(model: CarModel, halfAxle: number, paint: THREE.Material) {
  const rear = -halfAxle - 5.5,
    front = halfAxle + 5.5;
  prism(
    model.root,
    "uno-hatchback-body",
    [
      [rear, 2.2],
      [rear, 8.5],
      [-halfAxle, 9],
      [halfAxle - 2, 8.4],
      [front, 7.5],
      [front, 2.2],
    ],
    16.5,
    paint,
    { axles: [-halfAxle, halfAxle], radius: 3.45, y: 3.1, bottom: 2.2 },
  );
  prism(
    model.root,
    "uno-window-cabin",
    [
      [-halfAxle - 1, 8.7],
      [-halfAxle + 1, 15.3],
      [3.5, 15.3],
      [9, 8.7],
    ],
    14.8,
    glass,
  );
  box(
    model.root,
    "uno-roof",
    [halfAxle + 3, 0.65, 15],
    [-halfAxle / 2 + 2, 15.65, 0],
    paint,
  );
  for (const side of [-1, 1]) {
    box(
      model.root,
      "b-pillar",
      [1.05, 6.1, 0.35],
      [-3, 12.1, side * 7.55],
      paint,
    );
    box(
      model.root,
      "door-handle",
      [1.8, 0.45, 0.45],
      [1, 8.4, side * 8.4],
      carbon,
    );
    box(model.root, "mirror", [1.8, 1.2, 1.5], [7.4, 10.2, side * 8.6], carbon);
    box(
      model.root,
      "headlight",
      [0.5, 1.7, 4.1],
      [front + 0.12, 6.3, side * 5.2],
      headlight,
    );
    box(
      model.root,
      "tail-light",
      [0.45, 2.8, 1.7],
      [rear - 0.1, 6.3, side * 6.5],
      tailLight,
    );
  }
  box(model.root, "front-bumper", [2, 1.9, 17], [front, 3.8, 0], carbon);
  box(model.root, "rear-bumper", [1.8, 1.9, 17], [rear, 3.8, 0], carbon);
  box(
    model.root,
    "front-grille",
    [0.55, 1.4, 5.4],
    [front + 0.3, 6.3, 0],
    carbon,
  );
  for (const x of [-8, 5])
    box(model.root, "roof-rack", [1, 1, 17], [x, 16.8, 0], carbon);
  for (const side of [-1, 1])
    box(
      model.root,
      "ladder-rail",
      [34, 0.65, 0.65],
      [-2, 17.9, side * 3.7],
      alloy,
    );
  for (let x = -17; x <= 13; x += 3)
    box(model.root, "ladder-rung", [0.65, 0.5, 7.4], [x, 17.9, 0], alloy);
  wheels(model, halfAxle, 17, 3.1, 2.2);
}

/** All dimensions use the simulation's 10 world units per meter. */
export function createCarModel(
  key: CarModelKey,
  wheelbase: number,
  paint: THREE.Material,
): CarModel {
  const model: CarModel = {
    root: new THREE.Group(),
    frontWheels: [],
    wheelRotors: [],
    wheelRadius: key === "formula1" ? 4.3 : key === "uno" ? 3.1 : 3.7,
  };
  model.root.name = `model:${key}`;
  const halfAxle = Math.max(8, (wheelbase * 10) / 2);
  if (key === "formula1") formula1(model, halfAxle, paint);
  else if (key === "uno") uno(model, halfAxle, paint);
  else supercar(model, halfAxle, paint);
  batchMeshes(model.root, `${key}:${wheelbase}`, paint);
  return model;
}
