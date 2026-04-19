using System;
using System.Collections.Generic;
using System.Linq;
using SmartRace.Core;
using SmartRace.Utils;
using static System.Runtime.InteropServices.JavaScript.JSType;
using static System.Windows.Forms.VisualStyles.VisualStyleElement.TrackBar;

namespace SmartRace.Core
{
    public enum InputFormat
    {
        Raycast,
        Lookahead
    }

    public enum TrackPieceType
    {
        Straight,
        Arc
    }

    // Placeholder interfaces for Track classes that will be converted later
    public interface ITrackPiece
    {
        TrackPieceType Type { get; }
        Vector Start { get; }
        Vector End { get; }
        double Width { get; }
        double Length { get; }
    }

    public interface IStraightPiece : ITrackPiece
    {
    }

    public interface IArcPiece : ITrackPiece
    {
        Vector Center { get; }
        bool Clockwise { get; }
    }

    public interface ITrack
    {
        bool IsInsideTrack(double x, double y);
        TrackDataJson? ToJsonData();

        ITrackPiece[] Pieces { get; }
        ITrackPiece[] AnalyticPieces { get; }
    }

    public class Car
    {
        private static readonly string[][] RandomNames = new string[][]
        {
            ["Ayrton", "Senna"], // Greatest of all time, the legend himself
            ["Michael", "Schumacher"], // The original GOAT, 7-time world champion and dominant force in the 90s and early 2000s
            ["Lewis", "Hamilton"], // Modern GOAT, 7-time world champion, known for his consistency and racecraft
            ["Sebastian", "Vettel"], // 4-time world champion, dominant in the early 2010s with Red Bull
            ["Alain", "Prost"], // 4-time world champion, known as "The Professor" for his calculated driving style
            ["Niki", "Lauda"], // 3-time world champion, known for his incredible comeback after a near-fatal crash
            ["Jim", "Clark"], // 2-time world champion, dominant in the 60s with Lotus
            ["Jackie", "Stewart"], // 3-time world champion, known for his smooth driving style and safety advocacy
            ["Fernando", "Alonso"], // 2-time world champion, known for his versatility and racecraft
            ["Kimi", "Raikkonen"], // 1-time world champion, known as "The Iceman" for his cool demeanor and raw speed
            ["Juan Manuel", "Fangio"], // 5-time world champion in the 50s, known for his skill and dominance in the early years of F1
            ["Alberto", "Ascari"], // 2-time world champion in the 50s, known for his smooth driving style
            ["Tony", "Stark"], // Fictional character from Marvel Comics, known for his genius and charisma
            ["Felipe", "Massa"], // 1-time world champion, known for his speed and near miss of the 2008 title
            ["Gilles", "Villeneuve"], // Known for his fearless driving style and incredible car control, a true legend of the sport
            ["Dale", "Earnhardt"], // NASCAR legend, known for his aggressive driving style and 7 championships in the top-tier NASCAR series
            ["Colin", "McRae"], // Rally legend, known for his incredible car control and 1995 World Rally Championship title
            ["Travis", "Pastrana"], // Known for his versatility across motorsports, including motocross, rally, and NASCAR, as well as his daring stunts in the Nitro Circus
            ["Ken", "Block"], // Known for his Gymkhana series of videos showcasing his incredible car control and stunts, as well as his success in rally and rallycross
            ["Richard", "Petty"], // NASCAR legend, known as "The King" for his record 200 race wins and 7 championships in the top-tier NASCAR series
            ["Oscar", "Piastri"], // Young talent and 2021 Formula 2 champion, currently racing in Formula 1 with McLaren
            ["Lando", "Norris"], // Rising star in Formula 1, known for his speed and personality, currently racing with McLaren
            ["George", "Russell"], // Young talent in Formula 1, known for his speed and consistency, currently racing with Mercedes
            ["Mick", "Schumacher"], // Son of Michael Schumacher, showing promise in Formula 2 and currently racing in Formula 1 with Haas
            ["Charlie", "Leclerc"], // Young talent in Formula 1, known for his speed and racecraft, currently racing with Ferrari
            ["Max", "Verstappen"], // Current dominant force in Formula 1, known for his aggressive driving style and multiple world championships with Red Bull
            ["Rubens", "Barrichello"], // Known for his long career in Formula 1, including being a teammate to Michael Schumacher during his dominant years at Ferrari
            ["Gabriel", "Bortoleto"], // Brazilian driver known for his success in junior formulas and currently racing in Formula 1
            ["Franco", "Colapinto"], // Argentine driver known for his success in junior formulas and currently racing in Formula 1
            ["Lightning", "McQueen"], // Fictional character from the Cars movie franchise, known for his speed and racing spirit
        };

