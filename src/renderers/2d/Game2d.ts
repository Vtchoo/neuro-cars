import { downloadState, loadGameFile } from "../../ui/files";
import { drawTrackSelection } from "./trackSelection";
import p5 from "p5";
import { GameHUD } from "../../ui/GameHUD";
import {
  createTrackBuilder,
  handleTrackBuilderKeyPress,
  editorPressed,
  editorDragged,
  editorClick,
  editorReleased,
} from "../../editor/trackEditor";
import { newVector, Vector } from "../../Vector";
import Car2d from "./Car2d";
import Game from "../../core/Game";
import Track2d from "./Track2d";
import type { CarPreset } from "../../cars/carPresets";
import { tooltip } from "../../utils/tooltip";
import { buildMainMenu } from "../../ui/mainMenu";
import grassImage from "../../../images/grass.jpg";
import carImage from "../../../images/car.png";
import mcQueenImage from "../../../images/cars/mcqueen.png";
import theKingImage from "../../../images/cars/king.png";
import chickHicksImage from "../../../images/cars/chickhicks2.png";
import sennaImage from "../../../images/cars/senna2.png";
import formula1Image from "../../../images/cars/formula1.png";
import unoImage from "../../../images/cars/uno2.png";

//---------- SMART RACE 2 ----------

// Defines the current state of the simulator (setStart is the first one)
// let this.setPhase("generateTrack")

// Defines the width of the race track
const trackWidth = 120;

export default class Game2d extends Game<Car2d, Track2d> {
  override createCar(
    x: number,
    y: number,
    direction: number,
    generation?: number,
    preset?: CarPreset,
  ) {
    return new Car2d(x, y, direction, generation, preset, this.random);
  }
  override createTrack(data?: any): Track2d {
    return data ? (Track2d.fromData(data) as Track2d) : new Track2d();
  }

  private hud?: GameHUD;
  private p: p5;
  private canvas!: p5.Renderer;

  private _gameMenu: { remove(): void } | null = null;
  get gameMenu() {
    return this._gameMenu;
  }
  set gameMenu(menu: { remove(): void } | null) {
    if (this._gameMenu) {
      this._gameMenu.remove();
    }
    this._gameMenu = menu;
  }

  backgroundImage!: p5.Image;
  referenceImage: p5.Image | null = null;
  referenceImageScale: number = 1;
  referenceImageOpacity: number = 0.5;
  private referenceImageButton: p5.Element | null = null;

  renderTrack!: p5.Graphics;
  renderCars!: p5.Graphics;

  grid!: p5.Graphics;

  trackMap: number[][] = [];
  renderMap!: p5.Graphics;

  carSprite!: p5.Image;
  carTypeSprites: Map<string, p5.Image> = new Map();
  otherSprites: Map<string, p5.Image> = new Map();

  // Track editor presentation state
  private currentPosition!: Vector; //of the last section of the current track
  private currentDirection!: number; //of the next track segment

  constructor() {
    super();
    this.p = new p5((p: p5) => {
      p.preload = () => {
        this.preload();
      };

      p.setup = () => {
        this.setup();
      };

      p.draw = () => {
        this.draw();
      };

      p.mouseClicked = (e) => {
        console.log("Mouse clicked:", e);
        // if CTRL is pressed, we don't want to trigger mouseClicked because the user is probably trying to save or load the game, so we check if CTRL is pressed and if the click is on the canvas before triggering mouseClicked
        if ((e as MouseEvent)?.ctrlKey) {
          return;
        }

        if ((e as MouseEvent)?.target === this.canvas.elt) {
          this.mouseClicked();
        }
      };

      p.mousePressed = (e) => {
        console.log("Mouse pressed:", e);
        if ((e as MouseEvent)?.target === this.canvas.elt) this.mousePressed();
      };

      p.mouseReleased = () => editorReleased();

      p.mouseWheel = (event) => {
        this.mouseWheel(event);
      };

      p.mouseDragged = () => {
        this.mouseDragged();
      };

      p.keyPressed = () => {
        this.keyPressed();
      };

      p.windowResized = () => {
        this.p.resizeCanvas(window.innerWidth, window.innerHeight);
        this.renderTrack.resizeCanvas(this.p.width, this.p.height);
        this.renderCars.resizeCanvas(this.p.width, this.p.height);
        this.grid.resizeCanvas(this.p.width, this.p.height);
        // Update reference image button position
        if (this.referenceImageButton) {
          this.referenceImageButton.position(20, this.p.height);
        }
        // this.renderMap.resizeCanvas(this.p.width, this.p.height)
      };
    });
  }

