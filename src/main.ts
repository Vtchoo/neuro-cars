
import p5 from 'p5';
import { createGrid, createTrackBuilder, setTrack } from "./trackBuilder"
import { newVector, Vector } from './Vector';
import Car from './Car';
import { NeuralNet } from './NeuralNet';
//---------- SMART RACE 2 ----------

// Important objects
let carSprite: p5.Image

// Will the player be allowed to drive a car?
let playerDrive = false

// Defines the current state of the simulator (setStart is the first one)
// let phase = "generateTrack"
let phase = "setStart"

// Defines the width of the race track
const trackWidth = 50

// Graphic overlays
let showGrid = false // Shows grid when building the track
let showMap = false // Shows collision map during runtime
let showInputs = false
const resolution = 3 // Get 1 out of [resolution] pixels to create the track collision map

// Track building
var direction: number //of the starting track
var start: Vector // starting position of the cars
var currentPosition: Vector //of the last section of the current track
var currentDirection: number //of the next track segment

// Simulation settings
var ticks = 0
var generation = 0
var maxticks = 500
var averageFrameRate
var frameRecord = []
var avgDeltaTime = 0.016807703080427727

// Data logging and graphing
var maxFitness = [0]
var avgFitness = [0]
var maxFitnessNormal = [0]
var avgFitnessNormal = [0]
var drawGraphs = false

// Population settings
let population: Car[] = []
const individuals = 30
const offspring = 3

// Neural net settings
const nnLayers = 1
const nnNeurons = 10
const nnInputs = 8
const nnOutputs = 2
const nnRange = 4
const nnMutationRate = 0.01
const nnActivation = "softsign"


// private initializeP5(): void {
//     const sketch = (p: p5) => {
//         this.p5Instance = p;

//         p.setup = () => {
//             const canvas = p.createCanvas(1200, 800);
//             canvas.parent(document.body);
//             p.background(10);

//             this.generateTrack();
//             this.initializePopulation();
//         };

//         p.draw = () => {
//             this.update(p.deltaTime);
//             this.render();
//         };

//         p.keyPressed = () => {
//             if (p.key === ' ') {
//                 this.toggleSimulation();
//             }
//             if (p.key === 's' || p.key === 'S') {
//                 this.state.showInputs = !this.state.showInputs;
//             }
//         };
//     };

//     new p5(sketch);
// }

let player: Car

export default class Game {

	private p: p5

	renderTrack: p5.Graphics
	renderCars: p5.Graphics

	grid: p5.Graphics

	trackMap: number[][]
	renderMap: p5.Graphics

	constructor() {
		new p5((p: p5) => {
			this.p = p;

			p.preload = () => {
				this.preload();
			}

			p.setup = () => {
				this.setup();
			}

			p.draw = () => {
				this.draw();
			}

			p.mouseClicked = () => {
				this.mouseClicked();
			}
		});
	}

	setPhase(newPhase: string) {
		phase = newPhase
	}

	// The simulation itself

	preload() {
		//carSprite = loadImage("./images/car.png")
		//carSprite = loadImage("car.png")
		carSprite = this.p.loadImage("https://raw.githubusercontent.com/Vtchoo/smartRace2/master/images/car.png")
	}

	setup() {

		// Create canvas
		this.p.createCanvas(window.innerWidth, window.innerHeight)
		this.renderTrack = this.p.createGraphics(this.p.width, this.p.height)
		this.renderCars = this.p.createGraphics(this.p.width, this.p.height)
		this.grid = this.p.createGraphics(this.p.width, this.p.height)
		this.p.background("green")

		// Set a reduced resolution track map for the sensors of the cars
		this.trackMap = new Array(Math.floor(this.p.width / resolution));
		for (var i = 0; i < this.trackMap.length; i++) {
			this.trackMap[i] = new Array(Math.floor(this.p.height / resolution));
		}
		this.renderMap = this.p.createGraphics(this.p.width, this.p.height)

	}