        private static readonly string[] Names = [.. RandomNames.Select(name => name[0])];
        private static readonly string[] Surnames = [.. RandomNames.Select(name => name[1])];

        public string DriverName { get; set; }

        // Neural net settings
        private const int nnLayers = 1;
        private const int nnNeurons = 10;
        private const int nnOutputs = 2;
        private const double nnRange = 1.5;
        private const double nnMutationRate = 0.01;
        private const ActivationFunction nnActivation = ActivationFunction.Softsign;

        private static double avgDeltaTime = 1.0 / 60.0; // 0.016807703080427727

        // Car paint (helps to keep track of individuals)
        private HSL color;
        private RGB colorRGB;

        public HSL ColorHSL
        {
            get => color;
            set
            {
                color = value;
                colorRGB = ColorUtils.ConvertHSLToRGB(value.H, value.S, value.L);
            }
        }

        public string Paint => $"rgb({colorRGB.R},{colorRGB.G},{colorRGB.B})";

        private InputFormat inputFormat = InputFormat.Lookahead;

        public int Generation { get; set; } = 0;

        // Car movement
        public Vector Position { get; set; }
        public double Speed { get; set; } = 0;
        public double Acceleration { get; set; } = 0;
        public double Direction { get; set; } = 0;
        public double LastDrivingWheelDirection { get; set; } = 0;
        public double DrivingWheelForce = 0.05;

        // Ackermann steering properties
        public double Wheelbase = 3; // 3 meters
        public double SteeringAngle = 0; // Current front wheel angle in radians
        public double MaxSteeringAngle = Math.PI / 6; // 30 degrees maximum steering

        // Tire slip simulation properties
        public double TireGripCoefficient = 1.2; // Tire grip coefficient (sports car)
        public double Mass = 1485; // kg - Ferrari 458 Italia
        public double MaxSlipAngle = Math.PI / 24; // 7.5 degrees - angle where tires start to slip significantly

        // Realistic acceleration values (converted to simulation units)
        public double MaxAcceleration = 8.0; // m/s² - max acceleration at low speed (launch)
        public double MaxBraking = 10.0; // m/s² - sports car braking capability
        public double MaxReverseSpeed = 10.0; // m/s (~36 km/h) - max reverse speed
        public double MaxPower = 425000; // W - Ferrari 458 Italia (570 hp)
        public double FrontalArea = 2.3; // m² - Ferrari 458 Italia frontal area
        public double DragCoefficient = 0.35; // Cd - Ferrari 458 Italia
        public double RollingResistanceCoeff = 0.011; // Crr - Ferrari 458 Italia (performance tires)
        public double DownforceCoefficient = 0; // CL - Ferrari 458 Italia (Enzo didn't value downforce)
        public double StationaryDownforce = 0; // N - constant downforce regardless of speed (e.g. fan cars)
        public string SpriteKey = "car"; // sprite identifier used by the browser renderer

        // The brain inside the car
        public NeuralNet NeuralNet { get; set; }

        private int totalRayCastRays = 7;
        public double[] LastRayCastDistances { get; private set; }

        private int totalLookAheadPoints = 10;
        public TrackQueryResult? LastCarPositionInTrack { get; set; }
        public Vector LastCurrentCarPositionInTrack { get; private set; }
        public Vector[] LastLookAheadPoints { get; private set; }

        private static readonly Random random = new Random();

        public Car(double startX, double startY, double startDir, int generation = 0, CarConfigJson config = null)
        {
            Position = VectorFactory.NewVector(startX, startY);
            Direction = startDir;
            Generation = generation;

            if (config != null)
                ApplyConfig(config);

            int inputs = GetInputsCount();
            NeuralNet = new NeuralNet(nnLayers, nnNeurons, inputs, nnOutputs, nnRange, nnMutationRate, nnActivation);

            HSL color = new HSL(Generation % 360, 100, 50);
            ColorHSL = color;

            DriverName = $"{Names[random.Next(Names.Length)]} {Surnames[random.Next(Surnames.Length)]}";
        }

