import p5 from "p5"
import { ActivationFunction, NeuralNet } from "./NeuralNet"
import { newVector, Vector } from "./Vector"
import Track, { TrackPiece, TrackPieceType } from "./Track"
import { queryTrack, TrackQueryResult, TrackSegment } from "./utils/track"
import { convertHSLToRGB } from "./utils/colors"
import { signedLog, softsign } from "./utils/activationFunctions"
import { XY } from "./utils/math"
import { random } from "./utils/array"
import { CarPreset } from "./cars/carPresets"

let avgDeltaTime = 1 / 60 // 0.016807703080427727
const UNITS_PER_METER = 10 // 10 pixels = 1 meter scale

const randomNames = [
    ["Ayrton", "Senna"], // Greatest of all time, the legend himself
    ["Michael", "Schumacher"], // The original GOAT, 7-time world champion and dominant force in the 90s and early 2000s
    ["Lewis", "Hamilton"], // Modern GOAT, 7-time world champion, known for his consistency and racecraft
    ["Sebastian", "Vettel"], // 4-time world champion, dominant in the early 2010s with Red Bull
    ["Alain", "Prost"], // 4-time world champion, known as "The Professor" for his calculated driving style
    ["Niki", "Lauda"], // 3-time world champion, known for his incredible comeback after a near-fatal crash
    ["Jim", "Clark"], // 2-time world champion, dominant in the 60s with Lotus
    ["Jackie", "Stewart"], // 3-time world champion, known for his smooth driving style and safety advocacy
    ["Fernando", "Alonso"], // 2-time world champion, known for his versatility and racecraft
    ["Kimi", "Raikkonen"], // 1-time world champion, known as "The Iceman" for his cool demeanor and raw speed
    ["Juan Manuel", "Fangio"], // 5-time world champion in the 50s, known for his skill and dominance in the early years of F1
    ["Alberto", "Ascari"], // 2-time world champion in the 50s, known for his smooth driving style
    ["Tony", "Stark"], // Fictional character from Marvel Comics, known for his genius and charisma
    ["Felipe", "Massa"], // 1-time world champion, known for his speed and near miss of the 2008 title
    ["Gilles", "Villeneuve"], // Known for his fearless driving style and incredible car control, a true legend of the sport
    ["Dale", "Earnhardt"], // NASCAR legend, known for his aggressive driving style and 7 championships in the top-tier NASCAR series
    ["Colin", "McRae"], // Rally legend, known for his incredible car control and 1995 World Rally Championship title
    ["Travis", "Pastrana"], // Known for his versatility across motorsports, including motocross, rally, and NASCAR, as well as his daring stunts in the Nitro Circus
    ["Ken", "Block"], // Known for his Gymkhana series of videos showcasing his incredible car control and stunts, as well as his success in rally and rallycross
    ["Richard", "Petty"], // NASCAR legend, known as "The King" for his record 200 race wins and 7 championships in the top-tier NASCAR series
    ["Oscar", "Piastri"], // Young talent and 2021 Formula 2 champion, currently racing in Formula 1 with McLaren
    ["Lando", "Norris"], // Rising star in Formula 1, known for his speed and personality, currently racing with McLaren
    ["George", "Russell"], // Young talent in Formula 1, known for his speed and consistency, currently racing with Mercedes
    ["Mick", "Schumacher"], // Son of Michael Schumacher, showing promise in Formula 2 and currently racing in Formula 1 with Haas
    ["Charlie", "Leclerc"], // Young talent in Formula 1, known for his speed and racecraft, currently racing with Ferrari
    ["Max", "Verstappen"], // Current dominant force in Formula 1, known for his aggressive driving style and multiple world championships with Red Bull
    ["Rubens", "Barrichello"], // Known for his long career in Formula 1, including being a teammate to Michael Schumacher during his dominant years at Ferrari
    ["Gabriel", "Bortoleto"], // Brazilian driver known for his success in junior formulas and currently racing in Formula 1
    ["Franco", "Colapinto"], // Argentine driver known for his success in junior formulas and currently racing in Formula 1
    ["Lightning", "McQueen"], // Fictional character from the Cars movie franchise, known for his speed and racing spirit
]

const [names, surnames] = [randomNames.map(name => name[0]), randomNames.map(name => name[1])]

