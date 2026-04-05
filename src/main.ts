
import p5 from 'p5';
import { createTrackBuilder, setTrack } from "./ui/trackBuilder"
import { newVector, Vector } from './Vector';
import Car from './Car';
import { NeuralNet } from './NeuralNet';
import Track, { TrackPieceType } from './Track';
import { tooltip } from './utils/tooltip';
import { buildMainMenu } from './ui/mainMenu';
import { buildGameMenu } from './ui/gameMenu';
//---------- SMART RACE 2 ----------

// Important objects
let carSprite: p5.Image


// Defines the current state of the simulator (setStart is the first one)
// let phase = "generateTrack"
let phase = "menu"

// Defines the width of the race track
const trackWidth = 120


// Simulation settings
var averageFrameRate
var frameRecord = []
var avgDeltaTime = 1 / 60 // 0.016807703080427727

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


export default class Game {

	// Will the player be allowed to drive a car?
	playerDrive = false
	player: Car

	private p: p5
	private canvas: p5.Renderer

	private _gameMenu: p5.Element | null = null
	get gameMenu() {
		return this._gameMenu
	}
	set gameMenu(menu: p5.Element | null) {
		if (this._gameMenu) {
			this._gameMenu.remove()
		}
		this._gameMenu = menu
	}

	backgroundImage: p5.Image
	referenceImage: p5.Image | null = null
	referenceImageScale: number = 1
	referenceImageOpacity: number = 0.5
	private referenceImageButton: p5.Element | null = null
	renderTrack: p5.Graphics
	renderCars: p5.Graphics

	grid: p5.Graphics

	trackMap: number[][]
	renderMap: p5.Graphics

	track = new Track()
	population: Car[] = []

	followBestCar: 'off' | 'best' | 'bestActive' = 'off'

	private readonly decisionsPerSecond = 10
	private lastDecisionTime = 0

	// Track building
	direction: number //of the starting track
	start: Vector // starting position of the cars
	private currentPosition: Vector //of the last section of the current track
	private currentDirection: number //of the next track segment

	// Simulation settings
	/**
	 * If true, the simulator will add some extra ticks to the maxTicks if the best car is still running at the end of the generation. 
	 * This allows the best car to keep running and potentially get unstuck if it got stuck just before the maxTicks was reached, which can help it learn better and achieve higher fitness in the long run.
	 */
	increaseMaxTicksIfBestCarIsRunning = true

