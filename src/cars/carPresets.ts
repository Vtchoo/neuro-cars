export interface CarPreset {
    wheelbase?: number
    maxSteeringAngle?: number
    tireGripCoefficient?: number
    mass?: number
    maxAcceleration?: number
    maxBraking?: number
    maxReverseSpeed?: number
    maxPower?: number
    frontalArea?: number
    dragCoefficient?: number
    rollingResistanceCoeff?: number
    downforceCoefficient?: number
    stationaryDownforce?: number
    spriteKey?: string
}

/**
 * Ferrari 458 Italia
 * 570 hp, 1485 kg, 0-100 in ~3.4s, top speed ~325 km/h
 * No aerodynamic downforce (Enzo Ferrari didn't value it)
 */
export const supercarPreset: CarPreset = {
    wheelbase: 3.0,
    tireGripCoefficient: 1.2,
    mass: 1485,
    maxAcceleration: 8.0,
    maxBraking: 10.0,
    maxReverseSpeed: 15.0, // m/s (~54 km/h)
    maxPower: 425000,
    frontalArea: 2.3,
    dragCoefficient: 0.35,
    rollingResistanceCoeff: 0.011,
    downforceCoefficient: 0,
    spriteKey: "car",
}

/**
 * 2022-era Formula 1 car
 * ~1000 hp hybrid, 798 kg, 0-100 in ~2.6s, top speed ~350 km/h
 * Enormous aerodynamic downforce, carbon brakes, slick tires
 */
export const f1CarPreset: CarPreset = {
    wheelbase: 3.6,
    maxSteeringAngle: Math.PI / 8,
    tireGripCoefficient: 2.0,
    mass: 798,
    maxAcceleration: 15.0,
    maxBraking: 50.0,
    maxReverseSpeed: 5.0, // m/s (~18 km/h) - F1 cars barely reverse
    maxPower: 750000,
    frontalArea: 1.5,
    dragCoefficient: 1.0,
    rollingResistanceCoeff: 0.010,
    downforceCoefficient: 3.5,
    spriteKey: "formula1",
}