        public void ApplyConfig(CarConfigJson config)
        {
            if (config.Wheelbase.HasValue) Wheelbase = config.Wheelbase.Value;
            if (config.MaxSteeringAngle.HasValue) MaxSteeringAngle = config.MaxSteeringAngle.Value;
            if (config.TireGripCoefficient.HasValue) TireGripCoefficient = config.TireGripCoefficient.Value;
            if (config.Mass.HasValue) Mass = config.Mass.Value;
            if (config.MaxAcceleration.HasValue) MaxAcceleration = config.MaxAcceleration.Value;
            if (config.MaxBraking.HasValue) MaxBraking = config.MaxBraking.Value;
            if (config.MaxReverseSpeed.HasValue) MaxReverseSpeed = config.MaxReverseSpeed.Value;
            if (config.MaxPower.HasValue) MaxPower = config.MaxPower.Value;
            if (config.FrontalArea.HasValue) FrontalArea = config.FrontalArea.Value;
            if (config.DragCoefficient.HasValue) DragCoefficient = config.DragCoefficient.Value;
            if (config.RollingResistanceCoeff.HasValue) RollingResistanceCoeff = config.RollingResistanceCoeff.Value;
            if (config.DownforceCoefficient.HasValue) DownforceCoefficient = config.DownforceCoefficient.Value;
            if (config.StationaryDownforce.HasValue) StationaryDownforce = config.StationaryDownforce.Value;
            if (config.SpriteKey != null) SpriteKey = config.SpriteKey;
        }

        public void FadeColor()
        {
            HSL fadedColor = color;
            fadedColor.S = Math.Max(0, fadedColor.S - 2);
            ColorHSL = fadedColor;
        }

        private int GetInputsCount()
        {
            const int fixedInputs = 2; // speed and last driving wheel direction
            return fixedInputs + GetInputsCountForFormat(inputFormat);
        }

        private int GetInputsCountForFormat(InputFormat format)
        {
            switch (format)
            {
                case InputFormat.Raycast:
                    return totalRayCastRays;
                case InputFormat.Lookahead:
                    return totalLookAheadPoints * 2 + 2; // 2 for heading angle and lateral offset
                default:
                    return 0;
            }
        }

        // Updates car position
        public void Update(ITrack track)
        {
            // Apply acceleration
            this.Speed += this.Acceleration * avgDeltaTime;
            if (this.Speed < -this.MaxReverseSpeed) this.Speed = -this.MaxReverseSpeed;

            // Apply drag and rolling resistance for realistic physics
            var speedMPS = this.Speed; // m/s
            var dragForce = 0.5 * 1.225 * this.DragCoefficient * this.FrontalArea * speedMPS * speedMPS; // Air resistance (ρ * Cd * A * v²/2)
            var rollingForce = this.RollingResistanceCoeff * this.Mass * 9.81; // Rolling resistance
            var totalResistanceForce = dragForce + rollingForce;

            // Convert resistance back to simulation units and apply
            var resistanceAcceleration = totalResistanceForce / this.Mass * avgDeltaTime;
            if (this.Speed > 0)
            {
                this.Speed = Math.Max(0, this.Speed - resistanceAcceleration);
            }
            else if (this.Speed < 0)
            {
                this.Speed = Math.Min(0, this.Speed + resistanceAcceleration);
            }

            // Ackermann steering: calculate turning based on wheelbase and steering angle
            if (Math.Abs(this.SteeringAngle) > 0.001 && Math.Abs(this.Speed) > 0.1)
            {
                // Calculate turning radius using Ackermann geometry
                var turningRadius = this.Wheelbase / Math.Tan(Math.Abs(this.SteeringAngle));

                // Calculate angular velocity (rad/s)
                var angularVelocity = this.Speed / turningRadius;

                // Apply direction change with consistent time scaling
                var directionChange = angularVelocity * Math.Sign(this.SteeringAngle) * Math.Sign(this.Speed) * avgDeltaTime;
                this.Direction += directionChange;
            }

            bool isInsideTrack = track.IsInsideTrack(this.Position.X, this.Position.Y);
            if (!isInsideTrack)
            {
                this.Speed = 0;
            }

            var previousCarPositionInTrack = this.LastCarPositionInTrack;

            // Update position with consistent time scaling
            this.Position.Add(
                this.Speed * Math.Cos(this.Direction) * avgDeltaTime * Constants.UNITS_PER_METER,
                this.Speed * Math.Sin(this.Direction) * avgDeltaTime * Constants.UNITS_PER_METER
            );

            var currentCarPositionInTrack = TrackMath.QueryTrack(track.AnalyticPieces.Select(ConvertToTrackSegment).ToArray(), new XY(Position.X, Position.Y), this.Direction);
            this.LastCarPositionInTrack = currentCarPositionInTrack;

            var fitnessReward = CalculateFitnessReward(track, previousCarPositionInTrack, currentCarPositionInTrack);

            if (isInsideTrack)
                this.NeuralNet.AddFitness(fitnessReward);
        }


