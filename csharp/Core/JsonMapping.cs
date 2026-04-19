using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace SmartRace.Core
{
    // JSON-compatible mapping classes that exactly match the JavaScript save format
    
    public class GameSaveDataJson
    {
        [JsonPropertyName("version")]
        public string Version { get; set; } = "1.0";
        
        [JsonPropertyName("timestamp")]
        public string Timestamp { get; set; }
        
        [JsonPropertyName("track")]
        public TrackDataJson Track { get; set; }
        
        [JsonPropertyName("game")]
        public GameStateJson Game { get; set; }
        
        [JsonPropertyName("population")]
        public List<CarDataJson> Population { get; set; }

        [JsonPropertyName("carConfig")]
        public CarConfigJson CarConfig { get; set; }
    }

    public class TrackDataJson
    {
        [JsonPropertyName("startingPoint")]
        public PositionJson StartingPoint { get; set; }
        
        [JsonPropertyName("startingDirection")]
        public double StartingDirection { get; set; }
        
        [JsonPropertyName("pieces")]
        public List<TrackPieceJson> Pieces { get; set; }
    }

    public class GameStateJson  
    {
        [JsonPropertyName("generation")]
        public int Generation { get; set; }
        
        [JsonPropertyName("ticks")]
        public int Ticks { get; set; }
        
        [JsonPropertyName("maxTicks")]
        public int MaxTicks { get; set; }
        
        [JsonPropertyName("startPointIndex")]
        public int StartPointIndex { get; set; }
        
        [JsonPropertyName("cycleStartPoint")]
        public string CycleStartPoint { get; set; }
    }

    public class CarDataJson
    {
        [JsonPropertyName("NN")]
        public NeuralNetDataJson NN { get; set; }
        
        [JsonPropertyName("generation")]
        public int Generation { get; set; }
        
        [JsonPropertyName("position")]
        public PositionJson Position { get; set; }
        
        [JsonPropertyName("speed")]
        public double Speed { get; set; }
        
        [JsonPropertyName("direction")]
        public double Direction { get; set; }
        
        [JsonPropertyName("acceleration")]
        public double Acceleration { get; set; }

        [JsonPropertyName("lastDrivingWheelDirection")]
        public double LastDrivingWheelDirection { get; set; } = 0;

        // Note: JavaScript version doesn't save paintRGB consistently, so making it optional
        [JsonPropertyName("paintRGB")]
        public object PaintRGB { get; set; }

        [JsonPropertyName("driverName")]
        public string DriverName { get; set; }
    }

    public class NeuralNetDataJson
    {
        [JsonPropertyName("config")]
        public NeuralNetConfigJson Config { get; set; }
        
        [JsonPropertyName("weights")]
        public double[][][] Weights { get; set; }
        
        [JsonPropertyName("biases")]
        public double[][][] Biases { get; set; }
        
        [JsonPropertyName("fitness")]
        public double Fitness { get; set; }
    }

    public class NeuralNetConfigJson
    {
        [JsonPropertyName("layers")]
        public int Layers { get; set; }
        
        [JsonPropertyName("neurons")]
        public int Neurons { get; set; }
        
        [JsonPropertyName("inputs")]
        public int Inputs { get; set; }
        
        [JsonPropertyName("outputs")]
        public int Outputs { get; set; }
        
        [JsonPropertyName("range")]
        public double Range { get; set; }
        
        [JsonPropertyName("mutationRate")]
        public double MutationRate { get; set; }
        
        [JsonPropertyName("activation")]
        public string Activation { get; set; }  // String like "softsign", not enum
    }

    public class PositionJson
    {
        [JsonPropertyName("x")]
        public double X { get; set; }
        
        [JsonPropertyName("y")]
        public double Y { get; set; }
    }

    public class CarConfigJson
    {
        [JsonPropertyName("wheelbase")]
        public double? Wheelbase { get; set; }

        [JsonPropertyName("maxSteeringAngle")]
        public double? MaxSteeringAngle { get; set; }

        [JsonPropertyName("tireGripCoefficient")]
        public double? TireGripCoefficient { get; set; }

        [JsonPropertyName("mass")]
        public double? Mass { get; set; }

        [JsonPropertyName("maxAcceleration")]
        public double? MaxAcceleration { get; set; }

        [JsonPropertyName("maxBraking")]
        public double? MaxBraking { get; set; }

        [JsonPropertyName("maxReverseSpeed")]
        public double? MaxReverseSpeed { get; set; }

        [JsonPropertyName("maxPower")]
        public double? MaxPower { get; set; }

        [JsonPropertyName("frontalArea")]
        public double? FrontalArea { get; set; }

        [JsonPropertyName("dragCoefficient")]
        public double? DragCoefficient { get; set; }

        [JsonPropertyName("rollingResistanceCoeff")]
        public double? RollingResistanceCoeff { get; set; }

        [JsonPropertyName("downforceCoefficient")]
        public double? DownforceCoefficient { get; set; }

        [JsonPropertyName("stationaryDownforce")]
        public double? StationaryDownforce { get; set; }

        [JsonPropertyName("spriteKey")]
        public string SpriteKey { get; set; }
    }

    public class TrackPieceJson
    {
        [JsonPropertyName("type")]
        public string Type { get; set; }  // "Straight", "Arc"
        
        [JsonPropertyName("start")]
        public PositionJson Start { get; set; }
        
        [JsonPropertyName("end")]
        public PositionJson End { get; set; }
        
        [JsonPropertyName("width")]
        public double Width { get; set; }
        
        // Arc-specific properties (optional)
        [JsonPropertyName("center")]
        public PositionJson Center { get; set; }
        
        [JsonPropertyName("clockwise")]
        public bool? Clockwise { get; set; }
    }

    // Conversion utilities to map between JSON and internal C# classes
    public static class JsonMapping
    {
        // Fallback config for saves that predate the carConfig field (Ferrari 458 Italia)
        public static readonly CarConfigJson SupercarConfig = new CarConfigJson
        {
            Wheelbase = 3.0,
            MaxSteeringAngle = Math.PI / 6,
            TireGripCoefficient = 1.2,
            Mass = 1485,
            MaxAcceleration = 8.0,
            MaxBraking = 10.0,
            MaxReverseSpeed = 15.0,
            MaxPower = 425000,
            FrontalArea = 2.3,
            DragCoefficient = 0.35,
            RollingResistanceCoeff = 0.011,
            DownforceCoefficient = 0,
            StationaryDownforce = 0,
        };
        public static ActivationFunction ParseActivationFunction(string activation)
        {
            return activation?.ToLowerInvariant() switch
            {
                "identity" => ActivationFunction.Identity,
                "binary" => ActivationFunction.Binary,
                "softsign" => ActivationFunction.Softsign,
                "relu" => ActivationFunction.ReLU,
                "tanh" => ActivationFunction.Tanh,
                "sigmoid" => ActivationFunction.Sigmoid,
                "identitycapped" => ActivationFunction.IdentityCapped,
                "leakyrelu" => ActivationFunction.LeakyRelu,
                _ => ActivationFunction.Identity
            };
        }

        public static string ToActivationString(ActivationFunction activation)
        {
            return activation switch
            {
                ActivationFunction.Identity => "identity",
                ActivationFunction.Binary => "binary",
                ActivationFunction.Softsign => "softsign",
                ActivationFunction.ReLU => "relu",  
                ActivationFunction.Tanh => "tanh",
                ActivationFunction.Sigmoid => "sigmoid",
                ActivationFunction.IdentityCapped => "identityCapped",
                ActivationFunction.LeakyRelu => "leakyRelu",
                _ => "identity"
            };
        }

        public static TrackPieceType ParseTrackPieceType(string type)
        {
            return type switch
            {
                "Straight" => TrackPieceType.Straight,
                "Arc" => TrackPieceType.Arc,
                _ => TrackPieceType.Straight
            };
        }

        public static string ToTrackPieceTypeString(TrackPieceType type)
        {
            return type switch
            {
                TrackPieceType.Straight => "Straight",
                TrackPieceType.Arc => "Arc",
                _ => "Straight"
            };
        }

        // Convert from JSON to internal C# format
        public static NeuralNet CreateNeuralNetFromJson(NeuralNetDataJson jsonData)
        {
            var config = jsonData.Config;
            var activation = ParseActivationFunction(config.Activation);
            
            var neuralNet = new NeuralNet(
                config.Layers,
                config.Neurons, 
                config.Inputs,
                config.Outputs,
                config.Range,
                config.MutationRate,
                activation
            );

            // Create properly structured internal data
            var internalData = new NeuralNetData
            {
                Config = new NeuralNetConfig(
                    config.Layers,
                    config.Neurons,
                    config.Inputs, 
                    config.Outputs,
                    config.Range,
                    config.MutationRate,
                    activation
                ),
                Weights = jsonData.Weights,
                Biases = jsonData.Biases,
                Fitness = jsonData.Fitness
            };

            return NeuralNet.FromData(internalData);
        }

        // Convert from internal C# to JSON format
        public static NeuralNetDataJson CreateJsonFromNeuralNet(NeuralNet neuralNet)
        {
            var internalData = neuralNet.ExportData();
            
            return new NeuralNetDataJson
            {
                Config = new NeuralNetConfigJson
                {
                    Layers = internalData.Config.Layers,
                    Neurons = internalData.Config.Neurons,
                    Inputs = internalData.Config.Inputs,
                    Outputs = internalData.Config.Outputs,
                    Range = internalData.Config.Range,
                    MutationRate = internalData.Config.MutationRate,
                    Activation = ToActivationString(internalData.Config.Activation)
                },
                Weights = internalData.Weights,
                Biases = internalData.Biases,
                Fitness = internalData.Fitness
            };
        }

        // Convert Car to JSON format
        public static CarDataJson CreateJsonFromCar(Car car)
        {
            return new CarDataJson
            {
                NN = CreateJsonFromNeuralNet(car.NeuralNet),
                Generation = car.Generation,
                Position = new PositionJson { X = car.Position.X, Y = car.Position.Y },
                Speed = car.Speed,
                Direction = car.Direction,
                Acceleration = car.Acceleration,
                LastDrivingWheelDirection = car.LastDrivingWheelDirection,
                DriverName = car.DriverName
            };
        }

        // Convert JSON to Car
        public static Car CreateCarFromJson(CarDataJson jsonData, CarConfigJson config = null)
        {
            var car = new Car(
                jsonData.Position.X,
                jsonData.Position.Y,
                jsonData.Direction,
                jsonData.Generation,
                config ?? SupercarConfig
            )
            {
                NeuralNet = CreateNeuralNetFromJson(jsonData.NN),
                Speed = jsonData.Speed,
                Acceleration = jsonData.Acceleration,
                LastDrivingWheelDirection = jsonData.LastDrivingWheelDirection,
                DriverName = jsonData.DriverName
            };

            return car;
        }
    }
}