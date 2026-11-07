/** A simulation-owned stream prevents renderer UUIDs and particles from changing breeding. */
export class Random {
  constructor(public state: number) {}
  next = () => {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 4294967296;
  };
}
