import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "./mapPicker.css";
import { generateMap, type GeneratedMap } from "../maps/generateMap";
import { createNcMap } from "../maps/ncmap";
import { mapboxErrorMessage } from "../maps/mapboxErrors";
import { INTERLAGOS, mapDimensions } from "../maps/mapGeometry";
import type { BrowserGame } from "./BrowserGame";

const TOKEN_KEY = "smart-race.mapbox-token";

export function openMapPicker(game: BrowserGame, onContinue: () => void) {
  const dialog = document.createElement("dialog");
  dialog.className = "map-picker";
  dialog.innerHTML = `<div class="map-picker-layout">
        <section class="map-picker-controls"><h2>Pick a location on map</h2>
        <label>Mapbox public token<input id="mapbox-token" type="password" autocomplete="off" placeholder="pk.…"></label>
        <p class="map-note">Stored in this browser’s local storage. Use a public token with map access.</p>
        <button id="mapbox-open">Open map</button>
        <div class="map-picker-actions"><button id="mapbox-interlagos">Interlagos</button><button id="mapbox-draw" disabled>Draw rectangle</button></div>
        <p class="map-note">Pan and zoom to a location, then draw a rectangle or enter its bounds.</p>
        <div class="map-picker-bounds">
        <label>Min longitude<input id="mapbox-west" type="number" step="any"></label>
        <label>Max longitude<input id="mapbox-east" type="number" step="any"></label>
        <label>Min latitude<input id="mapbox-south" type="number" step="any"></label>
        <label>Max latitude<input id="mapbox-north" type="number" step="any"></label></div>
        <p id="mapbox-size"></p><p id="mapbox-status" role="status" aria-live="polite"></p>
        <button id="mapbox-generate" disabled>Generate map and heightmap</button><button id="mapbox-cancel">Cancel</button>
        </section><section class="map-picker-stage"><div id="mapbox-map"></div><div id="mapbox-selection" hidden></div><p id="mapbox-placeholder">Provide a Mapbox token to open the map.</p></section></div>`;
  document.body.append(dialog);
  dialog.showModal();
  const element = <T extends HTMLElement>(id: string) =>
    dialog.querySelector<T>(`#mapbox-${id}`)!;
  const token = element<HTMLInputElement>("token"),
    status = element("status"),
    stage = element("map"),
    selection = element("selection");
  const generate = element<HTMLButtonElement>("generate"),
    draw = element<HTMLButtonElement>("draw");
  let map: mapboxgl.Map | undefined,
    bounds = { ...INTERLAGOS },
    loaded = false,
    drawing = false,
    busy = false,
    closed = false;
  let start: [number, number] | undefined,
    controller: AbortController | undefined;
  const urls: string[] = [];
  try {
    token.value = localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  const close = () => {
    if (closed) return;
    closed = true;
    controller?.abort();
    map?.remove();
    urls.forEach((url) => URL.revokeObjectURL(url));
    dialog.close();
    dialog.remove();
  };
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    close();
  });
  element("cancel").onclick = close;
  const fit = () =>
    map?.fitBounds(
      [
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      ],
      { padding: 70, animate: false },
    );
  const paintSelection = () => {
    if (!map || !loaded) return;
    const nw = map.project([bounds.west, bounds.north]),
      se = map.project([bounds.east, bounds.south]);
    selection.hidden = false;
    Object.assign(selection.style, {
      left: `${nw.x}px`,
      top: `${nw.y}px`,
      width: `${se.x - nw.x}px`,
      height: `${se.y - nw.y}px`,
    });
  };
  const updateBounds = (writeInputs = true) => {
    if (writeInputs)
      for (const key of ["west", "east", "south", "north"] as const)
        element<HTMLInputElement>(key).value = String(bounds[key]);
    try {
      const size = mapDimensions(bounds);
      element("size").textContent =
        `Map: ${size.width * 2} × ${size.height * 2} px (@2x). Top to bottom: ${size.heightMeters.toFixed(1)} m.`;
      generate.disabled = !loaded || busy;
      paintSelection();
    } catch (error) {
      element("size").textContent = (error as Error).message;
      generate.disabled = true;
      selection.hidden = true;
    }
  };
  for (const key of ["west", "east", "south", "north"] as const)
    element<HTMLInputElement>(key).onchange = () => {
      if (busy) return;
      bounds = {
        ...bounds,
        [key]: Number(element<HTMLInputElement>(key).value),
      };
      updateBounds(false);
      if (!generate.disabled) fit();
    };
  const setDrawing = (value: boolean) => {
    drawing = value;
    draw.textContent = value ? "Cancel drawing" : "Draw rectangle";
    if (value) map?.dragPan.disable();
    else map?.dragPan.enable();
    stage.style.cursor = value ? "crosshair" : "";
  };
  draw.onclick = () => {
    if (!busy) setDrawing(!drawing);
  };
  element("interlagos").onclick = () => {
    if (!busy) {
      bounds = { ...INTERLAGOS };
      updateBounds();
      fit();
    }
  };
  element("open").onclick = () => {
    if (busy) return;
    const value = token.value.trim();
    if (!value.startsWith("pk.")) {
      status.textContent = "Enter a Mapbox public token beginning with pk.";
      return;
    }
    try {
      localStorage.setItem(TOKEN_KEY, value);
    } catch {
      status.textContent =
        "Token could not be saved; it will be used for this session.";
    }
    map?.remove();
    loaded = false;
    generate.disabled = true;
    draw.disabled = true;
    selection.hidden = true;
    status.textContent = "Loading satellite map…";
    element("placeholder").hidden = true;
    try {
      let tileError: string | undefined;
      map = new mapboxgl.Map({
        container: stage,
        accessToken: value,
        style: "mapbox://styles/mapbox/satellite-v9",
        projection: "mercator",
        renderWorldCopies: false,
        dragRotate: false,
        pitchWithRotate: false,
        boxZoom: false,
        bounds: [
          [bounds.west, bounds.south],
          [bounds.east, bounds.north],
        ],
        fitBoundsOptions: { padding: 70 },
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.on("load", () => {
        loaded = true;
        draw.disabled = false;
        status.textContent =
          tileError ?? "Select a rectangle, then generate both images.";
        updateBounds();
      });
      map.on("move", paintSelection);
      map.on("resize", paintSelection);
      map.on("error", (event) => {
        tileError = mapboxErrorMessage(event.error, "map tiles");
        if (!closed && !busy) status.textContent = tileError;
      });
    } catch {
      status.textContent =
        "Could not open the Mapbox map. Check WebGL support and your token.";
    }
  };
  const location = (event: PointerEvent): [number, number] => {
    const rect = stage.getBoundingClientRect();
    const point = map!.unproject([
      event.clientX - rect.left,
      event.clientY - rect.top,
    ]);
    return [point.lng, point.lat];
  };
  stage.addEventListener(
    "pointerdown",
    (event) => {
      if (!drawing || !map || busy || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      start = location(event);
      stage.setPointerCapture(event.pointerId);
    },
    { capture: true },
  );
  stage.addEventListener(
    "pointermove",
    (event) => {
      if (!start || !map) return;
      event.preventDefault();
      event.stopPropagation();
      const end = location(event);
      bounds = {
        west: Math.min(start[0], end[0]),
        east: Math.max(start[0], end[0]),
        south: Math.min(start[1], end[1]),
        north: Math.max(start[1], end[1]),
      };
      updateBounds();
    },
    { capture: true },
  );
  stage.addEventListener(
    "pointerup",
    (event) => {
      if (!start) return;
      event.preventDefault();
      event.stopPropagation();
      start = undefined;
      if (stage.hasPointerCapture(event.pointerId))
        stage.releasePointerCapture(event.pointerId);
      setDrawing(false);
    },
    { capture: true },
  );
  stage.addEventListener("pointercancel", () => {
    start = undefined;
    setDrawing(false);
  });
  generate.onclick = async () => {
    if (busy || !map || !loaded) return;
    busy = true;
    setDrawing(false);
    controller = new AbortController();
    generate.disabled = true;
    dialog
      .querySelectorAll<
        HTMLInputElement | HTMLButtonElement
      >("input,button:not(#mapbox-cancel)")
      .forEach((input) => (input.disabled = true));
    try {
      const result = await generateMap(
        bounds,
        token.value.trim(),
        controller.signal,
        (message) => {
          if (!closed) status.textContent = message;
        },
      );
      if (!closed) showDownloads(result);
    } catch (error) {
      if (!closed) {
        status.textContent = (error as Error).message;
        busy = false;
        dialog
          .querySelectorAll<
            HTMLInputElement | HTMLButtonElement
          >("input,button")
          .forEach((input) => (input.disabled = false));
        updateBounds(false);
      }
    }
  };
  const showDownloads = (result: GeneratedMap) => {
    map?.remove();
    map = undefined;
    const mapURL = URL.createObjectURL(result.map),
      heightURL = URL.createObjectURL(result.heightmap);
    urls.push(mapURL, heightURL);
    dialog.innerHTML = `<section class="map-picker-downloads"><h2>Your map is ready</h2><p>Save these images to reuse them later.</p>
            <div class="map-picker-previews"><figure><img id="mapbox-map-preview" alt="Selected satellite map"><figcaption>Satellite map</figcaption></figure>
            <figure><img id="mapbox-height-preview" alt="Generated heightmap"><figcaption>16-bit heightmap</figcaption></figure></div>
            <p id="mapbox-result-details"></p><p class="map-note">The PNGs include bounds and scale metadata. The heightmap is saved for later use; it is not applied to the track yet.</p>
            <div class="map-picker-actions"><button id="mapbox-save-package">Save .ncmap</button><button id="mapbox-save-map">Save map</button><button id="mapbox-save-heightmap">Save heightmap</button><button id="mapbox-continue">Continue</button><button id="mapbox-cancel">Cancel</button></div>
            <p id="mapbox-status" role="status"></p></section>`;
    element<HTMLImageElement>("map-preview").src = mapURL;
    element<HTMLImageElement>("height-preview").src = heightURL;
    element("result-details").textContent =
      `${result.width} × ${result.height} px · Top to bottom: ${result.heightMeters.toFixed(1)} m · Elevation: ${result.minElevation.toFixed(1)}–${result.maxElevation.toFixed(1)} m`;
    const download = (url: string, name: string) => {
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
    };
    const distance = Math.round(result.heightMeters);
    element("save-map").onclick = () => download(mapURL, `map ${distance}.png`);
    element("save-heightmap").onclick = () =>
      download(heightURL, `heightmap ${distance}.png`);
    let packageURL: string | undefined;
    element("save-package").onclick = async () => {
      const button = element<HTMLButtonElement>("save-package");
      button.disabled = true;
      try {
        if (!packageURL) {
          const archive = await createNcMap(result);
          if (closed) return;
          packageURL = URL.createObjectURL(archive);
          urls.push(packageURL);
        }
        download(packageURL, `map ${distance}.ncmap`);
      } catch {
        element("status").textContent =
          "Could not create the .ncmap package. You can still save the images separately.";
      } finally {
        button.disabled = false;
      }
    };
    element("cancel").onclick = close;
    element("continue").onclick = async () => {
      const button = element<HTMLButtonElement>("continue");
      button.disabled = true;
      try {
        await game.setReferenceImage(result.map, result.heightMeters);
        onContinue();
        close();
      } catch {
        element("status").textContent =
          "Could not load the reference image. Save the map and try loading it from the main menu.";
        button.disabled = false;
      }
    };
  };
  updateBounds();
}
