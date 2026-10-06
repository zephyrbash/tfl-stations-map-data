import type { Line, Network, RouteSequence } from "./types.d.ts";

export const DEFAULT_MODES = ["tube", "dlr", "overground", "elizabeth-line", "tram"];

const BASE_URL = "https://api.tfl.gov.uk";
const MAX_ATTEMPTS = 4;
const CONCURRENCY = 4;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

async function getJson<T>(path: string, allowMissing = false): Promise<T | null> {
    const url = new URL(path, BASE_URL);

    if (Bun.env.TFL_APP_KEY) {
        url.searchParams.set("app_key", Bun.env.TFL_APP_KEY);
    }

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        let response: Response;

        try {
            response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        } catch (error) {
            if (attempt === MAX_ATTEMPTS - 1) {
                throw new Error(`Request failed: ${url.pathname}`, { cause: error });
            }

            await Bun.sleep(500 * 2 ** attempt);
            continue;
        }

        if (response.ok) {
            return response.json() as Promise<T>;
        }

        // Some lines only expose a route sequence in one direction.
        if (allowMissing && response.status === 404) {
            return null;
        }

        if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS - 1) {
            throw new Error(`TfL returned HTTP ${response.status} for ${url.pathname}`);
        }

        // Respect TfL's rate limit delay, otherwise use exponential backoff.
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 500 * 2 ** attempt;

        await Bun.sleep(delay);
    }

    throw new Error(`Request failed: ${url.pathname}`);
}

/** Discover lines dynamically so renamed or newly added lines are included. */
export async function fetchNetwork(modes: string[]): Promise<Network> {
    const lines = await getJson<Line[]>(`/Line/Mode/${modes.map(encodeURIComponent).join(",")}/Route`);

    if (!Array.isArray(lines) || lines.length === 0) {
        throw new Error("TfL returned no lines");
    }

    if (lines.some((line) => !line.id)) {
        throw new Error("TfL returned a line without an ID");
    }

    console.log(`Found ${lines.length} lines; fetching route sequences...`);

    // Fetch both directions because their branches and stop lists can differ.
    const requests = lines.flatMap((line) =>
        ["outbound", "inbound"].map((direction) => ({ line, direction }))
    );
    const sequences: RouteSequence[] = [];

    for (let i = 0; i < requests.length; i += CONCURRENCY) {
        const batch = requests.slice(i, i + CONCURRENCY);

        const responses = await Promise.all(
            batch.map(({ line, direction }) =>
                getJson<RouteSequence>(
                    `/Line/${encodeURIComponent(line.id)}/Route/Sequence/${direction}`,
                    true
                )
            )
        );

        sequences.push(...responses.filter((response): response is RouteSequence => response !== null));
    }

    // A missing direction is acceptable; a missing line would leave the map incomplete.
    const fetchedLines = new Set(sequences.map((sequence) => sequence.lineId));

    for (const line of lines) {
        if (!fetchedLines.has(line.id)) {
            throw new Error(`No route sequences returned for ${line.id}`);
        }
    }

    return { lines, sequences };
}
