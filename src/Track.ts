import p5 from "p5";
import { Vector } from "./Vector";

enum TrackPieceType {
    Straight1Tile,
    StraightSqrt2Tile,
    Turn45DegLeft,
    Turn45DegRight,
    Turn90DegLeft,
    Turn90DegRight
}

interface TrackPiece {
    type: TrackPieceType;
    x: number;
    y: number;
    direction: number;
    radius?: number;
}

export default class Track {
    pieces: TrackPiece[] = [];

    private initialPosition: Vector
    private initialDirection: number
    trackWidth: number

    startPosition: Vector
    startDirection: number

    constructor(startPosition: Vector, startDirection: number, trackWidth: number) {
        this.startPosition = startPosition
        this.startDirection = startDirection
        this.trackWidth = trackWidth

        this.initialPosition = new Vector(startPosition.x, startPosition.y).add(
            -trackWidth * Math.sin(startDirection) / 2,
            trackWidth * Math.cos(startDirection) / 2
        )
        this.initialDirection = startDirection

        this.addPiece(TrackPieceType.Straight1Tile)
    }


    addPiece(type: TrackPieceType, radius?: number) {
        const lastPiece = this.pieces.length > 0 ? this.pieces[this.pieces.length - 1] : null
        let newPieceStartPosition
        let newPieceDirection
        // calculate new piece position and direction based on the last piece
        if (lastPiece) {
            switch (lastPiece.type) {
                case TrackPieceType.Straight1Tile:
                case TrackPieceType.StraightSqrt2Tile:
                    newPieceStartPosition = new Vector(lastPiece.x, lastPiece.y).add(
                        this.trackWidth * Math.cos(lastPiece.direction) * (lastPiece.type == TrackPieceType.Straight1Tile ? 1 : Math.SQRT2),
                        this.trackWidth * Math.sin(lastPiece.direction) * (lastPiece.type == TrackPieceType.Straight1Tile ? 1 : Math.SQRT2)
                    )
                    newPieceDirection = lastPiece.direction
                    break
                case TrackPieceType.Turn45DegLeft:
                case TrackPieceType.Turn90DegLeft:
                    newPieceStartPosition = new Vector(lastPiece.x, lastPiece.y).add(
                        this.trackWidth * Math.cos(lastPiece.direction + (lastPiece.type == TrackPieceType.Turn45DegLeft ? Math.PI / 4 : Math.PI / 2)) * (1 + (radius ? radius : 0)),
                        this.trackWidth * Math.sin(lastPiece.direction + (lastPiece.type == TrackPieceType.Turn45DegLeft ? Math.PI / 4 : Math.PI / 2)) * (1 + (radius ? radius : 0))
                    )
                    newPieceDirection = lastPiece.direction + (lastPiece.type == TrackPieceType.Turn45DegLeft ? Math.PI / 4 : Math.PI / 2)
                    break
                case TrackPieceType.Turn45DegRight:
                case TrackPieceType.Turn90DegRight:
                    newPieceStartPosition = new Vector(lastPiece.x, lastPiece.y).add(
                        this.trackWidth * Math.cos(lastPiece.direction - (lastPiece.type == TrackPieceType.Turn45DegRight ? Math.PI / 4 : Math.PI / 2)) * (1 + (radius ? radius : 0)),
                        this.trackWidth * Math.sin(lastPiece.direction - (lastPiece.type == TrackPieceType.Turn45DegRight ? Math.PI / 4 : Math.PI / 2)) * (1 + (radius ? radius : 0))
                    )
                    newPieceDirection = lastPiece.direction - (lastPiece.type == TrackPieceType.Turn45DegRight ? Math.PI / 4 : Math.PI / 2)
                    break
            }
        } else {
            newPieceStartPosition = new Vector(this.initialPosition.x, this.initialPosition.y)
            newPieceDirection = this.initialDirection
        }

        this.pieces.push({
            type,
            x: newPieceStartPosition.x,
            y: newPieceStartPosition.y,
            direction: newPieceDirection,
            radius
        })
    }

