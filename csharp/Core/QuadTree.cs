using System;
using System.Collections.Generic;
using System.Linq;
using SmartRace.Utils;

namespace SmartRace.Core
{
    /// <summary>
    /// Represents a bounding box for spatial queries
    /// </summary>
    public struct BoundingBox
    {
        public double MinX { get; set; }
        public double MinY { get; set; }  
        public double MaxX { get; set; }
        public double MaxY { get; set; }

        public BoundingBox(double minX, double minY, double maxX, double maxY)
        {
            MinX = minX;
            MinY = minY;
            MaxX = maxX;
            MaxY = maxY;
        }

        public double Width => MaxX - MinX;
        public double Height => MaxY - MinY;
        
        public bool Contains(double x, double y)
        {
            return x >= MinX && x <= MaxX && y >= MinY && y <= MaxY;
        }
        
        public bool Intersects(BoundingBox other)
        {
            return !(MaxX < other.MinX || MinX > other.MaxX || MaxY < other.MinY || MinY > other.MaxY);
        }
    }

    /// <summary>
    /// Represents the result of a line segment intersection test
    /// </summary>
    public struct LineIntersection
    {
        public bool Intersects { get; set; }
        public XY? Point { get; set; }

        public LineIntersection(bool intersects, XY? point = null)
        {
            Intersects = intersects;
            Point = point;
        }
    }

    /// <summary>
    /// Represents a node in the quadtree
    /// </summary>
    public class QuadTreeNode
    {
        public BoundingBox Bounds { get; set; }
        public bool IsLeaf { get; set; }
        public bool HasTrack { get; set; }
        public QuadTreeNode[] Children { get; set; }
        public List<ITrackPiece> TrackPieces { get; set; }

        public QuadTreeNode(BoundingBox bounds)
        {
            Bounds = bounds;
            IsLeaf = true;
            HasTrack = false;
            TrackPieces = new List<ITrackPiece>();
        }
    }

    /// <summary>
    /// Quadtree implementation for efficient spatial track queries
    /// </summary>
    public class QuadTree
    {
        private QuadTreeNode _root;
        private readonly int _maxDepth;
        private readonly double _minSize;

        public QuadTree(BoundingBox bounds, int maxDepth = 12, double minSize = 2.0)
        {
            _maxDepth = maxDepth;
            _minSize = minSize;
            _root = new QuadTreeNode(bounds);
        }

        /// <summary>
        /// Builds the quadtree from track pieces
        /// </summary>
        public void Build(IEnumerable<ITrackPiece> trackPieces)
        {
            var pieces = trackPieces.ToList();
            if (pieces.Count == 0)
            {
                _root = null;
                return;
            }

            _root = CreateNode(_root.Bounds, pieces, 0);
        }

        /// <summary>
        /// Queries the quadtree to check if a point is inside the track
        /// </summary>
        public bool Query(double x, double y)
        {
            if (_root == null)
                return false;
                
            return QueryNode(_root, x, y);
        }

        /// <summary>
        /// Creates a quadtree node recursively
        /// </summary>
        private QuadTreeNode CreateNode(BoundingBox bounds, List<ITrackPiece> trackPieces, int depth)
        {
            var node = new QuadTreeNode(bounds);

            // Check if we should stop subdividing
            if (depth >= _maxDepth || 
                Math.Min(bounds.Width, bounds.Height) < _minSize || 
                trackPieces.Count == 0)
            {
                node.HasTrack = CheckQuadrantHasTrack(bounds, trackPieces);
                node.TrackPieces = trackPieces;
                return node;
            }

            // The root node (depth 0) must always be subdivided since its borders  
            // won't intersect with track pieces by design (they contain the entire track with padding)
            bool shouldSubdivide = depth == 0 || ShouldSubdivideQuadrant(bounds, trackPieces);

            if (!shouldSubdivide)
            {
                // If no border crossing, check if any corner is inside the track
                node.HasTrack = CheckQuadrantCornerInTrack(bounds, trackPieces);
                node.TrackPieces = trackPieces;
            }
            else
            {
                // Subdivide into 4 children
                node.IsLeaf = false;
                node.Children = new QuadTreeNode[4];

                double midX = (bounds.MinX + bounds.MaxX) / 2;
                double midY = (bounds.MinY + bounds.MaxY) / 2;

                var childBounds = new[]
                {
                    new BoundingBox(bounds.MinX, bounds.MinY, midX, midY), // Bottom-left
                    new BoundingBox(midX, bounds.MinY, bounds.MaxX, midY), // Bottom-right
                    new BoundingBox(bounds.MinX, midY, midX, bounds.MaxY), // Top-left
                    new BoundingBox(midX, midY, bounds.MaxX, bounds.MaxY)  // Top-right
                };

                for (int i = 0; i < 4; i++)
                {
                    // Get track pieces that intersect with this child
                    var relevantPieces = trackPieces
                        .Where(piece => PieceIntersectsBounds(piece, childBounds[i]))
                        .ToList();

                    node.Children[i] = CreateNode(childBounds[i], relevantPieces, depth + 1);
                }
            }

            return node;
        }

