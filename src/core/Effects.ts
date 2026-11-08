import type Car from "../Car";

export type Explosion = {
  x: number;
  y: number;
  age: number;
  particles: { angle: number; speed: number }[];
};

export type Helicopter = {
  /** World units: ten units per meter, heights above the flat track. */
  altitude: number;
  minAltitude: number;
  maxAltitude: number;
  orbitRadius: number;
  targetX: number;
  targetY: number;
  velocityX: number;
  velocityY: number;
  bank: number;
  initialized: boolean;
  centerX: number;
  centerY: number;
  orbitAngle: number;
  orbitDirection: number;
  rotorAngle: number;
  heading: number;
  x: number;
  y: number;
};

/** Shared cosmetic state. Renderers only turn these positions into graphics. */
export class Effects {
  readonly duration = 24;
  readonly maxRadius = 90;
  explosions: Explosion[] = [];
  helicopters: Helicopter[] = this.createHelicopters();

  private createHelicopters(): Helicopter[] {
    return [0, 1].map((i) => ({
      altitude: 2000 + i * 1000,
      minAltitude: 1800 + i * 1000,
      maxAltitude: 2200 + i * 1000,
      orbitRadius: 1800 + i * 600,
      targetX: 0,
      targetY: 0,
      velocityX: 0,
      velocityY: 0,
      bank: 0,
      initialized: false,
      centerX: 0,
      centerY: 0,
      orbitAngle: i * Math.PI,
      orbitDirection: i ? -1 : 1,
      rotorAngle: 0,
      heading: 0,
      x: 0,
      y: 0,
    }));
  }

  reset() {
    this.explosions = [];
    this.helicopters = this.createHelicopters();
  }

  spawn(x: number, y: number) {
    // Cosmetic randomness deliberately uses a different source from training.
    this.explosions.push({
      x,
      y,
      age: 0,
      particles: Array.from({ length: 14 }, () => ({
        angle: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random(),
      })),
    });
  }

  update(
    cars: Car[],
    player: Car | undefined,
    showExplosions: boolean,
    showHelicopters: boolean,
  ) {
    if (!showExplosions) this.explosions = [];
    else {
      for (const explosion of this.explosions) explosion.age++;
      this.explosions = this.explosions.filter(
        (explosion) => explosion.age < this.duration,
      );
    }
    if (!showHelicopters || !cars.length) return;
    const best = cars.reduce(
      (a, b) => (b.neuralNet.fitness > a.neuralNet.fitness ? b : a),
      cars[0],
    );
    const active = cars.filter((car) => car.speed > 0.001);
    if (player && player.speed > 0.001) active.push(player);
    const average = active.length
      ? {
          x: active.reduce((sum, car) => sum + car.pos.x, 0) / active.length,
          y: active.reduce((sum, car) => sum + car.pos.y, 0) / active.length,
        }
      : best.pos;
    const targets = [best.pos, average];
    const dt = 1 / 60;
    this.helicopters.forEach((heli, i) => {
      const target = targets[i % targets.length];
      if (!heli.initialized) {
        heli.centerX = heli.targetX = target.x;
        heli.centerY = heli.targetY = target.y;
        heli.x = target.x + Math.cos(heli.orbitAngle) * heli.orbitRadius;
        heli.y = target.y + Math.sin(heli.orbitAngle) * heli.orbitRadius;
        heli.heading = heli.orbitAngle + (heli.orbitDirection * Math.PI) / 2;
        heli.initialized = true;
      }
      // Stabilized gimbal tracking is independent of the aircraft's flight heading.
      heli.targetX += (target.x - heli.targetX) * 0.05;
      heli.targetY += (target.y - heli.targetY) * 0.05;
      heli.centerX += (target.x - heli.centerX) * 0.004;
      heli.centerY += (target.y - heli.centerY) * 0.004;
      // 20 m/s orbit; forward travel capped at 55 m/s, acceleration at 4 m/s?.
      heli.orbitAngle += (200 / heli.orbitRadius) * dt * heli.orbitDirection;
      heli.rotorAngle = (heli.rotorAngle + 35 * dt) % (Math.PI * 2);
      const desiredX =
        heli.centerX + Math.cos(heli.orbitAngle) * heli.orbitRadius;
      const desiredY =
        heli.centerY + Math.sin(heli.orbitAngle) * heli.orbitRadius;
      let vx =
        (desiredX - heli.x) * 0.6 -
        Math.sin(heli.orbitAngle) * 200 * heli.orbitDirection;
      let vy =
        (desiredY - heli.y) * 0.6 +
        Math.cos(heli.orbitAngle) * 200 * heli.orbitDirection;
      const speedScale = Math.min(1, 550 / Math.max(1, Math.hypot(vx, vy)));
      vx *= speedScale;
      vy *= speedScale;
      const dx = vx - heli.velocityX,
        dy = vy - heli.velocityY;
      const accelerationScale = Math.min(
        1,
        (40 * dt) / Math.max(1e-9, Math.hypot(dx, dy)),
      );
      heli.velocityX += dx * accelerationScale;
      heli.velocityY += dy * accelerationScale;
      heli.x += heli.velocityX * dt;
      heli.y += heli.velocityY * dt;
      if (Math.hypot(heli.velocityX, heli.velocityY) > 1) {
        const desiredHeading = Math.atan2(heli.velocityY, heli.velocityX);
        const turn = Math.atan2(
          Math.sin(desiredHeading - heli.heading),
          Math.cos(desiredHeading - heli.heading),
        );
        heli.heading += Math.max(-0.35 * dt, Math.min(0.35 * dt, turn));
        const desiredBank = Math.max(-0.25, Math.min(0.25, -turn * 0.8));
        heli.bank += (desiredBank - heli.bank) * 0.03;
      }
      // Gentle, bounded variation; independent non-overlapping flight levels.
      const midpoint = (heli.minAltitude + heli.maxAltitude) / 2;
      heli.altitude =
        midpoint +
        Math.sin(heli.orbitAngle * 0.5 + i) *
          (heli.maxAltitude - heli.minAltitude) *
          0.2;
    });
  }
}
