export function softsign(value: number) {
    return value / (1 + Math.abs(value));
}
