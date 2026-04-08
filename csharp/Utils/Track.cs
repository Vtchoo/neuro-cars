using System;

namespace SmartRace.Utils
{
    public struct XY
    {
        public double X { get; set; }
        public double Y { get; set; }

        public XY(double x, double y)
        {
            X = x;
            Y = y;
        }

        public override string ToString() => $"({X}, {Y})";
    }

    public struct ClosestPointResult
    {
        public XY Point { get; set; }
        public XY Tangent { get; set; }       // normalized track-forward direction at closest point
        public double Distance { get; set; }
        public double DistanceSq { get; set; }
        public double T { get; set; }         // local segment parameter [0,1]
        public double DistanceFromTrackPieceStart { get; set; }
    }

    public struct LineSegment
    {
        public string Kind { get; }
        public XY Start { get; set; }
        public XY End { get; set; }

        public LineSegment(XY start, XY end)
        {
            Kind = "line";
            Start = start;
            End = end;
        }
    }

    public struct ArcSegment
    {
        public string Kind { get; }
        public XY Start { get; set; }
        public XY End { get; set; }
        public XY Center { get; set; }
        public bool Clockwise { get; set; }

        public ArcSegment(XY start, XY end, XY center, bool clockwise)
        {
            Kind = "arc";
            Start = start;
            End = end;
            Center = center;
            Clockwise = clockwise;
        }
    }

    public struct BezierSegment
    {
        public string Kind { get; }
        public XY P0 { get; set; }
        public XY P1 { get; set; }
        public XY P2 { get; set; }
        public XY P3 { get; set; }

        public BezierSegment(XY p0, XY p1, XY p2, XY p3)
        {
            Kind = "bezier";
            P0 = p0;
            P1 = p1;
            P2 = p2;
            P3 = p3;
        }
    }

    public interface ITrackSegment
    {
        string Kind { get; }
    }

    public struct TrackSegment : ITrackSegment
    {
        private readonly object _segment;
        
        public string Kind { get; private set; }

        public TrackSegment(LineSegment segment)
        {
            _segment = segment;
            Kind = "line";
        }

        public TrackSegment(ArcSegment segment)
        {
            _segment = segment;
            Kind = "arc";
        }

        public TrackSegment(BezierSegment segment)
        {
            _segment = segment;
            Kind = "bezier";
        }

        public LineSegment AsLine() => (LineSegment)_segment;
        public ArcSegment AsArc() => (ArcSegment)_segment;
        public BezierSegment AsBezier() => (BezierSegment)_segment;
    }

    public struct ClosestPointOnTrackResult
    {
        public XY Point { get; set; }
        public XY Tangent { get; set; }
        public double Distance { get; set; }
        public double DistanceSq { get; set; }
        public double T { get; set; }
        public int SegmentIndex { get; set; }
        public double DistanceFromTrackPieceStart { get; set; }
    }

    public struct TrackQueryResult
    {
        public XY Point { get; set; }
        public XY Tangent { get; set; }
        public double Distance { get; set; }
        public double DistanceSq { get; set; }
        public double T { get; set; }
        public int SegmentIndex { get; set; }
        public double LateralOffset { get; set; }    // right positive, left negative
        public double HeadingAngle { get; set; }     // signed angle from track tangent to car heading, in [-PI, PI]
        public double DistanceFromTrackPieceStart { get; set; }
    }

    public static class TrackMath
    {
        public static XY Add(XY a, XY b)
        {
            return new XY(a.X + b.X, a.Y + b.Y);
        }

        public static XY Sub(XY a, XY b)
        {
            return new XY(a.X - b.X, a.Y - b.Y);
        }

        public static XY Mul(XY v, double s)
        {
            return new XY(v.X * s, v.Y * s);
        }

        public static double Dot(XY a, XY b)
        {
            return a.X * b.X + a.Y * b.Y;
        }

        public static double Cross(XY a, XY b)
        {
            return a.X * b.Y - a.Y * b.X;
        }

        public static double LengthSq(XY v)
        {
            return Dot(v, v);
        }