  // The simulation itself

  preload() {
    this.p.loadImage(carImage, (img) => {
      img.resize(40, 20);
      this.carSprite = img;
      this.carTypeSprites.set("car", img);
    });
    this.p.loadImage(formula1Image, (img) => {
      img.resize(40, 20);
      this.carTypeSprites.set("formula1", img);
    });
    this.p.loadImage(unoImage, (img) => {
      img.resize(40, 20);
      this.carTypeSprites.set("uno", img);
    });
    this.backgroundImage = this.p.loadImage(grassImage);
    //carSprite = loadImage("car.png")
    // carSprite = this.p.loadImage("https://raw.githubusercontent.com/Vtchoo/smartRace2/master/images/car.png")
    this.p.loadImage(mcQueenImage, (img) => {
      img.resize(40, 20);
      this.otherSprites.set("Lightning McQueen", img);
    });
    this.p.loadImage(theKingImage, (img) => {
      img.resize(40, 20);
      this.otherSprites.set("The King", img);
    });
    this.p.loadImage(chickHicksImage, (img) => {
      img.resize(40, 20);
      this.otherSprites.set("Chick Hicks", img);
    });
    this.p.loadImage(sennaImage, (img) => {
      img.resize(40, 20);
      this.otherSprites.set("Ayrton Senna", img);
    });
  }

  setup() {
    // Create canvas
    this.canvas = this.p.createCanvas(window.innerWidth, window.innerHeight);
    this.renderTrack = this.p.createGraphics(this.p.width, this.p.height);
    this.renderCars = this.p.createGraphics(this.p.width, this.p.height);
    this.grid = this.p.createGraphics(this.p.width, this.p.height);

    buildMainMenu(this);
  }

  convertMousePositionToWorldCoordinates(mouseX: number, mouseY: number) {
    const worldX =
      (mouseX - this.p.width / 2) / this.cameraZoom - this.cameraOffsetX;
    const worldY =
      (mouseY - this.p.height / 2) / this.cameraZoom - this.cameraOffsetY;
    return { x: worldX, y: worldY };
  }

  getViewportBounds() {
    const min = this.convertMousePositionToWorldCoordinates(0, 0);
    const max = this.convertMousePositionToWorldCoordinates(
      this.p.width,
      this.p.height,
    );
    return { min, max };
  }

