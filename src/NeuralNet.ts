// Matrix-based Neural Network Implementation for Smart Race
// TypeScript class implementation with efficient matrix operations

export type ActivationFunction = "identity" | "binary" | "softsign" | "relu" | "tanh" | "sigmoid";

export interface NeuralNetConfig {
    layers: number;
    neurons: number;
    inputs: number;
    outputs: number;
    range: number;
    mutationRate: number;
    activation: ActivationFunction;
}

export class NeuralNet {
    public range: number;
    public layers: number;
    public neurons: number;
    public inputs: number;
    public outputs: number;
    public activation: ActivationFunction;
    public mutationRate: number;
    public fitness: number = 0;

    private weightMatrices: number[][][];
    private biasMatrices: number[][][];

    private useXavierInitialization: boolean = false; // Flag to toggle Xavier initialization

    constructor(layers: number, neurons: number, inputs: number, outputs: number, range: number, mutationRate: number, activation: ActivationFunction) {
        this.range = range;
        this.layers = layers;
        this.neurons = neurons;
        this.inputs = inputs;
        this.outputs = outputs;
        this.activation = activation;
        this.mutationRate = mutationRate;

        if (layers === 0) {
            throw new Error("Your neural net must have at least 1 neuron layer");
        }

        // Initialize weight matrices
        this.weightMatrices = [];

        // Input to first hidden layer
        this.weightMatrices.push(this.createRandomMatrix(neurons, inputs, inputs, neurons));

        // Hidden layer to hidden layer weights
        for (let i = 1; i < layers; i++) {
            this.weightMatrices.push(this.createRandomMatrix(neurons, neurons, neurons, neurons));
        }

        // Last hidden layer to output
        this.weightMatrices.push(this.createRandomMatrix(outputs, neurons, neurons, outputs));

        // Bias matrices
        this.biasMatrices = [];
        for (let i = 0; i < layers; i++) {
            this.biasMatrices.push(this.createRandomMatrix(neurons, 1, neurons, 1));
        }
        this.biasMatrices.push(this.createRandomMatrix(outputs, 1, neurons, 1));
    }

    // Helper function to create random matrix with Xavier-style initialization for softsign
    private createRandomMatrix(rows: number, cols: number, fanIn: number, fanOut: number): number[][] {
        const matrix: number[][] = [];
        // Modified Xavier for softsign (gentler than tanh)
        const limit = Math.sqrt(1.5 / (fanIn + fanOut));

        for (let i = 0; i < rows; i++) {
            matrix[i] = [];
            for (let j = 0; j < cols; j++) {
                matrix[i][j] = (Math.random() - 0.5) * 2 * limit;
            }
        }
        return matrix;
    }

