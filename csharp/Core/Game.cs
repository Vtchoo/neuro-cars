using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using System.Diagnostics;
using SmartRace.Core;
using SmartRace.Utils;

namespace SmartRace.Core
{
    public enum BreedingMethod
    {
        Pair,    // breeds the best with the second best, etc.
        Elite,   // elite individuals breed with each other 
        Clone    // clones and mutates the best
    }

    public enum CycleStartPoint
    {
        Off,
        Sequential,
        Random
    }

    // Note: JSON mapping classes are now in JsonMapping.cs for compatibility

    // Headless training-focused game engine
    public class Game
    {
        // Training configuration
        private const int Individuals = 100;
        private const int TrackWidth = 120;
        private const double AvgDeltaTime = 1.0 / 60.0;

        // High-frequency simulation settings
        private const int TargetTicksPerSecond = 1000; // Much faster than 60fps
        private const double TickInterval = 1.0 / TargetTicksPerSecond;

        // Population and breeding settings
        private readonly BreedingMethod breedingMethod = BreedingMethod.Pair;
        private const int Offspring = 20;
        private const int EliteSize = 7;

        // Game state
        public int Generation { get; private set; } = 0;
        public int Ticks { get; private set; } = 0;
        public int MaxTicks { get; private set; } = 1000;
        public int CapTicks { get; private set; } = 15000;
        public CarConfigJson CarConfig { get; set; } = JsonMapping.SupercarConfig;
        
        // Track and population
        private ITrack track;
        private Car[] population;
        private Vector start;
        private double direction;

        // Training progress tracking
        public List<double> MaxFitness { get; private set; } = [0];
        public List<double> AvgFitness { get; private set; } = [0];

        // Start point cycling for robust training
        public CycleStartPoint CycleStartPoint 
        { 
            get => cycleStartPoint; 
            set => cycleStartPoint = value; 
        }
        private CycleStartPoint cycleStartPoint = CycleStartPoint.Sequential;
        private int startPointIndex = 0;

        // Events for progress reporting
        public event Action<int, double, double, double> GenerationCompleted; // generation, maxFitness, avgFitness, fitnessPerTick
        public event Action<int> TickCompleted; // ticks
        public event Action<string> StatusUpdated;

        private readonly Stopwatch stopwatch = new Stopwatch();
        
        public Game()
        {
        }

        // Load game state from JSON file
        public async Task<bool> LoadGameAsync(string jsonFilePath)
        {
            try
            {
                StatusUpdated?.Invoke($"Loading game from {jsonFilePath}...");
                
                string jsonContent = await File.ReadAllTextAsync(jsonFilePath);
                
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    NumberHandling = JsonNumberHandling.AllowReadingFromString
                };
                
                var saveData = JsonSerializer.Deserialize<GameSaveDataJson>(jsonContent, options);
                
                return RestoreGameState(saveData);
            }
            catch (Exception ex)
            {
                StatusUpdated?.Invoke($"Error loading game: {ex.Message}");
                return false;
            }
        }

        // Create new game with default parameters
        public void CreateNewGame()
        {
            StatusUpdated?.Invoke("Creating new game...");
            
            // Initialize with no track - requires loading from JSON or creating manually
            start = new Vector(0, 0);
            direction = 0;
            track = null;
            
            InitializePopulation();
            
            Generation = 0;
            Ticks = 0;
            MaxTicks = 1000;
            
            StatusUpdated?.Invoke("New game created (no track loaded - load from JSON file to train)");
        }

        // Initialize population with neural networks
        private void InitializePopulation()
        {
            population = new Car[Individuals];
            
            // Use parallel processing for initialization
            Parallel.For(0, Individuals, i =>
            {
                population[i] = new Car(start.X, start.Y, direction, Generation, CarConfig);
            });
            
            StatusUpdated?.Invoke($"Initialized population of {Individuals} cars");
        }

