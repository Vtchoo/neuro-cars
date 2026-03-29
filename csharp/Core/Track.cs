using System;
using System.Collections.Concurrent;
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
        public ITrackPiece[] Pieces { get; set; }
        public ITrackPiece[] AnalyticPieces { get; private set; }
        public Vector StartingPoint { get; set; }
        public double StartingDirection { get; set; }

        private List<TrackSegment> trackSegments;

        private ConcurrentDictionary<string, bool> TrackMapCache = new();

        public Track(ITrackPiece[] pieces, Vector startingPoint, double startingDirection)
        {
            Pieces = pieces;
            AnalyticPieces = pieces;
            StartingPoint = startingPoint;
            StartingDirection = startingDirection;
            
            // Convert pieces to TrackSegments for geometry calculations
            trackSegments = pieces.Select(ConvertToTrackSegment).ToList();
        }

        // Basic track boundary check using track pieces
        public bool IsInsideTrack(double x, double y)
        {
            var cacheKey = $"{x:F0}_{y:F0}";

            if (TrackMapCache.TryGetValue(cacheKey, out bool cachedResult))
                return cachedResult;

            var point = new XY(x, y);
            
            // Check if point is within reasonable distance of any track segment
            foreach (var segment in trackSegments)
            {
                var closest = TrackMath.ClosestPointOnSegment(segment, point);
                if (closest.Distance < GetTrackWidthAtSegment() / 2)
                {
                    TrackMapCache.TryAdd(cacheKey, true);
                    return true;
                }
            }

            TrackMapCache.TryAdd(cacheKey, false);
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

            // Load all pieces first
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
            var track = new Track(pieces.ToArray(), startingPoint, trackJson.StartingDirection);
            
            // Generate optimized analytic pieces for better performance
            track.GenerateOptimizedAnalyticPieces();
            
            return track;
        }

        /// <summary>
        /// Generates optimized analytic pieces by merging consecutive pieces of the same type.
        /// This significantly improves performance with tracks that have many small pieces.
        /// </summary>
        public void GenerateOptimizedAnalyticPieces()
        {
            if (AnalyticPieces == null || AnalyticPieces.Length == 0)
                return;

            var originalCount = AnalyticPieces.Length;
            var optimizedPieces = new List<ITrackPiece>();
            
            foreach (var piece in AnalyticPieces)
            {
                var lastOptimized = optimizedPieces.LastOrDefault();
                
                if (CanMergeWithLast(piece, lastOptimized))
                {
                    MergeWithLast(optimizedPieces, piece);
                }
                else
                {
                    optimizedPieces.Add(ClonePiece(piece));
                }
            }
            
            AnalyticPieces = optimizedPieces.ToArray();
            Console.WriteLine($"Optimized track: {optimizedPieces.Count} analytic pieces from {originalCount} original pieces");
        }

        private bool CanMergeWithLast(ITrackPiece piece, ITrackPiece lastOptimized)
        {
            if (lastOptimized == null || 
                piece.Type != lastOptimized.Type || 
                Math.Abs(piece.Width - lastOptimized.Width) > 0.001)
                return false;

            switch (piece.Type)
            {
                case TrackPieceType.Straight:
                    // Can merge straights if they're collinear
                    var dir1 = Math.Atan2(lastOptimized.End.Y - lastOptimized.Start.Y, 
                                         lastOptimized.End.X - lastOptimized.Start.X);
                    var dir2 = Math.Atan2(piece.End.Y - piece.Start.Y, 
                                         piece.End.X - piece.Start.X);
                    return Math.Abs(dir1 - dir2) < 0.001; // Small tolerance for floating point errors
                    
                case TrackPieceType.Arc:
                    // Can merge arcs if they have same center and direction
                    var lastArc = (IArcPiece)lastOptimized;
                    var arcPiece = (IArcPiece)piece;
                    return Math.Abs(lastArc.Center.X - arcPiece.Center.X) < 0.001 && 
                           Math.Abs(lastArc.Center.Y - arcPiece.Center.Y) < 0.001 && 
                           lastArc.Clockwise == arcPiece.Clockwise;
                           
                default:
                    return false; // Don't merge other types for now
            }
        }

        private void MergeWithLast(List<ITrackPiece> optimizedPieces, ITrackPiece piece)
        {
            var lastIndex = optimizedPieces.Count - 1;
            var lastOptimized = optimizedPieces[lastIndex];

            switch (piece.Type)
            {
                case TrackPieceType.Straight:
                    optimizedPieces[lastIndex] = new StraightPiece(
                        lastOptimized.Start, 
                        piece.End, 
                        piece.Width);
                    break;
                    
                case TrackPieceType.Arc:
                    var lastArc = (IArcPiece)lastOptimized;
                    var arcPiece = (IArcPiece)piece;
                    optimizedPieces[lastIndex] = new ArcPiece(
                        lastOptimized.Start, 
                        piece.End, 
                        lastArc.Center, 
                        lastArc.Clockwise, 
                        piece.Width);
                    break;
            }
        }

        private ITrackPiece ClonePiece(ITrackPiece piece)
        {
            switch (piece.Type)
            {
                case TrackPieceType.Straight:
                    return new StraightPiece(
                        new Vector(piece.Start.X, piece.Start.Y), 
                        new Vector(piece.End.X, piece.End.Y), 
                        piece.Width);
                        
                case TrackPieceType.Arc:
                    var arcPiece = (IArcPiece)piece;
                    return new ArcPiece(
                        new Vector(piece.Start.X, piece.Start.Y), 
                        new Vector(piece.End.X, piece.End.Y), 
                        new Vector(arcPiece.Center.X, arcPiece.Center.Y), 
                        arcPiece.Clockwise, 
                        piece.Width);
                        
                default:
                    throw new NotSupportedException($"Unsupported piece type for cloning: {piece.Type}");
            }
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