    draw(p: p5, renderTrack: p5.Graphics) {
        renderTrack.push()
        renderTrack.strokeCap(p.SQUARE)
        renderTrack.noFill()
        renderTrack.strokeWeight(this.trackWidth)
        renderTrack.stroke("black")

        for (let piece of this.pieces) {
            switch (piece.type) {
                case TrackPieceType.Straight1Tile:
                    renderTrack.line(piece.x,
                        piece.y,
                        piece.x + this.trackWidth * Math.cos(piece.direction) * 1.01,
                        piece.y + this.trackWidth * Math.sin(piece.direction) * 1.01)
                    renderTrack.strokeWeight(1)
                    renderTrack.stroke("white")
                    renderTrack.line(
                        piece.x - this.trackWidth * Math.sin(piece.direction) / 2,
                        piece.y + this.trackWidth * Math.cos(piece.direction) / 2,
                        piece.x + this.trackWidth * Math.cos(piece.direction) - this.trackWidth * Math.sin(piece.direction) / 2,
                        piece.y + this.trackWidth * Math.sin(piece.direction) + this.trackWidth * Math.cos(piece.direction) / 2
                    )
                    break
                case TrackPieceType.StraightSqrt2Tile:
                    renderTrack.line(piece.x,
                        piece.y,
                        piece.x + this.trackWidth * Math.cos(piece.direction) * Math.SQRT2,
                        piece.y + this.trackWidth * Math.sin(piece.direction) * Math.SQRT2)
                    renderTrack.strokeWeight(1)
                    renderTrack.stroke("white")
                    renderTrack.line(
                        piece.x - this.trackWidth * Math.sin(piece.direction) / 2,
                        piece.y + this.trackWidth * Math.cos(piece.direction) / 2,
                        piece.x + this.trackWidth * Math.cos(piece.direction) * Math.SQRT2 - this.trackWidth * Math.sin(piece.direction) / 2,
                        piece.y + this.trackWidth * Math.sin(piece.direction) * Math.SQRT2 + this.trackWidth * Math.cos(piece.direction) / 2
                    )
                    break
                case TrackPieceType.Turn45DegLeft:
                case TrackPieceType.Turn45DegRight:
                case TrackPieceType.Turn90DegLeft:
                case TrackPieceType.Turn90DegRight:
                    let radius = piece.radius ? piece.radius : 0
                    let avgRadius = this.trackWidth * (1 + radius)
                    let angleStart
                    let angleEnd

                    if (piece.type == TrackPieceType.Turn45DegLeft) {
                        angleStart = piece.direction + Math.PI / 4 - .01
                        angleEnd = piece.direction + Math.PI / 2 + .01
                    } else if (piece.type == TrackPieceType.Turn45DegRight) {
                        angleStart = piece.direction - Math.PI / 2 - .01
                        angleEnd = piece.direction - Math.PI / 4 + .01
                    } else if (piece.type == TrackPieceType.Turn90DegLeft) {
                        angleStart = piece.direction + Math.PI / 2 - .01
                        angleEnd = piece.direction + Math.PI + .01
                    } else if (piece.type == TrackPieceType.Turn90DegRight) {
                        angleStart = piece.direction - Math.PI - .01
                        angleEnd = piece.direction - Math.PI / 2 + .01
                    }

                    renderTrack.arc(piece.x + Math.sin(piece.direction) * avgRadius / 2, piece.y - Math.cos(piece.direction) * avgRadius / 2, avgRadius, avgRadius, angleStart, angleEnd)
                    renderTrack.strokeWeight(1)
                    renderTrack.stroke("white")
                    renderTrack.arc(piece.x + Math.sin(piece.direction) * avgRadius / 2, piece.y - Math.cos(piece.direction) * avgRadius / 2, avgRadius - this.trackWidth, avgRadius - this.trackWidth, angleStart, angleEnd)
                    renderTrack.arc(piece.x + Math.sin(piece.direction) * avgRadius / 2, piece.y - Math.cos(piece.direction) * avgRadius / 2, avgRadius + this.trackWidth, avgRadius + this.trackWidth, angleStart, angleEnd)
                    break
            }
        }

        renderTrack.pop()
    }
}

