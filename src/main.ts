
import p5 from 'p5';
import { createGrid, createTrackBuilder, setTrack } from "./trackBuilder"
import { newVector, Vector } from './Vector';
import Car from './Car';
import { NeuralNet } from './NeuralNet';
import Track, { TrackPieceType } from './Track';
//---------- SMART RACE 2 ----------

// Important objects
let carSprite: p5.Image

// Will the player be allowed to drive a car?
let playerDrive = false

// Defines the current state of the simulator (setStart is the first one)
// let phase = "generateTrack"
let phase = "setStart"

// Defines the width of the race track
const trackWidth = 120


// Simulation settings
var averageFrameRate
var frameRecord = []
var avgDeltaTime = 0.016807703080427727

// Data logging and graphing
var maxFitness = [0]
var avgFitness = [0]
var maxFitnessNormal = [0]
var avgFitnessNormal = [0]

// Population settings
const individuals = 100

type BreedingMethod = 'pair' | 'elite' | 'clone'
const breedingMethod: BreedingMethod = 'pair' // "pair" breeds the best with the second best, the third with the fourth, and so on. "random" breeds random individuals from the top 20% of the population.

// pair
const offspring = 20
// elite
const eliteSize = 7

let player: Car

export default class Game {

	private p: p5

	renderTrack: p5.Graphics
	renderCars: p5.Graphics

	grid: p5.Graphics

	trackMap: number[][]
	renderMap: p5.Graphics

	track = new Track()
	population: Car[] = []

	followBestCar = false

	private readonly decisionsPerSecond = 10
	private lastDecisionTime = 0

	// Track building
	direction: number //of the starting track
	start: Vector // starting position of the cars
	private currentPosition: Vector //of the last section of the current track
	private currentDirection: number //of the next track segment

	// Graphic overlays
	private showGrid = true // Shows grid when building the track
	private showMap = false // Shows collision map during runtime
	private showInputs: "none" | "all" | "best" = "none" // Shows the sensor inputs of the cars during runtime. "all" shows for all cars, "best" only for the best car, and "none" for none.
	private drawGraphs = false
	private resolution = 3 // Get 1 out of [resolution] pixels to create the track collision map

	setShowGrid(show: boolean) {
		this.showGrid = show
	}
	setShowMap(show: boolean) {
		this.showMap = show
	}
	setDrawGraphs(show: boolean) {
		this.drawGraphs = show
	}

	toggleShowGrid() {
		this.showGrid = !this.showGrid
	}
	toggleShowMap() {
		this.showMap = !this.showMap
	}
	toggleShowInputs() {
		const options = ["none", "all", "best"] as const
		const currentIndex = options.indexOf(this.showInputs)
		const nextIndex = (currentIndex + 1) % options.length
		this.showInputs = options[nextIndex]
	}
	toggleDrawGraphs() {
		this.drawGraphs = !this.drawGraphs
	}

	ticks = 0
	generation = 0
	maxTicks = 1000

	/**
	 * Cycles through track's track pieces as starting points for the race, instead of always starting at the same point. This makes the AI more robust and able to handle different parts of the track.
	 */
	cycleStartPoint: 'off' | 'sequential' | 'random' = 'sequential'
	startPointIndex = 0

	incrementMaxTicks(increment: number) {
		this.maxTicks += increment
	}

	constructor() {
		this.p = new p5((p: p5) => {

			p.preload = () => {
				this.preload()
			}

			p.setup = () => {
				this.setup()
			}

			p.draw = () => {
				this.draw()
			}

			p.mouseClicked = () => {
				this.mouseClicked()
			}

			p.mousePressed = () => {
				this.mousePressed()
			}

			p.mouseWheel = (event) => {
				this.mouseWheel(event)
			}

			p.mouseDragged = () => {
				this.mouseDragged()
			}

			p.keyPressed = () => {
				this.keyPressed()
			}

			p.windowResized = () => {
				this.p.resizeCanvas(window.innerWidth, window.innerHeight)
				this.renderTrack.resizeCanvas(this.p.width, this.p.height)
				this.renderCars.resizeCanvas(this.p.width, this.p.height)
				this.grid.resizeCanvas(this.p.width, this.p.height)
				// this.renderMap.resizeCanvas(this.p.width, this.p.height)
			}
		})
	}

