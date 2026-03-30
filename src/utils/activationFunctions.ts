export function identity(value: number) {
    return value;
}

export function binary(value: number) {
    return value > 0 ? 1 : 0;
}

export function relu(value: number) {
    return value < 0 ? 0 : value;
}

export function tanh(value: number) {
    return Math.tanh(value);
}

export function sigmoid(value: number) {
    return 1 / (1 + Math.exp(-value));
}

export function softsign(value: number) {
    return value / (1 + Math.abs(value));
}

export function signedLog(value: number) {
    if (value === 0) return 0;
    const sign = Math.sign(value);
    return sign * Math.log1p(Math.abs(value));
}
