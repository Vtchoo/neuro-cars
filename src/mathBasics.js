function vector(){
	this.x
	this.y

	this.heading = function(){
		return Math.atan2(this.y, this.x)
	}

	this.add = function(a, b){
		this.x += a
		this.y += b
	}

	this.mult = function(a){
		if (a != 0){
			this.x *= a
			this.y *= a
		}
	}

	this.mag = function(){
		return Math.sqrt( Math.pow(this.x, 2) + Math.pow(this.y, 2) )
	}

	this.unit = function(){
		if (this.mag() != 0) {
			let length = this.mag()
			this.x = this.x/length
			this.y = this.y/length
		}
	}
}

function newVector(a, b){
	vec = new vector()
	vec.x = a
	vec.y = b
	return vec
}