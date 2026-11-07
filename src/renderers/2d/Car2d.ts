import type p5 from "p5";
import Car from "../../Car";

export default class Car2d extends Car {
  showInputs(p: p5) {
    if (this.lastCurrentCarPositionInTrack)
      p.circle(
        this.lastCurrentCarPositionInTrack.x,
        this.lastCurrentCarPositionInTrack.y,
        5,
      );

    if (this.lastLookAheadPoints) {
      for (let i = 0; i < this.lastLookAheadPoints.length; i++) {
        const point = this.lastLookAheadPoints[i];
        p.circle(point.x, point.y, 5);
      }
    }
  }
  show(
    p: p5,
    carSprite: p5.Image,
    extraSprites?: Map<string, p5.Image>,
    tintOverride?: string,
  ) {
    const customSprite = extraSprites && extraSprites.get(this.driverName);

    p.push();
    p.translate(this.pos.x, this.pos.y);
    p.rotate(this.direction);
    p.imageMode(p.CENTER);
    if (!customSprite) {
      p.tint(tintOverride ?? this.paint);
      p.image(carSprite, 0, 0);
    } else {
      if (tintOverride) p.tint(tintOverride);
      else p.noTint();
      p.image(customSprite, 0, 0);
    }
    p.pop();
  }
}