        /// <summary>
        /// Checks if track piece boundaries cross the quadrant borders
        /// </summary>
        private bool ShouldSubdivideQuadrant(BoundingBox bounds, List<ITrackPiece> trackPieces)
        {
            var quadrantLines = new[]
            {
                (new XY(bounds.MinX, bounds.MinY), new XY(bounds.MaxX, bounds.MinY)), // Bottom edge
                (new XY(bounds.MaxX, bounds.MinY), new XY(bounds.MaxX, bounds.MaxY)), // Right edge
                (new XY(bounds.MaxX, bounds.MaxY), new XY(bounds.MinX, bounds.MaxY)), // Top edge
                (new XY(bounds.MinX, bounds.MaxY), new XY(bounds.MinX, bounds.MinY))  // Left edge
            };

            foreach (var piece in trackPieces)
            {
                foreach (var (lineStart, lineEnd) in quadrantLines)
                {
                    if (TrackPieceCrossesLine(piece, lineStart, lineEnd))
                        return true;
                }
            }

            return false;
        }

        /// <summary>
        /// Checks if any corner of the quadrant is inside the track
        /// </summary>
        private bool CheckQuadrantCornerInTrack(BoundingBox bounds, List<ITrackPiece> trackPieces)
        {
            var corners = new[]
            {
                new XY(bounds.MinX, bounds.MinY),
                new XY(bounds.MaxX, bounds.MinY),
                new XY(bounds.MaxX, bounds.MaxY),
                new XY(bounds.MinX, bounds.MaxY)
            };

            foreach (var corner in corners)
            {
                foreach (var piece in trackPieces)
                {
                    double distance = GetDistanceToPiece(piece, corner);
                    if (distance <= piece.Width / 2)
                        return true;
                }
            }

            return false;
        }

        /// <summary>
        /// Checks if a quadrant has track (fallback method)
        /// </summary>
        private bool CheckQuadrantHasTrack(BoundingBox bounds, List<ITrackPiece> trackPieces)
        {
            // Check center point of quadrant
            double centerX = (bounds.MinX + bounds.MaxX) / 2;
            double centerY = (bounds.MinY + bounds.MaxY) / 2;
            var queryPoint = new XY(centerX, centerY);

            foreach (var piece in trackPieces)
            {
                double distance = GetDistanceToPiece(piece, queryPoint);
                if (distance <= piece.Width / 2)
                    return true;
            }

            return false;
        }

