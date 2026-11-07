import type Game from "../core/Game";

export type BrowserGame = Game & {
  gameMenu: { remove(): void } | null;
  loadGame(onLoad?: () => void): void;
  loadReferenceImage(onLoad?: () => void): void;
};
