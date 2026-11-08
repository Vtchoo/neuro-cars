import { Effects } from "./Effects";
import { Random } from "./Random";
import Car from "../Car";
import Track, { TrackPieceType } from "../Track";
import { Vector } from "../Vector";
import { NeuralNet, type NeuralNetTrace } from "../NeuralNet";
import {
  f1CarPreset,
  supercarPreset,
  type CarPreset,
} from "../cars/carPresets";
import {
  kMeansClustering,
  analyzeClusters,
  type ClusterGroup,
} from "../utils/neuralNetClustering";

const trackWidth = 120,
  eliteSize = 7;
const breedingMethod: "pair" | "elite" | "clone" = "pair";

type CycleStartPointMode =
  | "off"
  | "sequential"
  | "random"
  | "sequentialContinuous"
  | "randomPoint";

function normalizeCycleStartPoint(value: string): CycleStartPointMode {
  const modes: CycleStartPointMode[] = [
    "off",
    "sequential",
    "random",
    "sequentialContinuous",
    "randomPoint",
  ];
  const mode = modes.find(
    (mode) => mode.toLowerCase() === value.trim().toLowerCase(),
  );
  if (!mode) throw new Error(`Unknown cycleStartPoint mode: ${value}`);
  return mode;
}

/** Simulation state and fixed-step logic; no renderer, DOM, or animation loop. */
export default class Game<C extends Car = Car, T extends Track = Track> {
  readonly effects = new Effects();
  private rng = new Random(0);
  readonly random = () => this.rng.next();
  constructor(
    seed = (Date.now() ^ Math.floor(Math.random() * 4294967296)) >>> 0,
  ) {
    this.rng.state = seed >>> 0;
  }
  private accumulatedSeconds = 0;

  /** Both browser adapters feed elapsed time into this same 60 Hz simulation clock. */
  advance(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.accumulatedSeconds += Math.min(seconds, 0.25);
    while (this.accumulatedSeconds >= 1 / 60) {
      this.accumulatedSeconds -= 1 / 60;
      this.step();
    }
  }