        // Main training loop with high-frequency ticking
        public async Task RunTrainingAsync(int generations, int? maxTicksPerGeneration = null, 
            CancellationToken cancellationToken = default)
        {
            if (population == null)
            {
                StatusUpdated?.Invoke("No population loaded. Create or load a game first.");
                return;
            }

            if (maxTicksPerGeneration.HasValue)
                MaxTicks = maxTicksPerGeneration.Value;

            StatusUpdated?.Invoke($"Starting training for {generations} generations...");
            stopwatch.Start();

            for (int gen = 0; gen < generations; gen++)
            {
                if (cancellationToken.IsCancellationRequested)
                    break;

                await RunGenerationAsync(cancellationToken);
                
                if (gen < generations - 1) // Don't breed after the last generation
                {
                    BreedNewGeneration();
                }
            }

            stopwatch.Stop();
            StatusUpdated?.Invoke($"Training completed in {stopwatch.Elapsed.TotalSeconds:F2} seconds");
        }

        // Run a single generation with high-frequency simulation
        private async Task RunGenerationAsync(CancellationToken cancellationToken)
        {
            Ticks = 0;
            ResetPopulation();
            
            StatusUpdated?.Invoke($"Running generation {Generation}...");

            // High-frequency simulation loop
            while (Ticks < MaxTicks && !cancellationToken.IsCancellationRequested)
            {
                // Parallel processing of all cars
                await SimulateTickParallelAsync();
                
                // Check if all cars have stopped
                if (AllCarsStopped() && Ticks > 10)
                    break;

                Ticks++;
                
                // Report progress every 100 ticks to avoid flooding
                if (Ticks % 100 == 0)
                {
                    TickCompleted?.Invoke(Ticks);
                }

                // Optional: Add small delay to prevent CPU overload in debug scenarios
                // await Task.Delay(1); // Remove for maximum speed
            }

            // Generation completed - calculate and report fitness
            ProcessGenerationResults();
        }

        // Parallel simulation of all cars in a single tick
        private async Task SimulateTickParallelAsync()
        {
            // Skip simulation if no track is loaded
            if (track == null)
            {
                StatusUpdated?.Invoke("Warning: No track loaded, skipping simulation");
                return;
            }

            await Task.Run(() =>
            {
                Parallel.ForEach(population, car =>
                {
                    // Get neural network inputs
                    double[] inputs = car.GetInputs(track);
                        
                    // Get neural network output and drive
                    double[] outputs = car.NeuralNet.Output(inputs);
                    car.Drive(outputs);
                        
                    // Update car physics
                    car.Update(track);
                });
            });
        }

        // Check if all cars have essentially stopped
        private bool AllCarsStopped()
        {
            return population.All(car => car.Speed < 0.01);
        }

        // Process results and update fitness tracking
        private void ProcessGenerationResults()
        {
            // Sort population by fitness (descending)
            Array.Sort(population, (a, b) => b.NeuralNet.Fitness.CompareTo(a.NeuralNet.Fitness));

            // Check if best car is still moving - extend time if needed
            if (population[0].Speed > 0.01 && Ticks < CapTicks)
            {
                MaxTicks += 100;
                StatusUpdated?.Invoke("Best car is still moving, next generation will have more time to run");
            }

            // Calculate fitness statistics
            double maxFitness = population[0].NeuralNet.Fitness;
            double avgFitness = population.Average(car => car.NeuralNet.Fitness);

            MaxFitness.Add(maxFitness);
            AvgFitness.Add(avgFitness);

            // Fade colors for visualization (if needed later)
            foreach (var car in population)
            {
                car.FadeColor();
            }

            var fitnessPerTick = Ticks > 0 ? maxFitness / Ticks : 0;
            
            // Report generation completion
            GenerationCompleted?.Invoke(Generation, maxFitness, avgFitness, fitnessPerTick);

            StatusUpdated?.Invoke($"Generation {Generation}: Max={maxFitness:F2}, Avg={avgFitness:F2}, Ticks={Ticks}, Per tick={fitnessPerTick:F2}");
        }

        // Genetic algorithm breeding
        private void BreedNewGeneration()
        {
            switch (breedingMethod)
            {
                case BreedingMethod.Pair:
                    BreedPairs();
                    break;
                case BreedingMethod.Elite:
                    BreedElite();
                    break;
                case BreedingMethod.Clone:
                    BreedClones();
                    break;
            }

            UpdateStartingPoint();
            Generation++;
        }

        // Breed pairs of best individuals
        private void BreedPairs()
        {
            Parallel.For(0, Offspring, i =>
            {
                var newCar = new Car(start.X, start.Y, direction, Generation + 1, CarConfig);
                newCar.NeuralNet = NeuralNet.Breed(
                    population[2 * i].NeuralNet,
                    population[2 * i + 1].NeuralNet
                );
                population[Individuals - 1 - i] = newCar;
            });
        }

