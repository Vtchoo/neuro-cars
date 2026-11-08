import { style } from "@/utils/css";
import { containerStyle } from "./styles";
import type { BrowserGame } from "./BrowserGame";
import { dom } from "./dom";

export function buildGameMenu(game: BrowserGame) {
  const p = dom;
  const menu = p.createElement("div");
  menu.style(
    style({
      ...containerStyle,
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      gap: ".5rem",
      position: "absolute",
      bottom: "1rem",
      left: "1rem",
      width: "15rem",
    }),
  );

  const ticksLabel = p.createElement("span", `Ticks: ${game.maxTicks}`);
  const updateTicksLabel = () => ticksLabel.html(`Ticks: ${game.maxTicks}`);
  game.events.addEventListener("maxTicksChanged", updateTicksLabel);
  const removeMenu = menu.remove.bind(menu);
  menu.remove = () => {
    game.events.removeEventListener("maxTicksChanged", updateTicksLabel);
    removeMenu();
  };
  ticksLabel.style(
    style({
      fontSize: ".75rem",
      fontWeight: "bold",
    }),
  );

  const ticksRow = p.createElement("div");
  ticksRow.style(
    style({
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }),
  );
  ticksRow.parent(menu);
  const minus5PercentButton = p.createButton("-5%");
  minus5PercentButton.mouseClicked(() => {
    const decrement = Math.floor(game.maxTicks * 0.05);
    game.incrementMaxTicks(-decrement);
  });
  const minus100Button = p.createButton("-100");
  minus100Button.mouseClicked(() => {
    game.incrementMaxTicks(-100);
  });
  const plus5PercentButton = p.createButton("+5%");
  plus5PercentButton.mouseClicked(() => {
    const increment = Math.ceil(game.maxTicks * 0.05);
    game.incrementMaxTicks(increment);
  });
  const plus100Button = p.createButton("+100");
  plus100Button.mouseClicked(() => {
    game.incrementMaxTicks(100);
  });
  minus5PercentButton.parent(ticksRow);
  minus100Button.parent(ticksRow);
  ticksLabel.parent(ticksRow);
  plus100Button.parent(ticksRow);
  plus5PercentButton.parent(ticksRow);

  const increaseMaxTicksButton = p.createButton(
    `Extend time: ${game.increaseMaxTicksIfBestCarIsRunning ? "On" : "Off"}`,
  );
  increaseMaxTicksButton.parent(menu);
  increaseMaxTicksButton.attribute(
    "title",
    "If enabled, the game will automatically increase the max ticks for the next generation if the best car is still running when the max ticks is reached.",
  );
  increaseMaxTicksButton.mouseClicked(() => {
    game.increaseMaxTicksIfBestCarIsRunning =
      !game.increaseMaxTicksIfBestCarIsRunning;
    const isEnabled = game.increaseMaxTicksIfBestCarIsRunning;
    increaseMaxTicksButton.html(`Extend time: ${isEnabled ? "On" : "Off"}`);
  });

  const showFitnessGraphButton = p.createButton(
    `Show Fitness Graph: ${game.drawGraphs ? "On" : "Off"}`,
  );
  showFitnessGraphButton.parent(menu);
  showFitnessGraphButton.mouseClicked(() => {
    game.toggleDrawGraphs();
    const isDrawing = showFitnessGraphButton.html().includes("Off");
    showFitnessGraphButton.html(
      `Show Fitness Graph: ${isDrawing ? "On" : "Off"}`,
    );
  });

  const showInputsButton = p.createButton(`Show Inputs: ${game.showInputs}`);
  showInputsButton.parent(menu);
  showInputsButton.mouseClicked(() => {
    game.toggleShowInputs();
    const currentMode = game.showInputs;
    showInputsButton.html(`Show Inputs: ${currentMode}`);
  });

  const showNeuralNetButton = p.createButton(
    `Show Neural Net: ${game.showNeuralNet ? "On" : "Off"}`,
  );
  showNeuralNetButton.parent(menu);
  showNeuralNetButton.attribute(
    "title",
    "Show a live visualization of the followed car's neural network on the left side of the screen.",
  );
  showNeuralNetButton.mouseClicked(() => {
    const isOn = game.toggleShowNeuralNet();
    showNeuralNetButton.html(`Show Neural Net: ${isOn ? "On" : "Off"}`);
  });

  const displayLabels = {
    grip: "Grip circle",
    minimap: "Minimap",
    none: "None",
  };
  const displayButton = p.createButton(
    `Display: ${displayLabels[game.bottomRightDisplay]}`,
  );
  displayButton.parent(menu);
  displayButton.attribute(
    "title",
    "Cycle the bottom-right display: grip circle, minimap, or none.",
  );
  displayButton.mouseClicked(() => {
    const mode = game.cycleBottomRightDisplay();
    displayButton.html(`Display: ${displayLabels[mode]}`);
  });

  const showSpeciesButton = p.createButton(
    `Show Species: ${game.showClustering ? "On" : "Off"}`,
  );
  showSpeciesButton.parent(menu);
  showSpeciesButton.attribute(
    "title",
    "Color cars by neural network species (re-clustered each generation).",
  );
  showSpeciesButton.mouseClicked(() => {
    const isOn = game.toggleShowClustering();
    showSpeciesButton.html(`Show Species: ${isOn ? "On" : "Off"}`);
  });

  const followButtonsContainer = p.createElement("div");
  followButtonsContainer.style(
    style({
      display: "flex",
      flexDirection: "row",
      gap: ".25rem",
    }),
  );
  followButtonsContainer.parent(menu);

  const followPreviousCarButton = p.createButton("<");
  followPreviousCarButton.style(
    style({
      padding: "0 .5rem",
    }),
  );
  followPreviousCarButton.parent(followButtonsContainer);
  followPreviousCarButton.mouseClicked(() => {
    const car = game.followPreviousCar();
    followBestCarButton.html(`Follow: ${car.driverName}`);
  });

  const followBestCarButton = p.createButton(game.followLabel);
  followBestCarButton.style(
    style({
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      padding: "0 .5rem",
    }),
  );
  followBestCarButton.parent(followButtonsContainer);
  followBestCarButton.mouseClicked(() => {
    game.toggleFollowBestCar();
    followBestCarButton.html(game.followLabel);
  });

  const followNextCarButton = p.createButton(">");
  followNextCarButton.style(
    style({
      padding: "0 .5rem",
    }),
  );
  followNextCarButton.parent(followButtonsContainer);
  followNextCarButton.mouseClicked(() => {
    const car = game.followNextCar();
    followBestCarButton.html(`Follow: ${car.driverName}`);
  });

  return menu;
}