// Neural net settings
const nnLayers = 1
const nnNeurons = 20
const nnOutputs = 2
const nnRange = 1.5
const nnMutationRate = 0.01
const nnActivation: ActivationFunction = "leakyRelu"

export type InputFormat = "raycast" | "lookahead"

function getRandomColor() {
    const h = Math.floor(Math.random() * 360)
    return { h, s: 100, l: 50 }
}

interface RGB {
    r: number
    g: number
    b: number
}

interface HSL {
    h: number
    s: number
    l: number
}

export default class Car {
    public driverName: string

    // Car paint (helps to keep track of individuals)
    private color: HSL
    private colorRGB: RGB

    private set colorHSL(color: HSL) {
        this.color = color
        this.colorRGB = convertHSLToRGB(color.h, color.s, color.l)
    }
    get paint() {
        return "rgb(" + this.colorRGB.r + "," + this.colorRGB.g + "," + this.colorRGB.b + ")"
    }

    private inputFormat: InputFormat | InputFormat[] = "lookahead"

    generation = 0

    // Car movement
    pos: Vector
    speed = 0
    acceleration = 0
    direction = 0
    lastDrivingWheelDirection = 0
    lastInputs: number[] = [0, 0]

    // Ackermann steering properties
    wheelbase = 3 // 3 meters
    steeringAngle = 0 // Current front wheel angle in radians
    maxSteeringAngle = Math.PI / 6 // 30 degrees maximum steering

    // Tire slip simulation properties
    tireGripCoefficient = 1.2 // Tire grip coefficient (sports car)
    mass = 1485 // kg - Ferrari 458 Italia
    maxSlipAngle = Math.PI / 24 // 7.5 degrees - angle where tires start to slip significantly

    // Realistic acceleration values (converted to simulation units)
    maxAcceleration = 8.0 // m/s² - max acceleration at low speed (launch)
    maxBraking = 10.0 // m/s² - sports car braking capability
    maxPower = 425000 // W - Ferrari 458 Italia (570 hp)
    frontalArea = 2.3 // m² - Ferrari 458 Italia frontal area
    dragCoefficient = 0.35 // Cd - Ferrari 458 Italia
    rollingResistanceCoeff = 0.011 // Crr - Ferrari 458 Italia (performance tires)
    downforceCoefficient = 0 // CL - Ferrari 458 Italia (Enzo didn't value downforce)
    stationaryDownforce = 0 // N - constant downforce regardless of speed (e.g. fan cars)
    maxReverseSpeed = 15.0 // m/s (~54 km/h)

    /**
     * The force applied to the driving wheel from the input.
     * 1 = instant wheel turning
     * 0 = no wheel turning
     * values < 1 create a more realistic driving experience, where the car takes some time to turn the wheel and doesn't instantly reach the desired direction. This makes the learning process more challenging, but also more rewarding, as the car has to learn to anticipate turns and adjust its speed accordingly.
     */
    drivingWheelForce = 0.05

    // Sprite key for rendering — maps to a loaded image in main.ts
    spriteKey = "car"

    // The brain inside the car
    neuralNet: NeuralNet

    private totalRayCastRays = 7
    lastRayCastDistances: number[] | null = null

    private totalLookAheadPoints = 10
    lastCurrentCarPositionInTrack: Vector | null = null
    lastLookAheadPoints: Vector[] | null = null
    lastCarPositionInTrack: TrackQueryResult | null = null

    // Cached track segments to avoid re-converting every tick (set externally after track loads)
    cachedTrackSegments: TrackSegment[] | null = null

    // Lap timing
    private lapStartTick: number | null = null
    private lapMaxSegment: number = 0
    lastCompletedLapTicks: number | null = null

    resetLap() {
        this.lapStartTick = null
        this.lapMaxSegment = 0
        this.lastCompletedLapTicks = null
    }

    fadeColor() {
        const fadedColor = { ...this.color }
        fadedColor.s = Math.max(0, fadedColor.s - 2)
        this.colorHSL = fadedColor
    }

    private getInputsCount() {
        const fixedInputs = 2 // speed and last driving wheel direction

        if (Array.isArray(this.inputFormat)) {

            const variableInputs = this.inputFormat.reduce((sum, format) => {
                return sum + this.getInputsCountForFormat(format)
            }, 0)

            return fixedInputs + variableInputs
        }

        return fixedInputs + this.getInputsCountForFormat(this.inputFormat)
    }

