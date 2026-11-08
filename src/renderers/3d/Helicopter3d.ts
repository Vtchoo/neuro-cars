import * as THREE from "three";
import type { Helicopter } from "../../core/Effects";

/** Light broadcast helicopter, roughly 12 m long with an 11 m rotor diameter. */
export class Helicopter3d {
  readonly object = new THREE.Group();
  readonly rotor = new THREE.Group();
  readonly tailRotor = new THREE.Group();
  readonly gimbal = new THREE.Group();
  readonly camera = new THREE.PerspectiveCamera(22, 1, 5, 200000);
  private target = new THREE.Vector3();
  private materials: THREE.Material[] = [];

  constructor(index: number) {
    this.object.name = `Helicopter ${index + 1}`;
    const material = (options: THREE.MeshStandardMaterialParameters) => {
      const result = new THREE.MeshStandardMaterial(options);
      this.materials.push(result);
      return result;
    };
    const paint = material({
      color: index ? 0xf1ca43 : 0xd64839,
      roughness: 0.4,
      metalness: 0.2,
    });
    const dark = material({ color: 0x222831, roughness: 0.65, metalness: 0.3 });
    const glass = material({
      color: 0x163d52,
      roughness: 0.12,
      metalness: 0.5,
    });
    const metal = material({
      color: 0xa5afba,
      roughness: 0.35,
      metalness: 0.8,
    });
    const lens = material({ color: 0x183048, roughness: 0.06, metalness: 0.8 });
    const mesh = (
      parent: THREE.Object3D,
      name: string,
      geometry: THREE.BufferGeometry,
      mat: THREE.Material,
      x = 0,
      y = 0,
      z = 0,
    ) => {
      const result = new THREE.Mesh(geometry, mat);
      result.name = name;
      result.position.set(x, y, z);
      result.castShadow = true;
      result.receiveShadow = true;
      parent.add(result);
      return result;
    };
    const box = (
      parent: THREE.Object3D,
      name: string,
      size: number[],
      pos: number[],
      mat: THREE.Material,
    ) =>
      mesh(
        parent,
        name,
        new THREE.BoxGeometry(...size),
        mat,
        ...(pos as [number, number, number]),
      );
    const ellipsoid = (
      name: string,
      size: number[],
      pos: number[],
      mat: THREE.Material,
    ) => {
      const result = mesh(
        this.object,
        name,
        new THREE.SphereGeometry(1, 20, 12),
        mat,
        ...(pos as [number, number, number]),
      );
      result.scale.set(...(size as [number, number, number]));
      return result;
    };
    ellipsoid("fuselage", [27, 12, 11], [-1, 0, 0], paint);
    ellipsoid("glazed-cockpit", [18, 10, 10.4], [14, 1, 0], glass);
    box(
      this.object,
      "cockpit-center-frame",
      [1, 20, 0.7],
      [20, 1, 0],
      paint,
    ).rotation.z = -0.5;
    ellipsoid("engine-cowling", [17, 6, 8], [-10, 12, 0], paint);
    for (const side of [-1, 1]) {
      box(
        this.object,
        "cabin-door",
        [16, 15, 0.5],
        [-6, -1, side * 10.8],
        paint,
      );
      box(
        this.object,
        "cabin-window",
        [12, 8, 0.7],
        [-5, 3, side * 11.2],
        glass,
      );
      box(
        this.object,
        "door-handle",
        [3, 0.6, 0.8],
        [-11, -3, side * 11.4],
        metal,
      );
      const skid = mesh(
        this.object,
        "landing-skid",
        new THREE.CylinderGeometry(0.7, 0.7, 51, 8),
        dark,
        0,
        -18,
        side * 13,
      );
      skid.rotation.z = Math.PI / 2;
      for (const x of [-13, 12]) {
        const strut = box(
          this.object,
          "skid-strut",
          [1.2, 13, 1.2],
          [x, -12, side * 10],
          metal,
        );
        strut.rotation.x = -side * 0.5;
      }
      const exhaust = mesh(
        this.object,
        "engine-exhaust",
        new THREE.CylinderGeometry(2, 2, 8, 10),
        dark,
        -22,
        12,
        side * 5,
      );
      exhaust.rotation.z = Math.PI / 2;
      box(
        this.object,
        "navigation-light",
        [1.2, 1.2, 1.2],
        [-8, 4, side * 12],
        material({
          color: side > 0 ? 0x21b65a : 0xed2525,
          emissive: side > 0 ? 0x21b65a : 0xed2525,
        }),
      );
    }
    const boom = mesh(
      this.object,
      "tapered-tail-boom",
      new THREE.CylinderGeometry(2, 6, 48, 12),
      paint,
      -45,
      3,
      0,
    );
    boom.rotation.z = Math.PI / 2;
    box(this.object, "tail-stabilizer", [12, 1, 28], [-59, 5, 0], paint);
    const fin = box(
      this.object,
      "vertical-tail-fin",
      [11, 22, 1.2],
      [-65, 11, 0],
      paint,
    );
    fin.rotation.z = -0.25;
    this.tailRotor.position.set(-65, 9, 4);
    this.object.add(this.tailRotor);
    for (const angle of [0, Math.PI / 2])
      box(
        this.tailRotor,
        "tail-rotor-blade",
        [19, 1, 0.7],
        [0, 0, 0],
        dark,
      ).rotation.z = angle;
    mesh(
      this.object,
      "rotor-mast",
      new THREE.CylinderGeometry(1.1, 1.1, 10, 10),
      metal,
      -5,
      21,
      0,
    );
    this.rotor.position.set(-5, 26, 0);
    this.object.add(this.rotor);
    for (let i = 0; i < 4; i++) {
      const blade = box(
        this.rotor,
        "main-rotor-blade",
        [51, 0.5, 2.4],
        [29, 0, 0],
        dark,
      );
      const angle = (i * Math.PI) / 2;
      blade.position.set(Math.cos(angle) * 29, 0, Math.sin(angle) * 29);
      blade.rotation.y = -angle;
    }
    mesh(this.rotor, "rotor-hub", new THREE.SphereGeometry(2.7, 12, 8), metal);
    box(this.object, "camera-mount", [3, 21, 3], [20, -18, 0], dark);
    // Keep the lens below the landing skids for shallow filming angles.
    this.gimbal.name = "stabilized-camera-pod";
    this.gimbal.position.set(20, -30, 0);
    this.object.add(this.gimbal);
    mesh(
      this.gimbal,
      "camera-housing",
      new THREE.SphereGeometry(4.5, 16, 10),
      paint,
    );
    const barrel = mesh(
      this.gimbal,
      "camera-lens-barrel",
      new THREE.CylinderGeometry(2.4, 2.4, 3, 12),
      dark,
      0,
      0,
      -4,
    );
    barrel.rotation.x = Math.PI / 2;
    const optics = mesh(
      this.gimbal,
      "camera-lens",
      new THREE.CircleGeometry(1.9, 16),
      lens,
      0,
      0,
      -5.55,
    );
    optics.rotation.y = Math.PI;
    this.camera.position.z = -6;
    this.gimbal.add(this.camera);
  }

  update(
    state: Helicopter,
    aspect: number,
    groundHeight: (x: number, y: number) => number = () => 0,
  ) {
    this.object.position.set(
      state.x,
      groundHeight(state.x, state.y) + state.altitude,
      state.y,
    );
    this.object.rotation.set(-state.bank, -state.heading, -0.04, "YXZ");
    this.rotor.rotation.y = state.rotorAngle;
    this.tailRotor.rotation.z = state.rotorAngle * 5;
    this.object.updateMatrixWorld(true);
    this.target.set(
      state.targetX,
      groundHeight(state.targetX, state.targetY) + 4,
      state.targetY,
    );
    // Group.lookAt points +Z at the target; our camera and lens face -Z.
    this.gimbal.lookAt(this.target);
    this.gimbal.rotateY(Math.PI);
    if (this.camera.aspect !== aspect) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    this.object.updateMatrixWorld(true);
  }

  dispose() {
    this.object.removeFromParent();
    this.object.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
    this.materials.forEach((material) => material.dispose());
  }
}