	draw() {

		switch (phase) {
			case "setStart":

				this.renderTrack.push();
				this.renderTrack.fill("green")
				this.renderTrack.rect(0, 0, this.p.width, this.p.height)
				this.renderTrack.fill("black")
				this.renderTrack.noStroke()
				this.renderTrack.rect(this.p.mouseX - trackWidth / 2, this.p.mouseY - trackWidth / 2, trackWidth, trackWidth)
				this.renderTrack.pop();
				this.p.image(this.renderTrack, 0, 0)
				break

			case "rotateStart":

				this.renderTrack.push()
				this.renderTrack.fill("green")
				this.renderTrack.rect(0, 0, this.p.width, this.p.height)
				this.renderTrack.translate(start.x, start.y)
				this.renderTrack.rotate(Math.atan2(this.p.mouseY - start.y, this.p.mouseX - start.x))
				this.renderTrack.fill("black")
				this.renderTrack.rect(-trackWidth / 2, -trackWidth / 2, trackWidth, trackWidth)
				this.renderTrack.stroke("white")
				this.renderTrack.line(-trackWidth / 2, -trackWidth / 2, trackWidth / 2, -trackWidth / 2)
				this.renderTrack.line(-trackWidth / 2, +trackWidth / 2, trackWidth / 2, +trackWidth / 2)
				this.renderTrack.pop()
				this.p.image(this.renderTrack, 0, 0)
				break

			case "generateTrack":

				start = newVector(this.p.width / 2, this.p.height / 2)
				direction = Math.PI

				this.renderTrack.push()
				this.renderTrack.fill("green")
				this.renderTrack.rect(0, 0, this.p.width, this.p.height)

				var a = .5 * this.p.width - trackWidth / 2
				var b = .5 * this.p.height - trackWidth / 2

				let startRadius = this.p.sqrt(this.p.noise(2 + this.p.cos(0), 2 + this.p.sin(0)))
				start = newVector(
					this.p.width / 2 + a * startRadius * this.p.cos(Math.PI / 2),
					this.p.height / 2 + b * startRadius * this.p.sin(Math.PI / 2)
				)

				// Draws white line
				for (let i = 0; i < 360; i++) {

					let angle = i / 360 * Math.PI * 2
					let nextAngle = (i + 1) / 360 * Math.PI * 2
					let radius = this.p.sqrt(this.p.noise(2 + this.p.cos(angle), 2 + this.p.sin(angle)))
					let nextRadius = this.p.sqrt(this.p.noise(2 + this.p.cos(nextAngle), 2 + this.p.sin(nextAngle)))

					this.renderTrack.stroke("white")
					this.renderTrack.strokeWeight(trackWidth + 2)
					this.renderTrack.line(
						this.p.width / 2 + a * radius * this.p.cos(angle + Math.PI / 2),
						this.p.height / 2 + b * radius * this.p.sin(angle + Math.PI / 2),
						this.p.width / 2 + a * nextRadius * this.p.cos(nextAngle + Math.PI / 2),
						this.p.height / 2 + b * nextRadius * this.p.sin(nextAngle + Math.PI / 2)
					)

				}

				// Draws asphalt
				for (let i = 0; i < 360; i++) {

					let angle = i / 360 * Math.PI * 2
					let nextAngle = (i + 1) / 360 * Math.PI * 2
					let radius = this.p.sqrt(this.p.noise(2 + this.p.cos(angle), 2 + this.p.sin(angle)))
					let nextRadius = this.p.sqrt(this.p.noise(2 + this.p.cos(nextAngle), 2 + this.p.sin(nextAngle)))

					this.renderTrack.stroke("black")
					this.renderTrack.strokeWeight(trackWidth)
					this.renderTrack.line(
						this.p.width / 2 + a * radius * this.p.cos(angle + Math.PI / 2),
						this.p.height / 2 + b * radius * this.p.sin(angle + Math.PI / 2),
						this.p.width / 2 + a * nextRadius * this.p.cos(nextAngle + Math.PI / 2),
						this.p.height / 2 + b * nextRadius * this.p.sin(nextAngle + Math.PI / 2)
					)

				}
				this.renderTrack.pop()
				this.p.image(this.renderTrack, 0, 0)

				setTrack(this.renderTrack, this.trackMap, this.renderMap, this.p, resolution, this)
				this.setPhase("setup")
				break

			case "buildTrack":

				this.p.background("green")
				this.p.image(this.renderTrack, 0, 0)
				if (showGrid == true) { this.p.image(this.grid, 0, 0) }
				break

			case "setup":

				// for (let i = 0; i < individuals; i++) {
				// 	population[i] = new Car(start.x, start.y, direction)
				// }
				population = Array.from({ length: individuals }, () => {
					const car = new Car(start.x, start.y, direction)
					console.log(car)
					return car
				})

				player = new Car(start.x, start.y, direction)

				this.setPhase("running")
				break

			case "running":

				// if (generation == 0) {
				// 	frameRecord.push(this.p.frameRate())
				// 	averageFrameRate = 0
				// 	for (let h = 0; h < frameRecord.length; h++) {
				// 		averageFrameRate += frameRecord[h]
				// 	}
				// 	averageFrameRate = averageFrameRate / frameRecord.length
				// 	avgDeltaTime = 1 / averageFrameRate
				// }

				// Shows the track
				this.p.image(this.renderTrack, 0, 0)

				// or the AI detection map
				if (showMap == true) { this.p.image(this.renderMap, 0, 0) }

				// Updates each individual
				population.forEach((individual) => {
					individual.drive(individual.NN.output(individual.getInputs(this.trackMap, showInputs, this.p, resolution)))
					individual.update(this.trackMap, resolution)
					individual.show(this.p, carSprite)
					individual.NN.addFitness(individual.speed)
				})

				// Allows the player to drive a car
				if (playerDrive == true) {
					getUserInput()
					// player.update()
					// player.show()
				}

				// Draws the graph data
				if (drawGraphs) {
					if (maxFitness.length > 1) {
						let maxWidth = this.p.width / 1.5
						let interval = maxWidth / (maxFitness.length - 1)
						let maxHeight = this.p.height / 3
						for (let i = 0; i < maxFitness.length; i++) {
							this.p.push()
							this.p.stroke("blue")
							this.p.line(
								this.p.width - maxWidth + i * interval,
								this.p.height - maxHeight * maxFitnessNormal[i],
								this.p.width - maxWidth + (i + 1) * interval,
								this.p.height - maxHeight * maxFitnessNormal[i + 1]
							)
							this.p.stroke("yellow")
							this.p.line(
								this.p.width - maxWidth + i * interval,
								this.p.height - maxHeight * avgFitnessNormal[i],
								this.p.width - maxWidth + (i + 1) * interval,
								this.p.height - maxHeight * avgFitnessNormal[i + 1]
							)
							this.p.pop()
						}
					}
				}


				ticks++
				if (ticks >= maxticks) {
					phase = "breeding"
				}

				break
			case "breeding":

				// Sort the population by fitness
				population.sort(function (a, b) { return b.NN.fitness - a.NN.fitness })

				// And stores data into the data logging arrays
				maxFitness.push(population[0].NN.fitness)
				var avgFitnessGen = 0
				population.forEach(function (individual) {
					avgFitnessGen += individual.NN.fitness
				})
				avgFitness.push(avgFitnessGen / population.length)

				// Normalizes the fitnesses to show on a graph
				var maxTotalFitness = 0
				for (let i = 0; i < maxFitness.length; i++) {
					maxTotalFitness = maxFitness[i] > maxTotalFitness ? maxFitness[i] : maxTotalFitness
				}
				for (let i = 0; i < maxFitness.length; i++) {
					maxFitnessNormal[i] = maxFitness[i] / maxTotalFitness
					avgFitnessNormal[i] = avgFitness[i] / maxTotalFitness
				}

				// Generates new neural net and replaces the worst individuals
				for (let i = 0; i < offspring; i++) {
					population[individuals - 1 - i].NN = NeuralNet.breed(population[2 * i].NN, population[2 * i + 1].NN)
					population[individuals - 1 - i].generation = generation + 1
				}

				// Resets every individual's car
				population.forEach(function (individual) {
					individual.pos = newVector(start.x + Math.random(), start.y + Math.random())
					individual.speed = 0
					individual.direction = direction
					individual.acceleration = 0
					individual.NN.resetFitness()
				})

				// Resets player's car
				player.pos = newVector(start.x, start.y)
				player.speed = 0
				player.direction = direction

				ticks = 0
				generation++
				//console.log("Current generation: " + generation)

				phase = "running"
				break
		}
	}