    // Matrix multiplication function
    private matrixMultiply(a: number[][], b: number[][]): number[][] {
        const result: number[][] = [];
        for (let i = 0; i < a.length; i++) {
            result[i] = [];
            for (let j = 0; j < b[0].length; j++) {
                let sum = 0;
                for (let k = 0; k < b.length; k++) {
                    sum += a[i][k] * b[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }

    // Add two matrices
    private matrixAdd(a: number[][], b: number[][]): number[][] {
        const result: number[][] = [];
        for (let i = 0; i < a.length; i++) {
            result[i] = [];
            for (let j = 0; j < a[0].length; j++) {
                result[i][j] = a[i][j] + b[i][j];
            }
        }
        return result;
    }

    // Apply activation function to matrix
    private applyActivation(matrix: number[][], activation: ActivationFunction): number[][] {
        const result: number[][] = [];
        for (let i = 0; i < matrix.length; i++) {
            result[i] = [];
            for (let j = 0; j < matrix[0].length; j++) {
                result[i][j] = activate(matrix[i][j], activation);
            }
        }
        return result;
    }

    // Forward pass through the network
    public output(input: number[]): number[] {
        // Convert input array to column vector
        let currentLayer: number[][] = [];
        for (let i = 0; i < input.length; i++) {
            currentLayer[i] = [input[i]];
        }

        // Forward pass through all layers
        for (let i = 0; i < this.weightMatrices.length; i++) {
            // Matrix multiplication: weights * input + bias
            currentLayer = this.matrixMultiply(this.weightMatrices[i], currentLayer);
            currentLayer = this.matrixAdd(currentLayer, this.biasMatrices[i]);
            currentLayer = this.applyActivation(currentLayer, this.activation);
        }

        // Convert result back to flat array format
        const outputArray: number[] = [];
        for (let i = 0; i < currentLayer.length; i++) {
            outputArray[i] = currentLayer[i][0];
        }

        return outputArray;
    }

    // Fitness management
    public addFitness(value: number): void {
        this.fitness = this.fitness + value;
    }

    public resetFitness(): void {
        this.fitness = 0;
    }

    // Export neural network data for saving
    public exportData(): any {
        return {
            config: {
                layers: this.layers,
                neurons: this.neurons,
                inputs: this.inputs,
                outputs: this.outputs,
                range: this.range,
                mutationRate: this.mutationRate,
                activation: this.activation
            },
            weights: this.weightMatrices,
            biases: this.biasMatrices,
            fitness: this.fitness
        };
    }

    // Import neural network data for loading
    public static fromData(data: any): NeuralNet {
        const net = new NeuralNet(
            data.config.layers,
            data.config.neurons,
            data.config.inputs,
            data.config.outputs,
            data.config.range,
            data.config.mutationRate,
            data.config.activation
        );

        net.weightMatrices = data.weights;
        net.biasMatrices = data.biases;
        net.fitness = data.fitness || 0;

        return net;
    }

    // Helper function to get the proper initialization limit for a given layer
    private getInitializationLimit(layerIndex: number, isWeight: boolean = true): number {
        if (!this.useXavierInitialization) {
            return this.range;
        }

        let fanIn: number, fanOut: number;

        if (isWeight) {
            if (layerIndex === 0) {
                // Input to first hidden layer
                fanIn = this.inputs;
                fanOut = this.neurons;
            } else if (layerIndex === this.layers) {
                // Last hidden layer to output
                fanIn = this.neurons;
                fanOut = this.outputs;
            } else {
                // Hidden layer to hidden layer
                fanIn = this.neurons;
                fanOut = this.neurons;
            }
        } else {
            // For biases, fanOut is always 1
            if (layerIndex === this.layers) {
                // Output layer bias
                fanIn = this.neurons;
                fanOut = 1;
            } else {
                // Hidden layer bias
                fanIn = this.neurons;
                fanOut = 1;
            }
        }

        return Math.sqrt(6 / (fanIn + fanOut));
    }

    // Mutation function
    public mutate(): void {
        // Mutate weight matrices
        for (let m = 0; m < this.weightMatrices.length; m++) {
            const limit = this.getInitializationLimit(m, true);
            for (let i = 0; i < this.weightMatrices[m].length; i++) {
                for (let j = 0; j < this.weightMatrices[m][i].length; j++) {
                    if (Math.random() < this.mutationRate) {
                        this.weightMatrices[m][i][j] = (Math.random() - 0.5) * 2 * limit;
                    }
                }
            }
        }

        // Mutate bias matrices
        for (let m = 0; m < this.biasMatrices.length; m++) {
            const limit = this.getInitializationLimit(m, false);
            for (let i = 0; i < this.biasMatrices[m].length; i++) {
                for (let j = 0; j < this.biasMatrices[m][i].length; j++) {
                    if (Math.random() < this.mutationRate) {
                        this.biasMatrices[m][i][j] = (Math.random() - 0.5) * 2 * limit;
                    }
                }
            }
        }
    }

    // Create a deep copy of this neural network
    public copy(): NeuralNet {
        const newNet = new NeuralNet(
            this.layers,
            this.neurons,
            this.inputs,
            this.outputs,
            this.range,
            this.mutationRate,
            this.activation
        );

        // Deep copy weight matrices
        for (let m = 0; m < this.weightMatrices.length; m++) {
            for (let i = 0; i < this.weightMatrices[m].length; i++) {
                for (let j = 0; j < this.weightMatrices[m][i].length; j++) {
                    newNet.weightMatrices[m][i][j] = this.weightMatrices[m][i][j];
                }
            }
        }

        // Deep copy bias matrices
        for (let m = 0; m < this.biasMatrices.length; m++) {
            for (let i = 0; i < this.biasMatrices[m].length; i++) {
                for (let j = 0; j < this.biasMatrices[m][i].length; j++) {
                    newNet.biasMatrices[m][i][j] = this.biasMatrices[m][i][j];
                }
            }
        }

        newNet.fitness = this.fitness;
        return newNet;
    }

    // Breeding/Crossover function
    static breed(parent1: NeuralNet, parent2: NeuralNet): NeuralNet {
        const offspring = new NeuralNet(
            parent1.layers,
            parent1.neurons,
            parent1.inputs,
            parent1.outputs,
            parent1.range,
            parent1.mutationRate,
            parent1.activation
        );

        // Crossover for weight matrices
        for (let m = 0; m < offspring.weightMatrices.length; m++) {
            const limit = offspring.getInitializationLimit(m, true);
            for (let i = 0; i < offspring.weightMatrices[m].length; i++) {
                for (let j = 0; j < offspring.weightMatrices[m][i].length; j++) {
                    if (Math.random() > offspring.mutationRate) {
                        // Select from parent (50/50 chance)
                        if (Math.random() > 0.5) {
                            offspring.weightMatrices[m][i][j] = parent1.weightMatrices[m][i][j];
                        } else {
                            offspring.weightMatrices[m][i][j] = parent2.weightMatrices[m][i][j];
                        }
                    } else {
                        // Mutate
                        offspring.weightMatrices[m][i][j] = (Math.random() - 0.5) * 2 * limit;
                    }
                }
            }
        }

        // Crossover for bias matrices
        for (let m = 0; m < offspring.biasMatrices.length; m++) {
            const limit = offspring.getInitializationLimit(m, false);
            for (let i = 0; i < offspring.biasMatrices[m].length; i++) {
                for (let j = 0; j < offspring.biasMatrices[m][i].length; j++) {
                    if (Math.random() > offspring.mutationRate) {
                        // Select from parent (50/50 chance)
                        if (Math.random() > 0.5) {
                            offspring.biasMatrices[m][i][j] = parent1.biasMatrices[m][i][j];
                        } else {
                            offspring.biasMatrices[m][i][j] = parent2.biasMatrices[m][i][j];
                        }
                    } else {
                        // Mutate
                        offspring.biasMatrices[m][i][j] = (Math.random() - 0.5) * 2 * limit;
                    }
                }
            }
        }

        return offspring;
    }
}

// Activation functions
export function activate(value: number, activation: ActivationFunction): number {
    switch (activation) {
        case "identity":
            return value;
        case "binary":
            return value > 0 ? 1 : 0;
        case "softsign":
            return value / (1 + Math.abs(value));
        case "relu":
            return value < 0 ? 0 : value;
        case "tanh":
            return Math.tanh(value);
        case "sigmoid":
            return 1 / (1 + Math.exp(-value));
        default:
            console.log("No valid activation function selected");
            return value;
    }
}