//     renderTrack.push()
// renderTrack.strokeCap(p.SQUARE)
// renderTrack.noFill()
// renderTrack.strokeWeight(trkWidth)
// renderTrack.stroke("black")

// var pos = newVector(currentPosition.x, currentPosition.y)

// var advanceX
// var advanceY

// if (turn != "straight") {

//     var avgRadius = trkWidth * (1 + radius)
//     let angleStart
//     let angleEnd



//     if (turn == "left") {
//         angleStart = currDir + Math.PI / 4 - .01
//         angleEnd = currDir + Math.PI / 2 + .01

//         advanceX = avgRadius * Math.cos(Math.PI / 4 / 2) * Math.sin(Math.PI / 4 / 2)
//         advanceY = avgRadius * Math.sin(Math.PI / 4 / 2) * Math.sin(Math.PI / 4 / 2)

//         currentPosition.x += +advanceX * Math.cos(currentDirection) + advanceY * Math.sin(currentDirection)
//         currentPosition.y += +advanceX * Math.sin(currentDirection) - advanceY * Math.cos(currentDirection)
//         currentDirection -= Math.PI / 4

//     } else if (turn == "right") {
//         avgRadius *= -1
//         angleStart = currDir - Math.PI / 2 - .01
//         angleEnd = currDir - Math.PI / 4 + .01

//         advanceX = avgRadius * Math.cos(Math.PI / 4 / 2) * Math.sin(Math.PI / 4 / 2)
//         advanceY = avgRadius * Math.sin(Math.PI / 4 / 2) * Math.sin(Math.PI / 4 / 2)

//         currentPosition.x += -advanceX * Math.cos(currentDirection) + advanceY * Math.sin(currentDirection)
//         currentPosition.y += -advanceX * Math.sin(currentDirection) - advanceY * Math.cos(currentDirection)
//         currentDirection += Math.PI / 4
//     }

//     renderTrack.arc(pos.x + Math.sin(currDir) * avgRadius / 2, pos.y - Math.cos(currDir) * avgRadius / 2, avgRadius, avgRadius, angleStart, angleEnd)
//     renderTrack.strokeWeight(1)
//     renderTrack.stroke("white")
//     renderTrack.arc(pos.x + Math.sin(currDir) * avgRadius / 2, pos.y - Math.cos(currDir) * avgRadius / 2, avgRadius - trkWidth, avgRadius - trkWidth, angleStart, angleEnd)
//     renderTrack.arc(pos.x + Math.sin(currDir) * avgRadius / 2, pos.y - Math.cos(currDir) * avgRadius / 2, avgRadius + trkWidth, avgRadius + trkWidth, angleStart, angleEnd)

// } else {

//     advanceX = trackWidth * radius * Math.cos(currentDirection)
//     advanceY = trackWidth * radius * Math.sin(currentDirection)
//     renderTrack.line(currentPosition.x,
//         currentPosition.y,
//         currentPosition.x + advanceX * 1.01,
//         currentPosition.y + advanceY * 1.01)

//     renderTrack.strokeWeight(1)
//     renderTrack.stroke("white")
//     renderTrack.line(
//         currentPosition.x - trkWidth * Math.sin(currDir) / 2,
//         currentPosition.y + trkWidth * Math.cos(currDir) / 2,
//         currentPosition.x + trackWidth * radius * Math.cos(currDir) - trkWidth * Math.sin(currDir) / 2,
//         currentPosition.y + trackWidth * radius * Math.sin(currDir) + trkWidth * Math.cos(currDir) / 2)
//     renderTrack.line(
//         currentPosition.x + trkWidth * Math.sin(currDir) / 2,
//         currentPosition.y - trkWidth * Math.cos(currDir) / 2,
//         currentPosition.x + trackWidth * radius * Math.cos(currDir) + trkWidth * Math.sin(currDir) / 2,
//         currentPosition.y + trackWidth * radius * Math.sin(currDir) - trkWidth * Math.cos(currDir) / 2)

//     currentPosition.x += advanceX
//     currentPosition.y += advanceY
// }

// renderTrack.pop()
