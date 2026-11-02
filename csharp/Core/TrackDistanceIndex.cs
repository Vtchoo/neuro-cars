using SmartRace.Utils;

namespace SmartRace.Core;

// Built once with simulation geometry and shared by every car.
public sealed class TrackDistanceIndex
{
    private readonly ITrackPiece[] pieces;
    public double[] CumulativeLengths { get; }
    public double Length => CumulativeLengths[^1];

    public TrackDistanceIndex(ITrackPiece[] pieces)
    {
        this.pieces = pieces;
        CumulativeLengths = new double[pieces.Length + 1];
        for (int i = 0; i < pieces.Length; i++)
            CumulativeLengths[i+1] = CumulativeLengths[i] + pieces[i].Length;
    }

    public (Vector point, double direction, int pieceIndex, double offsetInPiece) PointAhead(
        int segmentIndex, double offset, double distance, bool closed)
    {
        if (Length <= 0) throw new InvalidOperationException("Track contains no drivable geometry.");
        double target = CumulativeLengths[segmentIndex] + offset + distance;
        target = closed ? ((target % Length) + Length) % Length : Math.Clamp(target, 0, Length);
        int lo = 0, hi = pieces.Length - 1;
        while (lo < hi)
        {
            int mid = (lo + hi) / 2;
            if (CumulativeLengths[mid+1] <= target) lo = mid+1;
            else hi = mid;
        }
        var piece = pieces[lo];
        offset = target - CumulativeLengths[lo];
        double t = offset / Math.Max(piece.Length, 1e-12);
        Vector point;
        double direction;
        if (piece is IArcPiece arc)
        {
            double radius = SplinePiece.Distance(piece.Start, arc.Center);
            double angle = Math.Atan2(piece.Start.Y-arc.Center.Y, piece.Start.X-arc.Center.X)
                + (arc.Clockwise ? 1 : -1) * offset / radius;
            point = new Vector(arc.Center.X + radius*Math.Cos(angle), arc.Center.Y + radius*Math.Sin(angle));
            direction = angle + (arc.Clockwise ? Math.PI/2 : -Math.PI/2);
        }
        else
        {
            point = SplinePiece.Mix(piece.Start, piece.End, t);
            direction = Math.Atan2(piece.End.Y-piece.Start.Y, piece.End.X-piece.Start.X);
        }
        return (point, direction, lo, offset);
    }
}
