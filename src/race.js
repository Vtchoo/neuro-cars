//---------- SMART RACE 2 ----------

// Important objects
let carSprite

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

function preload(){
	//carSprite = loadImage("./images/car.png")
	//carSprite = loadImage("car.png")
	carSprite = loadImage("https://raw.githubusercontent.com/Vtchoo/smartRace2/master/images/car.png")
}

function setup(){

	// Create canvas
	createCanvas(window.innerWidth, window.innerHeight)
	renderTrack = createGraphics(canvas.width, canvas.height)
	renderCars = createGraphics(canvas.width, canvas.height)
	grid = createGraphics(canvas.width, canvas.height)
	background("green")

	// Set a reduced resolution track map for the sensors of the cars
	trackMap = new Array(Math.floor(canvas.width/resolution));
	for (var i = 0; i < trackMap.length; i++) {
  		trackMap[i] = new Array(Math.floor(canvas.height/resolution));
	}
	renderMap = createGraphics(canvas.width, canvas.height)

}

function draw(){

	switch(phase){
		case "setStart":

			renderTrack.push();
			renderTrack.fill("green")
			renderTrack.rect(0,0,canvas.width,canvas.height)
			renderTrack.fill("black")
			renderTrack.noStroke()
			renderTrack.rect(mouseX-trackWidth/2, mouseY-trackWidth/2, trackWidth, trackWidth)
			renderTrack.pop();
			image(renderTrack,0,0)
			break

		case "rotateStart":

			renderTrack.push()
			renderTrack.fill("green")
			renderTrack.rect(0, 0, canvas.width,canvas.height)
			renderTrack.translate(start.x,start.y)
			renderTrack.rotate(atan2(mouseY - start.y, mouseX - start.x))
			renderTrack.fill("black")
			renderTrack.rect(-trackWidth/2, -trackWidth/2, trackWidth, trackWidth)
			renderTrack.stroke("white")
			renderTrack.line(-trackWidth/2, -trackWidth/2, trackWidth/2, -trackWidth/2)
			renderTrack.line(-trackWidth/2, +trackWidth/2, trackWidth/2, +trackWidth/2)
			renderTrack.pop()
			image(renderTrack,0,0)
			break

		case "generateTrack":

			start = newVector(canvas.width/2, canvas.height/2)
			direction = PI

			renderTrack.push()
			renderTrack.fill("green")
			renderTrack.rect(0, 0, canvas.width,canvas.height)

			var a = .5 * canvas.width - trackWidth/2
			var b = .5 * canvas.height - trackWidth/2

			let startRadius = sqrt(noise(2 + cos(0), 2 + sin(0)))
			start = newVector(
				canvas.width/2 + a * startRadius * cos(HALF_PI),
				canvas.height/2 + b * startRadius * sin(HALF_PI)
				)
			
			// Draws white line
			for (let i = 0; i < 360; i++){
				
				let angle = i / 360 * TWO_PI
				let nextAngle = (i+1) / 360 * TWO_PI
				let radius = sqrt(noise(2 + cos(angle), 2 + sin(angle)))
				let nextRadius = sqrt(noise(2 + cos(nextAngle), 2 + sin(nextAngle)))

				renderTrack.stroke("white")
				renderTrack.strokeWeight(trackWidth + 2)
				renderTrack.line(
					canvas.width/2 + a * radius * cos(angle + HALF_PI), 
					canvas.height/2 + b * radius * sin(angle + HALF_PI), 
					canvas.width/2 + a * nextRadius * cos(nextAngle + HALF_PI), 
					canvas.height/2 + b * nextRadius * sin(nextAngle + HALF_PI)
					)

			}

			// Draws asphalt
			for (let i = 0; i < 360; i++){
				
				let angle = i / 360 * TWO_PI
				let nextAngle = (i+1) / 360 * TWO_PI
				let radius = sqrt(noise(2 + cos(angle), 2 + sin(angle)))
				let nextRadius = sqrt(noise(2 + cos(nextAngle), 2 + sin(nextAngle)))

				renderTrack.stroke("black")
				renderTrack.strokeWeight(trackWidth)
				renderTrack.line(
					canvas.width/2 + a * radius * cos(angle + HALF_PI), 
					canvas.height/2 + b * radius * sin(angle + HALF_PI), 
					canvas.width/2 + a * nextRadius * cos(nextAngle + HALF_PI), 
					canvas.height/2 + b * nextRadius * sin(nextAngle + HALF_PI)
					)

			}
			renderTrack.pop()
			image(renderTrack,0,0)

			setTrack()
			phase = "setup"
			break

		case "buildTrack":

			background("green")
			image(renderTrack,0,0)
			if (showGrid == true){ image(grid,0,0) }
			break

		case "setup":

			for(let i = 0; i < individuals; i++){
				population[i] = new car(start.x, start.y, direction)
			}

			player = new car(start.x, start.y, direction)

			phase = "running"
			break

		case "running":

			if( generation == 0 ){ 
				frameRecord.push(frameRate()) 
				averageFrameRate = 0
				for (let h = 0; h < frameRecord.length; h++){
					averageFrameRate += frameRecord[h]	
				}
				averageFrameRate = averageFrameRate / frameRecord.length
				avgDeltaTime = 1/averageFrameRate
			}

			// Shows the track
			image(renderTrack,0,0)

			// or the AI detection map
			if( showMap == true) { image(renderMap,0,0) }

			// Updates each individual
			population.forEach( function(individual){ 
				individual.drive(individual.NN.output(individual.getInputs()))
				individual.update()
				individual.show()
				individual.NN.addfitness(individual.speed)
			})

			// Allows the player to drive a car
			if (playerDrive == true){
				getUserInput()
				player.update()
				player.show()
			}
			
			// Draws the graph data
			if (drawGraphs){
				if (maxFitness.length > 1){
					let maxWidth = canvas.width/1.5
					let interval = maxWidth/(maxFitness.length-1)
					let maxHeight = canvas.height/3
					for (let i = 0; i < maxFitness.length; i++){
						push()
						stroke("blue")
						line(
							canvas.width - maxWidth + i * interval,
							canvas.height - maxHeight * maxFitnessNormal[i] ,
							canvas.width- maxWidth + (i+1) * interval,
							canvas.height - maxHeight * maxFitnessNormal[i+1]
							)
						stroke("yellow")
						line(
							canvas.width - maxWidth + i * interval,
							canvas.height - maxHeight * avgFitnessNormal[i] ,
							canvas.width - maxWidth + (i+1) * interval,
							canvas.height - maxHeight * avgFitnessNormal[i+1]
							)
						pop()
					}
				}
			}


			ticks++
			if (ticks >= maxticks){
				phase = "breeding"
			}

			break
		case "breeding":

			// Sort the population by fitness
			population.sort( function(a,b){ return b.NN.fitness - a.NN.fitness } )

			// And stores data into the data logging arrays
			maxFitness.push(population[0].NN.fitness)
			var avgFitnessGen = 0
			population.forEach( function(individual){
				avgFitnessGen += individual.NN.fitness
			})
			avgFitness.push( avgFitnessGen / population.length )

			// Normalizes the fitnesses to show on a graph
			var maxTotalFitness = 0
			for (let i = 0; i < maxFitness.length; i++){
				maxTotalFitness = maxFitness[i] > maxTotalFitness ? maxFitness[i] : maxTotalFitness
			}
			for (let i = 0; i < maxFitness.length; i++){
				maxFitnessNormal[i] = maxFitness[i] / maxTotalFitness
				avgFitnessNormal[i] = avgFitness[i] / maxTotalFitness
			}

			// Generates new neural net and replaces the worst individuals
			for (let i = 0; i < offspring; i++){
				population[individuals - 1 - i].NN = breed( population[2*i].NN , population[2*i+1].NN )
				population[individuals - 1 - i].generation = generation+1
			}

			// Resets every individual's car
			population.forEach( function(individual){
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

function mouseClicked(){

	switch(phase){
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
			currentPosition = newVector(start.x + trackWidth*Math.cos(direction)/2, start.y + trackWidth*Math.sin(direction)/2)
			circle(currentPosition.x, currentPosition.y, 5)

			createTrackBuilder()
			createGrid()

			break
	}
}

function getUserInput(){

	var playerinput = []

	if( keyIsDown(87) ){
		playerinput[0] = 1
	} else if ( keyIsDown(83) ){
		playerinput[0] = -1
	} else {
		playerinput[0] = 0
	}

	if( keyIsDown(65) ){
		playerinput[1] = -1
	} else if ( keyIsDown(68) ){
		playerinput[1] = 1
	} else {
		playerinput[1] = 0
	}

	player.drive(playerinput)

}


