export const VERTICAL_PHYSICS = Object.freeze({ gravity: 17, lowGravity: 8, jumpSpeed: 11 });

export function gravityAt(course, distance) {
  return course.gravityZones.some(zone => distance >= zone.start && distance < zone.end)
    ? VERTICAL_PHYSICS.lowGravity : VERTICAL_PHYSICS.gravity;
}

export function verticalAt(course, pose, endDistance, dt) {
  let height = pose.height, verticalSpeed = pose.verticalSpeed;
  if (height <= 0 && verticalSpeed <= 0) return { height: 0, verticalSpeed: 0, landed: false };
  const travel = endDistance - pose.distance;
  let time = 0;
  while (time < dt) {
    let end = dt;
    if (travel) for (const zone of course.gravityZones) {
      const entry = (zone.start - pose.distance) / travel * dt;
      const exit = (zone.end - pose.distance) / travel * dt;
      if (entry > time && entry < end) end = entry;
      if (exit > time && exit < end) end = exit;
    }
    const gravity = gravityAt(course, pose.distance + travel * ((time + end) / 2 / dt));
    const span = end - time;
    const impactSpeed = Math.sqrt(verticalSpeed ** 2 + 2 * gravity * height);
    const landingTime = verticalSpeed < 0 ? 2 * height / (impactSpeed - verticalSpeed) : (verticalSpeed + impactSpeed) / gravity;
    if (landingTime <= span) return { height: 0, verticalSpeed: 0, landed: true, landingSpeed: impactSpeed, landingTime: time + landingTime };
    height += verticalSpeed * span - gravity * span ** 2 / 2;
    verticalSpeed -= gravity * span;
    time = end;
  }
  return { height, verticalSpeed, landed: false };
}

export function flightHeight(course, before, after, fraction) {
  return verticalAt(course, before, before.distance + (after.distance - before.distance) * fraction,
    (after.elapsed - before.elapsed) * fraction).height;
}

export function landingOffset(game) {
  if (!game.lastLanding) return 0;
  const age = game.elapsed - game.lastLanding.time;
  return age < 0 || age > 1 ? 0 : -Math.min(.22, game.lastLanding.speed * .018) * Math.sin(age * 20) * Math.exp(-10 * age);
}
