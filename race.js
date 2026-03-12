//---------- SMART RACE 2 ----------

// Important objects
var carSprite

// Will the player be allowed to drive a car?
var playerDrive = false

// Defines the current state of the simulator (menu is the first one)
var phase = "menu"

// Menu and track building variables
var menuButtons = []
var trackBuildMenu = []
var selectedTrackType = ""
var splinePoints = []
var currentSpline = []
var splineBuilding = false
var gridTrackPieces = []
var gridSize = 20
var currentPiece = "straight"
var trackFinished = false

// Grid track piece types
var trackPieces = {
	straight: { length: 1, angle: 0, name: "Straight" },
	diagonal: { length: Math.sqrt(2), angle: 0, name: "Diagonal" },
	curve_small_right: { length: Math.PI/2, angle: Math.PI/2, radius: 1, name: "Small Right" },
	curve_small_left: { length: Math.PI/2, angle: -Math.PI/2, radius: 1, name: "Small Left" },
	curve_medium_right: { length: Math.PI/2, angle: Math.PI/2, radius: 2, name: "Medium Right" },
	curve_medium_left: { length: Math.PI/2, angle: -Math.PI/2, radius: 2, name: "Medium Left" },
	curve_large_right: { length: Math.PI/2, angle: Math.PI/2, radius: 3, name: "Large Right" },
	curve_large_left: { length: Math.PI/2, angle: -Math.PI/2, radius: 3, name: "Large Left" },
	curve_xlarge_right: { length: Math.PI/2, angle: Math.PI/2, radius: 4, name: "X-Large Right" },
	curve_xlarge_left: { length: Math.PI/2, angle: -Math.PI/2, radius: 4, name: "X-Large Left" }
}

// Track building state
var trackBuildingStarted = false
var currentTrackPosition = null
var currentTrackDirection = 0
var placedPieces = []
var selectedPieceType = "straight"
var previewPiece = null

// Defines the width of the race track
const trackWidth = 50

// Graphic overlays
var showGrid = false // Shows grid when building the track
var showMap = false // Shows collision map during runtime
var showInputs = false
const resolution = 3 // Get 1 out of [resolution] pixels to create the track collision map

// Visual settings
const buttonWidth = 60
const buttonHeight = 50

// Track building
var direction //of the starting track
var start // starting position of the cars
var currentPosition //of the last section of the current track
var currentDirection //of the next track segment

// Simulation settings
var ticks = 0
var generation = 0
var maxticks = 500
var averageFrameRate
var frameRecord = []
var avgDeltaTime

// Data logging and graphing
var maxFitness = [0]
var avgFitness = [0]
var maxFitnessNormal = [0]
var avgFitnessNormal = [0]
var drawGraphs = false

// Population settings
var population = []
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




// The simulation itself

function preload() {
	//carSprite = loadImage("./images/car.png")
	//carSprite = loadImage("car.png")
	carSprite = loadImage("https://raw.githubusercontent.com/Vtchoo/smartRace2/master/images/car.png")
}

function setup() {

	// Create canvas
	createCanvas(window.innerWidth, window.innerHeight)
	renderTrack = createGraphics(canvas.width, canvas.height)
	renderCars = createGraphics(canvas.width, canvas.height)
	grid = createGraphics(canvas.width, canvas.height)
	background("green")

	// Set a reduced resolution track map for the sensors of the cars
	trackMap = new Array(Math.floor(canvas.width / resolution));
	for (var i = 0; i < trackMap.length; i++) {
		trackMap[i] = new Array(Math.floor(canvas.height / resolution));
	}
	renderMap = createGraphics(canvas.width, canvas.height)

}

