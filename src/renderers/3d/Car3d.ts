import * as THREE from "three";
import Car from "../../Car";

import { createCarModel, type CarModel } from "./carModels";

/** Only presentation lives here; all driving behavior is inherited unchanged. */
export default class Car3d extends Car {
  private _object?: THREE.Group;
  get object() {
    return (this._object ??= new THREE.Group());
  }
  private _paintMaterial?: THREE.MeshPhysicalMaterial;
  private get paintMaterial() {
    return (this._paintMaterial ??= new THREE.MeshPhysicalMaterial({
      // Metallic basecoat beneath a smooth, nonmetallic automotive clearcoat.
      roughness: 0.3,
      metalness: 0.6,
      clearcoat: 1,
      clearcoatRoughness: 0.15,
    }));
  }
  private _sensorGeometry?: THREE.BufferGeometry;
  private get sensorGeometry() {
    return (this._sensorGeometry ??= new THREE.BufferGeometry());
  }
  private _sensors?: THREE.LineSegments;
  private get sensors() {
    return (this._sensors ??= new THREE.LineSegments(
      this.sensorGeometry,
      new THREE.LineBasicMaterial({ color: 0x75d9ff }),
    ));
  }
  private model?: CarModel;
  private modelSignature = "";
  private lastPosition?: { x: number; y: number };
  private viewOpacity = 1;
  private readonly originalMaterials = new Map<
    THREE.Mesh,
    THREE.Material | THREE.Material[]
  >();
  private readonly transparentMaterials = new Map<
    THREE.Material,
    THREE.Material
  >();

  /** Ghost materials belong to this car; shared preset materials stay unchanged. */
  setViewOpacity(opacity: number) {
    if (this.viewOpacity === opacity) return;
    this.viewOpacity = opacity;
    this.object.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const original = (this.originalMaterials.get(object) ??
        object.material) as THREE.Material | THREE.Material[];
      if (!this.originalMaterials.has(object))
        this.originalMaterials.set(object, original);
      const ghost = (material: THREE.Material) => {
        let result = this.transparentMaterials.get(material);
        if (!result) {
          result = material.clone();
          result.transparent = true;
          result.depthWrite = false;
          this.transparentMaterials.set(material, result);
        }
        result.opacity = opacity;
        return result;
      };
      object.material =
        opacity === 1
          ? original
          : Array.isArray(original)
            ? original.map(ghost)
            : ghost(original);
    });
  }

  private build() {
    const opacity = this.viewOpacity;
    this.transparentMaterials.forEach((material) => material.dispose());
    this.transparentMaterials.clear();
    this.originalMaterials.clear();
    this.viewOpacity = 1;
    this.object.clear();
    this.model = createCarModel(
      this.modelKey,
      this.wheelbase,
      this.paintMaterial,
    );
    this.object.add(this.model.root);
    this.modelSignature = `${this.modelKey}:${this.wheelbase}`;
    this.setViewOpacity(opacity);
  }

  rollWheels(distance: number) {
    if (this.model)
      for (const wheel of this.model.wheelRotors)
        wheel.rotation.z -= distance / this.model.wheelRadius;
  }

  render(
    scene: THREE.Scene,
    tint?: string,
    showInputs = false,
    groundHeight: (x: number, y: number) => number = () => 0,
  ) {
    if (this.modelSignature !== `${this.modelKey}:${this.wheelbase}`)
      this.build();
    if (this.object.parent !== scene) scene.add(this.object);
    this.object.position.set(
      this.pos.x,
      groundHeight(this.pos.x, this.pos.y),
      this.pos.y,
    );
    this.object.rotation.y = -this.direction;
    this.paintMaterial.color.set(tint ?? this.paint);
    const ghostPaint = this.transparentMaterials.get(this.paintMaterial) as
      | THREE.MeshPhysicalMaterial
      | undefined;
    if (ghostPaint) ghostPaint.color.copy(this.paintMaterial.color);
    for (const wheel of this.model!.frontWheels)
      wheel.rotation.y = -this.steeringAngle;
    if (this.lastPosition) {
      const distance =
        (this.pos.x - this.lastPosition.x) * Math.cos(this.direction) +
        (this.pos.y - this.lastPosition.y) * Math.sin(this.direction);
      this.rollWheels(distance);
    }
    this.lastPosition = { x: this.pos.x, y: this.pos.y };
    if (this._sensors) this._sensors.visible = showInputs;
    if (showInputs) {
      const points = this.lastLookAheadPoints ?? this.lastRayCastPoints ?? [];
      const geometry = this.sensorGeometry;
      let position = geometry.getAttribute("position") as
        | THREE.BufferAttribute
        | undefined;
      if (!position || position.count !== points.length * 2) {
        // Release the previous GPU buffer when the sensor count changes.
        geometry.dispose();
        position = new THREE.BufferAttribute(
          new Float32Array(points.length * 6),
          3,
        );
        position.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute("position", position);
      }
      points.forEach((point, i) => {
        position!.setXYZ(
          i * 2,
          this.pos.x,
          groundHeight(this.pos.x, this.pos.y) + 4,
          this.pos.y,
        );
        position!.setXYZ(
          i * 2 + 1,
          point.x,
          groundHeight(point.x, point.y) + 4,
          point.y,
        );
      });
      position.needsUpdate = true;
      // Vertices are in world coordinates, so the culling bounds must move too.
      geometry.computeBoundingSphere();
      if (this.sensors.parent !== scene) scene.add(this.sensors);
    }
  }

  dispose() {
    this._object?.removeFromParent();
    this._sensors?.removeFromParent();
    this._paintMaterial?.dispose();
    this.transparentMaterials.forEach((material) => material.dispose());
    this.transparentMaterials.clear();
    this.originalMaterials.clear();
    this._sensorGeometry?.dispose();
    if (this._sensors) (this._sensors.material as THREE.Material).dispose();
  }
}