        // Breed elite individuals with each other
        private void BreedElite()
        {
            var offspring = new List<Car>();
            
            for (int i = 0; i < EliteSize; i++)
            {
                for (int j = i + 1; j < EliteSize; j++)
                {
                    var newCar = new Car(start.X, start.Y, direction, Generation + 1, CarConfig);
                    newCar.NeuralNet = NeuralNet.Breed(
                        population[i].NeuralNet,
                        population[j].NeuralNet
                    );
                    offspring.Add(newCar);
                }
            }

            // Replace worst individuals
            for (int i = 0; i < offspring.Count && i < Individuals; i++)
            {
                population[Individuals - 1 - i] = offspring[i];
            }
        }

        // Clone and mutate best individuals
        private void BreedClones()
        {
            Parallel.For(0, Offspring, i =>
            {
                var newCar = new Car(start.X, start.Y, direction, Generation + 1, CarConfig);
                newCar.NeuralNet = population[i].NeuralNet.Copy();
                newCar.NeuralNet.Mutate();
                population[Individuals - 1 - i] = newCar;
            });
        }

        // Update starting point for variety
        private void UpdateStartingPoint()
        {
            if (cycleStartPoint == CycleStartPoint.Off || track?.Pieces == null || track.Pieces.Length == 0)
                return;

            var random = new Random();
            ITrackPiece newStartPiece = null;
            
            // Keep trying until we find a suitable starting piece
            while (newStartPiece == null)
            {
                // Update the start point index based on cycling mode
                if (cycleStartPoint == CycleStartPoint.Sequential)
                {
                    startPointIndex = (startPointIndex + 1) % track.Pieces.Length;
                }
                else if (cycleStartPoint == CycleStartPoint.Random)
                {
                    startPointIndex = random.Next(track.Pieces.Length);
                }

                var startPieceCandidate = track.Pieces[startPointIndex];
                
                // If it's an arc and the radius is too small, skip it because cars would crash immediately
                if (startPieceCandidate.Type == TrackPieceType.Arc)
                {
                    var arcPiece = (IArcPiece)startPieceCandidate;
                    var radiusVector = Vector.Sub(arcPiece.Start, arcPiece.Center);
                    var radius = radiusVector.Mag();
                    
                    if (radius < TrackWidth)
                        continue; // Skip this piece and try the next one
                }
                
                newStartPiece = startPieceCandidate;
            }

            // Update starting point and direction based on the selected piece
            start = new Vector(newStartPiece.Start.X, newStartPiece.Start.Y);
            direction = CalculateStartingDirection(newStartPiece);
            
            StatusUpdated?.Invoke($"Starting point updated to piece {startPointIndex} ({newStartPiece.Type})");
        }

        // Calculate the starting direction based on track piece type
        private double CalculateStartingDirection(ITrackPiece piece)
        {
            switch (piece.Type)
            {
                case TrackPieceType.Straight:
                    // For straight pieces, direction is from start to end
                    var direction = Vector.Sub(piece.End, piece.Start);
                    return Math.Atan2(direction.Y, direction.X);
                    
                case TrackPieceType.Arc:
                    var arcPiece = (IArcPiece)piece;
                    // For arcs, the direction at the start point is tangent to the circle
                    var radiusVector = Vector.Sub(piece.Start, arcPiece.Center);
                    var tangentVector = new Vector(-radiusVector.Y, radiusVector.X); // Rotate 90 degrees
                    
                    if (!arcPiece.Clockwise)
                    {
                        tangentVector = new Vector(-tangentVector.X, -tangentVector.Y); // Flip direction
                    }
                    
                    return Math.Atan2(tangentVector.Y, tangentVector.X);
                    
                default:
                    return 0; // Default direction
            }
        }

        // Reset population for new generation
        private void ResetPopulation()
        {
            var random = new Random();
            
            Parallel.ForEach(population, car =>
            {
                // Small random position variation around start point
                double pointFromRadius = Math.Sqrt(random.NextDouble());
                double radius = pointFromRadius * TrackWidth / 4;
                double angle = random.NextDouble() * 2 * Math.PI;
                
                car.Position = new Vector(
                    start.X + radius * Math.Cos(angle),
                    start.Y + radius * Math.Sin(angle)
                );
                
                car.Speed = 0;
                car.Direction = direction;
                car.Acceleration = 0;
                car.LastDrivingWheelDirection = 0;
                car.LastCarPositionInTrack = null;
                car.NeuralNet.ResetFitness();
            });
        }