    private getInputsCountForFormat(format: InputFormat) {
        switch (format) {
            case "raycast":
                return this.totalRayCastRays
            case "lookahead":
                return this.totalLookAheadPoints * 2 + 2 // 2 for heading angle and lateral offset
        }
    }

    constructor(startX: number, startY: number, startDir: number, generation?: number, preset?: CarPreset) {
        this.pos = newVector(startX, startY)
        this.direction = startDir
        this.generation = generation || 0

        if (preset) Object.assign(this, preset)

        const inputs = this.getInputsCount()
        this.neuralNet = new NeuralNet(nnLayers, nnNeurons, inputs, nnOutputs, nnRange, nnMutationRate, nnActivation)

        const color = { h: this.generation % 360, s: 100, l: 50 } // getRandomColor()
        this.color = color
        this.colorRGB = convertHSLToRGB(color.h, color.s, color.l)

        this.driverName = `${random(names)} ${random(surnames)}`
    }

    // Updates car position
    update(trackMap: number[][], resolution: number, track: Track, IsPlayerCar?: boolean, gameTick?: number) {
        // Apply acceleration
        this.speed += this.acceleration * avgDeltaTime
        if (this.speed < -this.maxReverseSpeed) this.speed = -this.maxReverseSpeed

        // Apply drag and rolling resistance for realistic physics
        const speedMPS = this.speed // Convert to m/s
        const dragForce = 0.5 * 1.225 * this.dragCoefficient * this.frontalArea * speedMPS * speedMPS // Air resistance (ρ * Cd * A * v²/2)
        const rollingForce = this.rollingResistanceCoeff * this.mass * 9.81 // Rolling resistance
        const totalResistanceForce = dragForce + rollingForce

        // Convert resistance back to simulation units and apply
        const resistanceAcceleration = totalResistanceForce / this.mass * avgDeltaTime
        if (this.speed > 0) {
            this.speed = Math.max(0, this.speed - resistanceAcceleration)
        } else if (this.speed < 0) {
            this.speed = Math.min(0, this.speed + resistanceAcceleration)
        }

        // Ackermann steering: calculate turning based on wheelbase and steering angle
        if (Math.abs(this.steeringAngle) > 0.001 && Math.abs(this.speed) > 0.1) {
            // Calculate turning radius using Ackermann geometry
            const turningRadius = this.wheelbase / Math.tan(Math.abs(this.steeringAngle))

            // Calculate angular velocity (rad/s)
            const angularVelocity = this.speed / turningRadius

            // Apply direction change with consistent time scaling
            const directionChange = angularVelocity * Math.sign(this.steeringAngle) * Math.sign(this.speed) * avgDeltaTime
            this.direction += directionChange
        }

        const isInsideTrack = track.isInsideTrack(this.pos.x, this.pos.y)
        if (!isInsideTrack) {
            if (!IsPlayerCar) {
                this.speed = 0
            } else {
                // For player car, we allow it to go outside the track, but we could also choose to stop it or apply a penalty
                this.speed *= 0.98 // Apply a penalty to speed when outside the track
            }
        } 
        
        const previousCarPositionInTrack = this.lastCarPositionInTrack

        // Update position with consistent time scaling
        this.pos.add(
            this.speed * Math.cos(this.direction) * avgDeltaTime * UNITS_PER_METER,
            this.speed * Math.sin(this.direction) * avgDeltaTime * UNITS_PER_METER
        )

        const trackSegments = this.cachedTrackSegments ?? (this.cachedTrackSegments = track.analyticPieces.map(convertToTrackSegment))
        const currentCarPositionInTrack = queryTrack(trackSegments, this.pos, this.direction, this.lastCarPositionInTrack?.segmentIndex ?? -1)
        this.lastCarPositionInTrack = currentCarPositionInTrack

        // Lap timing — detect crossing the start/finish line (boundary between last and first segment)
        if (!IsPlayerCar && previousCarPositionInTrack && gameTick !== undefined) {
            const prevIdx = previousCarPositionInTrack.segmentIndex
            const currIdx = currentCarPositionInTrack.segmentIndex
            const totalSegments = track.analyticPieces.length
            const forwardCrossing = prevIdx === totalSegments - 1 && currIdx === 0
            const backwardCrossing = prevIdx === 0 && currIdx === totalSegments - 1

            // Accumulate the furthest segment reached during this timed lap
            this.lapMaxSegment = Math.max(this.lapMaxSegment, prevIdx)

            if (forwardCrossing) {
                // Interpolate the exact sub-tick at which the car crossed the line:
                // distToLine  = remaining distance in the last segment at the previous tick
                // distPastLine = distance into segment 0 at the current tick
                // fraction = distToLine / totalDistance → how far through this tick the crossing happened
                const lastSegLen = Track.getTrackPieceLength(track.analyticPieces[totalSegments - 1])
                const distToLine = lastSegLen - previousCarPositionInTrack.distanceFromTrackPieceStart
                const distPastLine = currentCarPositionInTrack.distanceFromTrackPieceStart
                const totalDist = distToLine + distPastLine
                const fraction = totalDist > 0 ? distToLine / totalDist : 0
                const exactCrossingTick = gameTick + fraction

                // Car must have covered at least half the track forward to count as a valid lap
                if (this.lapStartTick !== null && this.lapMaxSegment >= Math.floor(totalSegments / 2)) {
                    this.lastCompletedLapTicks = exactCrossingTick - this.lapStartTick
                }
                // Start the next lap timer at the exact crossing point
                this.lapStartTick = exactCrossingTick
                this.lapMaxSegment = 0
            } else if (backwardCrossing) {
                // Car reversed over the start/finish line — invalidate the current lap
                this.lapStartTick = null
                this.lapMaxSegment = 0
            }
        }

        if (isInsideTrack) {
            const fitnessReward = this.calculateFitnessReward(track, previousCarPositionInTrack, currentCarPositionInTrack)
            this.neuralNet.addFitness(fitnessReward)
            // this.neuralNet.addFitness(this.speed > 0 ? this.speed : 10 * this.speed)
        }
    }

