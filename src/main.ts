import Game2d from "./renderers/2d/Game2d";
export { default } from "./renderers/2d/Game2d";
const game = new Game2d();
Object.assign(window, {
  game,
  letPlayerDrive: (enabled = true) => {
    game.playerDrive = enabled;
  },
  pistonCup: () => game.pistonCup(),
});
