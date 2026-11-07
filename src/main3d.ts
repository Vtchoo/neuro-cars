import Game3d from "./renderers/3d/Game3d";

try {
  const game = new Game3d();
  Object.assign(window, {
    game,
    letPlayerDrive: (enabled = true) => {
      game.playerDrive = enabled;
    },
    pistonCup: () => game.pistonCup(),
  });
} catch (error) {
  console.error(error);
  const message = document.createElement("p");
  message.textContent =
    "The 3D renderer could not start. Please enable WebGL 2 in your browser.";
  const link = document.createElement("a");
  link.href = "../";
  link.textContent = "Open the 2D game";
  document.body.append(message, link);
}