        private double CalculateFitnessReward(ITrack track, TrackQueryResult? previousCarPositionInTrack, TrackQueryResult? currentCarPositionInTrack)
        {
            if (previousCarPositionInTrack is null || currentCarPositionInTrack is null)
            {
                return 0;
            }
            var previousPosition = previousCarPositionInTrack.Value;
            var currentPosition = currentCarPositionInTrack.Value;

            // if the index difference is 2 or bigger, let's ignore, also check for lap completion (index goes from last to 0)
            var indexDifference = previousPosition.SegmentIndex - currentPosition.SegmentIndex;
            if (Math.Abs(indexDifference) > 1 && !(currentPosition.SegmentIndex == 0 && previousPosition.SegmentIndex == track.AnalyticPieces.Length - 1))
            {
                return 0;
            }

            // there are 3 situations:
            // 1. the car is in the same track piece, so we reward it based on the distance it advanced in that piece
            // 2. the car advanced to the next piece, so we reward it based on the distance to the end of the previous piece and the distance from the start of the new piece
            // 3. the car went backward, so we penalize it based on the distance it moved backward
            // the car can also complete a lap, in that case the index resets to 0, so we also check for that and reward the car for completing a lap

            if (currentPosition.SegmentIndex == previousPosition.SegmentIndex)
            {
                // case 1
                return currentPosition.DistanceFromTrackPieceStart - previousPosition.DistanceFromTrackPieceStart;
            }
            else if (currentPosition.SegmentIndex == 0 && previousPosition.SegmentIndex == track.AnalyticPieces.Length - 1)
            {
                // case 3 - lap completed
                var piece1Length = track.AnalyticPieces[previousPosition.SegmentIndex].Length;
                return (piece1Length - previousPosition.DistanceFromTrackPieceStart) + currentPosition.DistanceFromTrackPieceStart;
            }
            else if (currentPosition.SegmentIndex > previousPosition.SegmentIndex)
            {
                // case 2 - advanced to next piece
                var piece1Length = track.AnalyticPieces[previousPosition.SegmentIndex].Length;
                return (piece1Length - previousPosition.DistanceFromTrackPieceStart) + currentPosition.DistanceFromTrackPieceStart;
            }
            else
            {
                // case 4 - went backward
                return currentPosition.DistanceFromTrackPieceStart - previousPosition.DistanceFromTrackPieceStart;
            }
        }

        // Inputs for driving the car with Ackermann steering and tire slip simulation
        public void Drive(double[] input)
        {
            // Calculate realistic acceleration based on throttle input (-1 to 1)
            var throttleInput = input[0]; // -1 to 1


            if (throttleInput >= 0)
            {
                // Power-limited engine force: full torque at low speed, power-capped at high speed
                var maxTorqueForce = throttleInput * this.MaxAcceleration * this.Mass;
                var maxPowerForce = (this.MaxPower * throttleInput) / Math.Max(Math.Abs(this.Speed), 0.5);
                var engineForce = Math.Min(maxTorqueForce, maxPowerForce);
                this.Acceleration = engineForce / this.Mass;
            }
            else
            {
                // Braking (negative throttle)
                var brakingMPS2 = Math.Abs(throttleInput) * this.MaxBraking;
                this.Acceleration = -brakingMPS2; // Convert to simulation units
            }

            // Calculate target steering angle from input (-1 to 1)
            var targetSteeringInput = input[1]; // -1 to 1
            var targetSteeringAngle = targetSteeringInput * this.MaxSteeringAngle;

            // Apply tire slip limitation - limit actual steering angle based on current speed
            var maxEffectiveAngle = this.GetMaxEffectiveSteeringAngle();

            // Clamp the steering angle to what the tires can actually provide
            this.SteeringAngle = Math.Sign(targetSteeringAngle) * Math.Min(Math.Abs(targetSteeringAngle), maxEffectiveAngle);

            // Keep lastDrivingWheelDirection for neural network input consistency
            this.LastDrivingWheelDirection = targetSteeringInput;
        }

