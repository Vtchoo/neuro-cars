export type CarModelKey = "supercar" | "formula1" | "uno";

export interface CarPreset {
  modelKey?: CarModelKey;
  wheelbase?: number;
  maxSteeringAngle?: number;
  tireGripCoefficient?: number;
  mass?: number;
  maxAcceleration?: number;
  maxBraking?: number;
  maxReverseSpeed?: number;
  maxPower?: number;
  frontalArea?: number;
  dragCoefficient?: number;
  rollingResistanceCoeff?: number;
  downforceCoefficient?: number;
  stationaryDownforce?: number;
  spriteKey?: string;
}

/**
 * Ferrari 458 Italia
 * 570 hp, 1485 kg, 0-100 in ~3.4s, top speed ~325 km/h
 * No aerodynamic downforce (Enzo Ferrari didn't value it)
 */
export const supercarPreset: CarPreset = {
  modelKey: "supercar",
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
};

/**
 * 2022-era Formula 1 car
 * ~1000 hp hybrid, 798 kg, 0-100 in ~2.6s, top speed ~350 km/h
 * Enormous aerodynamic downforce, carbon brakes, slick tires
 */
export const f1CarPreset: CarPreset = {
  modelKey: "formula1",
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
  rollingResistanceCoeff: 0.01,
  downforceCoefficient: 3.5,
  spriteKey: "formula1",
};

/**
 * Fiat Uno (com escada)
 * ~1500 hp, 820 kg, absurd grip and downforce
 * The ladder adds structural rigidity. And downforce.
 */
export const unoWithLadderPreset: CarPreset = {
  modelKey: "uno",
  wheelbase: 2.46,
  maxSteeringAngle: Math.PI / 5,
  tireGripCoefficient: 2.5, // F1 * 1.25
  mass: 820,
  maxAcceleration: 20.0,
  maxBraking: 50.0,
  maxReverseSpeed: 8.0,
  maxPower: 1125000, // F1 * 1.5
  frontalArea: 1.9,
  dragCoefficient: 0.42,
  rollingResistanceCoeff: 0.018,
  downforceCoefficient: 5.25, // F1 * 1.5
  spriteKey: "uno",
};