  draw() {
    if (this.playerDrive && this.phase === "running") this.getUserInput();
    this.advance(this.p.deltaTime / 1000);
    this.p.push();
    this.p.translate(this.p.width / 2, this.p.height / 2);
    this.p.scale(this.cameraZoom);
    this.p.translate(this.cameraOffsetX, this.cameraOffsetY);

    // Draw tiled background that covers the visible area
    this.drawTiledBackground();
    if (this.referenceImage) this.drawReferenceImage();

    switch (this.phase) {
      case "setStart": {
        this.p.push();
        // this.p.fill("green")
        // this.p.rect(0, 0, this.p.width, this.p.height)
        this.p.fill("black");
        this.p.noStroke();
        const { x: rectangleCenterX, y: rectangleCenterY } =
          this.convertMousePositionToWorldCoordinates(
            this.p.mouseX,
            this.p.mouseY,
          );
        // const rectangleCenterX = (this.p.mouseX - this.p.width / 2 + this.cameraOffsetX * this.cameraZoom)
        // const rectangleCenterY = (this.p.mouseY - this.p.height / 2 + this.cameraOffsetY * this.cameraZoom)
        this.p.rect(
          rectangleCenterX - trackWidth / 2,
          rectangleCenterY - trackWidth / 2,
          trackWidth,
          trackWidth,
        );
        this.p.pop();
        // this.p.image(this.renderTrack, 0, 0)
        break;
      }
      case "rotateStart": {
        this.p.push();
        // this.p.fill("green")
        // this.p.rect(0, 0, this.p.width, this.p.height)
        this.p.translate(this.start.x, this.start.y);
        const { x: mouseWorldX, y: mouseWorldY } =
          this.convertMousePositionToWorldCoordinates(
            this.p.mouseX,
            this.p.mouseY,
          );
        this.p.rotate(
          Math.atan2(mouseWorldY - this.start.y, mouseWorldX - this.start.x),
        );
        this.p.fill("black");
        this.p.rect(-trackWidth / 2, -trackWidth / 2, trackWidth, trackWidth);
        this.p.stroke("white");
        this.p.line(
          -trackWidth / 2,
          -trackWidth / 2,
          trackWidth / 2,
          -trackWidth / 2,
        );
        this.p.line(
          -trackWidth / 2,
          +trackWidth / 2,
          trackWidth / 2,
          +trackWidth / 2,
        );
        this.p.pop();
        // this.p.image(this.renderTrack, 0, 0)
        break;
      }
      case "buildTrack": {
        this.track.draw(this.p);
        drawTrackSelection(this.p, this.track, this.cameraZoom);
        // this.p.image(this.renderTrack, 0, 0)
        if (this.showGrid == true) {
          this.p.image(this.grid, 0, 0);
        }
        break;
      }
      case "setup": {
        this.track.draw(this.p);
        // for (let i = 0; i < individuals; i++) {
        // 	population[i] = new Car2d(start.x, start.y, direction)
        // }

        break;
      }
      case "running": {
        // Shows the track
        // this.p.image(this.renderTrack, 0, 0)
        this.track.draw(this.p);

        // or the AI detection map
        if (this.showMap == true) {
          this.p.image(this.renderMap, 0, 0);
        }

        const bestCar = this.population.reduce(
          (best, car) =>
            car.neuralNet.fitness > best.neuralNet.fitness ? car : best,
          this.population[0],
        );
        const activeCars = this.population.filter((car) => car.speed > 0.001);
        const bestActiveCar = activeCars.length
          ? activeCars.reduce(
              (best, car) =>
                car.neuralNet.fitness > best.neuralNet.fitness ? car : best,
              activeCars[0],
            )
          : null;

        switch (this.showInputs) {
          case "all":
            this.population.forEach((car) => car.showInputs(this.p));
            break;
          case "best":
            bestCar?.showInputs(this.p);
            break;
          case "bestActive":
            bestActiveCar?.showInputs(this.p);
            break;
        }

        for (const car of this.population) {
          const clusterTint =
            this.showClustering && this.clusteringResults
              ? this.getClusterTint(car)
              : undefined;
          const sprite =
            this.carTypeSprites.get(car.spriteKey) ?? this.carSprite;
          car.show(this.p, sprite, this.otherSprites, clusterTint);
        }

        this.drawExplosions();

        if (this.showHelicopters && this.population.length) {
          for (const heli of this.effects.helicopters)
            this.drawHelicopter(heli.x, heli.y, heli.heading, heli.rotorAngle);
        }

        // Follow best car camera logic
        const followCar = !!this.followCar || this.followBestCar !== "off";
        if (followCar && this.population.length > 0 && !this.playerDrive) {
          const carToFollow =
            this.followCar ??
            (this.followBestCar === "best" || !bestActiveCar
              ? bestCar
              : bestActiveCar);
          // Center camera on the best car
          this.cameraOffsetX = -carToFollow.pos.x;
          this.cameraOffsetY = -carToFollow.pos.y;
        }

        // Allows the player to drive a car
        if (this.playerDrive) {
          this.cameraOffsetX = -this.player.pos.x;
          this.cameraOffsetY = -this.player.pos.y;
          this.player.show(
            this.p,
            this.carTypeSprites.get(this.player.spriteKey) ?? this.carSprite,
            this.otherSprites,
          );
        }

        // if mouse is over some car, show that car's inputs (only if showInputs is not "all" or "best")
        // and also show a tooltip with the car's fitness and generation
        const mouseWorldX =
          (this.p.mouseX - this.p.width / 2) / this.cameraZoom -
          this.cameraOffsetX;
        const mouseWorldY =
          (this.p.mouseY - this.p.height / 2) / this.cameraZoom -
          this.cameraOffsetY;
        for (const car of this.population) {
          if (
            mouseWorldX > car.pos.x - 10 &&
            mouseWorldX < car.pos.x + 10 &&
            mouseWorldY > car.pos.y - 10 &&
            mouseWorldY < car.pos.y + 10
          ) {
            if (this.showInputs === "none") {
              car.showInputs(this.p);
            }
            const realLifeSpeed = car.speed * 3.6;
            tooltip(
              this.p,
              [
                car.driverName || "Unknown Driver",
                `Fitness: ${car.neuralNet.fitness.toFixed(2)}`,
                `Gen: ${car.generation} (age: ${this.generation - car.generation})`,
                `Speed: ${realLifeSpeed.toFixed(2)} km/h`,
              ],
              car.pos.x + 20 / this.cameraZoom,
              car.pos.y + 15 / this.cameraZoom,
              1 / this.cameraZoom,
            );
            break;
          }
        }

        if (
          mouseWorldX > this.player.pos.x - 10 &&
          mouseWorldX < this.player.pos.x + 10 &&
          mouseWorldY > this.player.pos.y - 10 &&
          mouseWorldY < this.player.pos.y + 10
        ) {
          const realLifeSpeed = this.player.speed * 3.6;
          tooltip(
            this.p,
            [`Player Car`, `Speed: ${realLifeSpeed.toFixed(2)} km/h`],
            this.player.pos.x + 20 / this.cameraZoom,
            this.player.pos.y + 15 / this.cameraZoom,
            1 / this.cameraZoom,
          );
        }

        // Draws the graph data

        break;
      }
      case "breeding": {
        // Shows the track
        // this.p.image(this.renderTrack, 0, 0)
        this.track.draw(this.p);

        break;
      }
    }

    this.p.pop();
    (this.hud ??= new GameHUD(this, this.p)).draw();
    this.drawPhaseSpecificUI();
  }

