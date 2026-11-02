using System;
using System.Collections.Generic;
using SmartRace.Utils;

namespace SmartRace.Core
{
    public class SplinePiece : ITrackPiece
    {
        public TrackPieceType Type => TrackPieceType.Spline;
        public Vector Start { get; set; }
        public Vector Control1 { get; set; }
        public Vector Control2 { get; set; }
        public Vector End { get; set; }
        public double Width { get; set; }
        public double Length
        {
            get
            {
                double length = 0;
                var previous = Start;
                for (int i = 1; i <= 100; i++)
                {
                    var point = PointAt(i / 100.0);
                    length += Distance(previous, point);
                    previous = point;
                }
                return length;
            }
        }

        public SplinePiece(Vector start, Vector control1, Vector control2, Vector end, double width)
        {
            Start = start; Control1 = control1; Control2 = control2; End = end; Width = width;
        }

        public Vector PointAt(double t)
        {
            double u = 1 - t;
            return new Vector(
                u*u*u*Start.X + 3*u*u*t*Control1.X + 3*u*t*t*Control2.X + t*t*t*End.X,
                u*u*u*Start.Y + 3*u*u*t*Control1.Y + 3*u*t*t*Control2.Y + t*t*t*End.Y);
        }

        // Match the browser's adaptive collision geometry: at most 8 world units per chord,
        // and less than 0.02 units between control-polygon and chord lengths.
        public IEnumerable<ITrackPiece> Flatten() => Flatten(Start, Control1, Control2, End, 0);

        private IEnumerable<ITrackPiece> Flatten(Vector a, Vector b, Vector c, Vector d, int depth)
        {
            double chord = Distance(a, d);
            double polygon = Distance(a, b) + Distance(b, c) + Distance(c, d);
            if (depth >= 16 || (polygon - chord < 0.02 && polygon <= 8))
            {
                if (chord > 0.000001) yield return new StraightPiece(a, d, Width);
                yield break;
            }
            var ab = Mix(a, b, .5); var bc = Mix(b, c, .5); var cd = Mix(c, d, .5);
            var abc = Mix(ab, bc, .5); var bcd = Mix(bc, cd, .5); var mid = Mix(abc, bcd, .5);
            foreach (var piece in Flatten(a, ab, abc, mid, depth + 1)) yield return piece;
            foreach (var piece in Flatten(mid, bcd, cd, d, depth + 1)) yield return piece;
        }

        internal static double Distance(Vector a, Vector b) => Math.Sqrt(Math.Pow(a.X-b.X, 2) + Math.Pow(a.Y-b.Y, 2));
        internal static Vector Mix(Vector a, Vector b, double t) => new Vector(a.X+(b.X-a.X)*t, a.Y+(b.Y-a.Y)*t);
    }
}
