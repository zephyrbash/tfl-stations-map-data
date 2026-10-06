// Only the TfL fields needed to build the graph are represented here.
export type Line = {
    id: string;
    name: string;
    modeName?: string;
};

export type Stop = {
    id: string;
    stationId?: string;
    name?: string;
    lat?: number;
    lon?: number;
    zone?: string;
};

export type RouteSequence = {
    lineId: string;
    lineName?: string;
    direction: string;
    mode?: string;
    stations?: Stop[];
    stopPointSequences?: StopPointSequence[];
    orderedLineRoutes?: OrderedLineRoute[];
};

export type StopPointSequence = {
    stopPoint?: Stop[];
};

export type OrderedLineRoute = {
    naptanIds?: string[];
    serviceType?: string;
};

export type Station = {
    id: string;
    name: string;
    lat?: number;
    lon?: number;
    zone?: string;
    lines: string[];
    links: StationLink[];
};

export type StationLink = {
    stationId: string;
    lines: string[];
};

export type LineDetails = {
    name: string;
    mode: string;
};

export type StationMap = {
    generatedAt: string;
    source: string;
    modes: string[];
    lines: Record<string, LineDetails>;
    stations: Record<string, Station>;
};

export type Network = {
    lines: Line[];
    sequences: RouteSequence[];
};

export type CliOptions = {
    output: string;
    modes: string[];
};
