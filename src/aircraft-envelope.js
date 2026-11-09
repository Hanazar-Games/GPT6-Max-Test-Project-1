export const bankLoad = flight => flight.onGround ? 1 : 1 / Math.max(.25, Math.abs(Math.cos(flight.roll)));

export function aircraftEnvelope(flight) {
  const performance = flight.performance;
  return { stall: performance.stall * (1 - flight.flaps * .1) * Math.sqrt(bankLoad(flight)), takeoff: performance.takeoff * (1 - flight.flaps * .07), landing: performance.landingSpeed, maxSpeed: performance.maxSpeed };
}