        public static double Length(XY v)
        {
            return Math.Sqrt(LengthSq(v));
        }

        public static XY Normalize(XY v)
        {
            double len = Length(v);
            if (len == 0) return new XY(0, 0);
            return new XY(v.X / len, v.Y / len);
        }

        public static double Clamp(double v, double min, double max)
        {
            return Math.Max(min, Math.Min(max, v));
        }

        public static double DistanceSq(XY a, XY b)
        {
            return LengthSq(Sub(a, b));
        }

        public static double AngleOf(XY v)
        {
            return Math.Atan2(v.Y, v.X);
        }

        public static double WrapAngle(double a)
        {
            while (a <= -Math.PI) a += 2 * Math.PI;
            while (a > Math.PI) a -= 2 * Math.PI;
            return a;
        }

        /// <summary>
        /// Signed angular travel from 'from' to 'to'.
        /// If ccw=true, result is in [0, 2π).
        /// If ccw=false, result is in (-2π, 0].
        /// </summary>
        public static double SignedArcDelta(double from, double to, bool ccw)
        {
            double d = WrapAngle(to - from);

            if (ccw)
            {
                if (d < 0) d += 2 * Math.PI;
            }
            else
            {
                if (d > 0) d -= 2 * Math.PI;
            }

            return d;
        }

        public static ClosestPointResult ClosestPointOnLineSegment(LineSegment seg, XY q)
        {
            XY a = seg.Start;
            XY b = seg.End;
            XY ab = Sub(b, a);
            double abLenSq = LengthSq(ab);

            if (abLenSq < 1e-12)
            {
                return new ClosestPointResult
                {
                    Point = a,
                    Tangent = new XY(1, 0),
                    DistanceSq = (double)DistanceSq(q, a),
                    Distance = Math.Sqrt((double)DistanceSq(q, a)),
                    T = 0,
                    DistanceFromTrackPieceStart = 0,
                };
            }

            double t = Clamp(Dot(Sub(q, a), ab) / abLenSq, 0, 1);
            XY point = Add(a, Mul(ab, t));
            XY tangent = Normalize(ab);
            double d2 = DistanceSq(q, point);

            return new ClosestPointResult
            {
                Point = point,
                Tangent = tangent,
                DistanceSq = d2,
                Distance = Math.Sqrt(d2),
                T = t,
                DistanceFromTrackPieceStart = t * Math.Sqrt(abLenSq),
            };
        }

        public static ClosestPointResult ClosestPointOnArcSegment(ArcSegment seg, XY q)
        {
            XY vs = Sub(seg.Start, seg.Center);
            XY ve = Sub(seg.End, seg.Center);
            XY vq = Sub(q, seg.Center);

            double rs = Length(vs);
            double re = Length(ve);

            if (rs < 1e-12 || re < 1e-12)
            {
                throw new InvalidOperationException("Arc start/end must not coincide with center.");
            }

            double radius = 0.5 * (rs + re);
            if (Math.Abs(rs - re) > 1e-6 * Math.Max(1, radius))
            {
                throw new InvalidOperationException("Arc start and end are not on the same circle.");
            }

            double a0 = AngleOf(vs);
            double a1 = AngleOf(ve);
            double aq = AngleOf(vq);

            bool useCCW = seg.Clockwise;
            double totalDelta = SignedArcDelta(a0, a1, useCCW);

            // Where does q lie along that directed arc?
            double qDelta = SignedArcDelta(a0, aq, useCCW);
            bool onArc = useCCW
                ? qDelta >= 0 && qDelta <= totalDelta
                : qDelta <= 0 && qDelta >= totalDelta;

            XY point;
            double t;

            if (LengthSq(vq) == 0)
            {
                // Query exactly at center: any circle point is equally radially valid,
                // so fall back to nearest endpoint.
                double d2Start = DistanceSq(q, seg.Start);
                double d2End = DistanceSq(q, seg.End);
                if (d2Start <= d2End)
                {
                    point = seg.Start;
                    t = 0;
                }
                else
                {
                    point = seg.End;
                    t = 1;
                }
            }
            else if (onArc)
            {
                XY dir = Normalize(vq);
                point = Add(seg.Center, Mul(dir, radius));
                t = totalDelta == 0 ? 0 : qDelta / totalDelta;
            }
            else
            {
                double d2Start = DistanceSq(q, seg.Start);
                double d2End = DistanceSq(q, seg.End);
                if (d2Start <= d2End)
                {
                    point = seg.Start;
                    t = 0;
                }
                else
                {
                    point = seg.End;
                    t = 1;
                }
            }

            // Forward tangent follows arc direction.
            XY radial = Normalize(Sub(point, seg.Center));
            XY tangent = !seg.Clockwise
                ? new XY(radial.Y, -radial.X)   // rotate radial by -90°
                : new XY(-radial.Y, radial.X);  // rotate radial by +90°

            double d2 = DistanceSq(q, point);

            double distanceFromTrackPieceStart = t * Math.Abs(totalDelta) * radius;

            return new ClosestPointResult
            {
                Point = point,
                Tangent = Normalize(tangent),
                DistanceSq = d2,
                Distance = Math.Sqrt(d2),
                T = Clamp(t, 0, 1),
                DistanceFromTrackPieceStart = distanceFromTrackPieceStart,
            };
        }

