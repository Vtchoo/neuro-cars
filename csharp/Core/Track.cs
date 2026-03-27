using System;
using System.Collections.Generic;
using System.Linq;
using SmartRace.Utils;

namespace SmartRace.Core
{
    // Concrete implementation of track pieces
    public class StraightPiece : IStraightPiece
    {
        public TrackPieceType Type => TrackPieceType.Straight;
        public Vector Start { get; set; }
        public Vector End { get; set; }
        public double Width { get; set; }

        public StraightPiece(Vector start, Vector end, double width)
        {
            Start = start;
            End = end;
            Width = width;
        }
    }

    public class ArcPiece : IArcPiece
    {
        public TrackPieceType Type => TrackPieceType.Arc;
        public Vector Start { get; set; }
        public Vector End { get; set; }
        public double Width { get; set; }
        public Vector Center { get; set; }
        public bool Clockwise { get; set; }

        public ArcPiece(Vector start, Vector end, Vector center, bool clockwise, double width)
        {
            Start = start;
            End = end;
            Center = center;
            Clockwise = clockwise;
            Width = width;
        }
    }

    // Concrete Track implementation
    public class Track : ITrack
    {
        public ITrackPiece[] AnalyticPieces { get; private set; }
        public Vector StartingPoint { get; set; }
        public double StartingDirection { get; set; }

        private List<TrackSegment> trackSegments;

        public Track(ITrackPiece[] pieces, Vector startingPoint, double startingDirection)
        {
            AnalyticPieces = pieces;
            StartingPoint = startingPoint;
            StartingDirection = startingDirection;
            
            // Convert pieces to TrackSegments for geometry calculations
            trackSegments = pieces.Select(ConvertToTrackSegment).ToList();
        }

        // Basic track boundary check using track pieces
        public bool IsInsideTrack(double x, double y)
        {
            var point = new XY(x, y);
            
            // Check if point is within reasonable distance of any track segment
            foreach (var segment in trackSegments)
            {
                var closest = TrackMath.ClosestPointOnSegment(segment, point);
                if (closest.Distance < GetTrackWidthAtSegment() / 2)
                    return true;
            }
            
            return false;
        }

        private double GetTrackWidthAtSegment()
        {
            // For now, use the first piece's width, but could be made more sophisticated
            return AnalyticPieces.Length > 0 ? AnalyticPieces[0].Width : 120;
        }

        private TrackSegment ConvertToTrackSegment(ITrackPiece piece)
        {
            switch (piece.Type)
            {
                case TrackPieceType.Straight:
                    return new TrackSegment(new LineSegment(
                        new XY(piece.Start.X, piece.Start.Y),
                        new XY(piece.End.X, piece.End.Y)
                    ));
                    
                case TrackPieceType.Arc:
                    var arcPiece = (IArcPiece)piece;
                    return new TrackSegment(new ArcSegment(
                        new XY(piece.Start.X, piece.Start.Y),
                        new XY(piece.End.X, piece.End.Y),
                        new XY(arcPiece.Center.X, arcPiece.Center.Y),
                        arcPiece.Clockwise
                    ));
                    
                default:
                    throw new NotSupportedException($"Unsupported track piece type: {piece.Type}");
            }
        }

        // Create Track from JSON data
        public static Track FromJsonData(TrackDataJson trackJson)
        {
            if (trackJson == null)
                throw new ArgumentNullException(nameof(trackJson));

            var pieces = new List<ITrackPiece>();

            foreach (var pieceJson in trackJson.Pieces)
            {
                var start = new Vector(pieceJson.Start.X, pieceJson.Start.Y);
                var end = new Vector(pieceJson.End.X, pieceJson.End.Y);

                switch (pieceJson.Type)
                {
                    case "Straight":
                        pieces.Add(new StraightPiece(start, end, pieceJson.Width));
                        break;
                        
                    case "Arc":
                        if (pieceJson.Center == null)
                            throw new InvalidOperationException("Arc piece missing center data");
                        
                        var center = new Vector(pieceJson.Center.X, pieceJson.Center.Y);
                        bool clockwise = pieceJson.Clockwise ?? false;
                        pieces.Add(new ArcPiece(start, end, center, clockwise, pieceJson.Width));
                        break;
                        
                    default:
                        throw new NotSupportedException($"Unknown track piece type: {pieceJson.Type}");
                }
            }

            var startingPoint = new Vector(trackJson.StartingPoint.X, trackJson.StartingPoint.Y);
            
            return new Track(pieces.ToArray(), startingPoint, trackJson.StartingDirection);
        }

        // Convert back to JSON data for saving
        public TrackDataJson ToJsonData()
        {
            var pieces = AnalyticPieces.Select(piece =>
            {
                var pieceJson = new TrackPieceJson
                {
                    Type = JsonMapping.ToTrackPieceTypeString(piece.Type),
                    Start = new PositionJson { X = piece.Start.X, Y = piece.Start.Y },
                    End = new PositionJson { X = piece.End.X, Y = piece.End.Y },
                    Width = piece.Width
                };

                if (piece is IArcPiece arcPiece)
                {
                    pieceJson.Center = new PositionJson { X = arcPiece.Center.X, Y = arcPiece.Center.Y };
                    pieceJson.Clockwise = arcPiece.Clockwise;
                }

                return pieceJson;
            }).ToList();

            return new TrackDataJson
            {
                StartingPoint = new PositionJson { X = StartingPoint.X, Y = StartingPoint.Y },
                StartingDirection = StartingDirection,
                Pieces = pieces
            };
        }
    }
}