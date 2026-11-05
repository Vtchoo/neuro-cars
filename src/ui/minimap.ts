import type p5 from 'p5'
import type Car from '@/Car'
import Track, { TrackPieceType } from '@/Track'

type MapGeometry = {
    pieces: Track['analyticPieces'];
    paths: Map<number, Path2D>;
    minX: number; minY: number; maxX: number; maxY: number;
}

const geometryCache = new WeakMap<Track, MapGeometry>()

function getGeometry(track: Track): MapGeometry {
    const cached = geometryCache.get(track)
    if (cached?.pieces === track.analyticPieces) return cached

    const paths = new Map<number, Path2D>()
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const include = (x: number, y: number, padding: number) => {
        minX = Math.min(minX, x-padding); minY = Math.min(minY, y-padding)
        maxX = Math.max(maxX, x+padding); maxY = Math.max(maxY, y+padding)
    }
    for (const piece of track.pieces) {
        let path = paths.get(piece.width)
        if (!path) { path = new Path2D(); paths.set(piece.width, path) }
        path.moveTo(piece.start.x, piece.start.y)
        include(piece.start.x, piece.start.y, piece.width/2)
        include(piece.end.x, piece.end.y, piece.width/2)
        switch (piece.type) {
            case TrackPieceType.Straight:
                path.lineTo(piece.end.x, piece.end.y)
                break
            case TrackPieceType.Spline:
                path.bezierCurveTo(piece.control1.x, piece.control1.y, piece.control2.x, piece.control2.y, piece.end.x, piece.end.y)
                // The control hull contains the whole curve.
                include(piece.control1.x, piece.control1.y, piece.width/2)
                include(piece.control2.x, piece.control2.y, piece.width/2)
                break
            case TrackPieceType.Arc: {
                const r = Math.hypot(piece.start.x-piece.center.x, piece.start.y-piece.center.y)
                path.arc(piece.center.x, piece.center.y, r,
                    Math.atan2(piece.start.y-piece.center.y, piece.start.x-piece.center.x),
                    Math.atan2(piece.end.y-piece.center.y, piece.end.x-piece.center.x), !piece.clockwise)
                include(piece.center.x, piece.center.y, r+piece.width/2)
                break
            }
        }
    }
    const geometry = { pieces: track.analyticPieces, paths, minX, minY, maxX, maxY }
    geometryCache.set(track, geometry)
    return geometry
}

export function drawMinimap(p: p5, track: Track, racers: Car[], followed: Car | null,
    colorForCar: (car: Car) => string = car => car.paint): void {
    const width = 240, height = 290
    const x = Math.max(10, p.width-width-20), y = Math.max(10, p.height-height-20)
    p.push()
    p.resetMatrix()
    p.rectMode(p.CORNER)
    p.ellipseMode(p.CENTER)
    const context = p.drawingContext as CanvasRenderingContext2D
    context.setLineDash([])
    p.noStroke()
    p.fill(10, 10, 18, 220)
    p.rect(x, y, width, height, 10)
    p.fill('white')
    p.textAlign(p.CENTER, p.CENTER)
    p.textSize(13)
    p.text('Minimap', x+width/2, y+20)

    if (track.pieces.length) {
        const geometry = getGeometry(track)
        const mapX = x+14, mapY = y+44, mapW = width-28, mapH = height-58
        const scale = Math.min(mapW/Math.max(1, geometry.maxX-geometry.minX), mapH/Math.max(1, geometry.maxY-geometry.minY))
        const tx = mapX+mapW/2-(geometry.minX+geometry.maxX)/2*scale
        const ty = mapY+mapH/2-(geometry.minY+geometry.maxY)/2*scale

        // Clip off-track racers to the map area without changing the fitted track bounds.
        context.beginPath()
        context.rect(mapX, mapY, mapW, mapH)
        context.clip()
        context.save()
        context.translate(tx, ty)
        context.scale(scale, scale)
        context.strokeStyle = '#8c939e'
        context.lineCap = 'round'
        context.lineJoin = 'round'
        for (const [roadWidth, path] of geometry.paths) {
            context.lineWidth = Math.max(roadWidth, 2/scale)
            context.stroke(path)
        }
        context.restore()

        const drawRacer = (car: Car, selected: boolean) => {
            p.stroke(selected ? 'white' : '#171923')
            p.strokeWeight(selected ? 1.5 : .7)
            p.fill(colorForCar(car))
            p.circle(tx+car.pos.x*scale, ty+car.pos.y*scale, selected ? 7 : 5)
        }
        for (const car of racers) if (car !== followed) drawRacer(car, false)
        // Draw the followed racer last so it remains visible in a group.
        if (followed && racers.includes(followed)) drawRacer(followed, true)
    }
    p.pop()
}