function draw() {

	switch (phase) {
		case "menu":
			background(50, 50, 100)
			fill(255)
			textAlign(CENTER)
			textSize(32)
			text("Smart Race 2", width/2, height/4)
			
			// Build Track button
			fill(100, 150, 200)
			rect(width/2 - 100, height/2 - 25, 200, 50)
			fill(255)
			textSize(20)
			text("Build Track", width/2, height/2 + 5)
			break

		case "trackBuildMenu":
			background(50, 50, 100)
			fill(255)
			textAlign(CENTER)
			textSize(24)
			text("Choose Track Type", width/2, height/4)
			
			// Random Track button
			fill(100, 150, 200)
			rect(width/2 - 100, height/2 - 80, 200, 40)
			fill(255)
			textSize(16)
			text("Random (Perlin Noise)", width/2, height/2 - 60)
			
			// Grid Track button
			fill(100, 150, 200)
			rect(width/2 - 100, height/2 - 30, 200, 40)
			fill(255)
			text("Grid Builder", width/2, height/2 - 10)
			
			// Spline Track button
			fill(100, 150, 200)
			rect(width/2 - 100, height/2 + 20, 200, 40)
			fill(255)
			text("Spline Builder", width/2, height/2 + 40)
			
			// Back button
			fill(150, 100, 100)
			rect(width/2 - 50, height/2 + 80, 100, 30)
			fill(255)
			textSize(14)
			text("Back", width/2, height/2 + 100)
			break

		case "gridBuilder":
			background("green")
			drawGrid()
			drawPlacedPieces()
			drawPreviewPiece()
			drawPiecePalette()
			drawGridInstructions()
			break

		case "splineBuilder":
			background("green")
			drawSplines()
			drawSplineUI()
			break

		case "setStart":

			renderTrack.push();
			renderTrack.fill("green")
			renderTrack.rect(0, 0, canvas.width, canvas.height)
			renderTrack.fill("black")
			renderTrack.noStroke()
			renderTrack.rect(mouseX - trackWidth / 2, mouseY - trackWidth / 2, trackWidth, trackWidth)
			renderTrack.pop();
			image(renderTrack, 0, 0)
			break

		case "rotateStart":

			renderTrack.push()
			renderTrack.fill("green")
			renderTrack.rect(0, 0, canvas.width, canvas.height)
			renderTrack.translate(start.x, start.y)
			renderTrack.rotate(atan2(mouseY - start.y, mouseX - start.x))
			renderTrack.fill("black")
			renderTrack.rect(-trackWidth / 2, -trackWidth / 2, trackWidth, trackWidth)
			renderTrack.stroke("white")
			renderTrack.line(-trackWidth / 2, -trackWidth / 2, trackWidth / 2, -trackWidth / 2)
			renderTrack.line(-trackWidth / 2, +trackWidth / 2, trackWidth / 2, +trackWidth / 2)
			renderTrack.pop()
			image(renderTrack, 0, 0)
			break

		case "generateTrack":

			start = newVector(canvas.width / 2, canvas.height / 2)
			direction = PI

			renderTrack.push()
			renderTrack.fill("green")
			renderTrack.rect(0, 0, canvas.width, canvas.height)

			var a = .5 * canvas.width - trackWidth / 2
			var b = .5 * canvas.height - trackWidth / 2

			let startRadius = sqrt(noise(2 + cos(0), 2 + sin(0)))
			start = newVector(
				canvas.width / 2 + a * startRadius * cos(HALF_PI),
				canvas.height / 2 + b * startRadius * sin(HALF_PI)
			)

			// Draws white line
			for (let i = 0; i < 360; i++) {

				let angle = i / 360 * TWO_PI
				let nextAngle = (i + 1) / 360 * TWO_PI
				let radius = sqrt(noise(2 + cos(angle), 2 + sin(angle)))
				let nextRadius = sqrt(noise(2 + cos(nextAngle), 2 + sin(nextAngle)))

				renderTrack.stroke("white")
				renderTrack.strokeWeight(trackWidth + 2)
				renderTrack.line(
					canvas.width / 2 + a * radius * cos(angle + HALF_PI),
					canvas.height / 2 + b * radius * sin(angle + HALF_PI),
					canvas.width / 2 + a * nextRadius * cos(nextAngle + HALF_PI),
					canvas.height / 2 + b * nextRadius * sin(nextAngle + HALF_PI)
				)

			}

			// Draws asphalt
			for (let i = 0; i < 360; i++) {

				let angle = i / 360 * TWO_PI
				let nextAngle = (i + 1) / 360 * TWO_PI
				let radius = sqrt(noise(2 + cos(angle), 2 + sin(angle)))
				let nextRadius = sqrt(noise(2 + cos(nextAngle), 2 + sin(nextAngle)))

				renderTrack.stroke("black")
				renderTrack.strokeWeight(trackWidth)
				renderTrack.line(
					canvas.width / 2 + a * radius * cos(angle + HALF_PI),
					canvas.height / 2 + b * radius * sin(angle + HALF_PI),
					canvas.width / 2 + a * nextRadius * cos(nextAngle + HALF_PI),
					canvas.height / 2 + b * nextRadius * sin(nextAngle + HALF_PI)
				)

			}
			renderTrack.pop()
			image(renderTrack, 0, 0)

			setTrack()
			phase = "setup"
			break

		case "buildTrack":

			background("green")
			image(renderTrack, 0, 0)
			if (showGrid == true) { image(grid, 0, 0) }
			break

		case "setup":

			for (let i = 0; i < individuals; i++) {
				population[i] = new Car(start.x, start.y, direction)
			}

			player = new Car(start.x, start.y, direction)

			phase = "running"
			break
		case "running":

			if (generation == 0) {
				frameRecord.push(frameRate())
				averageFrameRate = 0
				for (let h = 0; h < frameRecord.length; h++) {
					averageFrameRate += frameRecord[h]
				}
				averageFrameRate = averageFrameRate / frameRecord.length
				avgDeltaTime = 1 / averageFrameRate
			}

			// Shows the track
			image(renderTrack, 0, 0)

			// or the AI detection map
			if (showMap == true) { image(renderMap, 0, 0) }

			// Updates each individual
			population.forEach(function (individual) {
				individual.drive(individual.NN.output(individual.getInputs()))
				individual.update()
				individual.show()
				individual.NN.addfitness(individual.speed)
			})

			// Allows the player to drive a car
			if (playerDrive == true) {
				getUserInput()
				player.update()
				player.show()
			}

			// Draws the graph data
			if (drawGraphs) {
				if (maxFitness.length > 1) {
					let maxWidth = canvas.width / 1.5
					let interval = maxWidth / (maxFitness.length - 1)
					let maxHeight = canvas.height / 3
					for (let i = 0; i < maxFitness.length; i++) {
						push()
						stroke("blue")
						line(
							canvas.width - maxWidth + i * interval,
							canvas.height - maxHeight * maxFitnessNormal[i],
							canvas.width - maxWidth + (i + 1) * interval,
							canvas.height - maxHeight * maxFitnessNormal[i + 1]
						)
						stroke("yellow")
						line(
							canvas.width - maxWidth + i * interval,
							canvas.height - maxHeight * avgFitnessNormal[i],
							canvas.width - maxWidth + (i + 1) * interval,
							canvas.height - maxHeight * avgFitnessNormal[i + 1]
						)
						pop()
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
				population[individuals - 1 - i].NN = breed(population[2 * i].NN, population[2 * i + 1].NN)
				population[individuals - 1 - i].generation = generation + 1
			}

			// Resets every individual's car
			population.forEach(function (individual) {
				individual.pos = newVector(start.x + Math.random(), start.y + Math.random())
				individual.speed = 0
				individual.direction = direction
				individual.acceleration = 0
				individual.NN.resetfitness()
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

function mouseClicked() {
	switch (phase) {
		case "menu":
			// Build Track button
			if (mouseX > width/2 - 100 && mouseX < width/2 + 100 && 
			    mouseY > height/2 - 25 && mouseY < height/2 + 25) {
				phase = "trackBuildMenu"
			}
			break
			
		case "trackBuildMenu":
			// Random Track button
			if (mouseX > width/2 - 100 && mouseX < width/2 + 100 && 
			    mouseY > height/2 - 80 && mouseY < height/2 - 40) {
				selectedTrackType = "random"
				phase = "generateTrack"
			}
			// Grid Track button
			else if (mouseX > width/2 - 100 && mouseX < width/2 + 100 && 
					 mouseY > height/2 - 30 && mouseY < height/2 + 10) {
				selectedTrackType = "grid"
				initializeGridBuilder()
				phase = "gridBuilder"
			}
			// Spline Track button
			else if (mouseX > width/2 - 100 && mouseX < width/2 + 100 && 
					 mouseY > height/2 + 20 && mouseY < height/2 + 60) {
				selectedTrackType = "spline"
				initializeSplineBuilder()
				phase = "splineBuilder"
			}
			// Back button
			else if (mouseX > width/2 - 50 && mouseX < width/2 + 50 && 
					 mouseY > height/2 + 80 && mouseY < height/2 + 110) {
				phase = "menu"
			}
			break
			
		case "gridBuilder":
			handleGridBuilderClick()
			break
			
		case "splineBuilder":
			handleSplineBuilderClick()
			break
			
		case "resetTrack":
			phase = "setStart"
			break
		case "setStart":
			start = newVector(mouseX, mouseY)
			phase = "rotateStart"
			break
		case "rotateStart":
			direction = Math.atan2(mouseY - start.y, mouseX - start.x)
			phase = "buildTrack"

			currentDirection = direction
			currentPosition = newVector(start.x + trackWidth * Math.cos(direction) / 2, start.y + trackWidth * Math.sin(direction) / 2)
			circle(currentPosition.x, currentPosition.y, 5)

			createTrackBuilder()
			createGrid()
			break
	}
}

function getUserInput() {

	var playerinput = []

	if (keyIsDown(87)) {
		playerinput[0] = 1
	} else if (keyIsDown(83)) {
		playerinput[0] = -1
	} else {
		playerinput[0] = 0
	}

	if (keyIsDown(65)) {
		playerinput[1] = -1
	} else if (keyIsDown(68)) {
		playerinput[1] = 1
	} else {
		playerinput[1] = 0
	}

	player.drive(playerinput)
}

// Grid Builder Functions
function initializeGridBuilder() {
	trackBuildingStarted = false
	currentTrackPosition = null
	currentTrackDirection = 0
	placedPieces = []
	selectedPieceType = "straight"
	previewPiece = null
	gridSize = 30
}

function drawGrid() {
	stroke(100, 150, 100)
	strokeWeight(1)
	
	// Draw vertical lines
	for (let x = 0; x <= width; x += gridSize) {
		line(x, 0, x, height)
	}
	
	// Draw horizontal lines  
	for (let y = 0; y <= height; y += gridSize) {
		line(0, y, width, y)
	}
}

function drawPlacedPieces() {
	stroke(255, 255, 255)
	strokeWeight(trackWidth)
	
	for (let piece of placedPieces) {
		drawTrackPiece(piece)
	}
	
	// Draw asphalt
	stroke(0)
	strokeWeight(trackWidth - 4)
	
	for (let piece of placedPieces) {
		drawTrackPiece(piece)
	}
}

function drawTrackPiece(piece) {
	let startX = piece.startPos.x
	let startY = piece.startPos.y
	let endX = piece.endPos.x
	let endY = piece.endPos.y
	
	if (piece.type.includes("curve")) {
		// Draw curved piece using bezier curves for smooth appearance
		let controlOffset = piece.type.radius * gridSize * 0.5
		let midX = (startX + endX) / 2
		let midY = (startY + endY) / 2
		
		if (piece.type.includes("right")) {
			midX += controlOffset * Math.cos(piece.startDirection + Math.PI/2)
			midY += controlOffset * Math.sin(piece.startDirection + Math.PI/2)
		} else {
			midX += controlOffset * Math.cos(piece.startDirection - Math.PI/2)
			midY += controlOffset * Math.sin(piece.startDirection - Math.PI/2)
		}
		
		noFill()
		bezier(startX, startY, midX, midY, midX, midY, endX, endY)
	} else {
		line(startX, startY, endX, endY)
	}
}

function drawPreviewPiece() {
	if (!trackBuildingStarted || !currentTrackPosition) return
	
	let nextPos = calculateNextPiecePosition()
	if (!nextPos) return
	
	stroke(255, 255, 0, 150)
	strokeWeight(trackWidth - 2)
	
	let piece = {
		type: trackPieces[selectedPieceType],
		startPos: currentTrackPosition,
		endPos: nextPos.position,
		startDirection: currentTrackDirection
	}
	
	drawTrackPiece(piece)
}

function calculateNextPiecePosition() {
	let piece = trackPieces[selectedPieceType]
	if (!piece) return null
	
	let endX, endY, endDirection
	
	if (selectedPieceType === "straight") {
		endX = currentTrackPosition.x + gridSize * Math.cos(currentTrackDirection)
		endY = currentTrackPosition.y + gridSize * Math.sin(currentTrackDirection)
		endDirection = currentTrackDirection
	} else if (selectedPieceType === "diagonal") {
		endX = currentTrackPosition.x + gridSize * Math.sqrt(2) * Math.cos(currentTrackDirection)
		endY = currentTrackPosition.y + gridSize * Math.sqrt(2) * Math.sin(currentTrackDirection)
		endDirection = currentTrackDirection
	} else if (selectedPieceType.includes("curve")) {
		let radius = piece.radius * gridSize
		let angle = piece.angle
		
		// Calculate curve end position
		let centerX = currentTrackPosition.x + radius * Math.cos(currentTrackDirection + Math.PI/2)
		let centerY = currentTrackPosition.y + radius * Math.sin(currentTrackDirection + Math.PI/2)
		
		if (selectedPieceType.includes("left")) {
			centerX = currentTrackPosition.x + radius * Math.cos(currentTrackDirection - Math.PI/2)
			centerY = currentTrackPosition.y + radius * Math.sin(currentTrackDirection - Math.PI/2)
		}
		
		endX = centerX + radius * Math.cos(currentTrackDirection + angle + Math.PI)
		endY = centerY + radius * Math.sin(currentTrackDirection + angle + Math.PI)
		endDirection = currentTrackDirection + angle
	}
	
	return {
		position: newVector(endX, endY),
		direction: endDirection
	}
}

function drawPiecePalette() {
	// Background for palette
	fill(50, 50, 50, 200)
	rect(10, 10, 200, Object.keys(trackPieces).length * 30 + 60)
	
	fill(255)
	textAlign(LEFT)
	textSize(14)
	text("Track Pieces:", 20, 30)
	
	let y = 50
	for (let [key, piece] of Object.entries(trackPieces)) {
		// Highlight selected piece
		if (key === selectedPieceType) {
			fill(100, 150, 255, 100)
			rect(15, y - 12, 190, 20)
		}
		
		fill(255)
		text(piece.name, 20, y)
		y += 25
	}
	
	// Control buttons
	y += 10
	if (!trackBuildingStarted) {
		fill(100, 255, 100)
		rect(20, y, 80, 25)
		fill(0)
		text("Start Track", 25, y + 17)
	} else {
		fill(255, 100, 100)
		rect(20, y, 60, 25)
		fill(0)
		text("Clear", 25, y + 17)
		
		if (canFinishTrack()) {
			fill(100, 255, 100)
			rect(90, y, 80, 25)
			fill(0)
			text("Finish Track", 95, y + 17)
		}
	}
	
	// Back button
	y += 35
	fill(150, 100, 100)
	rect(20, y, 60, 25)
	fill(255)
	text("Back", 25, y + 17)
}

function drawGridInstructions() {
	fill(255)
	textAlign(RIGHT)
	textSize(12)
	text("Click on piece names to select", width - 20, height - 60)
	text("Click 'Start Track' to begin placing", width - 20, height - 45)
	text("Click on grid to place pieces", width - 20, height - 30)
	text("Connect back to start to finish", width - 20, height - 15)
}

function handleGridBuilderClick() {
	// Check if clicking on piece palette
	if (mouseX >= 10 && mouseX <= 210) {
		let y = 50
		for (let [key, piece] of Object.entries(trackPieces)) {
			if (mouseY >= y - 12 && mouseY <= y + 8) {
				selectedPieceType = key
				return
			}
			y += 25
		}
		
		// Check control buttons
		y += 10
		if (!trackBuildingStarted) {
			if (mouseX >= 20 && mouseX <= 100 && mouseY >= y && mouseY <= y + 25) {
				startGridTrack()
			}
		} else {
			if (mouseX >= 20 && mouseX <= 80 && mouseY >= y && mouseY <= y + 25) {
				clearGridTrack()
			}
			if (canFinishTrack() && mouseX >= 90 && mouseX <= 170 && mouseY >= y && mouseY <= y + 25) {
				finishGridTrack()
			}
		}
		
		// Back button
		y += 35
		if (mouseX >= 20 && mouseX <= 80 && mouseY >= y && mouseY <= y + 25) {
			phase = "trackBuildMenu"
			return
		}
		return
	}
	
	// Place track piece on grid
	if (trackBuildingStarted && currentTrackPosition) {
		placeGridPiece()
	}
}

function startGridTrack() {
	// Snap mouse position to grid
	let gridX = Math.round(mouseX / gridSize) * gridSize
	let gridY = Math.round(mouseY / gridSize) * gridSize
	
	currentTrackPosition = newVector(gridX, gridY)
	currentTrackDirection = 0 // Start facing right
	trackBuildingStarted = true
	placedPieces = []
}

function placeGridPiece() {
	let nextPos = calculateNextPiecePosition()
	if (!nextPos) return
	
	let piece = {
		type: trackPieces[selectedPieceType],
		startPos: newVector(currentTrackPosition.x, currentTrackPosition.y),
		endPos: nextPos.position,
		startDirection: currentTrackDirection,
		pieceType: selectedPieceType
	}
	
	placedPieces.push(piece)
	currentTrackPosition = nextPos.position
	currentTrackDirection = nextPos.direction
}

function clearGridTrack() {
	initializeGridBuilder()
}

function canFinishTrack() {
	if (placedPieces.length < 3) return false
	
	// Check if we're close to the starting position
	let firstPiece = placedPieces[0]
	if (!firstPiece) return false
	
	let dx = currentTrackPosition.x - firstPiece.startPos.x
	let dy = currentTrackPosition.y - firstPiece.startPos.y
	let distance = Math.sqrt(dx * dx + dy * dy)
	
	return distance < gridSize * 1.5
}

function finishGridTrack() {
	// Create final connecting piece
	let firstPiece = placedPieces[0]
	let connectingPiece = {
		type: trackPieces["straight"],
		startPos: newVector(currentTrackPosition.x, currentTrackPosition.y),
		endPos: firstPiece.startPos,
		startDirection: currentTrackDirection,
		pieceType: "straight"
	}
	
	placedPieces.push(connectingPiece)
	
	// Generate track from pieces and start simulation
	generateTrackFromPieces()
	phase = "setup"
}

function generateTrackFromPieces() {
	// Set start position and direction from first piece
	start = newVector(placedPieces[0].startPos.x, placedPieces[0].startPos.y)
	direction = placedPieces[0].startDirection
	
	// Create graphics for the track
	renderTrack.push()
	renderTrack.fill("green")
	renderTrack.rect(0, 0, canvas.width, canvas.height)
	
	// Draw white borders
	renderTrack.stroke("white")
	renderTrack.strokeWeight(trackWidth + 4)
	renderTrack.noFill()
	
	for (let piece of placedPieces) {
		renderTrack.push()
		drawTrackPieceOnGraphics(renderTrack, piece)
		renderTrack.pop()
	}
	
	// Draw black asphalt
	renderTrack.stroke("black")
	renderTrack.strokeWeight(trackWidth)
	
	for (let piece of placedPieces) {
		renderTrack.push()
		drawTrackPieceOnGraphics(renderTrack, piece)
		renderTrack.pop()
	}
	
	renderTrack.pop()
	
	setTrack()
}

function drawTrackPieceOnGraphics(graphics, piece) {
	if (piece.pieceType.includes("curve")) {
		// Draw smooth curves
		let steps = 20
		graphics.beginShape()
		graphics.noFill()
		for (let i = 0; i <= steps; i++) {
			let t = i / steps
			let angle = piece.startDirection + piece.type.angle * t
			let radius = piece.type.radius * gridSize
			
			let centerX, centerY
			if (piece.pieceType.includes("right")) {
				centerX = piece.startPos.x + radius * Math.cos(piece.startDirection + Math.PI/2)
				centerY = piece.startPos.y + radius * Math.sin(piece.startDirection + Math.PI/2)
			} else {
				centerX = piece.startPos.x + radius * Math.cos(piece.startDirection - Math.PI/2)
				centerY = piece.startPos.y + radius * Math.sin(piece.startDirection - Math.PI/2)
			}
			
			let x = centerX + radius * Math.cos(piece.startDirection + piece.type.angle * t + Math.PI)
			let y = centerY + radius * Math.sin(piece.startDirection + piece.type.angle * t + Math.PI)
			
			graphics.vertex(x, y)
		}
		graphics.endShape()
	} else {
		graphics.line(piece.startPos.x, piece.startPos.y, piece.endPos.x, piece.endPos.y)
	}
}

// Spline Builder Functions (basic implementation)
function initializeSplineBuilder() {
	splinePoints = []
	currentSpline = []
	splineBuilding = false
}

function drawSplines() {
	stroke(255)
	strokeWeight(trackWidth + 4)
	noFill()
	
	// Draw completed splines
	for (let spline of splinePoints) {
		if (spline.length >= 2) {
			beginShape()
			for (let point of spline) {
				curveVertex(point.x, point.y)
			}
			endShape()
		}
	}
	
	// Draw current spline being built
	if (currentSpline.length >= 2) {
		stroke(255, 255, 0)
		beginShape()
		for (let point of currentSpline) {
			curveVertex(point.x, point.y)
		}
		endShape()
	}
	
	// Draw asphalt
	stroke(0)
	strokeWeight(trackWidth)
	
	for (let spline of splinePoints) {
		if (spline.length >= 2) {
			beginShape()
			for (let point of spline) {
				curveVertex(point.x, point.y)
			}
			endShape()
		}
	}
	
	if (currentSpline.length >= 2) {
		beginShape()
		for (let point of currentSpline) {
			curveVertex(point.x, point.y)
		}
		endShape()
	}
}

function drawSplineUI() {
	fill(50, 50, 50, 200)
	rect(10, 10, 200, 120)
	
	fill(255)
	textAlign(LEFT)
	textSize(14)
	text("Spline Builder", 20, 30)
	text("Click to add points", 20, 50)
	text("Right-click to finish spline", 20, 70)
	text("'F' to finish track", 20, 90)
	
	// Back button
	fill(150, 100, 100)
	rect(20, 100, 60, 25)
	fill(255)
	text("Back", 25, 115)
}

function handleSplineBuilderClick() {	// Check for back button
	if (mouseX >= 20 && mouseX <= 80 && mouseY >= 100 && mouseY <= 125) {
		phase = "trackBuildMenu"
		return
	}
		// Add point to current spline
	currentSpline.push(newVector(mouseX, mouseY))
}

// Add keyboard input for spline builder
function keyPressed() {
	if (phase === "splineBuilder" && (key === 'f' || key === 'F')) {
		finishSplineTrack()
	}
}

function finishSplineTrack() {
	if (currentSpline.length > 0) {
		splinePoints.push([...currentSpline])
	}
	
	// Connect back to start
	if (splinePoints.length > 0 && splinePoints[0].length > 0) {
		let lastSpline = splinePoints[splinePoints.length - 1]
		let firstPoint = splinePoints[0][0]
		lastSpline.push(firstPoint)
	}
	
	generateTrackFromSplines()
	phase = "setup"
}

function generateTrackFromSplines() {
	start = newVector(splinePoints[0][0].x, splinePoints[0][0].y)
	direction = 0
	
	// Simple spline track generation
	renderTrack.push()
	renderTrack.fill("green")
	renderTrack.rect(0, 0, canvas.width, canvas.height)
	renderTrack.pop()
	
	setTrack()
}


