import type Car from "../Car";

export type Explosion = {
  x: number;
  y: number;
  age: number;
  particles: { angle: number; speed: number }[];
};

export type Helicopter = {
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
    const previous = this.helicopters.map((heli) => ({ x: heli.x, y: heli.y }));
    this.helicopters.forEach((heli, i) => {
      heli.centerX += (targets[i].x - heli.centerX) * 0.03;
      heli.centerY += (targets[i].y - heli.centerY) * 0.03;
      heli.orbitAngle += 0.006 * heli.orbitDirection;
      heli.rotorAngle += 1.2;
      heli.x = heli.centerX + Math.cos(heli.orbitAngle) * 160;
      heli.y = heli.centerY + Math.sin(heli.orbitAngle) * 160;
    });
    const [a, b] = this.helicopters,
      dx = b.x - a.x,
      dy = b.y - a.y,
      distance = Math.hypot(dx, dy);
    if (distance < 140) {
      const nx = distance > 1e-9 ? dx / distance : 1,
        ny = distance > 1e-9 ? dy / distance : 0,
        push = (140 - distance) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
    }
    this.helicopters.forEach((heli, i) => {
      const vx = heli.x - previous[i].x,
        vy = heli.y - previous[i].y;
      if (Math.hypot(vx, vy) > 0.001) heli.heading = Math.atan2(vy, vx);
    });
  }
}
