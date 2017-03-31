
export interface IMarker {
    startTime: number;
    endTime: number;
    onStart: (player) => void;
    onEnd?: (player) => void;
}

export type Range = [number, number];
function numberInRange (n: number, range: Range) {
    const [start, end] = range;
    return n > start && n < end;
}


//
export const startedIn = (marker: IMarker, range: Range) => numberInRange(marker.startTime, range);
export const endedIn = (marker: IMarker, range: Range) => numberInRange(marker.endTime, range);
