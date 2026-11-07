export function random<T>(array: T[], next: () => number = Math.random): T {
  return array[Math.floor(next() * array.length)];
}
