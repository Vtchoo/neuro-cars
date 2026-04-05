using System;
using System.Collections.Generic;
using System.Linq;
using SmartRace.Core;
using SmartRace.Utils;

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

        // The brain inside the car
        public NeuralNet NeuralNet { get; set; }

        private int totalRayCastRays = 7;
        public double[] LastRayCastDistances { get; private set; }

        private int totalLookAheadPoints = 10;
        public Vector LastCurrentCarPositionInTrack { get; private set; }
        public Vector[] LastLookAheadPoints { get; private set; }

        private static readonly Random random = new Random();

        public Car(double startX, double startY, double startDir, int generation = 0)
        {
            Position = VectorFactory.NewVector(startX, startY);
            Direction = startDir;
            Generation = generation;

            int inputs = GetInputsCount();
            NeuralNet = new NeuralNet(nnLayers, nnNeurons, inputs, nnOutputs, nnRange, nnMutationRate, nnActivation);

            HSL color = new HSL(Generation % 360, 100, 50);
            ColorHSL = color;
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
            Speed += Acceleration;
            if (Speed < -2) Speed = -2;

            // Skip track collision check if no track available
            if (track != null && !track.IsInsideTrack(Position.X, Position.Y))
            {
                Speed = 0;
            }
            else if (track != null)
            {
                NeuralNet.AddFitness(Speed > 0 ? Speed : 10 * Speed);
            }

            Position.Add(
                Speed * Math.Cos(Direction) * avgDeltaTime / (1.0 / 30.0),
                Speed * Math.Sin(Direction) * avgDeltaTime / (1.0 / 30.0)
            );
        }

        // Inputs for driving the car
        public void Drive(double[] input)
        {
            Acceleration = (input[0] > 0 && Speed >= 0) || Speed < 0 ? input[0] * 0.05 : input[0] * 0.15;
                
            var newDrivingWheelPosition = LastDrivingWheelDirection * (1 - DrivingWheelForce) + input[1] * DrivingWheelForce;

            Direction += newDrivingWheelPosition * 0.05 * (1 - 1 / (1 + Math.Abs(Speed))) * Math.Sign(Speed) * avgDeltaTime / (1.0 / 30.0);
            LastDrivingWheelDirection = newDrivingWheelPosition;
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
            double singleFrameDistance = Speed * avgDeltaTime / (1.0 / 60.0);
            double maxLookaheadDistance = singleFrameDistance * 120;

            // Convert track pieces to segments for querying
            TrackSegment[] trackSegments = track.AnalyticPieces.Select(ConvertToTrackSegment).ToArray();
            TrackQueryResult currentCarPositionInTrack = TrackMath.QueryTrack(trackSegments, 
                new XY(Position.X, Position.Y), Direction);
            
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