  step() {
    if (this.phase === "setup") this.setupPopulation();
    else if (this.phase === "running") this.tickSimulation();
    else if (this.phase === "breeding") this.breedGeneration();
    this.effects.update(
      this.population,
      this.playerDrive ? this.player : undefined,
      this.showExplosions,
      this.showHelicopters && this.phase === "running",
    );
  }
  phase = "menu";
  history = {
    maxFitness: [0],
    avgFitness: [0],
    maxFitnessNormal: [0],
    avgFitnessNormal: [0],
  };
  playerDrive = false;
  player!: C;
  clusteringResults: ClusterGroup[] | null = null;
  showClustering = false;
  track = this.createTrack();
  population: C[] = [];
  carConfig: CarPreset = f1CarPreset;
  lapRecords: { ticks: number; driverName: string; generation: number }[] = [];
  bestLapTime: number | null = null;
  public showExplosions = false;
  public showHelicopters = true;
  followBestCar: "off" | "best" | "bestActive" = "off";
  followCar: C | null = null;
  helicopterCamera: number | null = null;
  /** Only adapters capable of an onboard view advertise these camera modes. */
  get helicopterCameraCount() {
    return 0;
  }
  get followLabel() {
    return this.helicopterCamera !== null
      ? `Helicopter ${this.helicopterCamera + 1} camera`
      : this.followCar
        ? `Follow: ${this.followCar.driverName}`
        : `Follow best: ${this.followBestCar}`;
  }
  public readonly decisionsPerSecond = 60;
  direction = 0;
  start = new Vector(0, 0);
  increaseMaxTicksIfBestCarIsRunning = true;
  public showGrid = true;
  public showMap = false;
  public showInputs: "none" | "all" | "best" | "bestActive" = "none";
  public drawGraphs = false;
  public showNeuralNet = false;
  public bottomRightDisplay: "grip" | "minimap" | "none" = "none";
  cycleBottomRightDisplay() {
    const modes = ["grip", "minimap", "none"] as const;
    this.bottomRightDisplay =
      modes[(modes.indexOf(this.bottomRightDisplay) + 1) % modes.length];
    return this.bottomRightDisplay;
  }
  public lastNNTrace: NeuralNetTrace | null = null;
  setShowGrid(show: boolean) {
    this.showGrid = show;
  }
  setShowMap(show: boolean) {
    this.showMap = show;
  }
  setDrawGraphs(show: boolean) {
    this.drawGraphs = show;
  }
  toggleShowGrid() {
    this.showGrid = !this.showGrid;
  }
  toggleShowMap() {
    this.showMap = !this.showMap;
  }
  toggleShowInputs() {
    const options = ["none", "all", "best", "bestActive"] as const;
    const currentIndex = options.indexOf(this.showInputs);
    const nextIndex = (currentIndex + 1) % options.length;
    this.showInputs = options[nextIndex];
    return this.showInputs;
  }
  toggleFollowBestCar() {
    this.followCar = null;
    if (this.helicopterCamera !== null) {
      this.helicopterCamera++;
      if (this.helicopterCamera >= this.helicopterCameraCount)
        this.helicopterCamera = null;
      this.followBestCar = "off";
    } else if (this.followBestCar === "off") this.followBestCar = "best";
    else if (this.followBestCar === "best") this.followBestCar = "bestActive";
    else {
      this.followBestCar = "off";
      if (this.helicopterCameraCount && this.showHelicopters)
        this.helicopterCamera = 0;
    }
    return this.followBestCar;
  }
  followNextCar() {
    this.helicopterCamera = null;
    // sort in alphabetical order
    const cars = [...this.population].sort((a, b) => {
      const nameA = a.driverName || "";
      const nameB = b.driverName || "";
      return nameA.localeCompare(nameB);
    });
    if (!this.followCar) {
      this.followCar = cars[0];
    } else {
      const currentIndex = cars.indexOf(this.followCar);
      const nextIndex = (currentIndex + 1) % cars.length;
      this.followCar = cars[nextIndex];
    }
    this.followBestCar = "off";
    return this.followCar;
  }
  followPreviousCar() {
    this.helicopterCamera = null;
    // sort in alphabetical order
    const cars = [...this.population].sort((a, b) => {
      const nameA = a.driverName || "";
      const nameB = b.driverName || "";
      return nameA.localeCompare(nameB);
    });
    if (!this.followCar) {
      this.followCar = cars[cars.length - 1];
    } else {
      const currentIndex = cars.indexOf(this.followCar);
      const previousIndex = (currentIndex - 1 + cars.length) % cars.length;
      this.followCar = cars[previousIndex];
    }
    this.followBestCar = "off";
    return this.followCar;
  }
  toggleDrawGraphs() {
    this.drawGraphs = !this.drawGraphs;
  }
  toggleShowNeuralNet() {
    this.showNeuralNet = !this.showNeuralNet;
    return this.showNeuralNet;
  }
  getFollowedCar(): C | null {
    if (this.helicopterCamera !== null) return null;
    if (this.followCar) return this.followCar;
    if (this.followBestCar === "off" || this.population.length === 0)
      return null;
    const bestCar = this.population.reduce(
      (b, c) => (c.neuralNet.fitness > b.neuralNet.fitness ? c : b),
      this.population[0],
    );
    const activeCars = this.population.filter((c) => c.speed > 0.001);
    const bestActiveCar = activeCars.length
      ? activeCars.reduce(
          (b, c) => (c.neuralNet.fitness > b.neuralNet.fitness ? c : b),
          activeCars[0],
        )
      : null;
    return this.followBestCar === "best" || !bestActiveCar
      ? bestCar
      : bestActiveCar;
  }
  ticks = 0;
  generation = 0;
  readonly events = new EventTarget();
  private _maxTicks = 1000;
  get maxTicks() {
    return this._maxTicks;
  }
  set maxTicks(value: number) {
    if (value === this._maxTicks) return;
    this._maxTicks = value;
    this.events.dispatchEvent(
      new CustomEvent<number>("maxTicksChanged", { detail: value }),
    );
  }
  private _cycleStartPoint: CycleStartPointMode = "randomPoint";
  get cycleStartPoint() {
    return this._cycleStartPoint;
  }
  set cycleStartPoint(value: string) {
    // C# saves serialize enum names in lowercase; retain the browser's canonical names.
    this._cycleStartPoint = normalizeCycleStartPoint(value);
  }
  startPointIndex = 0;
  startPointOffset = 0;
  sequentialContinuousStep = 1000;
  incrementMaxTicks(increment: number) {
    this.maxTicks += increment;
  }
  setPhase(newPhase: string) {
    this.phase = newPhase === "resetTrack" ? "setStart" : newPhase;
    if (newPhase === "resetTrack") this.track = this.createTrack();
    this.events.dispatchEvent(
      new CustomEvent("phaseChanged", { detail: this.phase }),
    );
  }
  placeStart(point: { x: number; y: number }) {
    this.start = new Vector(point.x, point.y);
    this.track.startingPoint = this.start;
    this.setPhase("rotateStart");
  }
  orientStart(point: { x: number; y: number }) {
    this.direction = Math.atan2(point.y - this.start.y, point.x - this.start.x);
    this.track.startingDirection = this.direction;
    this.setPhase("buildTrack");
  }
  public restoreGameState(saveData: any) {
    if (
      !saveData?.track ||
      !saveData?.game ||
      !Array.isArray(saveData.population) ||
      !saveData.population.length
    ) {
      throw new Error(
        "Save must contain a track, game state, and a nonempty population.",
      );
    }
    const cycleMode = normalizeCycleStartPoint(
      saveData.game.cycleStartPoint ?? this.cycleStartPoint,
    );
    // Invalidate clustering results from previous session
    this.clusteringResults = null;
    this.lapRecords = [];
    this.bestLapTime = null;

    // Restore track
    this.track = this.createTrack(saveData.track);

    // Regenerate track graphics

    // Restore car config (fall back to supercar preset if not present)
    this.carConfig = saveData.carConfig ?? supercarPreset;

    console.log(saveData.carConfig);
    // Restore game state
    this.generation = saveData.game.generation;
    this.ticks = saveData.game.ticks;
    this.maxTicks = saveData.game.maxTicks;
    this.startPointIndex = saveData.game.startPointIndex;
    this.startPointOffset = saveData.game.startPointOffset ?? 0;
    this.cycleStartPoint = cycleMode;

    // Restore population
    this.population = saveData.population.map((carData: any) => {
      const car = this.createCar(
        carData.position.x,
        carData.position.y,
        carData.direction,
        carData.generation,
        this.carConfig,
      );
      car.neuralNet = NeuralNet.fromData(carData.NN, this.random);
      car.generation = carData.generation;
      car.speed = carData.speed;
      car.acceleration = carData.acceleration;
      car.paintRGB = carData.paintRGB;
      car.driverName = carData.driverName;
      car.lastDrivingWheelDirection = carData.lastDrivingWheelDirection || 0;
      return car;
    });

    // Update start position from track
    this.start = this.track.startingPoint;
    this.direction = this.track.startingDirection;

    this.player = this.createCar(
      this.start.x,
      this.start.y,
      this.direction,
      undefined,
      this.carConfig,
    );

    // Set phase to running
    if (Number.isInteger(saveData.randomState))
      this.rng.state = saveData.randomState >>> 0;
    this.accumulatedSeconds = 0;
    this.effects.reset();
    this.helicopterCamera = null;
    this.followCar = null;
    this.setPhase("running");
    this.events.dispatchEvent(new Event("gameLoaded"));
  }
  pistonCup() {
    const cars = ["Lightning McQueen", "The King", "Chick Hicks"];

    this.population.forEach((car) => {
      car.driverName = cars[Math.floor(this.random() * cars.length)];
    });
  }
  performClusteringAnalysis() {
    console.log("🧠 Analyzing neural network clusters...");

    try {
      const kMeansResult = kMeansClustering(this.population, 5);
      this.clusteringResults = kMeansResult;

      const analysis = analyzeClusters(kMeansResult);

      console.log("📊 Clustering Analysis Results:");
      console.log(`Total cars analyzed: ${this.population.length}`);
      console.log(`Number of clusters: ${kMeansResult.length}`);

      kMeansResult.forEach((cluster, index) => {
        console.log(
          `Species ${index + 1}: ${cluster.size} cars, Avg similarity: ${cluster.avgIntraSimlarity.toFixed(3)}`,
        );
      });

      console.log(analysis);
      console.log("Press 'V' to toggle visualization");
    } catch (error) {
      console.error("Error performing clustering analysis:", error);
    }
  }
  public clusterColors = [
    [255, 80, 80], // Red
    [80, 220, 80], // Green
    [80, 120, 255], // Blue
    [255, 220, 50], // Yellow
    [220, 80, 255], // Magenta
    [80, 220, 220], // Cyan
  ];
  getClusterTint(car: Car): string | undefined {
    if (!this.clusteringResults) return undefined;
    const idx = this.clusteringResults.findIndex((cluster) =>
      cluster.cars.includes(car),
    );
    if (idx === -1) return undefined;
    const [r, g, b] = this.clusterColors[idx % this.clusterColors.length];
    return `rgb(${r},${g},${b})`;
  }
  toggleShowClustering() {
    this.showClustering = !this.showClustering;
    if (
      this.showClustering &&
      !this.clusteringResults &&
      this.population.length > 1
    ) {
      this.performClusteringAnalysis();
    }
    return this.showClustering;
  }

