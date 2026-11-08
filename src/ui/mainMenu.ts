import { style } from "@/utils/css";
import { containerStyle } from "./styles";
import type { BrowserGame } from "./BrowserGame";
import { dom } from "./dom";
import { loadMapPackage } from "./files";

export function buildMainMenu(game: BrowserGame) {
  const p = dom;
  const menu = p.createElement("div");
  menu.style(
    style({
      ...containerStyle,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: ".5rem",
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    }),
  );

  const title = p.createElement("h1", "NeuroCars");
  title.parent(menu);

  const startButton = p.createButton("Start");
  startButton.style(
    style({
      width: "100%",
      padding: "0.5rem",
      fontSize: "1.25rem",
    }),
  );
  startButton.parent(menu);
  startButton.mouseClicked(() => {
    menu.remove();
    game.setPhase("setStart");
  });

  const loadTrackButton = p.createButton("Load game");
  loadTrackButton.style(
    style({
      width: "100%",
      padding: "0.5rem",
      fontSize: "1.25rem",
    }),
  );
  loadTrackButton.parent(menu);
  loadTrackButton.mouseClicked(() => {
    game.loadGame(() => {
      menu.remove();
    });
  });

  const loadReferenceImageButton = p.createButton("Load reference image");
  loadReferenceImageButton.style(
    style({
      width: "100%",
      padding: "0.5rem",
      fontSize: "1.25rem",
    }),
  );
  loadReferenceImageButton.parent(menu);
  loadReferenceImageButton.mouseClicked(() => {
    game.loadReferenceImage(() => {
      menu.remove();
    });
  });

  const pickLocationButton = p.createButton("Pick a location on map");
  pickLocationButton.style(
    style({ width: "100%", padding: "0.5rem", fontSize: "1.25rem" }),
  );
  pickLocationButton.parent(menu);
  pickLocationButton.mouseClicked(async () => {
    const { openMapPicker } = await import("./mapPicker");
    openMapPicker(game, () => menu.remove());
  });

  const loadMapButton = p.createButton("Load map (.ncmap)");
  loadMapButton.style(
    style({ width: "100%", padding: "0.5rem", fontSize: "1.25rem" }),
  );
  loadMapButton.parent(menu);
  loadMapButton.mouseClicked(() => loadMapPackage(game, () => menu.remove()));
}