    calculateFitnessReward(track: Track, previousCarPositionInTrack: TrackQueryResult | null, currentCarPositionInTrack: TrackQueryResult): number {
        if (!previousCarPositionInTrack || !currentCarPositionInTrack) {
            return 0
        }

        // if the index difference is 2 or bigger, let's ignore, also check for lap completion (index goes from last to 0)
        const indexDifference = currentCarPositionInTrack.segmentIndex - previousCarPositionInTrack.segmentIndex
        if (Math.abs(indexDifference) > 1 && !(currentCarPositionInTrack.segmentIndex === 0 && previousCarPositionInTrack.segmentIndex === track.analyticPieces.length - 1)) {
            return 0
        }


        // there are 3 situations:
        // 1. the car is in the same track piece, so we reward it based on the distance it advanced in that piece
        // 2. the car advanced to the next piece, so we reward it based on the distance to the end of the previous piece and the distance from the start of the new piece
        // 3. the car went backward, so we penalize it based on the distance it moved backward
        // the car can also complete a lap, in that case the index resets to 0, so we also check for that and reward the car for completing a lap

        if (currentCarPositionInTrack.segmentIndex === previousCarPositionInTrack.segmentIndex) {
            // case 1
            return currentCarPositionInTrack.distanceFromTrackPieceStart - previousCarPositionInTrack.distanceFromTrackPieceStart
        } else if (currentCarPositionInTrack.segmentIndex === 0 && previousCarPositionInTrack.segmentIndex === track.analyticPieces.length - 1) {
            // case 3 - lap completed
            const piece1Length = Track.getTrackPieceLength(track.analyticPieces[previousCarPositionInTrack.segmentIndex])
            return (piece1Length - previousCarPositionInTrack.distanceFromTrackPieceStart) + currentCarPositionInTrack.distanceFromTrackPieceStart
        } else if (currentCarPositionInTrack.segmentIndex > previousCarPositionInTrack.segmentIndex) {
            // case 2 - advanced to next piece
            const piece1Length = Track.getTrackPieceLength(track.analyticPieces[previousCarPositionInTrack.segmentIndex])
            return (piece1Length - previousCarPositionInTrack.distanceFromTrackPieceStart) + currentCarPositionInTrack.distanceFromTrackPieceStart
        } else {
            // case 4 - went backward
            return currentCarPositionInTrack.distanceFromTrackPieceStart - previousCarPositionInTrack.distanceFromTrackPieceStart
        }
    }

    showInputs(p: p5) {
        if (this.lastCurrentCarPositionInTrack)
            p.circle(this.lastCurrentCarPositionInTrack.x, this.lastCurrentCarPositionInTrack.y, 5)

        if (this.lastLookAheadPoints) {
            for (let i = 0; i < this.lastLookAheadPoints.length; i++) {
                const point = this.lastLookAheadPoints[i]
                p.circle(point.x, point.y, 5)
            }
        }
    }

