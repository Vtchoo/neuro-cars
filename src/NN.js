function neuralNet(layers, neurons, inputs, outputs, range, mutationRate, activation){
	
	//console.log("New neural net generated")
	
	this.range = range
	this.layers = layers
	this.neurons = neurons
	this.inputs = inputs
	this.outputs = outputs
	this.activation = activation
	this.mutationRate = mutationRate

	this.fitness = 0

	if ( layers == 0 ){
		console.log("Your neural net must have at least 1 neuron layer")
		return 0
	}

	// Creates layers from random values inside the specified range
	this.weights = []
	for ( i = 0 ; i < layers + 1 ; i++ ){

		this.weights[this.weights.length] = []

		if ( i == 0 ){                      // Create the first weights, from the input values to the first layer
			for ( j = 0 ; j < inputs*neurons ; j++){ this.weights[i][j] = (Math.random() - (1/2)) * 2 * range }
		}else if( i == layers ){            // Create the last weights, from the last layer to the output values
			for ( j = 0 ; j < outputs*neurons ; j++){ this.weights[i][j] = (Math.random() - (1/2)) * 2 * range }
		}else{								// Create the weights between hidden neuron layers
			for ( j = 0 ; j < neurons*neurons ; j++){ this.weights[i][j] = (Math.random() - (1/2)) * 2 * range }
		}	
	}

	this.output = function(input){

		//console.log(input)

		this.neuronLayer = new Array(this.neurons).fill(0)
		this.neuronLayerPrev = new Array(this.neurons).fill(0)
		this.outputArray = new Array(this.outputs).fill(0)

		for ( i = 0 ; i < this.layers + 1 ; i++ ){

			this.neuronLayer.fill(0)
			//console.log(this.neuronLayer)
			//console.log(this.neuronLayerPrev)

			if ( i == 0 ){                      // First layer

				for ( j = 0 ; j < this.neurons ; j++){
					for (k = 0 ; k < this.inputs ; k++){
						this.neuronLayer[j] = this.neuronLayer[j] + input[k]*this.weights[i][j + k*this.neurons]
					}
					this.neuronLayer[j] = activate(this.neuronLayer[j], this.activation)
					this.neuronLayerPrev[j] = this.neuronLayer[j]
				}

			}else if( i == this.layers ){            // Middle layers

				for ( j = 0 ; j < this.outputs ; j++){
					for (k = 0 ; k < this.neurons ; k++){
						this.outputArray[j] = this.outputArray[j] + this.neuronLayerPrev[k]*this.weights[i][j + k*this.outputs]
					}
					this.outputArray[j] = activate(this.outputArray[j], this.activation)
				}

			}else{								// Output layer

				for ( j = 0 ; j < this.neurons ; j++){
					for (k = 0 ; k < this.neurons ; k++){
						this.neuronLayer[j] = this.neuronLayer[j] + this.neuronLayerPrev[k]*this.weights[i][j + k*this.neurons]
					}
					this.neuronLayer[j] = activate(this.neuronLayer[j], this.activation)
					this.neuronLayerPrev[j] = this.neuronLayer[j]
				}
			}
		}
		//console.log(this.outputArray)
		return this.outputArray
	}

	// Manages individual fitness
	this.addfitness = function(value){
		this.fitness = this.fitness + value
	}

	this.resetfitness = function(){
		this.fitness = 0
	}

	// Create random mutations on the specified individual
	this.mutate = function(){

		for ( i = 0 ; i < this.layers + 1 ; i++ ){

			if ( i == 0 ){                      // Mutate the first weights, from the input values to the first layer

				for ( j = 0 ; j < this.inputs*this.neurons ; j++){
					if (Math.random() < this.mutationRate){ this.weights[i][j] = (Math.random() - (1/2)) * 2 * this.range }
				}

			}else if( i == this.layers ){            // Create the last weights, from the last layer to the output values

				for ( j = 0 ; j < this.outputs*this.neurons ; j++){ 
					if (Math.random() < this.mutationRate){ this.weights[i][j] = (Math.random() - (1/2)) * 2 * this.range }
				}

			}else{								// Create the weights between hidden neuron layers

				for ( j = 0 ; j < this.neurons*this.neurons ; j++){ 
					if (Math.random() < this.mutationRate){ this.weights[i][j] = (Math.random() - (1/2)) * 2 * this.range }
				}
			}	
		}
	}
}

function activate(value, activation){

	switch (activation){
		case "identity":
			return value
		case "binary":
			if ( value > 0 ){
				return 1
			} else {
				return 0
			}
		case "softsign":
			return value / (1 + Math.abs(value))
		case "relu":
			if (value < 0) {
				return 0
			} else {
				return value
			}
		default:
			console.log("No valid activation function selected")
			return value
	}
}

function breed(parent1, parent2){

	var offsRange = parent1.range
	var offsLayers = parent1.layers
	var offsNeurons = parent1.neurons
	var offsInputs = parent1.inputs
	var offsOutputs = parent1.outputs
	var offsActivation = parent1.activation
	var offsMutationRate = parent1.mutationRate

	var offspring = new neuralNet(offsLayers, offsNeurons, offsInputs, offsOutputs, offsRange, offsMutationRate, offsActivation)

	// Crossover algorithm
	for ( i = 0 ; i < offspring.layers + 1 ; i++ ){

		offspring.weights[offspring.weights.length] = []

		if ( i == 0 ){                      // Create the first weights, from the input values to the first layer

			for ( j = 0 ; j < offspring.inputs*offspring.neurons ; j++){
				if (Math.random() > offspring.mutationRate){
					if (Math.random() > 0.5){ 
						offspring.weights[i][j] = parent1.weights[i][j]
					} else {
						offspring.weights[i][j] = parent2.weights[i][j]
					}
				} else {
					offspring.weights[i][j] = (Math.random() - (1/2)) * 2 * offspring.range
				}
			}

		}else if( i == offspring.layers ){            // Create the last weights, from the last layer to the output values

			for ( j = 0 ; j <offspring.outputs*offspring.neurons ; j++){ 
				if (Math.random() > offspring.mutationRate){
					if (Math.random() > 0.5){ 
						offspring.weights[i][j] = parent1.weights[i][j]
					} else {
						offspring.weights[i][j] = parent2.weights[i][j]
					}
				} else {
					offspring.weights[i][j] = (Math.random() - (1/2)) * 2 * offspring.range
				}
			}

		}else{								// Create the weights between hidden neuron layers

			for ( j = 0 ; j < offspring.neurons*offspring.neurons ; j++){ 
				if (Math.random() > offspring.mutationRate){
					if (Math.random() > 0.5){ 
						offspring.weights[i][j] = parent1.weights[i][j]
					} else {
						offspring.weights[i][j] = parent2.weights[i][j]
					}
				} else {
					offspring.weights[i][j] = (Math.random() - (1/2)) * 2 * offspring.range
				}
			}
		}	
	}

	return offspring
}