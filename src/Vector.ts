class Vector {
    x: number
    y: number

    constructor(x: number, y: number) {
        this.x = x
        this.y = y
    }

    heading() {
        return Math.atan2(this.y, this.x)
    }

    add(a: number, b: number) {
        this.x += a
        this.y += b
    }

    mult(a: number) {
        if (a != 0) {
            this.x *= a
            this.y *= a
        }
    }

    mag() {
        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2))
    }

    unit() {
        if (this.mag() != 0) {
            let length = this.mag()
            this.x = this.x / length
            this.y = this.y / length
        }
    }
}

export function newVector(a: number, b: number) {
    const vec = new Vector(a, b)
    vec.x = a
    vec.y = b
    return vec
}
