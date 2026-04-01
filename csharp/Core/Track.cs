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

        // QuadTree for spatial queries
        private QuadTree _quadTree;
        public string BoundQueryType { get; set; } = "quadTree"; // "analytic" or "quadTree"
        
        // QuadTree configuration
        public int MaxQuadTreeDepth { get; set; } = 12;
        public double MinQuadTreeSize { get; set; } = 2.0;

        public Track(ITrackPiece[] pieces, Vector startingPoint, double startingDirection)
        {
            Pieces = pieces;
            AnalyticPieces = pieces;
            StartingPoint = startingPoint;
            StartingDirection = startingDirection;
            
            // Convert pieces to TrackSegments for geometry calculations
            trackSegments = pieces.Select(ConvertToTrackSegment).ToList();
            
            // Build quadtree for spatial queries
            BuildQuadTree();
        }

        // Basic track boundary check using track pieces
        public bool IsInsideTrack(double x, double y)
        {
            var cacheKey = $"{x:F0}_{y:F0}";

            if (TrackMapCache.TryGetValue(cacheKey, out bool cachedResult))
                return cachedResult;

            switch (BoundQueryType)
            {
                case "analytic":
                    return IsInsideTrackAnalytic(x, y);
                
                case "quadTree":
                    return IsInsideTrackQuadTree(x, y);
                
                default:
                    return IsInsideTrackAnalytic(x, y);
            }
        }

        private bool IsInsideTrackAnalytic(double x, double y)
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

        private bool IsInsideTrackQuadTree(double x, double y)
        {
            if (_quadTree == null)
            {
                BuildQuadTree();
            }

            if (_quadTree == null || AnalyticPieces.Length == 0)
            {
                return false;
            }

            return _quadTree.Query(x, y);
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
            
            // Build quadtree for spatial queries
            track.BuildQuadTree();
            
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
            
            // Rebuild quadtree after optimization
            BuildQuadTree();
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
            var pieces = Pieces.Select(piece =>
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
        
        /// <summary>
        /// Builds the quadtree for efficient spatial queries
        /// </summary>
        public void BuildQuadTree()
        {
            if (AnalyticPieces == null || AnalyticPieces.Length == 0)
            {
                _quadTree = null;
                return;
            }

            var bounds = CalculateTrackBounds();
            
            // Add some padding to ensure the track is fully contained
            const double padding = 50.0;
            bounds = new BoundingBox(
                bounds.MinX - padding,
                bounds.MinY - padding,
                bounds.MaxX + padding,
                bounds.MaxY + padding
            );

            _quadTree = new QuadTree(bounds, MaxQuadTreeDepth, MinQuadTreeSize);
            _quadTree.Build(AnalyticPieces);
            
            Console.WriteLine($"Built quadtree with bounds: MinX={bounds.MinX:F1}, MinY={bounds.MinY:F1}, MaxX={bounds.MaxX:F1}, MaxY={bounds.MaxY:F1}");
        }

        /// <summary>
        /// Calculates the bounding box that contains all track pieces
        /// </summary>
        private BoundingBox CalculateTrackBounds()
        {
            if (AnalyticPieces == null || AnalyticPieces.Length == 0)
                return new BoundingBox(0, 0, 0, 0);

            double minX = double.PositiveInfinity;
            double minY = double.PositiveInfinity;
            double maxX = double.NegativeInfinity;
            double maxY = double.NegativeInfinity;

            foreach (var piece in AnalyticPieces)
            {
                var bounds = GetPieceBounds(piece);
                minX = Math.Min(minX, bounds.MinX);
                minY = Math.Min(minY, bounds.MinY);
                maxX = Math.Max(maxX, bounds.MaxX);
                maxY = Math.Max(maxY, bounds.MaxY);
            }

            return new BoundingBox(minX, minY, maxX, maxY);
        }

        /// <summary>
        /// Gets the bounding box of a track piece
        /// </summary>
        private BoundingBox GetPieceBounds(ITrackPiece piece)
        {
            double halfWidth = piece.Width / 2;

            switch (piece.Type)
            {
                case TrackPieceType.Straight:
                    double minX = Math.Min(piece.Start.X, piece.End.X) - halfWidth;
                    double maxX = Math.Max(piece.Start.X, piece.End.X) + halfWidth;
                    double minY = Math.Min(piece.Start.Y, piece.End.Y) - halfWidth;
                    double maxY = Math.Max(piece.Start.Y, piece.End.Y) + halfWidth;
                    return new BoundingBox(minX, minY, maxX, maxY);

                case TrackPieceType.Arc:
                    var arcPiece = (IArcPiece)piece;
                    double radius = Math.Sqrt(Math.Pow(piece.Start.X - arcPiece.Center.X, 2) + 
                                            Math.Pow(piece.Start.Y - arcPiece.Center.Y, 2));
                    double centerX = arcPiece.Center.X;
                    double centerY = arcPiece.Center.Y;

                    // Calculate actual arc bounds instead of using full circle
                    double startAngle = Math.Atan2(piece.Start.Y - centerY, piece.Start.X - centerX);
                    double endAngle = Math.Atan2(piece.End.Y - centerY, piece.End.X - centerX);

                    // Collect points that contribute to the bounding box
                    var boundingPoints = new List<XY> { 
                        new XY(piece.Start.X, piece.Start.Y), 
                        new XY(piece.End.X, piece.End.Y) 
                    };

                    // Check if any cardinal directions (0°, 90°, 180°, 270°) are within the arc
                    double[] cardinalAngles = { 0, Math.PI / 2, Math.PI, 3 * Math.PI / 2 };

                    foreach (double cardinalAngle in cardinalAngles)
                    {
                        if (IsAngleInArc(cardinalAngle, startAngle, endAngle, arcPiece.Clockwise))
                        {
                            double x = centerX + radius * Math.Cos(cardinalAngle);
                            double y = centerY + radius * Math.Sin(cardinalAngle);
                            boundingPoints.Add(new XY(x, y));
                        }
                    }

                    // Calculate bounds from all collected points
                    minX = boundingPoints.Min(p => p.X) - halfWidth;
                    maxX = boundingPoints.Max(p => p.X) + halfWidth;
                    minY = boundingPoints.Min(p => p.Y) - halfWidth;
                    maxY = boundingPoints.Max(p => p.Y) + halfWidth;

                    return new BoundingBox(minX, minY, maxX, maxY);

                default:
                    return new BoundingBox(0, 0, 0, 0);
            }
        }

        /// <summary>
        /// Checks if an angle is within an arc
        /// </summary>
        private bool IsAngleInArc(double angle, double startAngle, double endAngle, bool clockwise)
        {
            // Normalize all angles to [0, 2π]
            double NormalizeAngle(double a)
            {
                while (a < 0) a += 2 * Math.PI;
                while (a >= 2 * Math.PI) a -= 2 * Math.PI;
                return a;
            }

            double normStart = NormalizeAngle(startAngle);
            double normEnd = NormalizeAngle(endAngle);
            double normAngle = NormalizeAngle(angle);

            if (!clockwise)
            {
                // Counter-clockwise: from start to end going counter-clockwise
                if (normStart >= normEnd)
                {
                    // Normal case: start > end, angle should be between start and end
                    return normAngle >= normEnd && normAngle <= normStart;
                }
                else
                {
                    // Arc crosses 0: angle should be >= end or <= start
                    return normAngle >= normEnd || normAngle <= normStart;
                }
            }
            else
            {
                // Clockwise: from start to end going clockwise
                if (normStart <= normEnd)
                {
                    // Normal case: start < end, angle should be between start and end
                    return normAngle >= normStart && normAngle <= normEnd;
                }
                else
                {
                    // Arc crosses 0: angle should be >= start or <= end
                    return normAngle >= normStart || normAngle <= normEnd;
                }
            }
        }
    }
}