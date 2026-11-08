import { dom, type MenuElement } from "../ui/dom";
import { Vector } from "../Vector";
import type { BrowserGame as Game } from "../ui/BrowserGame";
import Track, { SplinePiece, TrackPieceType } from "../Track";
import { buildGameMenu } from "../ui/gameMenu";

type Hit = {
  piece: SplinePiece;
  key: "start" | "end" | "control1" | "control2";
};
let panel: MenuElement | undefined;
let hit: Hit | null = null;
let pressed: Vector | null = null;
let dragged = false;
let width = 100;
const dist = (a: Vector, b: Vector) => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (a: Vector, b: Vector, t: number) =>
  new Vector(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const copy = (a: Vector) => new Vector(a.x, a.y);
const pieces = (track: Track) => track.pieces as SplinePiece[];
const point = (s: SplinePiece, t: number) => {
  const a = mix(s.start, s.control1, t),
    b = mix(s.control1, s.control2, t),
    c = mix(s.control2, s.end, t);
  return mix(mix(a, b, t), mix(b, c, t), t);
};
function sync(game: Game) {
  const first = pieces(game.track)[0];
  if (first) {
    game.track.startingPoint = copy(first.start);
    game.track.startingDirection = Track.getTrackPieceStartDirection(first);
    game.start = copy(first.start);
    game.direction = game.track.startingDirection;
  }
  game.track.generateAnalyticPieces();
}
function icon(track: Track, zoom: number) {
  const first = pieces(track)[0];
  return first
    ? new Vector(first.start.x, first.start.y - (first.width / 2 + 24 / zoom))
    : null;
}
function findHit(track: Track, pos: Vector, zoom: number): Hit | null {
  const all = pieces(track);
  for (const key of ["start", "end", "control1", "control2"] as const) {
    for (const piece of all)
      if (dist(piece[key], pos) <= 9 / zoom) return { piece, key };
  }
  return null;
}
export function createTrackBuilder(
  initialPosition: Vector,
  initialDirection: number,
  trackWidth: number,
  game: Game,
  track: Track,
) {
  const p = dom;
  panel?.remove();
  width = trackWidth;
  track.pieces = [];
  track.closed = false;
  const start = copy(game.start),
    end = copy(initialPosition);
  const span = Math.max(trackWidth, dist(start, end));
  end.x = start.x + span * Math.cos(initialDirection);
  end.y = start.y + span * Math.sin(initialDirection);
  track.addSpline(
    start,
    mix(start, end, 1 / 3),
    mix(start, end, 2 / 3),
    end,
    width,
  );
  sync(game);
  panel = p.createDiv();
  panel
    .style("position", "absolute")
    .style("top", "1rem")
    .style("left", "1rem")
    .style("background", "#fff")
    .style("padding", "12px")
    .style("max-width", "260px");
  panel.child(
    p.createDiv(
      "Click empty space to extend; click road to split. Click endpoints to remove; drag endpoints or handles to reshape. Ctrl + drag to pan; wheel to zoom. Use the start link icon to close or reopen.",
    ),
  );
  const button = (label: string, action: () => void) => {
    const b = p.createButton(label);
    b.parent(panel!);
    b.mouseClicked(action);
  };
  button("Reset", () => {
    panel?.remove();
    game.setPhase("resetTrack");
  });
  button("Load", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        game.track = game.createTrack(data.track ?? data);
        sync(game);
      } catch {
        alert("Unable to load track JSON");
      }
    };
    input.click();
  });
  button("Done", () => setTrack(game));
}
export function setTrack(game: Game) {
  if (!game.track.pieces.length) return;
  sync(game);
  panel?.remove();
  panel = undefined;
  game.gameMenu = buildGameMenu(game);
  game.setPhase("setup");
}
export function editorPressed(track: Track, pos: Vector, zoom: number) {
  pressed = pos;
  dragged = false;
  hit = findHit(track, pos, zoom);
  return hit !== null;
}
export function editorDragged(game: Game, pos: Vector, zoom: number) {
  if (!pressed) return;
  if (dist(pos, pressed) > 3 / zoom) dragged = true;
  if (!dragged || !hit) return;
  const { piece, key } = hit,
    target = piece[key],
    dx = pos.x - target.x,
    dy = pos.y - target.y;
  if (key === "start" || key === "end") {
    for (const s of pieces(game.track)) {
      if (s.start === target) {
        s.control1.x += dx;
        s.control1.y += dy;
      }
      if (s.end === target) {
        s.control2.x += dx;
        s.control2.y += dy;
      }
    }
    target.x = pos.x;
    target.y = pos.y;
  } else {
    target.x = pos.x;
    target.y = pos.y;
    const anchor = key === "control1" ? piece.start : piece.end;
    const vx = anchor.x - target.x,
      vy = anchor.y - target.y,
      mag = Math.hypot(vx, vy);
    if (mag > 0.000001)
      for (const s of pieces(game.track)) {
        const opposite =
          key === "control1" && s.end === anchor
            ? s.control2
            : key === "control2" && s.start === anchor
              ? s.control1
              : null;
        if (opposite) {
          const len = dist(opposite, anchor);
          opposite.x = anchor.x + (vx / mag) * len;
          opposite.y = anchor.y + (vy / mag) * len;
        }
      }
  }
  sync(game);
}
export function editorReleased() {
  pressed = null;
  hit = null;
}
export function editorClick(game: Game, pos: Vector, zoom: number) {
  if (dragged) {
    dragged = false;
    return;
  }
  const track = game.track,
    all = pieces(track),
    first = all[0],
    last = all[all.length - 1],
    link = icon(track, zoom);
  if (link && dist(pos, link) < 13 / zoom) {
    if (track.closed) {
      all.pop();
      track.closed = false;
    } else if (first && last) {
      const len = Math.max(dist(last.end, first.start) / 3, 1);
      const a = Track.getTrackPieceEndDirection(last),
        b = Track.getTrackPieceStartDirection(first);
      all.push({
        type: TrackPieceType.Spline,
        start: last.end,
        control1: new Vector(
          last.end.x + Math.cos(a) * len,
          last.end.y + Math.sin(a) * len,
        ),
        control2: new Vector(
          first.start.x - Math.cos(b) * len,
          first.start.y - Math.sin(b) * len,
        ),
        end: first.start,
        width: last.width,
      });
      track.closed = true;
    }
    sync(game);
    return;
  }
  const selected = findHit(track, pos, zoom);
  if (selected) {
    if (selected.key === "control1" || selected.key === "control2") return;
    const anchor = selected.piece[selected.key];
    const before = all.findIndex((s) => s.end === anchor),
      after = all.findIndex((s) => s.start === anchor);
    if (before >= 0 && after >= 0 && before !== after) {
      const a = all[before],
        b = all[after];
      a.end = b.end;
      a.control2 = b.control2;
      all.splice(after, 1);
      if (all.length < 2) track.closed = false;
    } else if (before >= 0) all.splice(before, 1);
    else if (after >= 0) all.splice(after, 1);
    sync(game);
    return;
  }
  let nearest: { s: SplinePiece; t: number; d: number } | null = null;
  for (const s of all) {
    let t = 0,
      d = Infinity;
    for (let i = 0; i <= 100; i++) {
      const test = i / 100,
        delta = dist(point(s, test), pos);
      if (delta < d) {
        d = delta;
        t = test;
      }
    }
    let lo = Math.max(0, t - 0.01),
      hi = Math.min(1, t + 0.01);
    for (let i = 0; i < 24; i++) {
      const a = lo + (hi - lo) / 3,
        b = hi - (hi - lo) / 3;
      if (dist(point(s, a), pos) < dist(point(s, b), pos)) hi = b;
      else lo = a;
    }
    t = (lo + hi) / 2;
    d = dist(point(s, t), pos);
    if (d <= s.width / 2 && (!nearest || d < nearest.d)) nearest = { s, t, d };
  }
  if (nearest) {
    const { s, t } = nearest;
    if (t < 0.0001 || t > 0.9999) return;
    const a = mix(s.start, s.control1, t),
      b = mix(s.control1, s.control2, t),
      c = mix(s.control2, s.end, t),
      d = mix(a, b, t),
      e = mix(b, c, t),
      m = mix(d, e, t);
    all.splice(
      all.indexOf(s),
      1,
      { ...s, control1: a, control2: d, end: m },
      { ...s, start: m, control1: e, control2: c },
    );
  } else if (!track.closed) {
    const start = last ? last.end : copy(track.startingPoint);
    if (!last) {
      const len = dist(start, pos) / 3,
        a = track.startingDirection;
      track.addSpline(
        start,
        new Vector(start.x + Math.cos(a) * len, start.y + Math.sin(a) * len),
        mix(start, pos, 2 / 3),
        copy(pos),
        width,
      );
    } else {
      const len = dist(start, pos) / 3,
        a = Track.getTrackPieceEndDirection(last);
      all.push({
        type: TrackPieceType.Spline,
        start,
        control1: new Vector(
          start.x + Math.cos(a) * len,
          start.y + Math.sin(a) * len,
        ),
        control2: mix(start, pos, 2 / 3),
        end: copy(pos),
        width: last.width,
      });
    }
  }
  sync(game);
}

export function handleTrackBuilderKeyPress(_key: string, _track: Track) {}

export const splinePieces = pieces;
export const getTrackLinkPosition = icon;
