import type { Line, RouteSequence, Station, StationMap, Stop } from "./types.d.ts";

/** Route IDs can refer to a station or a stop within a branch. Index both forms. */
function indexStops(sequences: RouteSequence[]) {
    const stopIndex = new Map<string, Stop>();

    for (const sequence of sequences) {
        const branchStops = (sequence.stopPointSequences ?? []).flatMap((branch) => branch.stopPoint ?? []);

        for (const stop of [...(sequence.stations ?? []), ...branchStops]) {
            if (!stop.id) {
                continue;
            }

            const previous = stopIndex.get(stop.id);

            if (!previous || (stop.name && !previous.name)) {
                stopIndex.set(stop.id, stop);
            }

            if (stop.stationId && !stopIndex.has(stop.stationId)) {
                stopIndex.set(stop.stationId, stop);
            }
        }
    }

    return stopIndex;
}

/** Build an undirected graph of neighboring stations, with lines attached to each link. */
export function buildMap(
    lines: Line[],
    sequences: RouteSequence[],
    modes: string[]
): StationMap {
    const lineIndex: StationMap["lines"] = {};

    for (const line of lines) {
        if (!line.id || !line.name) {
            throw new Error("TfL returned an invalid line");
        }

        lineIndex[line.id] = { name: line.name, mode: line.modeName ?? "unknown" };
    }

    const stopIndex = indexStops(sequences);
    const stations = new Map<string, Station>();

    // Sets deduplicate links reported by multiple routes and travel directions.
    const links = new Map<string, Map<string, Set<string>>>();

    function addStation(id: string, lineId: string) {
        const stop = stopIndex.get(id);
        let station = stations.get(id);

        if (!station) {
            station = { id, name: stop?.name ?? id, lines: [], links: [] };

            if (typeof stop?.lat === "number" && Number.isFinite(stop.lat)) {
                station.lat = stop.lat;
            }

            if (typeof stop?.lon === "number" && Number.isFinite(stop.lon)) {
                station.lon = stop.lon;
            }

            if (stop?.zone) {
                station.zone = stop.zone;
            }

            stations.set(id, station);
        }

        if (!station.lines.includes(lineId)) {
            station.lines.push(lineId);
        }
    }

    function connect(from: string, to: string, lineId: string) {
        if (from === to) {
            return;
        }

        const neighbours = links.get(from) ?? new Map<string, Set<string>>();
        const sharedLines = neighbours.get(to) ?? new Set<string>();

        sharedLines.add(lineId);
        neighbours.set(to, sharedLines);
        links.set(from, neighbours);
    }

    for (const sequence of sequences) {
        if (!lineIndex[sequence.lineId]) {
            throw new Error(`Unexpected line: ${sequence.lineId}`);
        }

        if (!Array.isArray(sequence.orderedLineRoutes)) {
            throw new Error(`Missing routes for ${sequence.lineId} ${sequence.direction}`);
        }

        // Keep listed stations even when TfL doesn't include them in an ordered route.
        for (const stop of sequence.stations ?? []) {
            if (stop.id) {
                addStation(stop.id, sequence.lineId);
            }
        }

        // Join adjacent stops within each complete route to preserve branch topology.
        for (const route of sequence.orderedLineRoutes) {
            if (route.serviceType && route.serviceType !== "Regular") {
                continue;
            }

            const ids = route.naptanIds;

            if (!Array.isArray(ids)) {
                throw new Error(`Invalid route for ${sequence.lineId}`);
            }

            for (const id of ids) {
                addStation(id, sequence.lineId);
            }

            for (let i = 1; i < ids.length; i++) {
                const from = ids[i - 1]!;
                const to = ids[i]!;

                connect(from, to, sequence.lineId);
                connect(to, from, sequence.lineId);
            }
        }
    }

    // Convert Maps/Sets to JSON objects/arrays and sort them for readable file diffs.
    const sortedStations: Record<string, Station> = {};

    for (const id of [...stations.keys()].sort()) {
        const station = stations.get(id)!;

        station.lines.sort();
        station.links = [...(links.get(id)?.entries() ?? [])]
            .map(([stationId, sharedLines]) => ({ stationId, lines: [...sharedLines].sort() }))
            .sort((a, b) => a.stationId.localeCompare(b.stationId));

        sortedStations[id] = station;
    }

    return {
        generatedAt: new Date().toISOString(),
        source: "https://api.tfl.gov.uk",
        modes,
        lines: Object.fromEntries(Object.entries(lineIndex).sort(([a], [b]) => a.localeCompare(b))),
        stations: sortedStations,
    };
}