        /// <summary>
        /// Checks if a track piece intersects with the given bounds
        /// </summary>
        private bool PieceIntersectsBounds(ITrackPiece piece, BoundingBox bounds)
        {
            var pieceBounds = GetPieceBounds(piece);
            return bounds.Intersects(pieceBounds);
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

        /// <summary>
        /// Gets the distance from a point to a track piece
        /// </summary>
        private double GetDistanceToPiece(ITrackPiece piece, XY point)
        {
            switch (piece.Type)
            {
                case TrackPieceType.Straight:
                    var lineSegment = new TrackSegment(new LineSegment(
                        new XY(piece.Start.X, piece.Start.Y),
                        new XY(piece.End.X, piece.End.Y)
                    ));
                    return TrackMath.ClosestPointOnSegment(lineSegment, point).Distance;

                case TrackPieceType.Arc:
                    var arcPiece = (IArcPiece)piece;
                    var arcSegment = new TrackSegment(new ArcSegment(
                        new XY(piece.Start.X, piece.Start.Y),
                        new XY(piece.End.X, piece.End.Y),
                        new XY(arcPiece.Center.X, arcPiece.Center.Y),
                        arcPiece.Clockwise
                    ));
                    return TrackMath.ClosestPointOnSegment(arcSegment, point).Distance;

                default:
                    return double.PositiveInfinity;
            }
        }

        /// <summary>
        /// Checks if a track piece crosses a line segment
        /// </summary>
        private bool TrackPieceCrossesLine(ITrackPiece piece, XY lineStart, XY lineEnd)
        {
            switch (piece.Type)
            {
                case TrackPieceType.Straight:
                    // For straights, check if the track boundaries intersect with the line
                    double dir = Math.Atan2(piece.End.Y - piece.Start.Y, piece.End.X - piece.Start.X);
                    double offsetX = piece.Width * Math.Sin(dir) / 2;
                    double offsetY = piece.Width * Math.Cos(dir) / 2;

                    var line1Start = new XY(piece.Start.X - offsetX, piece.Start.Y + offsetY);
                    var line1End = new XY(piece.End.X - offsetX, piece.End.Y + offsetY);
                    var line2Start = new XY(piece.Start.X + offsetX, piece.Start.Y - offsetY);
                    var line2End = new XY(piece.End.X + offsetX, piece.End.Y - offsetY);

                    return LineSegmentIntersection(line1Start, line1End, lineStart, lineEnd).Intersects ||
                           LineSegmentIntersection(line2Start, line2End, lineStart, lineEnd).Intersects;

                case TrackPieceType.Arc:
                    var arcPiece = (IArcPiece)piece;
                    double radius = Math.Sqrt(Math.Pow(piece.Start.X - arcPiece.Center.X, 2) + 
                                            Math.Pow(piece.Start.Y - arcPiece.Center.Y, 2));
                    double internalRadius = radius - piece.Width / 2;
                    double externalRadius = radius + piece.Width / 2;

                    // Check intersection with both the internal and external circles
                    var internalIntersections = CircleLineIntersection(arcPiece.Center, internalRadius, lineStart, lineEnd);
                    var externalIntersections = CircleLineIntersection(arcPiece.Center, externalRadius, lineStart, lineEnd);

                    return internalIntersections.Any(i => i.Intersects) || 
                           externalIntersections.Any(i => i.Intersects);

                default:
                    return false;
            }
        }

        /// <summary>
        /// Checks if two line segments intersect
        /// </summary>
        private LineIntersection LineSegmentIntersection(XY a1, XY a2, XY b1, XY b2)
        {
            double denom = (b2.Y - b1.Y) * (a2.X - a1.X) - (b2.X - b1.X) * (a2.Y - a1.Y);

            if (Math.Abs(denom) < 1e-10)
                return new LineIntersection(false); // Lines are parallel

            double ua = ((b2.X - b1.X) * (a1.Y - b1.Y) - (b2.Y - b1.Y) * (a1.X - b1.X)) / denom;
            double ub = ((a2.X - a1.X) * (a1.Y - b1.Y) - (a2.Y - a1.Y) * (a1.X - b1.X)) / denom;

            if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1)
            {
                double x = a1.X + ua * (a2.X - a1.X);
                double y = a1.Y + ua * (a2.Y - a1.Y);
                return new LineIntersection(true, new XY(x, y));
            }

            return new LineIntersection(false);
        }

        /// <summary>
        /// Calculates intersections between a circle and a line segment
        /// </summary>
        private List<LineIntersection> CircleLineIntersection(Vector center, double radius, XY lineStart, XY lineEnd)
        {
            double dx = lineEnd.X - lineStart.X;
            double dy = lineEnd.Y - lineStart.Y;
            double fx = lineStart.X - center.X;
            double fy = lineStart.Y - center.Y;
            double a = dx * dx + dy * dy;
            double b = 2 * (fx * dx + fy * dy);
            double c = fx * fx + fy * fy - radius * radius;
            double discriminant = b * b - 4 * a * c;

            var intersections = new List<LineIntersection>();

            if (discriminant < 0)
            {
                intersections.Add(new LineIntersection(false)); // No intersection
                return intersections;
            }

            double sqrtDiscriminant = Math.Sqrt(discriminant);
            double t1 = (-b - sqrtDiscriminant) / (2 * a);
            double t2 = (-b + sqrtDiscriminant) / (2 * a);

            if (t1 >= 0 && t1 <= 1)
            {
                intersections.Add(new LineIntersection(true, new XY(
                    lineStart.X + t1 * dx,
                    lineStart.Y + t1 * dy
                )));
            }

            if (t2 >= 0 && t2 <= 1 && Math.Abs(t2 - t1) > 1e-10)
            {
                intersections.Add(new LineIntersection(true, new XY(
                    lineStart.X + t2 * dx,
                    lineStart.Y + t2 * dy
                )));
            }

            if (intersections.Count == 0)
                intersections.Add(new LineIntersection(false));

            return intersections;
        }

        /// <summary>
        /// Queries a quadtree node to check if a point is inside the track
        /// </summary>
        private bool QueryNode(QuadTreeNode node, double x, double y)
        {
            // Check if point is within bounds
            if (!node.Bounds.Contains(x, y))
                return false;

            if (node.IsLeaf)
                return node.HasTrack;

            // Query children
            if (node.Children != null)
            {
                foreach (var child in node.Children)
                {
                    if (QueryNode(child, x, y))
                        return true;
                }
            }

            return false;
        }
    }
}