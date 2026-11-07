/** Renderer-independent drawing port for the shared screen-space HUD. */
export interface DrawingSurface {
  width: number;
  height: number;
  drawingContext: any;
  CENTER: any;
  CORNER: any;
  LEFT: any;
  TOP: any;
  push(): void;
  pop(): void;
  resetMatrix(): void;
  fill(...values: any[]): void;
  stroke(...values: any[]): void;
  noFill(): void;
  noStroke(): void;
  strokeWeight(value: number): void;
  rectMode(mode: any): void;
  ellipseMode(mode: any): void;
  rect(x: number, y: number, w: number, h: number, r?: number): void;
  ellipse(x: number, y: number, w: number, h: number): void;
  circle(x: number, y: number, d: number): void;
  line(x: number, y: number, x2: number, y2: number): void;
  textAlign(horizontal: any, vertical?: any): void;
  textSize(size: number): void;
  textWidth(text: string): number;
  text(text: string | number, x: number, y: number): void;
}

const color = (values: any[]) =>
  typeof values[0] === "string"
    ? values[0]
    : values.length < 3
      ? `rgba(${values[0]},${values[0]},${values[0]},${(values[1] ?? 255) / 255})`
      : `rgba(${values[0]},${values[1]},${values[2]},${(values[3] ?? 255) / 255})`;

/** Native Canvas2D implementation; the Three.js page never imports p5.js. */
export class CanvasSurface implements DrawingSurface {
  readonly CENTER = "center";
  readonly CORNER = "corner";
  readonly LEFT = "left";
  readonly TOP = "top";
  readonly drawingContext: CanvasRenderingContext2D;
  private fillEnabled = true;
  private strokeEnabled = true;
  private stack: [boolean, boolean][] = [];
  constructor(readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas2D is unavailable");
    this.drawingContext = context;
    context.font = "12px sans-serif";
  }
  get width() {
    return this.canvas.width;
  }
  get height() {
    return this.canvas.height;
  }
  push() {
    this.stack.push([this.fillEnabled, this.strokeEnabled]);
    this.drawingContext.save();
  }
  pop() {
    [this.fillEnabled, this.strokeEnabled] = this.stack.pop()!;
    this.drawingContext.restore();
  }
  resetMatrix() {
    this.drawingContext.resetTransform();
  }
  fill(...values: any[]) {
    this.fillEnabled = true;
    this.drawingContext.fillStyle = color(values);
  }
  stroke(...values: any[]) {
    this.strokeEnabled = true;
    this.drawingContext.strokeStyle = color(values);
  }
  noFill() {
    this.fillEnabled = false;
  }
  noStroke() {
    this.strokeEnabled = false;
  }
  strokeWeight(value: number) {
    this.drawingContext.lineWidth = value;
  }
  rectMode(_mode: any) {}
  ellipseMode(_mode: any) {}
  private paint() {
    if (this.fillEnabled) this.drawingContext.fill();
    if (this.strokeEnabled) this.drawingContext.stroke();
  }
  rect(x: number, y: number, w: number, h: number, r = 0) {
    this.drawingContext.beginPath();
    this.drawingContext.roundRect(x, y, w, h, r);
    this.paint();
  }
  ellipse(x: number, y: number, w: number, h: number) {
    this.drawingContext.beginPath();
    this.drawingContext.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    this.paint();
  }
  circle(x: number, y: number, d: number) {
    this.ellipse(x, y, d, d);
  }
  line(x: number, y: number, x2: number, y2: number) {
    if (!this.strokeEnabled) return;
    this.drawingContext.beginPath();
    this.drawingContext.moveTo(x, y);
    this.drawingContext.lineTo(x2, y2);
    this.drawingContext.stroke();
  }
  textAlign(horizontal: any, vertical: any = "alphabetic") {
    this.drawingContext.textAlign = horizontal;
    this.drawingContext.textBaseline =
      vertical === "center" ? "middle" : vertical;
  }
  textSize(size: number) {
    this.drawingContext.font = `${size}px sans-serif`;
  }
  textWidth(text: string) {
    return this.drawingContext.measureText(text).width;
  }
  text(text: string | number, x: number, y: number) {
    if (this.fillEnabled) this.drawingContext.fillText(String(text), x, y);
  }
  clear() {
    this.resetMatrix();
    this.drawingContext.clearRect(0, 0, this.width, this.height);
  }
}