    // Renders car on canvas
    show(p: p5, carSprite: p5.Image, extraSprites?: Map<string, p5.Image>, tintOverride?: string) {

        const customSprite = extraSprites && extraSprites.get(this.driverName)

        p.push();
        p.translate(this.pos.x, this.pos.y);
        p.rotate(this.direction);
        p.imageMode(p.CENTER)
        if (!customSprite) {
            carSprite.resize(40, 20)
            p.tint(tintOverride ?? this.paint)
            p.image(carSprite, 0, 0)
        } else {
            customSprite.resize(40, 20)
            if (tintOverride) p.tint(tintOverride)
            else p.noTint()
            p.image(customSprite, 0, 0)
        }
        p.pop();
    }

    // Calculate maximum effective steering angle based on tire slip physics
    private getMaxEffectiveSteeringAngle(): number {
        // Convert speed from pixels/frame to m/s using consistent scaling
        const speedMPS = Math.abs(this.speed)

        // At very low speeds, full steering is available
        if (speedMPS < 0.5) {
            return this.maxSteeringAngle
        }

        // Downforce increases normal force on tires, raising the lateral grip limit
        const downforce = 0.5 * 1.225 * this.downforceCoefficient * this.frontalArea * speedMPS * speedMPS + this.stationaryDownforce
        const effectiveNormalForce = this.mass * 9.81 + downforce
        const maxLateralAcceleration = this.tireGripCoefficient * (effectiveNormalForce / this.mass) // m/s²

        // Calculate the maximum turning radius before tire slip occurs
        // Using the relationship: lateral_accel = v²/R
        const maxTurningRadius = (speedMPS * speedMPS) / maxLateralAcceleration

        // Convert turning radius back to steering angle using wheelbase in meters
        const wheelbaseMeters = this.wheelbase
        const maxEffectiveAngle = Math.atan(wheelbaseMeters / maxTurningRadius)

        // Return the minimum of physical steering limit and slip-limited angle
        return Math.min(this.maxSteeringAngle, maxEffectiveAngle)
    }

    // Inputs for driving the car with Ackermann steering and tire slip simulation
    drive() {
        // Calculate realistic acceleration based on throttle input (-1 to 1)
        const throttleInput = this.lastInputs[0] // -1 to 1

        if (throttleInput >= 0) {
            // Power-limited engine force: full torque at low speed, power-capped at high speed
            const maxTorqueForce = throttleInput * this.maxAcceleration * this.mass
            const maxPowerForce = (this.maxPower * throttleInput) / Math.max(Math.abs(this.speed), 0.5)
            const engineForce = Math.min(maxTorqueForce, maxPowerForce)
            this.acceleration = engineForce / this.mass
        } else {
            // Braking (negative throttle)
            const brakingMPS2 = Math.abs(throttleInput) * this.maxBraking
            this.acceleration = -brakingMPS2 // Convert to simulation units
        }

        // Calculate target steering angle from input (-1 to 1)
        const targetSteeringInput = this.lastInputs[1] // -1 to 1
        const targetSteeringAngle = targetSteeringInput * this.maxSteeringAngle

        // Apply tire slip limitation - limit actual steering angle based on current speed
        const maxEffectiveAngle = this.getMaxEffectiveSteeringAngle()

        // Clamp the steering angle to what the tires can actually provide
        this.steeringAngle = Math.sign(targetSteeringAngle) * Math.min(Math.abs(targetSteeringAngle), maxEffectiveAngle)

        // Friction circle: tires have a finite combined grip budget.
        // When lateral acceleration is high, less grip remains for longitudinal force.
        if (Math.abs(this.steeringAngle) > 0.001 && Math.abs(this.speed) > 0.1) {
            const speedMPS = Math.abs(this.speed)
            const downforce = 0.5 * 1.225 * this.downforceCoefficient * this.frontalArea * speedMPS * speedMPS + this.stationaryDownforce
            const maxLateralAccel = this.tireGripCoefficient * (this.mass * 9.81 + downforce) / this.mass
            const turningRadius = this.wheelbase / Math.tan(Math.abs(this.steeringAngle))
            const lateralAccel = (speedMPS * speedMPS) / turningRadius
            const frictionCircleFactor = Math.sqrt(Math.max(0, 1 - (lateralAccel / maxLateralAccel) ** 2))
            this.acceleration *= frictionCircleFactor
        }

        // Keep lastDrivingWheelDirection for neural network input consistency
        this.lastDrivingWheelDirection = targetSteeringInput
    }