	mouseClicked() {

		switch (phase) {
			case "resetTrack":
				phase = "setStart"
				break
			case "setStart":
				start = newVector(this.p.mouseX, this.p.mouseY)
				phase = "rotateStart"
				break
			case "rotateStart":
				direction = Math.atan2(this.p.mouseY - start.y, this.p.mouseX - start.x)
				phase = "buildTrack"

				currentDirection = direction
				currentPosition = newVector(start.x + trackWidth * Math.cos(direction) / 2, start.y + trackWidth * Math.sin(direction) / 2)
				this.p.circle(currentPosition.x, currentPosition.y, 5)

				createGrid(this.grid, start, direction, trackWidth, this.p)
				createTrackBuilder(this.p, currentPosition, currentDirection, trackWidth, this.renderTrack, this.trackMap, this.renderMap, resolution, this)

				break
		}
	}

	getUserInput() {

		var playerinput = []

		if (this.p.keyIsDown(87)) {
			playerinput[0] = 1
		} else if (this.p.keyIsDown(83)) {
			playerinput[0] = -1
		} else {
			playerinput[0] = 0
		}

		if (this.p.keyIsDown(65)) {
			playerinput[1] = -1
		} else if (this.p.keyIsDown(68)) {
			playerinput[1] = 1
		} else {
			playerinput[1] = 0
		}

		player.drive(playerinput)

	}
}

const game = new Game()