        // Restore game state from save data
        private bool RestoreGameState(GameSaveDataJson saveData)
        {
            try
            {
                // Restore basic game state
                Generation = saveData.Game.Generation;
                Ticks = saveData.Game.Ticks;
                MaxTicks = saveData.Game.MaxTicks;
                startPointIndex = saveData.Game.StartPointIndex;

                // Restore cycle start point mode
                if (!string.IsNullOrEmpty(saveData.Game.CycleStartPoint))
                {
                    if (Enum.TryParse<CycleStartPoint>(saveData.Game.CycleStartPoint, true, out var parsedMode))
                    {
                        cycleStartPoint = parsedMode;
                    }
                }

                StatusUpdated?.Invoke($"Game state loaded: Generation {Generation}, Ticks {Ticks}, MaxTicks {MaxTicks}, CycleMode {cycleStartPoint}");

                // Restore population using JSON mapping
                population = new Car[saveData.Population.Count];
                var carConfig = saveData.CarConfig ?? JsonMapping.SupercarConfig;
                CarConfig = carConfig;
                
                Parallel.For(0, saveData.Population.Count, i =>
                {
                    population[i] = JsonMapping.CreateCarFromJson(saveData.Population[i], carConfig);
                });

                // Restore track starting point and direction
                if (saveData.Track != null)
                {
                    start = new Vector(saveData.Track.StartingPoint.X, saveData.Track.StartingPoint.Y);
                    direction = saveData.Track.StartingDirection;
                    
                    // Create the actual track object from JSON data
                    track = Track.FromJsonData(saveData.Track);
                    StatusUpdated?.Invoke($"Track loaded: {saveData.Track.Pieces.Count} pieces");
                }
                else
                {
                    // Fallback values
                    start = new Vector(0, 0);
                    direction = 0;
                    track = null;
                    StatusUpdated?.Invoke("Warning: No track data found in save file");
                }

                StatusUpdated?.Invoke($"Game state restored: Generation {Generation}, {population.Length} cars loaded");
                return true;
            }
            catch (Exception ex)
            {
                StatusUpdated?.Invoke($"Error restoring game state: {ex.Message}");
                return false;
            }
        }

        // Save current game state to JSON
        public async Task<bool> SaveGameAsync(string filePath)
        {
            try
            {
                var saveData = new GameSaveDataJson
                {
                    Version = "1.0",
                    Timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"), // ISO format like JavaScript
                    Track = track?.ToJsonData() ?? new TrackDataJson
                    {
                        StartingPoint = new PositionJson { X = start.X, Y = start.Y },
                        StartingDirection = direction,
                        Pieces = new List<TrackPieceJson>()
                    },
                    Game = new GameStateJson
                    {
                        Generation = Generation,
                        Ticks = Ticks,
                        MaxTicks = MaxTicks,
                        StartPointIndex = startPointIndex,
                        CycleStartPoint = cycleStartPoint.ToString().ToLower()
                    },
                    Population = population.Select(JsonMapping.CreateJsonFromCar).ToList(),
                    CarConfig = CarConfig
                };

                var options = new JsonSerializerOptions { 
                    WriteIndented = true,
                    PropertyNamingPolicy = null // Keep exact property names from JsonPropertyName attributes
                };
                string jsonString = JsonSerializer.Serialize(saveData, options);
                await File.WriteAllTextAsync(filePath, jsonString);

                StatusUpdated?.Invoke($"Game saved to {filePath}");
                return true;
            }
            catch (Exception ex)
            {
                StatusUpdated?.Invoke($"Error saving game: {ex.Message}");
                return false;
            }
        }

        // Get current training statistics
        public (int generation, double maxFitness, double avgFitness, int ticks) GetStats()
        {
            return (
                Generation,
                MaxFitness.LastOrDefault(),
                AvgFitness.LastOrDefault(),
                Ticks
            );
        }

        // Get best performing car's neural network
        public NeuralNet GetBestNeuralNet()
        {
            if (population == null || population.Length == 0)
                return null;

            return population.OrderByDescending(car => car.NeuralNet.Fitness).First().NeuralNet;
        }
    }
}