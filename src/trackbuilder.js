// Creates the menu for building the track pieces (just like in Roller Coaster Tycoon)

function createTrackBuilder(){
	


	buttons = new Array()

	buttons[0] = createButton("Large Left")
	buttons[1] = createButton("Large Right")
	buttons[2] = createButton("Big Left")
	buttons[3] = createButton("Big Right")
	buttons[4] = createButton("Medium Left")
	buttons[5] = createButton("Medium Right")
	buttons[6] = createButton("Small Left")
	buttons[7] = createButton("Small Right")

	for (let i = 0; i < 4; i++){
		for (let j = 0; j < 2; j++){
			
			let dir
			if( j == 0){ dir = "left" } else { dir = "right" }

			buttons[i*2 + j].size(buttonWidth, buttonHeight)
			buttons[i*2 + j].position(20 + (buttonWidth+5)*j, 20 + (buttonHeight+5)*i)
			buttons[i*2 + j].mousePressed( () => { buildTrack(6 - 2*i, dir, trackWidth, currentDirection)} )
		}
	}

	buttons[8] = createButton("1 unit Straight")
	buttons[8].size(2*buttonWidth + 5, buttonHeight)
	buttons[8].position(20, 20 + 4*(buttonHeight+5))
	buttons[8].mousePressed( () => { buildTrack(1, "straight", trackWidth, currentDirection)} )

	buttons[9] = createButton("SQRT(2) units straight")
	buttons[9].size(2*buttonWidth + 5, buttonHeight)
	buttons[9].position(20, 20 + 5*(buttonHeight+5))
	buttons[9].mousePressed( () => { buildTrack(Math.sqrt(2), "straight", trackWidth, currentDirection)} )

	buttons[10] = createButton("Show Grid")
	buttons[10].size(2*buttonWidth + 5, buttonHeight)
	buttons[10].position(20, 20 + 7*(buttonHeight+5))
	buttons[10].mousePressed(() => {showGrid = !showGrid})

	buttons[11] = createButton("Reset")
	buttons[11].size(buttonWidth,buttonHeight)
	buttons[11].position(20, canvas.height - buttonHeight - 20)
	buttons[11].mousePressed(resetTrack)

	buttons[12] = createButton("Done!")
	buttons[12].size(buttonWidth,buttonHeight)
	buttons[12].position(20 + 1*(buttonWidth + 5), canvas.height - buttonHeight - 20)
	buttons[12].mousePressed(setTrack)
}


function buildTrack(radius, turn, trkWidth, currDir){
	
	renderTrack.push()
	renderTrack.strokeCap(SQUARE)
	renderTrack.noFill()
	renderTrack.strokeWeight(trkWidth)
	renderTrack.stroke("black")

	var pos = newVector(currentPosition.x, currentPosition.y)
	
	var advanceX
	var advanceY

	if (turn != "straight"){
	
		var avgRadius = trkWidth*(1 + radius)
		let angleStart
		let angleEnd

		
	
		if (turn == "left"){
			angleStart = currDir + QUARTER_PI -.01
			angleEnd = currDir + HALF_PI + .01

			advanceX = avgRadius * Math.cos(QUARTER_PI/2) * Math.sin(QUARTER_PI/2)
			advanceY = avgRadius * Math.sin(QUARTER_PI/2) * Math.sin(QUARTER_PI/2)

			currentPosition.x += +advanceX * Math.cos(currentDirection) + advanceY * Math.sin(currentDirection)
			currentPosition.y += +advanceX * Math.sin(currentDirection) - advanceY * Math.cos(currentDirection)
			currentDirection -= QUARTER_PI
			
		}else if (turn == "right"){
			avgRadius *= -1
			angleStart = currDir - HALF_PI - .01
			angleEnd = currDir - QUARTER_PI + .01

			advanceX = avgRadius * Math.cos(QUARTER_PI/2) * Math.sin(QUARTER_PI/2)
			advanceY = avgRadius * Math.sin(QUARTER_PI/2) * Math.sin(QUARTER_PI/2)

			currentPosition.x += -advanceX * Math.cos(currentDirection) + advanceY * Math.sin(currentDirection)
			currentPosition.y += -advanceX * Math.sin(currentDirection) - advanceY * Math.cos(currentDirection)
			currentDirection += QUARTER_PI
		}

		renderTrack.arc(pos.x + Math.sin(currDir)*avgRadius/2, pos.y - Math.cos(currDir)*avgRadius/2, avgRadius, avgRadius, angleStart, angleEnd)
		renderTrack.strokeWeight(1)
		renderTrack.stroke("white")
		renderTrack.arc(pos.x + Math.sin(currDir)*avgRadius/2, pos.y - Math.cos(currDir)*avgRadius/2, avgRadius - trkWidth, avgRadius - trkWidth, angleStart, angleEnd)
		renderTrack.arc(pos.x + Math.sin(currDir)*avgRadius/2, pos.y - Math.cos(currDir)*avgRadius/2, avgRadius + trkWidth, avgRadius + trkWidth, angleStart, angleEnd)
	
	} else {

		advanceX = trackWidth * radius * Math.cos(currentDirection)
		advanceY = trackWidth * radius * Math.sin(currentDirection)
		renderTrack.line(currentPosition.x, 
			currentPosition.y, 
			currentPosition.x + advanceX * 1.01, 
			currentPosition.y + advanceY * 1.01)

		renderTrack.strokeWeight(1)
		renderTrack.stroke("white")
		renderTrack.line(
			currentPosition.x - trkWidth * Math.sin(currDir)/2, 
			currentPosition.y + trkWidth * Math.cos(currDir)/2, 
			currentPosition.x + trackWidth * radius * Math.cos(currDir) - trkWidth * Math.sin(currDir)/2, 
			currentPosition.y + trackWidth * radius * Math.sin(currDir) + trkWidth * Math.cos(currDir)/2)
		renderTrack.line(
			currentPosition.x + trkWidth * Math.sin(currDir)/2, 
			currentPosition.y - trkWidth * Math.cos(currDir)/2, 
			currentPosition.x + trackWidth * radius * Math.cos(currDir) + trkWidth * Math.sin(currDir)/2, 
			currentPosition.y + trackWidth * radius * Math.sin(currDir) - trkWidth * Math.cos(currDir)/2)

		currentPosition.x += advanceX
		currentPosition.y += advanceY
	}

	renderTrack.pop()
	console.log("Track segment built")
}

