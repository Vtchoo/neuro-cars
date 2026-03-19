import p5 from "p5"
import { NeuralNet } from "./NeuralNet"
import { newVector, Vector } from "./Vector"
import Track, { TrackPiece, TrackPieceType } from "./Track"
import { queryTrack, TrackSegment } from "./utils/track"

let avgDeltaTime = 0.016807703080427727

// Neural net settings
const nnLayers = 1
const nnNeurons = 10
const nnInputs = 23
const nnOutputs = 2
const nnRange = 4
const nnMutationRate = 0.01
const nnActivation = "softsign"

export type InputFormat = "raycast" | "lookahead"

export default class Car {
    // Car paint (helps to keep track of individuals)
    paintRGB = [Math.floor(Math.random() * 255), Math.floor(Math.random() * 255), Math.floor(Math.random() * 255)]
    get paint() {
        return "rgb(" + this.paintRGB[0] + "," + this.paintRGB[1] + "," + this.paintRGB[2] + ")"
    }

    private inputFormat: InputFormat = "lookahead"

    // Car movement
    pos: Vector
    speed = 0
    acceleration = 0
    direction = 0

    // The brain inside the car
    NN = new NeuralNet(nnLayers, nnNeurons, nnInputs, nnOutputs, nnRange, nnMutationRate, nnActivation)
    generation = 0

    constructor(startX: number, startY: number, startDir: number) {
        this.pos = newVector(startX, startY)
        this.direction = startDir
    }

    // Updates car position
    update(trackMap: number[][], resolution: number, track: Track) {
        this.speed += this.acceleration
        if (this.speed < -2) { this.speed = -2 }
        // if (trackMap[Math.floor(this.pos.x / resolution)][Math.floor(this.pos.y / resolution)] == 0) { this.speed = 0 }
        if (!track.isInsideTrack(this.pos.x, this.pos.y)) { this.speed = 0 }

        this.pos.add(
            this.speed * Math.cos(this.direction) * avgDeltaTime / (1 / 30),
            this.speed * Math.sin(this.direction) * avgDeltaTime / (1 / 30))
    }

    // Renders car on canvas
    show(p: p5, carSprite: p5.Image) {
        p.push();
        p.translate(this.pos.x, this.pos.y);
        p.rotate(this.direction);
        p.imageMode(p.CENTER)
        carSprite.resize(20, 10)
        p.tint(this.paint)
        p.image(carSprite, 0, 0)
        p.pop();
    }

    // Inputs for driving the car
    drive(input: number[]) {
        this.acceleration = (input[0] > 0 && this.speed >= 0) || this.speed < 0 ? input[0] * .05 : input[0] * .15
        //this.acceleration = input[0] * .05
        this.direction += input[1] * .05 * (1 - 1 / (1 + Math.abs(this.speed))) * Math.sign(this.speed) * avgDeltaTime / (1 / 30)
    }

    // Gets sensors' data
    getInputs(trackMap: number[][], showInputs: boolean, p: p5, resolution: number, track: Track) {
        switch (this.inputFormat) {
            case "raycast":
                return this.getRaycastInputs(showInputs, p, track)
            case "lookahead":
                return this.getLookaheadInputs(showInputs, p, track)
        }

    }

    private getRaycastInputs(showInputs: boolean, p: p5, track: Track) {
        const inputs = new Array(8).fill(0)
        const maxIncrements = 30

        inputs[7] = this.speed

        for (let i = 0; i < 7; i++) {

            let angle = this.direction + ((i - 3) / 10) * Math.PI

            for (let j = 0; j < maxIncrements; j++) {
                const prevx = this.pos.x + (2 * Math.cos(((i - 3) / 10) * Math.PI)) * j * Math.cos(angle) * 4
                const prevy = this.pos.y + (2 * Math.cos(((i - 3) / 10) * Math.PI)) * j * Math.sin(angle) * 4

                let x = this.pos.x + (2 * Math.cos(((i - 3) / 10) * Math.PI)) * (j + 1) * Math.cos(angle) * 4
                let y = this.pos.y + (2 * Math.cos(((i - 3) / 10) * Math.PI)) * (j + 1) * Math.sin(angle) * 4

                // const tile = trackMap[Math.floor(x / resolution)][Math.floor(y / resolution)]
                const isInsideTrack = track.isInsideTrack(x, y)
                if (!isInsideTrack || j == maxIncrements - 1) {
                    x = prevx
                    y = prevy

                    inputs[i] = Math.sqrt(Math.pow(x - this.pos.x, 2) + Math.pow(y - this.pos.y, 2))
                    if (showInputs) {
                        p.stroke(255); p.line(this.pos.x, this.pos.y, x, y)
                    }
                    break
                }
            }
        }
        return inputs
    }