        /// <summary>
        /// Right normal for a forward tangent.
        /// If tangent points forward, this points to track-right.
        /// </summary>
        private static XY RightNormalFromTangent(XY tangent)
        {
            return new XY(tangent.Y, -tangent.X);
        }

        private static XY CarDirectionFromAngle(double angle)
        {
            return new XY(Math.Cos(angle), Math.Sin(angle));
        }

        public static ClosestPointResult ClosestPointOnSegment(TrackSegment seg, XY q)
        {
            switch (seg.Kind)
            {
                case "line":
                    return ClosestPointOnLineSegment(seg.AsLine(), q);
                case "arc":
                    return ClosestPointOnArcSegment(seg.AsArc(), q);
                default:
                    throw new NotSupportedException($"Unsupported segment kind: {seg.Kind}");
                // case "bezier":
                //   return ClosestPointOnBezier(seg, q);
            }
        }

        public static TrackQueryResult QueryTrack(TrackSegment[] track, XY carPos, double carAngle)
        {
            if (track.Length == 0)
            {
                throw new ArgumentException("Track must contain at least one segment.");
            }

            ClosestPointOnTrackResult? best = null;

            for (int i = 0; i < track.Length; i++)
            {
                ClosestPointResult r = ClosestPointOnSegment(track[i], carPos);
                if (!best.HasValue || r.DistanceSq < best.Value.DistanceSq)
                {
                    best = new ClosestPointOnTrackResult
                    {
                        Point = r.Point,
                        Tangent = r.Tangent,
                        Distance = r.Distance,
                        DistanceSq = r.DistanceSq,
                        T = r.T,
                        SegmentIndex = i,
                        DistanceFromTrackPieceStart = r.DistanceFromTrackPieceStart,
                    };
                }
            }

            XY tangent = Normalize(best.Value.Tangent);
            XY delta = Sub(carPos, best.Value.Point);

            // Right-positive lateral offset
            XY right = RightNormalFromTangent(tangent);
            double lateralOffset = Dot(delta, right);

            // Signed heading angle from track tangent to car heading, in [-PI, PI]
            double trackAngle = AngleOf(tangent);
            double headingAngle = WrapAngle(carAngle - trackAngle);

            return new TrackQueryResult
            {
                Point = best.Value.Point,
                Tangent = tangent,
                Distance = best.Value.Distance,
                DistanceSq = best.Value.DistanceSq,
                T = best.Value.T,
                SegmentIndex = best.Value.SegmentIndex,
                LateralOffset = lateralOffset,
                HeadingAngle = headingAngle,
                DistanceFromTrackPieceStart = best.Value.DistanceFromTrackPieceStart,
            };
        }
    }
}