function resetTrack(){
	// Resets the grid
	for (let i = 0; i < canvas.width; i++){
		for (let j = 0; j < canvas.height; j++){
			grid.set(i, j, "rgba(0,0,0,0)")
		}
	}
	grid.updatePixels()
	phase = "resetTrack"
}

function createGrid(){
	var spacing = trackWidth
	var angle = direction
	var anchor = start

	var offset = (canvas.width % spacing)/spacing

	for (let i = 0; i < 2*canvas.width/spacing; i++){
		for (let j = 0; j < 2*canvas.width/spacing; j++){
			grid.push()
			grid.stroke("white")
			grid.noFill()
			grid.translate(anchor.x, anchor.y)
			grid.rotate(angle)
			grid.rectMode(CENTER)
			grid.square(-canvas.width + spacing*(i+offset), -canvas.width + spacing*(j+offset), spacing)
			grid.pop()
		}
	}
}

function setTrack(){

	// Removes the track builder
	if(typeof buttons != "undefined"){
		buttons.forEach( function(element){ element.remove() })
	}

	// Hides the grid, if it is showing
	if (showGrid == true){ showGrid = false }

	// Creates the collison map for the track
	renderTrack.loadPixels()

	// Also creates a visual representation of the collision map
	renderMap.push()

	for(let i = 0; i < Math.floor(canvas.width/resolution); i++){
		for(let j = 0; j < Math.floor(canvas.height/resolution); j++){

			if( renderTrack.pixels[ 4*( j*canvas.width + i )*resolution + 1] > 20 ){
				renderMap.fill("red")
				trackMap[i][j] = 0
			} else {
				renderMap.fill("white")
				trackMap[i][j] = 1
			}
			renderMap.rect(i * resolution, j* resolution, resolution, resolution)
		}
	}
	renderMap.pop()

	// Show additional buttons to control the visualization
	exibInputs = createButton("Show Inputs")
	exibInputs.size(buttonWidth, buttonHeight)
	exibInputs.position(20, canvas.height - buttonHeight - 20)
	exibInputs.mousePressed( () => {showInputs = !showInputs} )

	exibMap = createButton("Show Map")
	exibMap.size(buttonWidth, buttonHeight)
	exibMap.position(20 + (buttonWidth + 5)*1, canvas.height - buttonHeight - 20)
	exibMap.mousePressed( () => {showMap = !showMap} )

	incrTime = createButton("Increase simul. time")
	incrTime.size(buttonWidth, buttonHeight)
	incrTime.position(20 + (buttonWidth + 5)*2, canvas.height - buttonHeight - 20)
	incrTime.mousePressed( () => {maxticks += 100} )

	showGraph = createButton("Show graphs")
	showGraph.size(buttonWidth, buttonHeight)
	showGraph.position(20 + (buttonWidth + 5)*3, canvas.height - buttonHeight - 20)
	showGraph.mousePressed( () => {drawGraphs = !drawGraphs} )

	phase = "setup"
}