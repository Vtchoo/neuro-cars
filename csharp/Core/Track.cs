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

        public double Length { get; private set; }

        public StraightPiece(Vector start, Vector end, double width)
        {
            Start = start;
            End = end;
            Width = width;
            Length = Math.Sqrt((end.X - start.X) * (end.X - start.X) + (end.Y - start.Y) * (end.Y - start.Y));
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

        public double Length { get; private set; }

        public ArcPiece(Vector start, Vector end, Vector center, bool clockwise, double width)
        {
            Start = start;
            End = end;
            Center = center;
            Clockwise = clockwise;
            Width = width;

            var radius = Math.Sqrt((start.X - center.X) * (start.X - center.X) + (start.Y - center.Y) * (start.Y - center.Y));
            var angleStart = Math.Atan2(start.Y - center.Y, start.X - center.X);
            var angleEnd = Math.Atan2(end.Y - center.Y, end.X - center.X);
            var angleDiff = angleEnd - angleStart;
            if (!clockwise && angleDiff > 0)
            {
                angleDiff -= 2 * Math.PI;
            }
            else if (clockwise && angleDiff < 0)
            {
                angleDiff += 2 * Math.PI;
            }
            Length = Math.Abs(angleDiff) * radius;
        }
    }

    // Concrete Track implementation
    public class Track : ITrack
    {
        public bool Closed { get; set; }
        public ITrackPiece[] Pieces { get; set; }
        public ITrackPiece[] AnalyticPieces { get; private set; }
        public TrackDistanceIndex DistanceIndex { get; private set; } = null!;
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
            AnalyticPieces = Array.Empty<ITrackPiece>();
            StartingPoint = startingPoint;
            StartingDirection = startingDirection;
            
            // Convert pieces to TrackSegments for geometry calculations
            trackSegments = new List<TrackSegment>();
            GenerateOptimizedAnalyticPieces();
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
            for (int i = 0; i < trackSegments.Count; i++)
            {
                var closest = TrackMath.ClosestPointOnSegment(trackSegments[i], point);
                if (closest.Distance <= AnalyticPieces[i].Width / 2)
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
                        
                    case "Spline":
                        if (pieceJson.Control1 == null || pieceJson.Control2 == null)
                            throw new InvalidOperationException("Spline piece missing control points");
                        pieces.Add(new SplinePiece(start,
                            new Vector(pieceJson.Control1.X, pieceJson.Control1.Y),
                            new Vector(pieceJson.Control2.X, pieceJson.Control2.Y), end, pieceJson.Width));
                        break;
                    default:
                        throw new NotSupportedException($"Unknown track piece type: {pieceJson.Type}");
                }
            }

            bool closed = trackJson.Closed ?? (pieces.Count > 1 && SplinePiece.Distance(pieces[0].Start, pieces[pieces.Count-1].End) < 0.001);
            var splines = ConvertToSplines(pieces, closed);
            var startingPoint = new Vector(trackJson.StartingPoint.X, trackJson.StartingPoint.Y);
            var track = new Track(splines, startingPoint, trackJson.StartingDirection) { Closed = closed };

            return track;
        }

        /// <summary>
        /// Rebuilds simulation geometry from source pieces. Béziers use adaptive line chords;
        /// legacy straight/arc pieces retain their merging optimization.
        /// </summary>
        public void GenerateOptimizedAnalyticPieces()
        {
            var optimizedPieces = new List<ITrackPiece>();
            foreach (var piece in Pieces)
            {
                if (piece is SplinePiece spline)
                {
                    // Keep adaptive chords in track order for progress and sensor queries.
                    optimizedPieces.AddRange(spline.Flatten());
                }
                else if (CanMergeWithLast(piece, optimizedPieces.LastOrDefault()))
                    MergeWithLast(optimizedPieces, piece);
                else
                    optimizedPieces.Add(ClonePiece(piece));
            }
            AnalyticPieces = optimizedPieces.ToArray();
            DistanceIndex = new TrackDistanceIndex(AnalyticPieces);
            trackSegments = AnalyticPieces.Select(ConvertToTrackSegment).ToList();
            TrackMapCache.Clear();
            BuildQuadTree();
        }

        private static ITrackPiece[] ConvertToSplines(IEnumerable<ITrackPiece> pieces, bool closed)
        {
            var result = new List<SplinePiece>();
            foreach (var piece in pieces)
            {
                if (piece is SplinePiece spline) result.Add(spline);
                else if (piece.Type == TrackPieceType.Straight)
                    result.Add(new SplinePiece(piece.Start, SplinePiece.Mix(piece.Start, piece.End, 1.0/3),
                        SplinePiece.Mix(piece.Start, piece.End, 2.0/3), piece.End, piece.Width));
                else if (piece is IArcPiece arc)
                {
                    double radius = SplinePiece.Distance(arc.Start, arc.Center);
                    double angle = Math.Atan2(arc.Start.Y-arc.Center.Y, arc.Start.X-arc.Center.X);
                    double sweep = Math.Atan2(arc.End.Y-arc.Center.Y, arc.End.X-arc.Center.X)-angle;
                    if (arc.Clockwise && sweep < 0) sweep += Math.PI*2;
                    if (!arc.Clockwise && sweep > 0) sweep -= Math.PI*2;
                    int count = Math.Max(1, (int)Math.Ceiling(Math.Abs(sweep)/(Math.PI/2)));
                    for (int i=0; i<count; i++)
                    {
                        double a=angle+sweep*i/count, b=angle+sweep*(i+1)/count;
                        double k=4.0/3*Math.Tan((b-a)/4)*radius;
                        var start=i==0 ? arc.Start : new Vector(arc.Center.X+radius*Math.Cos(a),arc.Center.Y+radius*Math.Sin(a));
                        var end=i==count-1 ? arc.End : new Vector(arc.Center.X+radius*Math.Cos(b),arc.Center.Y+radius*Math.Sin(b));
                        result.Add(new SplinePiece(start, new Vector(start.X-k*Math.Sin(a),start.Y+k*Math.Cos(a)),
                            new Vector(end.X+k*Math.Sin(b),end.Y-k*Math.Cos(b)),end,piece.Width));
                    }
                }
            }
            for (int i=1; i<result.Count; i++) result[i].Start=result[i-1].End;
            if (closed && result.Count>0) result[result.Count-1].End=result[0].Start;
            // Match the browser's legacy-join conversion, retaining each handle's length.
            for (int i=0; i<result.Count; i++)
            {
                if (i==0 && !closed) continue;
                var previous=result[(i+result.Count-1)%result.Count]; var next=result[i];
                double dx=previous.End.X-previous.Control2.X,dy=previous.End.Y-previous.Control2.Y;
                double magnitude=Math.Sqrt(dx*dx+dy*dy),handle=SplinePiece.Distance(next.Start,next.Control1);
                if (magnitude>0.000001) next.Control1=new Vector(next.Start.X+dx/magnitude*handle,next.Start.Y+dy/magnitude*handle);
            }
            return result.Cast<ITrackPiece>().ToArray();
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

                if (piece is SplinePiece spline)
                {
                    pieceJson.Control1 = new PositionJson { X = spline.Control1.X, Y = spline.Control1.Y };
                    pieceJson.Control2 = new PositionJson { X = spline.Control2.X, Y = spline.Control2.Y };
                }
                return pieceJson;
            }).ToList();

            return new TrackDataJson
            {
                Closed = Closed,
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