  mouseClicked() {
    if (this.phase === "buildTrack") {
      const pos = this.convertMousePositionToWorldCoordinates(
        this.p.mouseX,
        this.p.mouseY,
      );
      editorClick(this, new Vector(pos.x, pos.y), this.cameraZoom);
      return;
    }

    switch (this.phase) {
      case "resetTrack":
        this.setPhase("setStart");
        break;
      case "setStart":
        // this.start = newVector((this.p.mouseX - this.p.width / 2) / this.cameraZoom, (this.p.mouseY - this.p.height / 2) / this.cameraZoom)
        const { x: worldX, y: worldY } =
          this.convertMousePositionToWorldCoordinates(
            this.p.mouseX,
            this.p.mouseY,
          );
        this.placeStart({ x: worldX, y: worldY });
        break;
      case "rotateStart":
        const { x: worldX2, y: worldY2 } =
          this.convertMousePositionToWorldCoordinates(
            this.p.mouseX,
            this.p.mouseY,
          );
        this.orientStart({ x: worldX2, y: worldY2 });

        this.currentDirection = this.direction;
        this.currentPosition = newVector(
          this.start.x + (trackWidth * Math.cos(this.direction)) / 2,
          this.start.y + (trackWidth * Math.sin(this.direction)) / 2,
        );
        this.p.circle(this.currentPosition.x, this.currentPosition.y, 5);

        createTrackBuilder(
          this.currentPosition,
          this.currentDirection,
          trackWidth,
          this,
          this.track,
        );

        break;
    }
  }

  private drawReferenceImage() {
    if (this.referenceImage) {
      // && (this.phase === "setStart" || this.phase === "rotateStart" || this.phase === "buildTrack")) {
      this.p.push();
      this.p.tint(255, this.referenceImageOpacity * 255);
      // Draw reference image centered at origin with proper scale
      const scaledWidth = this.referenceImage.width * this.referenceImageScale;
      const scaledHeight =
        this.referenceImage.height * this.referenceImageScale;
      this.p.image(
        this.referenceImage,
        -scaledWidth / 2,
        -scaledHeight / 2,
        scaledWidth,
        scaledHeight,
      );
      this.p.pop();
    }
  }