	setPhase(newPhase: string) {
		phase = newPhase
	}

	// The simulation itself

	preload() {
		carSprite = this.p.loadImage("./images/car.png")
		//carSprite = loadImage("car.png")
		// carSprite = this.p.loadImage("https://raw.githubusercontent.com/Vtchoo/smartRace2/master/images/car.png")
	}

	setup() {

		// Create canvas
		this.p.createCanvas(window.innerWidth, window.innerHeight)
		this.renderTrack = this.p.createGraphics(this.p.width, this.p.height)
		this.renderCars = this.p.createGraphics(this.p.width, this.p.height)
		this.grid = this.p.createGraphics(this.p.width, this.p.height)
		this.p.background("green")
	}

	draw() {
		this.p.background("green")
		this.p.push()
		this.p.translate(this.p.width / 2, this.p.height / 2)
		this.p.scale(this.cameraZoom)
		this.p.translate(this.cameraOffsetX, this.cameraOffsetY)
		switch (phase) {
			case "setStart":

				this.p.push();
				// this.p.fill("green")
				// this.p.rect(0, 0, this.p.width, this.p.height)
				this.p.fill("black")
				this.p.noStroke()
				this.p.rect((this.p.mouseX - this.p.width / 2) / this.cameraZoom - trackWidth / 2, (this.p.mouseY - this.p.height / 2) / this.cameraZoom - trackWidth / 2, trackWidth, trackWidth)
				this.p.pop();
				// this.p.image(this.renderTrack, 0, 0)
				break

			case "rotateStart":

				this.p.push()
				// this.p.fill("green")
				// this.p.rect(0, 0, this.p.width, this.p.height)
				this.p.translate(this.start.x, this.start.y)
				this.p.rotate(Math.atan2((this.p.mouseY - this.p.height / 2) / this.cameraZoom - this.start.y, (this.p.mouseX - this.p.width / 2) / this.cameraZoom - this.start.x))
				this.p.fill("black")
				this.p.rect(-trackWidth / 2, -trackWidth / 2, trackWidth, trackWidth)
				this.p.stroke("white")
				this.p.line(-trackWidth / 2, -trackWidth / 2, trackWidth / 2, -trackWidth / 2)
				this.p.line(-trackWidth / 2, +trackWidth / 2, trackWidth / 2, +trackWidth / 2)
				this.p.pop()
				// this.p.image(this.renderTrack, 0, 0)
				break

			case "buildTrack":

				this.p.background("green")
				this.track.draw(this.p, this.p)
				// this.p.image(this.renderTrack, 0, 0)
				if (this.showGrid == true) { this.p.image(this.grid, 0, 0) }
				break

			case "setup":

				this.track.draw(this.p, this.p)
				// for (let i = 0; i < individuals; i++) {
				// 	population[i] = new Car(start.x, start.y, direction)
				// }
				this.population = Array.from({ length: individuals }, () => {
					const car = new Car(this.start.x, this.start.y, this.direction)
					console.log(car)
					return car
				})

				player = new Car(this.start.x, this.start.y, this.direction)

				this.setPhase("running")
				break

			case "running":

				// Shows the track
				// this.p.image(this.renderTrack, 0, 0)
				this.track.draw(this.p, this.p)

				// or the AI detection map
				if (this.showMap == true) { this.p.image(this.renderMap, 0, 0) }

				const currentTime = Date.now()
				const shouldMakeDecision = currentTime - this.lastDecisionTime >= 1000 / this.decisionsPerSecond
				if (shouldMakeDecision) {
					this.lastDecisionTime = currentTime
				}

				// Updates each individual
				this.population.forEach((individual) => {
					// if (shouldMakeDecision) {
					const inputs = individual.getInputs(this.trackMap, false, this.p, this.resolution, this.track)
					individual.drive(individual.neuralNet.output(inputs))
					// }
					individual.update(this.trackMap, this.resolution, this.track)
				})

				switch (this.showInputs) {
					case "all":
						this.population.forEach(car => car.showInputs(this.p))
						break
					case "best":
						if (this.population.length > 0)
							this.population[0].showInputs(this.p)
						break
				}

				for (const car of this.population) {
					car.show(this.p, carSprite)
				}

				// Follow best car camera logic
				if (this.followBestCar && this.population.length > 0 && !playerDrive) {
					const bestCar = this.population[0] // Population is sorted during breeding, so [0] is the best
					// Center camera on the best car
					this.cameraOffsetX = -bestCar.pos.x
					this.cameraOffsetY = -bestCar.pos.y
				}

				// Allows the player to drive a car
				if (playerDrive) {
					// getUserInput()
					this.cameraOffsetX = -player.pos.x
					this.cameraOffsetY = -player.pos.y
					// player.update()
					// player.show()
				}

				// Draws the graph data

				const everyCarIsStopped = this.population.every(car => car.speed < 0.01)
				if (everyCarIsStopped && this.ticks > 10) {
					phase = "breeding"
				}

				this.ticks++
				if (this.ticks >= this.maxTicks) {
					phase = "breeding"
				}

				break
			case "breeding":

				// Shows the track
				// this.p.image(this.renderTrack, 0, 0)
				this.track.draw(this.p, this.p)

				// Sort the population by fitness
				this.population.sort(function (a, b) { return b.neuralNet.fitness - a.neuralNet.fitness })

				if (this.population[0].speed > 0.01) {
					console.log("Best car is still moving, next generation will have more time to run")
					// add some extra frames cause the best car hasn't actually stopped but just got very slow, so we give it some extra time to see if it can get unstuck and keep going
					this.maxTicks += 100
				}

				// And stores data into the data logging arrays
				maxFitness.push(this.population[0].neuralNet.fitness)

				const avgFitnessGen = this.population.reduce((sum, individual) => sum + individual.neuralNet.fitness, 0) / this.population.length
				avgFitness.push(avgFitnessGen)

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
				switch (breedingMethod) {
					case 'pair': {
						for (let i = 0; i < offspring; i++) {
							const newCar = new Car(this.start.x, this.start.y, this.direction, this.generation + 1)
							newCar.neuralNet = NeuralNet.breed(this.population[2 * i].neuralNet, this.population[2 * i + 1].neuralNet)
							this.population[individuals - 1 - i] = newCar
						}
						break
					}
					case 'elite': {
						const offspring: Car[] = []
						for (let i = 0; i < eliteSize; i++) {
							for (let j = i + 1; j < eliteSize; j++) {
								const newCar = new Car(this.start.x, this.start.y, this.direction, this.generation + 1)
								newCar.neuralNet = NeuralNet.breed(this.population[i].neuralNet, this.population[j].neuralNet)
								offspring.push(newCar)
							}
						}
						// replace the worst individuals with the offspring
						for (let i = 0; i < offspring.length && i < individuals; i++) {
							this.population[individuals - 1 - i] = offspring[i]
						}
						break
					}
					case 'clone': {
						for (let i = 0; i < offspring; i++) {
							const newCar = new Car(this.start.x, this.start.y, this.direction, this.generation + 1)
							newCar.neuralNet = this.population[i].neuralNet.copy()
							newCar.neuralNet.mutate()
							this.population[individuals - 1 - i] = newCar
						}
						break
					}
				}


				let startingPoint = this.start
				let startingDirection = this.direction
				if (this.cycleStartPoint !== 'off') {
					let newStartPiece
					while (!newStartPiece) {
						if (this.cycleStartPoint === 'sequential') {
							this.startPointIndex = (this.startPointIndex + 1) % this.track.pieces.length
						} else if (this.cycleStartPoint === 'random') {
							this.startPointIndex = Math.floor(Math.random() * this.track.pieces.length)
						}
						const startPieceCandidate = this.track.pieces[this.startPointIndex]
						// if it's an arc and the radius is too small, skip it because the cars would just crash immediately and not learn anything
						if (startPieceCandidate.type === TrackPieceType.Arc) {
							const radius = Vector.sub(startPieceCandidate.center, startPieceCandidate.start).mag()
							if (radius < trackWidth)
								continue
						}
						newStartPiece = startPieceCandidate
					}
					startingPoint = newStartPiece.start
					startingDirection = Track.getTrackPieceStartDirection(newStartPiece)
				}

				// Resets every individual's car
				for (const individual of this.population) {
					const pointFromRadius = Math.sqrt(Math.random())
					const radius = pointFromRadius * trackWidth / 4
					const angle = Math.random() * 2 * Math.PI
					const initialPosition = new Vector(startingPoint.x + radius * Math.cos(angle), startingPoint.y + radius * Math.sin(angle))
					individual.pos = initialPosition
					// individual.pos = new Vector(startingPoint.x + (Math.random() - 0.5) * trackWidth / 2, startingPoint.y + (Math.random() - 0.5) * trackWidth / 2)
					individual.speed = 0
					individual.direction = startingDirection
					individual.acceleration = 0
					individual.neuralNet.resetFitness()
				}

				if (playerDrive) {
					// Resets player's car
					player.pos = new Vector(this.start.x, this.start.y)
					player.speed = 0
					player.direction = this.direction
				}

				this.ticks = 0
				this.generation++
				//console.log("Current generation: " + this.generation)

				phase = "running"
				break
		}

		this.p.pop()

		// Draw UI overlay (not affected by camera transform)
		this.drawUI()
	}

