import type { DrawingSurface } from "./CanvasSurface";
import type Car from "@/Car";

/** Screen-space tire grip budget for the car being followed. */
export function drawGripBudget(p: DrawingSurface, car: Car | null): void {
  const width = 240,
    height = 290;
  const x = Math.max(10, p.width - width - 20);
  const y = Math.max(10, p.height - height - 20);
  const cx = x + width / 2,
    cy = y + 151,
    radius = 76;

  p.push();
  p.resetMatrix();
  p.rectMode(p.CORNER);
  p.ellipseMode(p.CENTER);
  p.drawingContext.setLineDash([]);
  p.noStroke();
  p.fill(10, 10, 18, 220);
  p.rect(x, y, width, height, 10);
  p.fill("white");
  p.textAlign(p.CENTER, p.CENTER);
  p.textSize(13);
  p.text("Tire grip budget", cx, y + 20);

  p.stroke(255, 255, 255, 45);
  p.strokeWeight(1);
  p.line(cx - radius, cy, cx + radius, cy);
  p.line(cx, cy - radius, cx, cy + radius);
  p.noFill();
  p.stroke(255, 255, 255, 190);
  p.drawingContext.setLineDash([5, 5]);
  // Both axes use the same physical scale and the simulation's shared grip limit.
  p.ellipse(cx, cy, radius * 2, radius * 2);
  p.drawingContext.setLineDash([]);

  p.noStroke();
  p.fill(210);
  p.textSize(10);
  p.text("Accelerate", cx, cy - radius - 13);
  p.text("Brake", cx, cy + radius + 13);
  p.text("Left", cx - radius - 20, cy);
  p.text("Right", cx + radius + 20, cy);

  if (car) {
    const { limit, longitudinal, lateral } = car.gripState;
    const scale = limit > 0 ? radius / limit : 0;
    // Do not clamp the dot: exceeding the limit should remain visible.
    p.fill("white");
    p.circle(cx + lateral * scale, cy - longitudinal * scale, 7);
    p.textSize(11);
    p.text(`Limit: ${(limit / 9.81).toFixed(2)} g`, cx, y + 254);
    p.text(
      `Lat: ${(lateral / 9.81).toFixed(2)} g   Long: ${(longitudinal / 9.81).toFixed(2)} g`,
      cx,
      y + 273,
    );
  }
  p.pop();
}
