interface TrackPiece {
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

class Track {
    pieces: TrackPiece[] = [];
}