	mouseClicked() {

		switch (phase) {
			case "resetTrack":
				phase = "setStart"
				break
			case "setStart":
				this.start = newVector((this.p.mouseX - this.p.width / 2) / this.cameraZoom, (this.p.mouseY - this.p.height / 2) / this.cameraZoom)
				this.track.startingPoint = this.start
				phase = "rotateStart"
				break
			case "rotateStart":
				this.direction = Math.atan2((this.p.mouseY - this.p.height / 2) / this.cameraZoom - this.start.y, (this.p.mouseX - this.p.width / 2) / this.cameraZoom - this.start.x)
				phase = "buildTrack"
				this.track.startingDirection = this.direction

				this.currentDirection = this.direction
				this.currentPosition = newVector(this.start.x + trackWidth * Math.cos(this.direction) / 2, this.start.y + trackWidth * Math.sin(this.direction) / 2)
				this.p.circle(this.currentPosition.x, this.currentPosition.y, 5)

				createGrid(this.grid, this.start, this.direction, trackWidth, this.p)
				createTrackBuilder(this.p, this.currentPosition, this.currentDirection, trackWidth, this.renderTrack, this.trackMap, this.renderMap, this.resolution, this, this.track)

				break
		}

	}

	private drawUI() {
		// Controls help panel
		this.p.fill(0, 0, 0, 150)
		this.p.noStroke()
		this.p.rect(10, 10, 250, 140)

		this.p.fill(255)
		this.p.textAlign(this.p.LEFT)
		this.p.textSize(12)
		this.p.text("Controls:", 20, 30)
		this.p.text("F - Toggle follow best car", 20, 50)
		this.p.text("S - Toggle sensor inputs", 20, 65)
		this.p.text("M - Toggle track map", 20, 80)
		this.p.text("G - Toggle graphs", 20, 95)
		this.p.text("Ctrl+S - Save game", 20, 110)
		this.p.text("Ctrl+L - Load game", 20, 125)
		this.p.text(`Generation: ${this.generation}`, 20, 140)

		if (this.drawGraphs) {
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
	}

	private previousMouseX = 0
	private previousMouseY = 0
	private cameraOffsetX = 0
	private cameraOffsetY = 0
	private cameraZoom = 1

	mousePressed() {
		this.previousMouseX = this.p.mouseX
		this.previousMouseY = this.p.mouseY
	}

	mouseDragged() {
		console.log("dragging")
		switch (phase) {
			case "buildTrack":
			case "running":
				// move camera around
				this.cameraOffsetX += (this.p.mouseX - this.previousMouseX) / this.cameraZoom
				this.cameraOffsetY += (this.p.mouseY - this.previousMouseY) / this.cameraZoom
				this.previousMouseX = this.p.mouseX
				this.previousMouseY = this.p.mouseY
				break
		}
	}

	mouseWheel(event: any) {
		// Zoom in/out
		this.cameraZoom += event.delta * -0.001;
		this.cameraZoom = Math.min(Math.max(this.cameraZoom, 0.1), 5);
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

	keyPressed() {
		switch (this.p.key) {
			case 'f':
			case 'F':
				// Toggle follow best car
				this.followBestCar = !this.followBestCar
				console.log(`Follow best car: ${this.followBestCar ? 'ON' : 'OFF'}`)
				break
			case 's':
			case 'S':
				// Check if Ctrl is held for save, otherwise toggle show inputs
				if (this.p.keyIsDown(this.p.CONTROL)) {
					this.saveGame();
				} else {
					this.showInputs = !this.showInputs;
				}
				break
			case 'l':
			case 'L':
				// Load game (Ctrl+L)
				// if (this.p.keyIsDown(this.p.CONTROL)) {
				this.loadGame();
				// }
				break
			case 'm':
			case 'M':
				// Toggle show map
				this.showMap = !this.showMap
				break
			case 'g':
			case 'G':
				// Toggle show graphs
				this.drawGraphs = !this.drawGraphs
				break
		}
	}

	// Save game functionality
	saveGame() {
		const saveData = {
			version: "1.0",
			timestamp: new Date().toISOString(),
			track: this.track.exportData(),
			game: {
				generation: this.generation,
				ticks: this.ticks,
				maxTicks: this.maxTicks
			},
			population: this.population.map(car => ({
				NN: car.neuralNet.exportData(),
				generation: car.generation,
				position: { x: car.pos.x, y: car.pos.y },
				speed: car.speed,
				direction: car.direction,
				acceleration: car.acceleration,
				paintRGB: car.paintRGB
			}))
		};

		// Create and trigger download
		const dataStr = JSON.stringify(saveData, null, 2);
		const dataBlob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(dataBlob);

		const link = document.createElement('a');
		link.href = url;
		link.download = `smartrace_save_gen${this.generation}_${Date.now()}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		console.log(`Game saved! Generation: ${this.generation}`);
	}

	// Load game functionality
	loadGame() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = (event) => {
			const file = (event.target as HTMLInputElement).files?.[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = (e) => {
					try {
						const saveData = JSON.parse(e.target?.result as string);
						this.restoreGameState(saveData);
						console.log(`Game loaded! Generation: ${this.generation}`);
					} catch (error) {
						console.error('Error loading save file:', error);
						alert('Error loading save file. Please check the file format.');
					}
				};
				reader.readAsText(file);
			}
		};
		input.click();
	}

	private restoreGameState(saveData: any) {
		// Restore track
		this.track = Track.fromData(saveData.track);

		// Regenerate track graphics
		this.renderTrack.push();
		this.renderTrack.fill("green");
		this.renderTrack.rect(0, 0, this.p.width, this.p.height);
		this.renderTrack.pop();
		this.track.draw(this.p, this.p);

		// Restore game state
		this.generation = saveData.game.generation;
		this.ticks = saveData.game.ticks;
		this.maxTicks = saveData.game.maxTicks;

		// Restore population
		this.population = saveData.population.map((carData: any) => {
			const car = new Car(carData.position.x, carData.position.y, carData.direction, carData.generation);
			car.neuralNet = NeuralNet.fromData(carData.NN);
			car.generation = carData.generation;
			car.speed = carData.speed;
			car.acceleration = carData.acceleration;
			car.paintRGB = carData.paintRGB;
			return car;
		});

		// Update start position from track
		this.start = this.track.startingPoint;
		this.direction = this.track.startingDirection;

		// Set phase to running
		this.setPhase("running");
	}
}

window.game = new Game()
window.letPlayerDrive = function (letPlayerDrive = true) {
	playerDrive = letPlayerDrive
}

// console.log('Large weights (>1.5):', game.population.reduce((sum, car) => { return sum + [...car.neuralNet.weightMatrices.flat().flat(), ...car.neuralNet.biasMatrices.flat().flat()].filter(w => Math.abs(w) > 1.5).length }, 0));
