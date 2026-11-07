import type p5 from "p5";
import type Track from "../../Track";
import { splinePieces, getTrackLinkPosition } from "../../editor/trackEditor";
export function drawTrackSelection(p: p5, track: Track, zoom = 1) {
  p.push();
  p.strokeWeight(1 / zoom);
  for (const s of splinePieces(track)) {
    p.stroke("#55bfff");
    p.line(s.start.x, s.start.y, s.control1.x, s.control1.y);
    p.line(s.end.x, s.end.y, s.control2.x, s.control2.y);
    for (const key of ["start", "end", "control1", "control2"] as const) {
      p.fill(key === "start" || key === "end" ? "#fff" : "#55bfff");
      p.circle(s[key].x, s[key].y, 12 / zoom);
    }
  }
  const link = getTrackLinkPosition(track, zoom);
  if (link) {
    p.fill(track.closed ? "#f8b84e" : "#60e5a0");
    p.stroke("#222");
    p.circle(link.x, link.y, 26 / zoom);
    p.fill("#111");
    p.noStroke();
    p.textAlign(p.CENTER, p.CENTER);
    p.textSize(16 / zoom);
    p.text(track.closed ? "×" : "↗", link.x, link.y);
  }
  p.pop();
}