  createCar(
    x: number,
    y: number,
    direction: number,
    generation?: number,
    preset?: CarPreset,
  ): C {
    return new Car(x, y, direction, generation, preset, this.random) as C;
  }
  createTrack(data?: any): T {
    return (data ? Track.fromData(data) : new Track()) as T;
  }
  setupPopulation(count = 100) {
    this.population = Array.from({ length: count }, () =>
      this.createCar(
        this.start.x,
        this.start.y,
        this.direction,
        this.generation,
        this.carConfig,
      ),
    );
    this.player = this.createCar(
      this.start.x,
      this.start.y,
      this.direction,
      undefined,
      this.carConfig,
    );
    this.setPhase("running");
  }

  tickSimulation() {
    if (!this.population.length) return;
    const shouldMakeDecision =
      this.ticks % Math.floor(60 / this.decisionsPerSecond) === 0;

    // Updates each individual
    this.population.forEach((individual) => {
      const shouldUpdateSensors =
        shouldMakeDecision ||
        this.showInputs === "all" ||
        this.getFollowedCar() === individual;

      const sensorsData = shouldUpdateSensors
        ? individual.updateSensors(this.track)
        : individual.lastInputs;
      if (shouldMakeDecision) {
        individual.lastInputs = individual.neuralNet.output(sensorsData);
      }
      individual.drive();
      individual.update(this.track, false, this.ticks);
      if (individual.justCrashed) {
        if (this.showExplosions)
          this.effects.spawn(individual.pos.x, individual.pos.y);
        this.events.dispatchEvent(
          new CustomEvent("carCrashed", { detail: individual }),
        );
      }
      if (individual.lastCompletedLapTicks !== null) {
        if (
          this.bestLapTime === null ||
          individual.lastCompletedLapTicks < this.bestLapTime
        ) {
          this.bestLapTime = individual.lastCompletedLapTicks;
          this.lapRecords.push({
            ticks: individual.lastCompletedLapTicks,
            driverName: individual.driverName,
            generation: this.generation,
          });
          console.log(
            `New best lap: ${individual.lastCompletedLapTicks} ticks by ${individual.driverName} (gen ${this.generation})`,
          );
        }
        individual.lastCompletedLapTicks = null;
      }
    });

    // Compute neural-net trace for the followed car (used by the visualizer)
    if (this.showNeuralNet) {
      const followed = this.getFollowedCar();
      if (followed) {
        const tracedInputs = followed.updateSensors(this.track);
        this.lastNNTrace = followed.neuralNet.forwardWithTrace(tracedInputs);
      } else {
        this.lastNNTrace = null;
      }
    }

    if (this.playerDrive && this.player) {
      this.player.drive();
      this.player.update(this.track, true);
      if (this.player.justCrashed && this.showExplosions)
        this.effects.spawn(this.player.pos.x, this.player.pos.y);
      if (this.player.justCrashed)
        this.events.dispatchEvent(
          new CustomEvent("carCrashed", { detail: this.player }),
        );
    }
    const everyCarIsStopped = this.population.every(
      (car) => car.speed < 0.0001,
    );
    this.ticks++;
    if ((everyCarIsStopped && this.ticks > 100) || this.ticks >= this.maxTicks)
      this.setPhase("breeding");
  }