    // Gets sensors' data
    updateSensors(trackMap: number[][], showInputs: boolean, p: p5, resolution: number, track: Track) {
        const inputs = [
            signedLog(this.speed),
            this.lastDrivingWheelDirection,
        ]

        if (!this.lastCarPositionInTrack)
            this.lastCarPositionInTrack = queryTrack(
                this.cachedTrackSegments ?? (this.cachedTrackSegments = track.analyticPieces.map(convertToTrackSegment)),
                this.pos, this.direction, -1)

        switch (this.inputFormat) {
            case "raycast": {
                const raycastInputs = this.getRaycastInputs(showInputs, p, track)
                inputs.push(...raycastInputs)
                break
            }
            case "lookahead": {
                const lookaheadInputs = this.getLookaheadInputs(track)
                inputs.push(...lookaheadInputs)
                break
            }
        }

        return inputs
    }

    private getRaycastInputs(showInputs: boolean, p: p5, track: Track) {
        const inputs = new Array(this.totalRayCastRays).fill(0)
        const rayCastPoints: XY[] = new Array(this.totalRayCastRays)
        const maxIncrements = 30

        for (let i = 0; i < this.totalRayCastRays; i++) {

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
                    rayCastPoints[i] = { x, y }
                    break
                }
            }
        }
        this.lastRayCastPoints = rayCastPoints
        return inputs
    }

    private getLookaheadInputs(track: Track) {
        // in this mode, the car gets as input the points of the track that are in front of it, at a certain distance and angle from the car

        const totalqueryPoints = this.totalLookAheadPoints
        const singleFrameDistance = this.speed * avgDeltaTime * UNITS_PER_METER
        const maxLookaheadDistance = singleFrameDistance * 60 * 6 // look ahead up to 6 seconds in the future at current speed

        // const currentCarPositionInTrack = queryTrack(track.analyticPieces.map(convertToTrackSegment), this.pos, this.direction)
        const currentCarPositionInTrack = this.lastCarPositionInTrack || queryTrack(
            this.cachedTrackSegments ?? (this.cachedTrackSegments = track.analyticPieces.map(convertToTrackSegment)),
            this.pos, this.direction, -1)
        this.lastCurrentCarPositionInTrack = new Vector(currentCarPositionInTrack.point.x, currentCarPositionInTrack.point.y)

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

                        const availableAngleInCurrentSegment = segment.clockwise ? finalAngle - startAngle : startAngle - finalAngle
                        const availableDistanceInCurrentSegment = Math.abs((availableAngleInCurrentSegment + 2 * Math.PI) % (2 * Math.PI)) * radius

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

        this.lastLookAheadPoints = lookAheadPoints

        const relativeLookAheadPoints = lookAheadPoints.map(point => {
            const relativePosition = Vector.sub(point, currentCarPositionInTrack.point)
            // Rotate relative position to be relative to tangent
            const tangent = currentCarPositionInTrack.tangent
            const rotatedX = relativePosition.x * tangent.x + relativePosition.y * tangent.y
            const rotatedY = -relativePosition.x * tangent.y + relativePosition.y * tangent.x
            return new Vector(rotatedX, rotatedY)
        })

        const normalizationFactor = 1 + maxLookaheadDistance

        const trackPiece = track.analyticPieces[currentCarPositionInTrack.segmentIndex]

        const finalInputs = [
            ...relativeLookAheadPoints.flatMap(point => [point.x / normalizationFactor, point.y / normalizationFactor]),
            currentCarPositionInTrack.headingAngle,
            currentCarPositionInTrack.lateralOffset / (trackPiece.width / 2),
        ]

        return finalInputs
    }

    reset(startX: number, startY: number, startDir: number) {
        this.pos = newVector(startX, startY)
        this.direction = startDir
        this.speed = 0
        this.acceleration = 0
        this.steeringAngle = 0
        this.lastDrivingWheelDirection = 0
        this.lastRayCastDistances = null
        this.lastCurrentCarPositionInTrack = null
        this.lastLookAheadPoints = null
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