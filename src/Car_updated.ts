// Modern Car Implementation for Smart Race
// TypeScript class with proper typing and p5.js integration

import { NeuralNet, ActivationFunction } from './neuralNet';
import p5 from 'p5';

export interface CarConfig {
    nnLayers?: number;
    nnNeurons?: number;
    nnInputs?: number;
    nnOutputs?: number;
    nnRange?: number;
    nnMutationRate?: number;
    nnActivation?: ActivationFunction;
    maxSpeed?: number;
    maxReverse?: number;
    sensorRange?: number;
}

export interface RGB {
    r: number;
    g: number;
    b: number;
}

export class Car {
    public config: Required<CarConfig>;
    public paintRGB: RGB;
    public paint: string;

    // Physics properties
    public pos: p5.Vector;
    public speed: number = 0;
    public acceleration: number = 0;
    public direction: number;
    public maxSpeed: number;
    public maxReverse: number;

    // Sensor properties
    public sensorCount: number = 7;
    public sensorRange: number;
    public sensorIncrements: number = 30;
    public sensorDistances?: number[];

    // Car dimensions
    public width: number = 20;
    public height: number = 10;

    // Neural network brain
    public brain: NeuralNet;

    // Performance tracking
    public generation: number = 0;
    public isAlive: boolean = true;
    public timeSurvived: number = 0;
    public distanceTraveled: number = 0;
    private lastPos: p5.Vector;

    constructor(
        startX: number,
        startY: number,
        startDir: number,
        config: CarConfig = {},
        p5Instance?: p5
    ) {
        // Configuration with defaults
        this.config = {
            nnLayers: config.nnLayers || 2,
            nnNeurons: config.nnNeurons || 6,
            nnInputs: config.nnInputs || 8,
            nnOutputs: config.nnOutputs || 2,
            nnRange: config.nnRange || 1,
            nnMutationRate: config.nnMutationRate || 0.1,
            nnActivation: config.nnActivation || "relu",
            maxSpeed: config.maxSpeed || 5,
            maxReverse: config.maxReverse || -2,
            sensorRange: config.sensorRange || 120
        };

        // Car visual properties
        this.paintRGB = {
            r: Math.floor(Math.random() * 255),
            g: Math.floor(Math.random() * 255),
            b: Math.floor(Math.random() * 255)
        };
        this.paint = `rgb(${this.paintRGB.r},${this.paintRGB.g},${this.paintRGB.b})`;

        // Physics properties
        this.pos = p5Instance ?
            p5Instance.createVector(startX, startY) :
            { x: startX, y: startY } as p5.Vector;

        this.direction = startDir;
        this.maxSpeed = this.config.maxSpeed;
        this.maxReverse = this.config.maxReverse;
        this.sensorRange = this.config.sensorRange;

        // Neural network brain
        this.brain = new NeuralNet(
            this.config.nnLayers,
            this.config.nnNeurons,
            this.config.nnInputs,
            this.config.nnOutputs,
            this.config.nnRange,
            this.config.nnMutationRate,
            this.config.nnActivation
        );

        // Initialize last position
        this.lastPos = p5Instance ?
            p5Instance.createVector(startX, startY) :
            { x: startX, y: startY } as p5.Vector;
    }

    // Updates car physics and position
    public update(deltaTime: number, trackMap: number[][], resolution: number, p5Instance: p5): void {
        if (!this.isAlive) return;

        this.timeSurvived += deltaTime;

        // Update speed with acceleration
        this.speed += this.acceleration;
        this.speed = p5Instance.constrain(this.speed, this.maxReverse, this.maxSpeed);

        // Check collision with track boundaries
        const gridX = Math.floor(this.pos.x / resolution);
        const gridY = Math.floor(this.pos.y / resolution);

        if (this.isOutOfBounds(gridX, gridY, trackMap)) {
            this.isAlive = false;
            this.speed = 0;
            return;
        }

        // Update position
        const normalizedDeltaTime = deltaTime / (1000 / 60); // Normalize to 60 FPS
        this.pos.x += this.speed * Math.cos(this.direction) * normalizedDeltaTime;
        this.pos.y += this.speed * Math.sin(this.direction) * normalizedDeltaTime;

        // Track distance traveled for fitness
        this.distanceTraveled += p5.Vector.dist(this.pos, this.lastPos);
        this.lastPos = p5Instance.createVector(this.pos.x, this.pos.y);
    }

    // Check if car is out of bounds or hit wall
    private isOutOfBounds(gridX: number, gridY: number, trackMap: number[][]): boolean {
        if (gridX < 0 || gridY < 0 ||
            gridX >= trackMap.length ||
            gridY >= trackMap[0].length) {
            return true;
        }
        return trackMap[gridX][gridY] === 0;
    }

    // Render car on canvas
    public show(p5Instance: p5, carSprite?: p5.Image, showInputs: boolean = false): void {
        if (!this.isAlive) return;

        p5Instance.push();
        p5Instance.translate(this.pos.x, this.pos.y);
        p5Instance.rotate(this.direction);

        if (carSprite) {
            // Use sprite if provided
            p5Instance.imageMode(p5Instance.CENTER);
            p5Instance.tint(this.paintRGB.r, this.paintRGB.g, this.paintRGB.b);
            p5Instance.image(carSprite, 0, 0, this.width, this.height);
            p5Instance.noTint();
        } else {
            // Draw simple rectangle if no sprite
            p5Instance.fill(this.paintRGB.r, this.paintRGB.g, this.paintRGB.b);
            p5Instance.stroke(255);
            p5Instance.rectMode(p5Instance.CENTER);
            p5Instance.rect(0, 0, this.width, this.height);
        }

        p5Instance.pop();

        // Draw sensor lines if enabled
        if (showInputs) {
            this.drawSensors(p5Instance);
        }
    }

