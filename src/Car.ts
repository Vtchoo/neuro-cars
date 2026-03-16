import p5 from "p5"
import { NeuralNet } from "./NeuralNet"
import { newVector, Vector } from "./Vector"

let avgDeltaTime = 0.016807703080427727 

// Neural net settings
const nnLayers = 1
const nnNeurons = 10
const nnInputs = 8
const nnOutputs = 2
const nnRange = 4
const nnMutationRate = 0.01
const nnActivation = "softsign"

export default class Car {
    // Car paint (helps to keep track of individuals)
    paintRGB = [Math.floor(Math.random() * 255), Math.floor(Math.random() * 255), Math.floor(Math.random() * 255)]
    get paint() {
        return "rgb(" + this.paintRGB[0] + "," + this.paintRGB[1] + "," + this.paintRGB[2] + ")"
    }

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
    update(trackMap: number[][], resolution: number) {
        this.speed += this.acceleration
        if (this.speed < -2) { this.speed = -2 }
        if (trackMap[Math.floor(this.pos.x / resolution)][Math.floor(this.pos.y / resolution)] == 0) { this.speed = 0 }

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
    getInputs(trackMap: number[][], showInputs: boolean, p: p5, resolution: number) {
        var inputs = new Array(8).fill(0)
        var increments = 30

        inputs[7] = this.speed

        for (let i = 0; i < 7; i++) {

            let angle = this.direction + ((i - 3) / 10) * Math.PI

            for (let j = 0; j < increments; j++) {
                var prevx = this.pos.x + (2 * Math.cos(((i - 3) / 10) * Math.PI)) * j * Math.cos(angle) * 4
                var prevy = this.pos.y + (2 * Math.cos(((i - 3) / 10) * Math.PI)) * j * Math.sin(angle) * 4

                var x = this.pos.x + (2 * Math.cos(((i - 3) / 10) * Math.PI)) * (j + 1) * Math.cos(angle) * 4
                var y = this.pos.y + (2 * Math.cos(((i - 3) / 10) * Math.PI)) * (j + 1) * Math.sin(angle) * 4

                const tile = trackMap[Math.floor(x / resolution)][Math.floor(y / resolution)]
                if (tile == 0 || j == increments - 1) {
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
}