	// Graphic overlays
	private showGrid = true // Shows grid when building the track
	private showMap = false // Shows collision map during runtime
	public showInputs: "none" | "all" | "best" | "bestActive" = "none" // Shows the sensor inputs of the cars during runtime. "all" shows for all cars, "best" only for the best car, and "none" for none.
	public drawGraphs = false
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
		const options = ["none", "all", "best", "bestActive"] as const
		const currentIndex = options.indexOf(this.showInputs)
		const nextIndex = (currentIndex + 1) % options.length
		this.showInputs = options[nextIndex]
		return this.showInputs
	}
	toggleFollowBestCar() {
		const options = ['off', 'best', 'bestActive'] as const
		const currentIndex = options.indexOf(this.followBestCar)
		const nextIndex = (currentIndex + 1) % options.length
		this.followBestCar = options[nextIndex]
		return this.followBestCar
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

			p.mouseClicked = (e) => {
				console.log('Mouse clicked:', e)
				// if CTRL is pressed, we don't want to trigger mouseClicked because the user is probably trying to save or load the game, so we check if CTRL is pressed and if the click is on the canvas before triggering mouseClicked
				if (e?.ctrlKey) {
					return
				}


				if (e?.target === this.canvas.elt) {
					this.mouseClicked()
				}
			}

			p.mousePressed = (e) => {
				console.log('Mouse pressed:', e)
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
				// Update reference image button position
				if (this.referenceImageButton) {
					this.referenceImageButton.position(20, this.p.height)
				}
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
		this.backgroundImage = this.p.loadImage("./images/grass.jpg")
		//carSprite = loadImage("car.png")
		// carSprite = this.p.loadImage("https://raw.githubusercontent.com/Vtchoo/smartRace2/master/images/car.png")
	}

	setup() {

		// Create canvas
		this.canvas = this.p.createCanvas(window.innerWidth, window.innerHeight)
		this.renderTrack = this.p.createGraphics(this.p.width, this.p.height)
		this.renderCars = this.p.createGraphics(this.p.width, this.p.height)
		this.grid = this.p.createGraphics(this.p.width, this.p.height)

		buildMainMenu(this, this.p)
	}

	convertMousePositionToWorldCoordinates(mouseX: number, mouseY: number) {
		const worldX = (mouseX - this.p.width / 2) / this.cameraZoom - this.cameraOffsetX
		const worldY = (mouseY - this.p.height / 2) / this.cameraZoom - this.cameraOffsetY
		return { x: worldX, y: worldY }
	}

	getViewportBounds() {
		const min = this.convertMousePositionToWorldCoordinates(0, 0)
		const max = this.convertMousePositionToWorldCoordinates(this.p.width, this.p.height)
		return { min, max }
	}

	draw() {
		this.p.push()
		this.p.translate(this.p.width / 2, this.p.height / 2)
		this.p.scale(this.cameraZoom)
		this.p.translate(this.cameraOffsetX, this.cameraOffsetY)

		// Draw tiled background that covers the visible area
		this.drawTiledBackground()
		if (this.referenceImage)
			this.drawReferenceImage()

		switch (phase) {
			case "setStart": {

				this.p.push();
				// this.p.fill("green")
				// this.p.rect(0, 0, this.p.width, this.p.height)
				this.p.fill("black")
				this.p.noStroke()
				const { x: rectangleCenterX, y: rectangleCenterY } = this.convertMousePositionToWorldCoordinates(this.p.mouseX, this.p.mouseY)
				// const rectangleCenterX = (this.p.mouseX - this.p.width / 2 + this.cameraOffsetX * this.cameraZoom)
				// const rectangleCenterY = (this.p.mouseY - this.p.height / 2 + this.cameraOffsetY * this.cameraZoom)
				this.p.rect(rectangleCenterX - trackWidth / 2, rectangleCenterY - trackWidth / 2, trackWidth, trackWidth)
				this.p.pop();
				// this.p.image(this.renderTrack, 0, 0)
				break
			}
			case "rotateStart": {

				this.p.push()
				// this.p.fill("green")
				// this.p.rect(0, 0, this.p.width, this.p.height)
				this.p.translate(this.start.x, this.start.y)
				const { x: mouseWorldX, y: mouseWorldY } = this.convertMousePositionToWorldCoordinates(this.p.mouseX, this.p.mouseY)
				this.p.rotate(Math.atan2(mouseWorldY - this.start.y, mouseWorldX - this.start.x))
				this.p.fill("black")
				this.p.rect(-trackWidth / 2, -trackWidth / 2, trackWidth, trackWidth)
				this.p.stroke("white")
				this.p.line(-trackWidth / 2, -trackWidth / 2, trackWidth / 2, -trackWidth / 2)
				this.p.line(-trackWidth / 2, +trackWidth / 2, trackWidth / 2, +trackWidth / 2)
				this.p.pop()
				// this.p.image(this.renderTrack, 0, 0)
				break
			}
			case "buildTrack": {

				this.track.draw(this.p)
				// this.p.image(this.renderTrack, 0, 0)
				if (this.showGrid == true) { this.p.image(this.grid, 0, 0) }
				break
			}
			case "setup": {

				this.track.draw(this.p)
				// for (let i = 0; i < individuals; i++) {
				// 	population[i] = new Car(start.x, start.y, direction)
				// }
				this.population = Array.from({ length: individuals }, () => {
					const car = new Car(this.start.x, this.start.y, this.direction)
					console.log(car)
					return car
				})

				this.player = new Car(this.start.x, this.start.y, this.direction)

				this.setPhase("running")
				break
			}
			case "running": {

				// Shows the track
				// this.p.image(this.renderTrack, 0, 0)
				this.track.draw(this.p)

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

				const bestCar = this.population.reduce((best, car) => car.neuralNet.fitness > best.neuralNet.fitness ? car : best, this.population[0])
				const activeCars = this.population
					.filter(car => car.speed > 0.01)
				const bestActiveCar = activeCars.length ?
					activeCars
						.reduce((best, car) => (car.neuralNet.fitness > best.neuralNet.fitness) ? car : best, activeCars[0])
					: null

				switch (this.showInputs) {
					case "all":
						this.population.forEach(car => car.showInputs(this.p))
						break
					case "best":
						bestCar?.showInputs(this.p)
						break
					case "bestActive":
						bestActiveCar?.showInputs(this.p)
						break
				}

				for (const car of this.population) {
					car.show(this.p, carSprite)
				}

				// Follow best car camera logic
				if (this.followBestCar !== 'off' && this.population.length > 0 && !this.playerDrive) {
					const carToFollow = (this.followBestCar === 'best' || !bestActiveCar) ? bestCar : bestActiveCar
					// Center camera on the best car
					this.cameraOffsetX = -carToFollow.pos.x
					this.cameraOffsetY = -carToFollow.pos.y
				}

				// Allows the player to drive a car
				if (this.playerDrive) {
					this.getUserInput()
					this.cameraOffsetX = -this.player.pos.x
					this.cameraOffsetY = -this.player.pos.y
					this.player.update(this.trackMap, this.resolution, this.track)
					this.player.show(this.p, carSprite)
				}

				// if mouse is over some car, show that car's inputs (only if showInputs is not "all" or "best")
				// and also show a tooltip with the car's fitness and generation
				const mouseWorldX = (this.p.mouseX - this.p.width / 2) / this.cameraZoom - this.cameraOffsetX
				const mouseWorldY = (this.p.mouseY - this.p.height / 2) / this.cameraZoom - this.cameraOffsetY
				for (const car of this.population) {
					if (mouseWorldX > car.pos.x - 10 && mouseWorldX < car.pos.x + 10 && mouseWorldY > car.pos.y - 10 && mouseWorldY < car.pos.y + 10) {
						if (this.showInputs === "none") {
							car.showInputs(this.p)
						}
						const realLifeSpeed = car.speed * 3.6
						tooltip(
							this.p,
							[`Fitness: ${car.neuralNet.fitness.toFixed(2)}`, `Gen: ${car.generation}`, `Speed: ${realLifeSpeed.toFixed(2)} km/h`],
							car.pos.x + 20 / this.cameraZoom,
							car.pos.y + 15 / this.cameraZoom,
							1 / this.cameraZoom
						)
						break
					}
				}

				if (mouseWorldX > this.player.pos.x - 10 && mouseWorldX < this.player.pos.x + 10 && mouseWorldY > this.player.pos.y - 10 && mouseWorldY < this.player.pos.y + 10) {
					const realLifeSpeed = this.player.speed * 3.6
					tooltip(
						this.p,
						[`Player Car`, `Speed: ${realLifeSpeed.toFixed(2)} km/h`],
						this.player.pos.x + 20 / this.cameraZoom,
						this.player.pos.y + 15 / this.cameraZoom,
						1 / this.cameraZoom
					)
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
			}
			case "breeding": {

				// Shows the track
				// this.p.image(this.renderTrack, 0, 0)
				this.track.draw(this.p)

				// Sort the population by fitness
				this.population.sort(function (a, b) { return b.neuralNet.fitness - a.neuralNet.fitness })

				this.population.forEach(car => car.fadeColor())

				if (this.increaseMaxTicksIfBestCarIsRunning && this.population[0].speed > 0.01) {
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
					individual.lastDrivingWheelDirection = 0
					individual.neuralNet.resetFitness()
				}

				if (this.playerDrive) {
					// Resets player's car
					this.player.pos = new Vector(this.start.x, this.start.y)
					this.player.speed = 0
					this.player.direction = this.direction
				}

				this.ticks = 0
				this.generation++
				//console.log("Current generation: " + this.generation)

				phase = "running"
				break
			}
		}

		this.p.pop()

		// Draw UI overlay (not affected by camera transform)
		this.drawUI()
		this.drawPhaseSpecificUI()
	}

	mouseClicked() {

		switch (phase) {
			case "resetTrack":
				phase = "setStart"
				break
			case "setStart":
				// this.start = newVector((this.p.mouseX - this.p.width / 2) / this.cameraZoom, (this.p.mouseY - this.p.height / 2) / this.cameraZoom)
				const { x: worldX, y: worldY } = this.convertMousePositionToWorldCoordinates(this.p.mouseX, this.p.mouseY)
				this.start = newVector(worldX, worldY)
				this.track.startingPoint = this.start
				phase = "rotateStart"
				break
			case "rotateStart":
				const { x: worldX2, y: worldY2 } = this.convertMousePositionToWorldCoordinates(this.p.mouseX, this.p.mouseY)
				this.direction = Math.atan2(worldY2 - this.start.y, worldX2 - this.start.x)
				phase = "buildTrack"
				this.track.startingDirection = this.direction

				this.currentDirection = this.direction
				this.currentPosition = newVector(this.start.x + trackWidth * Math.cos(this.direction) / 2, this.start.y + trackWidth * Math.sin(this.direction) / 2)
				this.p.circle(this.currentPosition.x, this.currentPosition.y, 5)

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

	private drawReferenceImage() {
		if (this.referenceImage && (phase === "setStart" || phase === "rotateStart" || phase === "buildTrack")) {
			this.p.push()
			this.p.tint(255, this.referenceImageOpacity * 255)
			// Draw reference image centered at origin with proper scale
			const scaledWidth = this.referenceImage.width * this.referenceImageScale
			const scaledHeight = this.referenceImage.height * this.referenceImageScale
			this.p.image(this.referenceImage, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight)
			this.p.pop()
		}
	}

	private drawPhaseSpecificUI() {
		if (phase === "menu") {
			// if (!this.referenceImageButton) {
			// 	this.createReferenceImageButton()
			// }
			// // Show reference image button
			// if (this.referenceImageButton) {
			// 	this.referenceImageButton.show()
			// }

			// Show reference image info if loaded
			if (this.referenceImage) {
				this.p.fill(0, 0, 0, 150)
				this.p.noStroke()
				this.p.rect(180, this.p.height - 110, 200, 80)

				this.p.fill(255)
				this.p.textAlign(this.p.LEFT)
				this.p.textSize(12)
				this.p.text("Reference Image Loaded", 190, this.p.height - 90)
				this.p.text(`Scale: ${this.referenceImageScale.toFixed(3)}`, 190, this.p.height - 70)
				this.p.text(`Opacity: ${Math.round(this.referenceImageOpacity * 100)}%`, 190, this.p.height - 50)
				this.p.text("Use +/- to adjust opacity", 190, this.p.height - 35)
				this.p.text("Press R to remove reference", 190, this.p.height - 20)
			}
		}

		if (phase === "setStart") {
			// Hide reference image button in other phases
			if (this.referenceImageButton) {
				this.referenceImageButton.hide()
			}
		}
	}

	private createReferenceImageButton() {
		this.referenceImageButton = this.p.createButton("Load Reference Image")
		// this.referenceImageButton.parent(document.querySelector("canvas")) // Ensure the button is added to the DOM
		this.referenceImageButton.position(20, this.p.height)
		this.referenceImageButton.size(150, 30)
		this.referenceImageButton.mouseClicked(() => {
			this.loadReferenceImage()
		})
	}

	public loadReferenceImage(onLoadCallback?: () => void) {
		// Create file input
		const input = this.p.createFileInput((file: any) => {
			if (file.type === 'image') {
				// Prompt for distance
				const distanceInput = prompt('Enter the distance from top to bottom of the image in meters:')
				if (distanceInput === null) {
					input.remove()
					return
				}

				const distanceMeters = parseFloat(distanceInput)
				if (isNaN(distanceMeters) || distanceMeters <= 0) {
					alert('Please enter a valid positive number for distance')
					input.remove()
					return
				}

				// Load the image
				this.p.loadImage(file.data, (img: p5.Image) => {
					this.referenceImage = img
					// Calculate scale: 1 meter = 10 pixels
					// distanceMeters * 10 pixels/meter = desired height in pixels
					const desiredHeightPixels = distanceMeters * 10
					this.referenceImageScale = desiredHeightPixels / img.height
					console.log(`Reference image loaded: ${img.width}x${img.height}, scaled by ${this.referenceImageScale}`)
					if (onLoadCallback) {
						onLoadCallback()
					}
				}, () => {
					alert('Failed to load image. Please try a different file.')
				})
			} else {
				alert('Please select an image file')
			}
			input.remove()
			this.setPhase("setStart") // Ensure we are in the correct phase to show the reference image after loading
		})

		// Trigger file input
		input.elt.click()
	}

	private drawTiledBackground() {
		if (!this.backgroundImage) return;

		const imageScaling = 1; // Adjust this if you want to scale the background image

		const imgWidth = this.backgroundImage.width * imageScaling;
		const imgHeight = this.backgroundImage.height * imageScaling;

		// Calculate the visible area in world coordinates (considering camera transform)
		const screenWidth = this.p.width;
		const screenHeight = this.p.height;

		// Calculate world bounds visible on screen (accounting for camera transform)
		const worldLeft = (-screenWidth / 2) / this.cameraZoom - this.cameraOffsetX;
		const worldRight = (screenWidth / 2) / this.cameraZoom - this.cameraOffsetX;
		const worldTop = (-screenHeight / 2) / this.cameraZoom - this.cameraOffsetY;
		const worldBottom = (screenHeight / 2) / this.cameraZoom - this.cameraOffsetY;

		// Calculate which tiles we need to draw (with small buffer)
		const startX = Math.floor(worldLeft / imgWidth) - 1;
		const endX = Math.ceil(worldRight / imgWidth) + 1;
		const startY = Math.floor(worldTop / imgHeight) - 1;
		const endY = Math.ceil(worldBottom / imgHeight) + 1;

		// Draw only the visible tiles
		this.p.push()
		this.p.noSmooth()
		for (let x = startX; x <= endX; x++) {
			for (let y = startY; y <= endY; y++) {
				// apply a random rotation to the background image based on the tile coordinates to add some visual variety
				const rotationAngle = ((x * 31 + y * 17) % 4) * (Math.PI / 2); // Rotate in 90 degree increments
				this.p.push()
				this.p.translate(x * imgWidth + imgWidth / 2, y * imgHeight + imgHeight / 2)
				this.p.rotate(rotationAngle)

				this.p.image(this.backgroundImage, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
				this.p.pop()
			}
		}
		this.p.pop()
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
			case "setStart":
				// only move in this phase if CTRL is pressed, otherwise the user is probably trying to move the camera, so we check if CTRL is pressed before allowing the user to move the starting point
				if (this.p.keyIsDown(this.p.CONTROL)) {
					this.cameraOffsetX += (this.p.mouseX - this.previousMouseX) / this.cameraZoom
					this.cameraOffsetY += (this.p.mouseY - this.previousMouseY) / this.cameraZoom
					this.previousMouseX = this.p.mouseX
					this.previousMouseY = this.p.mouseY
				}
				break
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

		this.player.drive(playerinput)

	}

	keyPressed() {
		switch (this.p.key) {
			case 'f':
			case 'F':
				// Toggle follow best car
				const nextMode = this.toggleFollowBestCar()
				console.log(`Follow best car: ${nextMode}`)
				break
			case 's':
			case 'S':
				// Check if Ctrl is held for save, otherwise toggle show inputs
				if (this.p.keyIsDown(this.p.CONTROL)) {
					this.saveGame();
				} else {
					// this.showInputs = this.toggleShowInputs()
					// console.log(`Show inputs: ${this.showInputs}`)
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
			case '=':
			case '+':
				// Increase reference image opacity
				if (this.referenceImage) {
					this.referenceImageOpacity = Math.min(1, this.referenceImageOpacity + 0.1)
					console.log(`Reference image opacity: ${Math.round(this.referenceImageOpacity * 100)}%`)
				}
				break
			case '-':
			case '_':
				// Decrease reference image opacity
				if (this.referenceImage) {
					this.referenceImageOpacity = Math.max(0.1, this.referenceImageOpacity - 0.1)
					console.log(`Reference image opacity: ${Math.round(this.referenceImageOpacity * 100)}%`)
				}
				break
			case 'r':
			case 'R':
				// Remove reference image (only in setStart, rotateStart, or buildTrack phase)
				if ((phase === "setStart" || phase === "rotateStart" || phase === "buildTrack") && this.referenceImage) {
					this.referenceImage = null
					console.log("Reference image removed")
				}
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
				maxTicks: this.maxTicks,
				startPointIndex: this.startPointIndex,
			},
			population: this.population.map(car => ({
				NN: car.neuralNet.exportData(),
				generation: car.generation,
				position: { x: car.pos.x, y: car.pos.y },
				speed: car.speed,
				direction: car.direction,
				acceleration: car.acceleration,
				lastDrivingWheelDirection: car.lastDrivingWheelDirection,
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
	loadGame(onLoadCallback?: () => void) {
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
						this.gameMenu = buildGameMenu(this, this.p)
						if (onLoadCallback) {
							onLoadCallback();
						}
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
		this.track.draw(this.p);

		// Restore game state
		this.generation = saveData.game.generation;
		this.ticks = saveData.game.ticks;
		this.maxTicks = saveData.game.maxTicks;
		this.startPointIndex = saveData.game.startPointIndex;

		// Restore population
		this.population = saveData.population.map((carData: any) => {
			const car = new Car(carData.position.x, carData.position.y, carData.direction, carData.generation);
			car.neuralNet = NeuralNet.fromData(carData.NN);
			car.generation = carData.generation;
			car.speed = carData.speed;
			car.acceleration = carData.acceleration;
			car.paintRGB = carData.paintRGB;
			car.lastDrivingWheelDirection = carData.lastDrivingWheelDirection || 0;
			return car;
		});

		// Update start position from track
		this.start = this.track.startingPoint;
		this.direction = this.track.startingDirection;

		this.player = new Car(this.start.x, this.start.y, this.direction)

		// Set phase to running
		this.setPhase("running");
	}
}

window.game = new Game()
window.letPlayerDrive = function (letPlayerDrive = true) {
	game.playerDrive = letPlayerDrive
}

// console.log('Large weights (>1.5):', game.population.reduce((sum, car) => { return sum + [...car.neuralNet.weightMatrices.flat().flat(), ...car.neuralNet.biasMatrices.flat().flat()].filter(w => Math.abs(w) > 1.5).length }, 0));