    private getLookaheadInputs(showInputs: boolean, p: p5, track: Track) {
        // in this mode, the car gets as input the points of the track that are in front of it, at a certain distance and angle from the car

        const totalqueryPoints = 10
        const singleFrameDistance = this.speed * avgDeltaTime / (1 / 30)
        const maxLookaheadDistance = singleFrameDistance * 60

        const currentCarPositionInTrack = queryTrack(track.analyticPieces.map(convertToTrackSegment), this.pos, this.direction)
        p.circle(currentCarPositionInTrack.point.x, currentCarPositionInTrack.point.y, 5)

        const lookAheadPoints: Vector[] = []
        const distanceBetweenPoints = maxLookaheadDistance / totalqueryPoints

        for (let i = 1; i <= totalqueryPoints; i++) {
            const lookaheadDistance = i * distanceBetweenPoints
            let remainingDistance = lookaheadDistance
            let segmentIndex = currentCarPositionInTrack.segmentIndex
            let pointOnTrack = currentCarPositionInTrack.point

            while (remainingDistance > 0) {
                const segment = track.analyticPieces[segmentIndex]

                switch (segment.type) {
                    case TrackPieceType.Straight: {
                        const availableDistanceInCurrentSegment = Vector.sub(segment.end, pointOnTrack).mag()
                        if (remainingDistance <= availableDistanceInCurrentSegment) {
                            const segmentDirection = Vector.sub(segment.end, segment.start)
                            const unitVector = new Vector(segmentDirection.x / segmentDirection.mag(), segmentDirection.y / segmentDirection.mag())
                            pointOnTrack = new Vector(pointOnTrack.x + unitVector.x * remainingDistance, pointOnTrack.y + unitVector.y * remainingDistance)
                            remainingDistance = 0
                        } else {
                            remainingDistance -= availableDistanceInCurrentSegment
                            segmentIndex = (segmentIndex + 1) % track.analyticPieces.length
                            pointOnTrack = track.analyticPieces[segmentIndex].start
                        }
                        break
                    }
                    case TrackPieceType.Arc: {
                        const center = segment.center
                        const radius = Vector.sub(segment.start, center).mag()

                        const finalAngle = (Math.atan2(segment.end.y - center.y, segment.end.x - center.x) + 2 * Math.PI) % (2 * Math.PI)
                        const startAngle = (Math.atan2(pointOnTrack.y - center.y, pointOnTrack.x - center.x) + 2 * Math.PI) % (2 * Math.PI)

                        const availableAngleInCurrentSegment = finalAngle - startAngle
                        const availableDistanceInCurrentSegment = Math.abs(availableAngleInCurrentSegment) * radius

                        if (remainingDistance <= availableDistanceInCurrentSegment) {
                            const angleDirection = segment.clockwise ? 1 : -1
                            const angleToPoint = Math.atan2(pointOnTrack.y - center.y, pointOnTrack.x - center.x) + angleDirection * (remainingDistance / radius)
                            pointOnTrack = new Vector(center.x + radius * Math.cos(angleToPoint), center.y + radius * Math.sin(angleToPoint))
                            remainingDistance = 0
                        } else {
                            remainingDistance -= availableDistanceInCurrentSegment
                            segmentIndex = (segmentIndex + 1) % track.analyticPieces.length
                            pointOnTrack = track.analyticPieces[segmentIndex].start
                        }
                        break
                    }
                }
            }

            lookAheadPoints.push(pointOnTrack)
        }

        const relativeLookAheadPoints = lookAheadPoints.map(point => {
            const relativePosition = Vector.sub(point, currentCarPositionInTrack.point)
            // Rotate relative position to be relative to tangent
            const tangent = currentCarPositionInTrack.tangent
            const rotatedX = relativePosition.x * tangent.x + relativePosition.y * tangent.y
            const rotatedY = -relativePosition.x * tangent.y + relativePosition.y * tangent.x
            return new Vector(rotatedX, rotatedY)
        })

        for (let i = 0; i < lookAheadPoints.length; i++) {
            const point = lookAheadPoints[i]
            p.circle(point.x, point.y, 5)
        }

        const normalizationFactor = 1 + maxLookaheadDistance

        const finalInputs = [
            ...relativeLookAheadPoints.flatMap(point => [point.x / normalizationFactor, point.y / normalizationFactor]),
            this.speed,
            currentCarPositionInTrack.headingAngle,
            currentCarPositionInTrack.lateralOffset,
        ]

        return finalInputs
    }
}

function convertToTrackSegment(piece: TrackPiece): TrackSegment {
    switch (piece.type) {
        case TrackPieceType.Straight:
            return {
                kind: "line",
                start: piece.start,
                end: piece.end,
            }
        case TrackPieceType.Arc:
            return {
                kind: "arc",
                center: piece.center,
                start: piece.start,
                end: piece.end,
                clockwise: piece.clockwise,
            }
        default:
            throw new Error("Unsupported piece kind: " + (piece as any).kind);
    }
}