  private drawPhaseSpecificUI() {
    if (this.phase === "menu") {
      // if (!this.referenceImageButton) {
      // 	this.createReferenceImageButton()
      // }
      // // Show reference image button
      // if (this.referenceImageButton) {
      // 	this.referenceImageButton.show()
      // }

      // Show reference image info if loaded
      if (this.referenceImage) {
        this.p.fill(0, 0, 0, 150);
        this.p.noStroke();
        this.p.rect(180, this.p.height - 110, 200, 80);

        this.p.fill(255);
        this.p.textAlign(this.p.LEFT);
        this.p.textSize(12);
        this.p.text("Reference Image Loaded", 190, this.p.height - 90);
        this.p.text(
          `Scale: ${this.referenceImageScale.toFixed(3)}`,
          190,
          this.p.height - 70,
        );
        this.p.text(
          `Opacity: ${Math.round(this.referenceImageOpacity * 100)}%`,
          190,
          this.p.height - 50,
        );
        this.p.text("Use +/- to adjust opacity", 190, this.p.height - 35);
        this.p.text("Press R to remove reference", 190, this.p.height - 20);
      }
    }

    if (this.phase === "setStart") {
      // Hide reference image button in other phases
      if (this.referenceImageButton) {
        this.referenceImageButton.hide();
      }
    }
  }

