function car(startX, startY, startDir){

	// Car paint (helps to keep track of individuals)
	this.paintRGB = [int(Math.random()*255), int(Math.random()*255), int(Math.random()*255)]
	this.paint = "rgb("+this.paintRGB[0]+","+this.paintRGB[1]+","+this.paintRGB[2]+")"

	// Car movement
	this.pos = newVector(startX, startY)
	this.speed = 0
	this.acceleration = 0
	this.direction = startDir

	// The brain inside the car
	this.NN = new neuralNet(nnLayers, nnNeurons, nnInputs, nnOutputs, nnRange, nnMutationRate, nnActivation)
	this.generation = 0

	// Updates car position
	this.update = function(){
		this.speed += this.acceleration
		if (this.speed < -2){ this.speed = -2 }
		if ( trackMap[Math.floor(this.pos.x/resolution)][Math.floor(this.pos.y/resolution)] == 0){ this.speed = 0}

		this.pos.add(
			this.speed * Math.cos(this.direction) * avgDeltaTime / (1/30), 
			this.speed * Math.sin(this.direction) * avgDeltaTime / (1/30))
	}
	
	// Renders car on canvas
	this.show = function(){
		push();
		translate(this.pos.x, this.pos.y);
		rotate(this.direction);
		imageMode(CENTER)
		carSprite.resize(20, 10)
		tint(this.paint)
		image(carSprite,0,0)
		pop();
	}

	// Inputs for driving the car
	this.drive = function(input){
		this.acceleration = (input[0] > 0 && this.speed >= 0) || this.speed < 0 ? input[0] * .05 : input[0] * .15
		//this.acceleration = input[0] * .05
		this.direction += input[1] * .05 * ( 1 - 1/(1 + Math.abs(this.speed)) ) * Math.sign(this.speed) * avgDeltaTime / (1/30)
	}

	// Gets sensors' data
	this.getInputs = function(){

		var inp = new Array(8).fill(0)
		var increments = 30

		inp[7] = this.speed

		for (let i = 0; i < 7; i++){

			let angle = this.direction + ((i-3)/10)*PI

			for (let j = 0; j < increments; j++){
				var prevx = this.pos.x + (2*Math.cos(((i-3)/10)*PI))*j*Math.cos(angle)*4
				var prevy = this.pos.y + (2*Math.cos(((i-3)/10)*PI))*j*Math.sin(angle)*4

				var x = this.pos.x + (2*Math.cos(((i-3)/10)*PI))*(j+1)*Math.cos(angle)*4
				var y = this.pos.y + (2*Math.cos(((i-3)/10)*PI))*(j+1)*Math.sin(angle)*4

				if ( trackMap[Math.floor(x/resolution)][Math.floor(y/resolution)] == 0 || j == increments - 1){
					x = prevx
					y = prevy

					inp[i] = Math.sqrt( Math.pow(x - this.pos.x, 2) + Math.pow(y - this.pos.y, 2) )
					if (showInputs){ stroke(255); line(this.pos.x, this.pos.y, x, y)
					}
					break
				}

				
			}
			
		}
		return inp
	}

}