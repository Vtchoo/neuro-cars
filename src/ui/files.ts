import type { BrowserGame } from "./BrowserGame";
import { buildGameMenu } from "./gameMenu";

export function loadGameFile(game: BrowserGame, onLoad?: () => void) {
  chooseFile(".json", async (file) => {
    try {
      game.restoreGameState(JSON.parse(await file.text()));
      game.gameMenu?.remove();
      game.gameMenu = buildGameMenu(game);
      onLoad?.();
    } catch (error) {
      console.error(error);
      alert("Error loading save file. Please check the file format.");
    }
  });
}

export function downloadState(data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `smartrace-save-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function loadMapPackage(game: BrowserGame, onLoad?: () => void) {
  chooseFile(".ncmap", async (file) => {
    try {
      const { readNcMap } = await import("../maps/ncmap");
      const result = await readNcMap(file);
      await game.setReferenceImage(result.map, result.data.map.heightMeters);
      onLoad?.();
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not load the .ncmap package.",
      );
    }
  });
}

export function chooseFile(accept: string, onFile: (file: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.addEventListener(
    "change",
    () => {
      const file = input.files?.[0];
      if (file) onFile(file);
    },
    { once: true },
  );
  input.click();
}