        // Calculate maximum effective steering angle based on tire slip physics
        private double GetMaxEffectiveSteeringAngle()
        {
            // Convert speed from pixels/frame to m/s using consistent scaling
            var speedMPS = Math.Abs(this.Speed);

            // At very low speeds, full steering is available
            if (speedMPS < 0.5)
            {
                return this.MaxSteeringAngle;
            }

            // Downforce increases normal force on tires, raising the lateral grip limit
            var downforce = 0.5 * 1.225 * this.DownforceCoefficient * this.FrontalArea * speedMPS * speedMPS + this.StationaryDownforce;
            var effectiveNormalForce = this.Mass * 9.81 + downforce;
            var maxLateralAcceleration = this.TireGripCoefficient * (effectiveNormalForce / this.Mass); // m/s²

            // Calculate the maximum turning radius before tire slip occurs
            // Using the relationship: lateral_accel = v²/R
            var maxTurningRadius = (speedMPS * speedMPS) / maxLateralAcceleration;

            // Convert turning radius back to steering angle using wheelbase in meters
            var wheelbaseMeters = this.Wheelbase;
            var maxEffectiveAngle = Math.Atan(wheelbaseMeters / maxTurningRadius);

            // Return the minimum of physical steering limit and slip-limited angle
            return Math.Min(this.MaxSteeringAngle, maxEffectiveAngle);
        }

        // Gets sensors' data
        public double[] GetInputs(ITrack track)
        {
            // Return default inputs if no track available
            if (track == null)
            {
                double[] defaultInputs = new double[GetInputsCount()];
                defaultInputs[defaultInputs.Length - 1] = Speed; // Add speed as last input
                defaultInputs[defaultInputs.Length - 2] = LastDrivingWheelDirection; // Add last driving wheel direction as second last input
                return defaultInputs;
            }


            var inputs = new double[GetInputsCount()];
            inputs[0] = ActivationFunctions.SignedLog(Speed);
            inputs[1] = LastDrivingWheelDirection;

            if (LastCarPositionInTrack is null)
                LastCarPositionInTrack = TrackMath.QueryTrack(track.AnalyticPieces.Select(ConvertToTrackSegment).ToArray(), new XY(Position.X, Position.Y), Direction);

            switch (inputFormat)
            {
                case InputFormat.Raycast:
                    {
                        var variableInputs = GetRaycastInputs(track);
                        Array.Copy(variableInputs, 0, inputs, 2, variableInputs.Length);
                        return inputs;
                    }
                case InputFormat.Lookahead:
                    {
                        var variableInputs = GetLookaheadInputs(track);
                        Array.Copy(variableInputs, 0, inputs, 2, variableInputs.Length);
                        return inputs;
                    }
                default:
                    return new double[0];
            }
        }

        private double[] GetRaycastInputs(ITrack track)
        {
            double[] inputs = new double[totalRayCastRays];
            const int maxIncrements = 30;

            // Return default inputs if no track available
            if (track == null)
            {
                LastRayCastDistances = inputs.Take(totalRayCastRays).ToArray();
                return inputs;
            }

            for (int i = 0; i < totalRayCastRays; i++)
            {
                double angle = Direction + ((i - 3) / 10.0) * Math.PI;

                for (int j = 0; j < maxIncrements; j++)
                {
                    double prevx = Position.X + (2 * Math.Cos(((i - 3) / 10.0) * Math.PI)) * j * Math.Cos(angle) * 4;
                    double prevy = Position.Y + (2 * Math.Cos(((i - 3) / 10.0) * Math.PI)) * j * Math.Sin(angle) * 4;

                    double x = Position.X + (2 * Math.Cos(((i - 3) / 10.0) * Math.PI)) * (j + 1) * Math.Cos(angle) * 4;
                    double y = Position.Y + (2 * Math.Cos(((i - 3) / 10.0) * Math.PI)) * (j + 1) * Math.Sin(angle) * 4;

                    bool isInsideTrack = track.IsInsideTrack(x, y);
                    if (!isInsideTrack || j == maxIncrements - 1)
                    {
                        x = prevx;
                        y = prevy;

                        inputs[i] = Math.Sqrt(Math.Pow(x - Position.X, 2) + Math.Pow(y - Position.Y, 2));
                        break;
                    }
                }
            }
            
            LastRayCastDistances = inputs.Take(totalRayCastRays).ToArray();
            return inputs;
        }