    // Draw sensor visualization
    private drawSensors(p5Instance: p5): void {
        if (!this.sensorDistances) return;

        p5Instance.stroke(255, 100);
        for (let i = 0; i < this.sensorCount; i++) {
            const angle = this.direction + ((i - 3) / 10) * Math.PI;
            const distance = this.sensorDistances[i];
            const endX = this.pos.x + distance * Math.cos(angle);
            const endY = this.pos.y + distance * Math.sin(angle);
            p5Instance.line(this.pos.x, this.pos.y, endX, endY);
        }
    }

    // Control car movement based on neural network output
    public drive(output: number[], deltaTime: number): void {
        if (!this.isAlive) return;

        const normalizedDeltaTime = deltaTime / (1000 / 60);

        // Acceleration control
        const throttleInput = output[0];
        if ((throttleInput > 0 && this.speed >= 0) || this.speed < 0) {
            this.acceleration = throttleInput * 0.05;
        } else {
            this.acceleration = throttleInput * 0.15;
        }

        // Steering control
        const steerInput = output[1];
        const steerSensitivity = 0.05;
        const speedFactor = 1 - 1 / (1 + Math.abs(this.speed));
        this.direction += steerInput * steerSensitivity * speedFactor * Math.sign(this.speed) * normalizedDeltaTime;
    }

    // Get sensor data for neural network input
    public getInputs(trackMap: number[][], resolution: number): number[] {
        if (!this.isAlive) return new Array(this.config.nnInputs).fill(0);

        const inputs = new Array(this.config.nnInputs).fill(0);
        this.sensorDistances = new Array(this.sensorCount).fill(0);

        // Include current speed as input
        inputs[this.sensorCount] = this.speed / this.maxSpeed; // Normalized speed

        // Cast rays in different directions
        for (let i = 0; i < this.sensorCount; i++) {
            const angle = this.direction + ((i - 3) / 10) * Math.PI;
            const distance = this.castRay(angle, trackMap, resolution);

            inputs[i] = distance / this.sensorRange; // Normalized distance
            this.sensorDistances[i] = distance;
        }

        return inputs;
    }

    // Cast a ray from car position to detect walls
    private castRay(angle: number, trackMap: number[][], resolution: number, maxDistance: number = this.sensorRange): number {
        const stepSize = 4;
        let distance = 0;

        while (distance < maxDistance) {
            const x = this.pos.x + distance * Math.cos(angle);
            const y = this.pos.y + distance * Math.sin(angle);

            const gridX = Math.floor(x / resolution);
            const gridY = Math.floor(y / resolution);

            if (this.isOutOfBounds(gridX, gridY, trackMap)) {
                return distance;
            }

            distance += stepSize;
        }

        return maxDistance;
    }

    // Think using neural network and control car
    public think(trackMap: number[][], resolution: number, deltaTime: number): void {
        if (!this.isAlive) return;

        const inputs = this.getInputs(trackMap, resolution);
        const outputs = this.brain.output(inputs);
        this.drive(outputs, deltaTime);
    }

    // Calculate fitness based on performance
    public calculateFitness(): number {
        let fitness = 0;

        // Reward survival time
        fitness += this.timeSurvived * 0.1;

        // Reward distance traveled
        fitness += this.distanceTraveled * 0.5;

        // Reward speed (but not too much to avoid just going fast and crashing)
        fitness += Math.abs(this.speed) * 0.01;

        this.brain.fitness = fitness;
        return fitness;
    }

    // Reset car to starting position
    public reset(startX: number, startY: number, startDir: number, p5Instance: p5): void {
        this.pos = p5Instance.createVector(startX, startY);
        this.speed = 0;
        this.acceleration = 0;
        this.direction = startDir;
        this.isAlive = true;
        this.timeSurvived = 0;
        this.distanceTraveled = 0;
        this.lastPos = p5Instance.createVector(startX, startY);
        this.brain.resetFitness();
    }

    // Create a mutated copy of this car
    public mutate(): void {
        this.brain.mutate();
    }

    // Get a copy of this car for breeding
    public copy(p5Instance: p5): Car {
        const newCar = new Car(this.pos.x, this.pos.y, this.direction, this.config, p5Instance);
        newCar.brain = this.brain.copy();
        newCar.generation = this.generation;
        return newCar;
    }
}

// Utility function for breeding cars
export function breedCars(
    parent1: Car,
    parent2: Car,
    startX: number,
    startY: number,
    startDir: number,
    config: CarConfig,
    p5Instance: p5
): Car {
    const offspring = new Car(startX, startY, startDir, config, p5Instance);
    offspring.brain = NeuralNet.breed(parent1.brain, parent2.brain);
    offspring.generation = Math.max(parent1.generation, parent2.generation) + 1;
    return offspring;
}