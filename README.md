# TfL station map

Fetches TfL rail and tram lines and writes a JSON graph of stations and their directly adjacent stops. The default modes are Tube, DLR, London Overground, Elizabeth line, and Tram.

## Run

Requires [Bun](https://bun.sh/). From this directory:

```sh
bun install
bun run build
```

The result is `data/stations.json`. An API key is optional; set `TFL_APP_KEY` if you have one. You can change the output path and modes:

```sh
bun run build --output data/rail.json --modes tube,dlr,overground,elizabeth-line,tram
```

The command refreshes the JSON from TfL each time it runs. It requests the [line list by mode](https://push-api-nile.tfl.gov.uk/swagger/ui/index.html) and each line's inbound and outbound route sequences. Route stop IDs are joined in order to make bidirectional links. Branches remain separate, and repeated links are combined. The graph shows normal route adjacency; it does not include walking transfers, service disruptions, or timetable details.

## Use as a Git submodule

From the root of your application's Git repository, add this project and commit the submodule reference:

```sh
git submodule add https://github.com/zephyrbash/tfl-stations-map-data.git vendor/tfl-stations-map-data
git add .gitmodules vendor/tfl-stations-map-data
git commit -m "Add TfL station map submodule"
```

Install its dependencies and generate the station map into your application's `data/` directory:

```sh
(
    cd vendor/tfl-stations-map-data
    bun install
    bun run build --output ../../data/tfl-stations.json
)
```

The output path is relative to the submodule directory because the build runs there. The parentheses keep your shell in the application's root after the commands finish. If you use an API key, export `TFL_APP_KEY` before running the build. You can also append `--modes` as shown above.

Your application can import the generated JSON directly:

```ts
import stationMap from "./data/tfl-stations.json";

for (const station of Object.values(stationMap.stations)) {
    console.log(station.name, station.links);
}
```

Adjust the import path relative to your application's source file. Regenerate the JSON whenever you want fresh TfL data; you can commit the generated file in your application or generate it during your build.

For a new clone of your application, include submodules (replace `YOUR_APP_REPO_URL` with your application's repository URL):

```sh
git clone --recurse-submodules YOUR_APP_REPO_URL
```

For an existing clone, initialize submodules from the application's root:

```sh
git submodule update --init --recursive
```

Then run the dependency installation and JSON generation commands above.

The application records a specific commit of this submodule. To update it to the latest upstream version, run these commands from the application's root:

```sh
git submodule update --remote vendor/tfl-stations-map-data
git add vendor/tfl-stations-map-data
git commit -m "Update TfL station map submodule"
```

After updating, reinstall the submodule's dependencies and regenerate the JSON.

## JSON format

`stations` is keyed by TfL NaPTAN stop ID. Each station has its TfL name, optional coordinates and zone, the lines that serve it, and direct `links`. Each link has a neighboring station ID and the lines connecting the pair. `lines` maps line IDs to names and modes.

```json
{
    "lines": {
        "example-line": { "name": "Example line", "mode": "tube" }
    },
    "stations": {
        "A": {
            "id": "A",
            "name": "Alpha",
            "lines": ["example-line"],
            "links": [{ "stationId": "B", "lines": ["example-line"] }]
        }
    }
}
```

The file also has `generatedAt`, `source`, and `modes` at the top level. The example above omits other stations for brevity.

The entry script, `src/index.ts`, uses Bun's top-level await. `src/tfl.ts` handles API requests, and `src/map.ts` turns the route data into the JSON graph. All shared types live in `src/types.d.ts`.

EditorConfig and Prettier settings specify four spaces for indentation. Generated JSON also uses four spaces.

Run `bun run typecheck` to check the TypeScript types.