        private double[] GetLookaheadInputs(ITrack track)
        {
            // Return default inputs if no track available
            if (track == null)
            {
                double[] defaultInputs = new double[totalLookAheadPoints * 2]; // points + speed + heading + lateral
                defaultInputs[defaultInputs.Length - 3] = Speed;
                return defaultInputs;
            }

            // in this mode, the car gets as input the points of the track that are in front of it, at a certain distance and angle from the car

            int totalQueryPoints = totalLookAheadPoints;
            double singleFrameDistance = Speed * avgDeltaTime * Constants.UNITS_PER_METER;
            double maxLookaheadDistance = singleFrameDistance * 60 * 6; // lookahead distance is 6 seconds at max speed, which allows the car to see far enough ahead to make informed decisions without overwhelming it with too much information. This also helps to keep the neural network inputs manageable and focused on relevant track information.

            // Convert track pieces to segments for querying
            //TrackSegment[] trackSegments = track.AnalyticPieces.Select(ConvertToTrackSegment).ToArray();
            //TrackQueryResult currentCarPositionInTrack = TrackMath.QueryTrack(trackSegments, 
            //    new XY(Position.X, Position.Y), Direction);
            
            //LastCarPositionInTrack = currentCarPositionInTrack;
            var currentCarPositionInTrack = LastCarPositionInTrack ?? TrackMath.QueryTrack(track.AnalyticPieces.Select(ConvertToTrackSegment).ToArray(), new XY(Position.X, Position.Y), Direction);

            LastCurrentCarPositionInTrack = new Vector(currentCarPositionInTrack.Point.X, currentCarPositionInTrack.Point.Y);

            List<Vector> lookAheadPoints = new List<Vector>();
            double distanceBetweenPoints = maxLookaheadDistance / totalQueryPoints;

            for (int i = 1; i <= totalQueryPoints; i++)
            {
                double lookaheadDistance = i * distanceBetweenPoints;
                double remainingDistance = lookaheadDistance;
                int segmentIndex = currentCarPositionInTrack.SegmentIndex;
                Vector pointOnTrack = new Vector(currentCarPositionInTrack.Point.X, currentCarPositionInTrack.Point.Y);

                while (remainingDistance > 0)
                {
                    ITrackPiece segment = track.AnalyticPieces[segmentIndex];

                    switch (segment.Type)
                    {
                        case TrackPieceType.Straight:
                            {
                                double availableDistanceInCurrentSegment = Vector.Sub(segment.End, pointOnTrack).Mag();
                                if (remainingDistance <= availableDistanceInCurrentSegment)
                                {
                                    Vector segmentDirection = Vector.Sub(segment.End, segment.Start);
                                    Vector unitVector = new Vector(segmentDirection.X / segmentDirection.Mag(), segmentDirection.Y / segmentDirection.Mag());
                                    pointOnTrack = new Vector(pointOnTrack.X + unitVector.X * remainingDistance, pointOnTrack.Y + unitVector.Y * remainingDistance);
                                    remainingDistance = 0;
                                }
                                else
                                {
                                    remainingDistance -= availableDistanceInCurrentSegment;
                                    segmentIndex = (segmentIndex + 1) % track.AnalyticPieces.Length;
                                    pointOnTrack = track.AnalyticPieces[segmentIndex].Start;
                                }
                                break;
                            }
                        case TrackPieceType.Arc:
                            {
                                IArcPiece arcSegment = segment as IArcPiece;
                                Vector center = arcSegment.Center;
                                double radius = Vector.Sub(segment.Start, center).Mag();

                                double finalAngle = (Math.Atan2(segment.End.Y - center.Y, segment.End.X - center.X) + 2 * Math.PI) % (2 * Math.PI);
                                double startAngle = (Math.Atan2(pointOnTrack.Y - center.Y, pointOnTrack.X - center.X) + 2 * Math.PI) % (2 * Math.PI);

                                double availableAngleInCurrentSegment = arcSegment.Clockwise ? finalAngle - startAngle : startAngle - finalAngle;
                                double availableDistanceInCurrentSegment = Math.Abs((availableAngleInCurrentSegment + 2 * Math.PI) % (2 * Math.PI)) * radius;

                                if (remainingDistance <= availableDistanceInCurrentSegment)
                                {
                                    double angleDirection = arcSegment.Clockwise ? 1 : -1;
                                    double angleToPoint = Math.Atan2(pointOnTrack.Y - center.Y, pointOnTrack.X - center.X) + angleDirection * (remainingDistance / radius);
                                    pointOnTrack = new Vector(center.X + radius * Math.Cos(angleToPoint), center.Y + radius * Math.Sin(angleToPoint));
                                    remainingDistance = 0;
                                }
                                else
                                {
                                    remainingDistance -= availableDistanceInCurrentSegment;
                                    segmentIndex = (segmentIndex + 1) % track.AnalyticPieces.Length;
                                    pointOnTrack = track.AnalyticPieces[segmentIndex].Start;
                                }
                                break;
                            }
                    }
                }

                lookAheadPoints.Add(pointOnTrack);
            }

            LastLookAheadPoints = lookAheadPoints.ToArray();

            // Convert lookahead points to relative coordinates
            Vector[] relativeLookAheadPoints = lookAheadPoints.Select(point =>
            {
                Vector relativePosition = Vector.Sub(point, new Vector(currentCarPositionInTrack.Point.X, currentCarPositionInTrack.Point.Y));
                // Rotate relative position to be relative to tangent
                XY tangent = currentCarPositionInTrack.Tangent;
                double rotatedX = relativePosition.X * tangent.X + relativePosition.Y * tangent.Y;
                double rotatedY = -relativePosition.X * tangent.Y + relativePosition.Y * tangent.X;
                return new Vector(rotatedX, rotatedY);
            }).ToArray();

            double normalizationFactor = 1 + maxLookaheadDistance;
            ITrackPiece trackPiece = track.AnalyticPieces[currentCarPositionInTrack.SegmentIndex];

            List<double> finalInputs = new List<double>();
            foreach (Vector point in relativeLookAheadPoints)
            {
                finalInputs.Add(point.X / normalizationFactor);
                finalInputs.Add(point.Y / normalizationFactor);
            }
            finalInputs.Add(currentCarPositionInTrack.HeadingAngle);
            finalInputs.Add(currentCarPositionInTrack.LateralOffset / (trackPiece.Width / 2));

            return finalInputs.ToArray();
        }

