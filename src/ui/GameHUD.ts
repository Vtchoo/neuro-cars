import type Game from "../core/Game";
import type { DrawingSurface } from "./CanvasSurface";
import { drawNeuralNet } from "./neuralNetViz";
import { drawGripBudget } from "./gripViz";
import { drawMinimap } from "./minimap";
import { tooltip } from "../utils/tooltip";

export class GameHUD {
  constructor(
    private game: Game,
    private p: DrawingSurface,
  ) {}
  draw() {
    // Controls help panel
    tooltip(
      this.p,
      [
        "Controls:",
        "S - Save game",
        "L - Load game",
        `Generation: ${this.game.generation}`,
        `Max age: ${this.game.population.reduce((max, car) => Math.max(max, this.game.generation - car.generation), 0)}`,
        `Average age: ${this.game.population.reduce((sum, car) => sum + (this.game.generation - car.generation), 0) / this.game.population.length || 0}`,
      ],
      20,
      30,
    );

    // Neural-net visualization (screen-space)
    if (this.game.showNeuralNet && this.game.phase === "running") {
      const followed = this.game.getFollowedCar();
      const net = followed?.neuralNet;
      if (net) {
        drawNeuralNet(this.p, net, this.game.lastNNTrace);
      }
    }

    // Neural network clustering visualization
    if (this.game.phase === "running") {
      this.drawClusteringVisualization();
    }

    // Lap records panel
    if (this.game.phase === "running" && this.game.lapRecords.length > 0) {
      this.drawLapRecords();
    }

    if (this.game.drawGraphs) {
      if (this.game.history.maxFitness.length > 1) {
        let maxWidth = this.p.width / 1.5;
        let interval = maxWidth / (this.game.history.maxFitness.length - 1);
        let maxHeight = this.p.height / 3;
        for (let i = 0; i < this.game.history.maxFitness.length; i++) {
          this.p.push();
          this.p.stroke("blue");
          this.p.line(
            this.p.width - maxWidth + i * interval,
            this.p.height - maxHeight * this.game.history.maxFitnessNormal[i],
            this.p.width - maxWidth + (i + 1) * interval,
            this.p.height -
              maxHeight * this.game.history.maxFitnessNormal[i + 1],
          );
          this.p.stroke("yellow");
          this.p.line(
            this.p.width - maxWidth + i * interval,
            this.p.height - maxHeight * this.game.history.avgFitnessNormal[i],
            this.p.width - maxWidth + (i + 1) * interval,
            this.p.height -
              maxHeight * this.game.history.avgFitnessNormal[i + 1],
          );
          this.p.pop();
        }
      }
    }
    if (
      this.game.phase === "running" &&
      this.game.bottomRightDisplay !== "none"
    ) {
      const followed = this.game.playerDrive
        ? this.game.player
        : this.game.getFollowedCar();
      if (this.game.bottomRightDisplay === "grip") {
        if (followed) drawGripBudget(this.p, followed);
      } else {
        const racers = this.game.playerDrive
          ? [...this.game.population, this.game.player]
          : this.game.population;
        drawMinimap(
          this.p,
          this.game.track,
          racers,
          followed,
          (car) =>
            (this.game.showClustering && this.game.clusteringResults
              ? this.game.getClusterTint(car)
              : undefined) ?? car.paint,
        );
      }
    }
  }
  drawLapRecords() {
    const top10 = this.game.lapRecords.slice(-10).reverse();
    const panelWidth = 320;
    const rowHeight = 20;
    const headerHeight = 30;
    const padding = 10;
    const panelHeight = headerHeight + top10.length * rowHeight + padding;

    const x = this.p.width - panelWidth - 10;
    const y = 10;

    this.p.push();
    this.p.fill(0, 0, 0, 150);
    this.p.noStroke();
    this.p.rect(x, y, panelWidth, panelHeight, 4);

    this.p.fill(255, 220, 50);
    this.p.textSize(14);
    this.p.textAlign(this.p.LEFT);
    this.p.text("🏁 Best Lap Times", x + padding, y + 20);

    this.p.textSize(12);
    top10.forEach((record, i) => {
      const rowY = y + headerHeight + i * rowHeight + rowHeight / 2 + 4;
      const totalSecs = record.ticks / 60;
      const mins = Math.floor(totalSecs / 60);
      const secs = (totalSecs % 60).toFixed(3).padStart(6, "0");
      const timeStr = mins > 0 ? `${mins}:${secs}` : `${secs}s`;
      const medal =
        i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
      if (i === 0) this.p.fill(255, 220, 50);
      else this.p.fill(200);
      this.p.text(
        `${medal} ${timeStr}  ${record.driverName}  gen${record.generation}`,
        x + padding,
        rowY,
      );
    });
    this.p.pop();
  }
  drawClusteringVisualization() {
    if (!this.game.clusteringResults || !this.game.showClustering) return;

    const colors = this.game.clusterColors;

    // Draw cluster information panel
    this.p.push();
    this.p.fill(0, 0, 0, 150);
    this.p.noStroke();
    this.p.rect(10, 10, 300, 150);

    this.p.fill(255);
    this.p.textSize(16);
    this.p.text("Neural Network Clusters", 20, 30);

    this.p.textSize(12);
    let yOffset = 50;

    this.game.clusteringResults.forEach((cluster, index) => {
      const color = colors[index % colors.length];
      this.p.fill(color[0], color[1], color[2]);
      this.p.text(`Species ${index + 1}: ${cluster.size} cars`, 20, yOffset);
      this.p.fill(200);
      this.p.text(
        `Spread: ${cluster.avgIntraSimlarity.toFixed(3)}`,
        160,
        yOffset,
      );
      yOffset += 20;
    });

    this.p.pop();
  }
}