  breedGeneration() {
    if (!this.population.length) return;
    const individuals = this.population.length,
      offspring = Math.min(20, Math.floor(individuals / 2));
    // Sort the population by fitness
    this.population.sort(function (a, b) {
      return b.neuralNet.fitness - a.neuralNet.fitness;
    });

    this.population.forEach((car) => car.fadeColor());

    if (
      this.increaseMaxTicksIfBestCarIsRunning &&
      this.population[0].speed > 0.01
    ) {
      console.log(
        "Best car is still moving, next generation will have more time to run",
      );
      // add some extra frames cause the best car hasn't actually stopped but just got very slow, so we give it some extra time to see if it can get unstuck and keep going
      this.maxTicks += 100;
    }

    // And stores data into the data logging arrays
    this.history.maxFitness.push(this.population[0].neuralNet.fitness);

    const avgFitnessGen =
      this.population.reduce(
        (sum, individual) => sum + individual.neuralNet.fitness,
        0,
      ) / this.population.length;
    this.history.avgFitness.push(avgFitnessGen);

    // Normalizes the fitnesses to show on a graph
    var maxTotalFitness = 0;
    for (let i = 0; i < this.history.maxFitness.length; i++) {
      maxTotalFitness =
        this.history.maxFitness[i] > maxTotalFitness
          ? this.history.maxFitness[i]
          : maxTotalFitness;
    }
    for (let i = 0; i < this.history.maxFitness.length; i++) {
      this.history.maxFitnessNormal[i] =
        this.history.maxFitness[i] / maxTotalFitness;
      this.history.avgFitnessNormal[i] =
        this.history.avgFitness[i] / maxTotalFitness;
    }

    // Generates new neural net and replaces the worst individuals
    switch (breedingMethod) {
      case "pair": {
        for (let i = 0; i < offspring; i++) {
          const newCar = this.createCar(
            this.start.x,
            this.start.y,
            this.direction,
            this.generation + 1,
            this.carConfig,
          );
          newCar.neuralNet = NeuralNet.breed(
            this.population[2 * i].neuralNet,
            this.population[2 * i + 1].neuralNet,
          );
          this.population[individuals - 1 - i] = newCar;
        }
        break;
      }
      case "elite": {
        const offspring: C[] = [];
        for (let i = 0; i < Math.min(eliteSize, individuals); i++) {
          for (let j = i + 1; j < Math.min(eliteSize, individuals); j++) {
            const newCar = this.createCar(
              this.start.x,
              this.start.y,
              this.direction,
              this.generation + 1,
              this.carConfig,
            );
            newCar.neuralNet = NeuralNet.breed(
              this.population[i].neuralNet,
              this.population[j].neuralNet,
            );
            offspring.push(newCar);
          }
        }
        // replace the worst individuals with the offspring
        for (let i = 0; i < offspring.length && i < individuals; i++) {
          this.population[individuals - 1 - i] = offspring[i];
        }
        break;
      }
      case "clone": {
        for (let i = 0; i < offspring; i++) {
          const newCar = this.createCar(
            this.start.x,
            this.start.y,
            this.direction,
            this.generation + 1,
            this.carConfig,
          );
          newCar.neuralNet = this.population[i].neuralNet.copy();
          newCar.neuralNet.mutate();
          this.population[individuals - 1 - i] = newCar;
        }
        break;
      }
    }

    let startingPoint = this.start;
    let startingDirection = this.direction;
    if (this.cycleStartPoint !== "off") {
      switch (this.cycleStartPoint) {
        case "sequential": {
          let newStartPiece;
          while (!newStartPiece) {
            this.startPointIndex =
              (this.startPointIndex + 1) % this.track.pieces.length;
            const candidate = this.track.pieces[this.startPointIndex];
            if (candidate.type === TrackPieceType.Arc) {
              const radius = Vector.sub(
                candidate.center,
                candidate.start,
              ).mag();
              if (radius < trackWidth) continue;
            }
            newStartPiece = candidate;
          }
          startingPoint = newStartPiece.start;
          startingDirection = Track.getTrackPieceStartDirection(newStartPiece);
          break;
        }
        case "random": {
          let newStartPiece;
          while (!newStartPiece) {
            this.startPointIndex = Math.floor(
              this.random() * this.track.pieces.length,
            );
            const candidate = this.track.pieces[this.startPointIndex];
            if (candidate.type === TrackPieceType.Arc) {
              const radius = Vector.sub(
                candidate.center,
                candidate.start,
              ).mag();
              if (radius < trackWidth) continue;
            }
            newStartPiece = candidate;
          }
          startingPoint = newStartPiece.start;
          startingDirection = Track.getTrackPieceStartDirection(newStartPiece);
          break;
        }
        case "sequentialContinuous": {
          const result = Track.getPointAtDistance(
            this.track.analyticPieces,
            this.startPointIndex,
            this.startPointOffset,
            this.sequentialContinuousStep,
          );
          this.startPointIndex = result.pieceIndex;
          this.startPointOffset = result.offsetInPiece;
          startingPoint = result.point;
          startingDirection = result.direction;
          break;
        }
        case "randomPoint": {
          const totalLength = this.track.analyticPieces.reduce(
            (sum, p) => sum + Track.getTrackPieceLength(p),
            0,
          );
          const result = Track.getPointAtDistance(
            this.track.analyticPieces,
            0,
            0,
            this.random() * totalLength,
          );
          this.startPointIndex = result.pieceIndex;
          this.startPointOffset = result.offsetInPiece;
          startingPoint = result.point;
          startingDirection = result.direction;
          break;
        }
      }
    }

    // Resets every individual's car
    for (const individual of this.population) {
      const pointFromRadius = Math.sqrt(this.random());
      const radius = (pointFromRadius * trackWidth) / 4;
      const angle = this.random() * 2 * Math.PI;
      const initialPosition = new Vector(
        startingPoint.x + radius * Math.cos(angle),
        startingPoint.y + radius * Math.sin(angle),
      );
      individual.pos = initialPosition;
      // individual.pos = new Vector(startingPoint.x + (this.random() - 0.5) * trackWidth / 2, startingPoint.y + (this.random() - 0.5) * trackWidth / 2)
      individual.speed = 0;
      individual.direction = startingDirection;
      individual.acceleration = 0;
      individual.lastDrivingWheelDirection = 0;
      individual.lastCarPositionInTrack = null;
      individual.resetLap();
      individual.neuralNet.resetFitness();
    }

    if (this.playerDrive) {
      // Resets player's car
      // this.player.pos = new Vector(this.start.x, this.start.y)
      // this.player.speed = 0
      // this.player.direction = this.direction
      // this.player.lastCarPositionInTrack = null
    }

    this.ticks = 0;
    this.generation++;

    // Re-cluster population after every generation
    if (this.population.length > 1) {
      this.performClusteringAnalysis();
    }

    this.setPhase("running");
    this.events.dispatchEvent(new Event("generationChanged"));
  }

  exportState() {
    return {
      version: "1.0",
      randomState: this.rng.state,
      timestamp: new Date().toISOString(),
      track: this.track.exportData(),
      game: {
        generation: this.generation,
        ticks: this.ticks,
        maxTicks: this.maxTicks,
        startPointIndex: this.startPointIndex,
        startPointOffset: this.startPointOffset,
        cycleStartPoint: this.cycleStartPoint,
      },
      carConfig: this.carConfig,
      population: this.population.map((car) => ({
        NN: car.neuralNet.exportData(),
        generation: car.generation,
        position: { x: car.pos.x, y: car.pos.y },
        speed: car.speed,
        direction: car.direction,
        acceleration: car.acceleration,
        lastDrivingWheelDirection: car.lastDrivingWheelDirection,
        paintRGB: car.paintRGB,
        driverName: car.driverName,
      })),
    };
  }
}