        private static TrackSegment ConvertToTrackSegment(ITrackPiece piece)
        {
            switch (piece.Type)
            {
                case TrackPieceType.Straight:
                    return new TrackSegment(new LineSegment(
                        new XY(piece.Start.X, piece.Start.Y),
                        new XY(piece.End.X, piece.End.Y)
                    ));
                case TrackPieceType.Arc:
                    IArcPiece arcPiece = piece as IArcPiece;
                    return new TrackSegment(new ArcSegment(
                        new XY(piece.Start.X, piece.Start.Y),
                        new XY(piece.End.X, piece.End.Y),
                        new XY(arcPiece.Center.X, arcPiece.Center.Y),
                        arcPiece.Clockwise
                    ));
                default:
                    throw new NotSupportedException($"Unsupported piece kind: {piece.Type}");
            }
        }

        private static HSL GetRandomColor()
        {
            return new HSL(random.Next(360), 100, 50);
        }

        public void Reset(double startX, double startY, double startDir)
        {
            Position = VectorFactory.NewVector(startX, startY);
            Direction = startDir;
            Speed = 0;
            Acceleration = 0;
            LastDrivingWheelDirection = 0;
            SteeringAngle = 0;
            LastRayCastDistances = null;
            LastCurrentCarPositionInTrack = null;
            LastLookAheadPoints = null;
        }
    }

    public struct HSL
    {
        public double H { get; set; }
        public double S { get; set; }
        public double L { get; set; }

        public HSL(double h, double s, double l)
        {
            H = h;
            S = s;
            L = l;
        }
    }
}