  public async setReferenceImage(
    blob: Blob,
    heightMeters: number,
  ): Promise<void> {
    if (!Number.isFinite(heightMeters) || heightMeters <= 0)
      throw new Error("Invalid reference height");
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<p5.Image>((resolve, reject) =>
        this.p.loadImage(url, resolve, reject),
      );
      this.referenceImage = img;
      this.track.setHeightmap(null);
      this.referenceImageScale = (heightMeters * 10) / img.height;
      this.cameraZoom =
        0.85 *
        Math.min(
          this.p.width / (img.width * this.referenceImageScale),
          this.p.height / (heightMeters * 10),
        );
      this.cameraOffsetX = this.cameraOffsetY = 0;
      this.setPhase("setStart");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  public loadReferenceImage(onLoadCallback?: () => void) {
    // Create file input
    const input = this.p.createFileInput((file: any) => {
      if (file.type === "image") {
        // Prompt for distance
        const distanceInput = prompt(
          "Enter the distance from top to bottom of the image in meters:",
        );
        if (distanceInput === null) {
          input.remove();
          return;
        }

        const distanceMeters = parseFloat(distanceInput);
        if (isNaN(distanceMeters) || distanceMeters <= 0) {
          alert("Please enter a valid positive number for distance");
          input.remove();
          return;
        }

        // Load the image
        this.p.loadImage(
          file.data,
          (img: p5.Image) => {
            this.referenceImage = img;
            // Calculate scale: 1 meter = 10 pixels
            // distanceMeters * 10 pixels/meter = desired height in pixels
            const desiredHeightPixels = distanceMeters * 10;
            this.referenceImageScale = desiredHeightPixels / img.height;
            console.log(
              `Reference image loaded: ${img.width}x${img.height}, scaled by ${this.referenceImageScale}`,
            );
            if (onLoadCallback) {
              onLoadCallback();
            }
          },
          () => {
            alert("Failed to load image. Please try a different file.");
          },
        );
      } else {
        alert("Please select an image file");
      }
      input.remove();
      this.setPhase("setStart"); // Ensure we are in the correct phase to show the reference image after loading
    });

    // Trigger file input
    input.elt.click();
  }

  private drawTiledBackground() {
    if (!this.backgroundImage) return;

    const imageScaling = 1; // Adjust this if you want to scale the background image

    const imgWidth = this.backgroundImage.width * imageScaling;
    const imgHeight = this.backgroundImage.height * imageScaling;

    // Calculate the visible area in world coordinates (considering camera transform)
    const screenWidth = this.p.width;
    const screenHeight = this.p.height;

    // Calculate world bounds visible on screen (accounting for camera transform)
    const worldLeft = -screenWidth / 2 / this.cameraZoom - this.cameraOffsetX;
    const worldRight = screenWidth / 2 / this.cameraZoom - this.cameraOffsetX;
    const worldTop = -screenHeight / 2 / this.cameraZoom - this.cameraOffsetY;
    const worldBottom = screenHeight / 2 / this.cameraZoom - this.cameraOffsetY;

    // Calculate which tiles we need to draw (with small buffer)
    const startX = Math.floor(worldLeft / imgWidth) - 1;
    const endX = Math.ceil(worldRight / imgWidth) + 1;
    const startY = Math.floor(worldTop / imgHeight) - 1;
    const endY = Math.ceil(worldBottom / imgHeight) + 1;

    // Draw only the visible tiles
    this.p.push();
    this.p.noSmooth();
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        // apply a random rotation to the background image based on the tile coordinates to add some visual variety
        const rotationAngle = ((x * 31 + y * 17) % 4) * (Math.PI / 2); // Rotate in 90 degree increments
        this.p.push();
        this.p.translate(
          x * imgWidth + imgWidth / 2,
          y * imgHeight + imgHeight / 2,
        );
        this.p.rotate(rotationAngle);

        this.p.image(
          this.backgroundImage,
          -imgWidth / 2,
          -imgHeight / 2,
          imgWidth,
          imgHeight,
        );
        this.p.pop();
      }
    }
    this.p.pop();
  }

  private previousMouseX = 0;
  private previousMouseY = 0;
  private cameraOffsetX = 0;
  private cameraOffsetY = 0;
  private cameraZoom = 1;

  mousePressed() {
    this.previousMouseX = this.p.mouseX;
    this.previousMouseY = this.p.mouseY;
    if (this.phase === "buildTrack" && !this.p.keyIsDown(this.p.CONTROL)) {
      const pos = this.convertMousePositionToWorldCoordinates(
        this.p.mouseX,
        this.p.mouseY,
      );
      editorPressed(this.track, new Vector(pos.x, pos.y), this.cameraZoom);
    }
  }

  mouseDragged() {
    console.log("dragging");
    switch (this.phase) {
      case "rotateStart":
      case "setStart":
        // only move in this phase if CTRL is pressed, otherwise the user is probably trying to move the camera, so we check if CTRL is pressed before allowing the user to move the starting point
        if (this.p.keyIsDown(this.p.CONTROL)) {
          this.cameraOffsetX +=
            (this.p.mouseX - this.previousMouseX) / this.cameraZoom;
          this.cameraOffsetY +=
            (this.p.mouseY - this.previousMouseY) / this.cameraZoom;
          this.previousMouseX = this.p.mouseX;
          this.previousMouseY = this.p.mouseY;
        }
        break;
      case "buildTrack":
        if (!this.p.keyIsDown(this.p.CONTROL)) {
          const pos = this.convertMousePositionToWorldCoordinates(
            this.p.mouseX,
            this.p.mouseY,
          );
          editorDragged(this, new Vector(pos.x, pos.y), this.cameraZoom);
          break;
        }
        this.panCamera();
        break;
      case "running":
        this.panCamera();
        break;
    }
  }

  private panCamera() {
    this.cameraOffsetX +=
      (this.p.mouseX - this.previousMouseX) / this.cameraZoom;
    this.cameraOffsetY +=
      (this.p.mouseY - this.previousMouseY) / this.cameraZoom;
    this.previousMouseX = this.p.mouseX;
    this.previousMouseY = this.p.mouseY;
  }

  mouseWheel(event: any) {
    // Zoom in/out
    this.cameraZoom += event.delta * -0.001;
    this.cameraZoom = Math.min(Math.max(this.cameraZoom, 0.1), 5);
  }

  getUserInput() {
    var playerinput = [];

    if (this.p.keyIsDown(87)) {
      playerinput[0] = 1;
    } else if (this.p.keyIsDown(83)) {
      playerinput[0] = -1;
    } else {
      playerinput[0] = 0;
    }

    if (this.p.keyIsDown(65)) {
      playerinput[1] = -1;
    } else if (this.p.keyIsDown(68)) {
      playerinput[1] = 1;
    } else {
      playerinput[1] = 0;
    }

    this.player.lastInputs = playerinput;
  }

  keyPressed() {
    if (
      this.playerDrive &&
      ["w", "a", "s", "d"].includes(this.p.key.toLowerCase())
    )
      return;
    switch (this.p.key) {
      case "s":
      case "S":
        this.saveGame();
        break;
      case "l":
      case "L":
        this.loadGame();
        break;
      case "=":
      case "+":
        // Increase reference image opacity
        if (this.referenceImage) {
          this.referenceImageOpacity = Math.min(
            1,
            this.referenceImageOpacity + 0.1,
          );
          console.log(
            `Reference image opacity: ${Math.round(this.referenceImageOpacity * 100)}%`,
          );
        }
        break;
      case "-":
      case "_":
        // Decrease reference image opacity
        if (this.referenceImage) {
          this.referenceImageOpacity = Math.max(
            0.1,
            this.referenceImageOpacity - 0.1,
          );
          console.log(
            `Reference image opacity: ${Math.round(this.referenceImageOpacity * 100)}%`,
          );
        }
        break;
      case "r":
      case "R":
        // Remove reference image (only in setStart, rotateStart, or buildTrack phase)
        if (
          (this.phase === "setStart" ||
            this.phase === "rotateStart" ||
            this.phase === "buildTrack") &&
          this.referenceImage
        ) {
          // this.referenceImage = null
          // console.log("Reference image removed")
        }
        break;
    }

    // Track builder specific controls
    if (this.phase === "buildTrack") {
      handleTrackBuilderKeyPress(this.p.key, this.track);
    }
  }

  // Save game functionality
  saveGame() {
    downloadState(this.exportState());
  }
  loadGame(onLoadCallback?: () => void) {
    loadGameFile(this, onLoadCallback);
  }

  private drawExplosions() {
    if (!this.showExplosions) return;
    this.p.push();
    this.p.noStroke();
    for (const explosion of this.effects.explosions) {
      const progress = explosion.age / this.effects.duration;
      for (const particle of explosion.particles) {
        const distance = particle.speed * progress * this.effects.maxRadius;
        this.p.fill(
          255,
          progress < 0.3 ? 255 : this.p.lerp(200, 40, progress),
          40,
          (1 - progress) * 255,
        );
        this.p.circle(
          explosion.x + Math.cos(particle.angle) * distance,
          explosion.y + Math.sin(particle.angle) * distance,
          (1 - progress) * 18,
        );
      }
    }
    this.p.pop();
  }

  // Flight paths and independent altitude bands live in the shared Effects state.

  // Top-down helicopter: fuselage/tail point along the direction of travel, main rotor seen from above
  private drawHelicopter(
    x: number,
    y: number,
    heading: number,
    rotorAngle: number,
  ) {
    this.p.push();
    this.p.translate(x, y);

    // Shadow cast on the ground below, kept axis-aligned regardless of heading
    this.p.noStroke();
    this.p.fill(0, 0, 0, 70);
    this.p.ellipse(5, 5, 34, 34);

    this.p.rotate(heading);

    // Tail boom, with a small spinning tail rotor blur at the end
    this.p.fill(40);
    this.p.rect(-28, -2, 20, 4, 2);
    this.p.fill(120, 120, 120, 120);
    this.p.ellipse(-28, 0, 10, 10);

    // Main rotor blur disc, seen from directly above
    this.p.fill(200, 200, 200, 60);
    this.p.ellipse(0, 0, 48, 48);

    // Fuselage, nose toward +x (the heading direction)
    this.p.noStroke();
    this.p.fill(210, 40, 40);
    this.p.ellipse(0, 0, 32, 14);
    this.p.fill(180, 220, 255, 220);
    this.p.ellipse(10, 0, 12, 9);

    // Stub wings/skids, perpendicular to the direction of travel
    this.p.stroke(30);
    this.p.strokeWeight(2);
    this.p.line(-4, -14, -4, 14);

    // Spinning main rotor blades, independent of heading
    this.p.rotate(rotorAngle);
    this.p.line(-24, 0, 24, 0);
    this.p.line(0, -24, 0, 24);

    this.p.pop();
  }
}
