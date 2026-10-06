import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildMap } from "./map.ts";
import { DEFAULT_MODES, fetchNetwork } from "./tfl.ts";
import type { CliOptions } from "./types.d.ts";

function usage(): never {
    console.log("Usage: bun run build [--output data/stations.json] [--modes tube,dlr,overground,elizabeth-line,tram]");
    process.exit(0);
}

function parseOptions(args: string[]): CliOptions {
    let output = "data/stations.json";
    let modes = DEFAULT_MODES;

    for (let i = 0; i < args.length; i++) {
        const argument = args[i];

        if (argument === "--help" || argument === "-h") {
            usage();
        }

        if (argument === "--output" || argument === "--modes") {
            const value = args[++i];

            if (!value || value.startsWith("--")) {
                throw new Error(`Missing value for ${argument}`);
            }

            if (argument === "--output") {
                output = value;
            } else {
                modes = value
                    .split(",")
                    .map((mode) => mode.trim())
                    .filter(Boolean);
            }
        } else {
            throw new Error(`Unknown option: ${argument}`);
        }
    }

    if (!modes.length) {
        throw new Error("At least one mode is required");
    }

    return { output: resolve(output), modes };
}

// Bun supports top-level await, so the script runs directly here.
try {
    const { output, modes } = parseOptions(Bun.argv.slice(2));
    const { lines, sequences } = await fetchNetwork(modes);
    const map = buildMap(lines, sequences, modes);

    // Fetch and build successfully before writing the output file.
    await mkdir(dirname(output), { recursive: true });
    await Bun.write(output, JSON.stringify(map, null, 4) + "\n");

    console.log(`Wrote ${Object.keys(map.stations).length} stations and ${Object.keys(map.lines).length} lines to ${output}`);
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
