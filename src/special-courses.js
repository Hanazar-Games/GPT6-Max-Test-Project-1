export function makeSpecialCourse(mission) {
  const hazard = mission.special === 'hazard';
  const boost = mission.special === 'boost';
  const gates = Array.from({ length: 6 }, (_, id) => ({ id, distance: mission.length * (id + 0.9) / 6, lane: 0, width: hazard ? 9 : 14 }));
  const course = { gates, pickups: [], obstacles: [], pads: [], meteors: [], gravityZones: [] };
  if (hazard) {
    for (let row = 0, distance = 500; distance < mission.length - 300; row++, distance += 200) {
      const lane = [-9, 0, 9, 0][Math.floor(row / 2) % 4];
      if (gates.some(gate => Math.abs(gate.distance - distance) < 260)) continue;
      for (const blocked of [-9, 0, 9].filter(value => value !== lane)) {
        course.obstacles.push({ id: course.obstacles.length, distance, lane: blocked, radius: 2.8, kind: 'rock' });
      }
      course.pickups.push({ id: course.pickups.length, distance: distance - 65, lane });
      if (row % 9 === 0) {
        course.meteors.push({ id: course.meteors.length, distance, lane: lane === -9 ? 6 : -6, radius: 4.5, first: distance / 175, period: 7.5 });
      }
    }
  } else {
    for (let distance = 100; distance < mission.length - 100; distance += 360) {
      course.pickups.push({ id: course.pickups.length, distance, lane: 0 });
    }
    for (let distance = boost ? 20 : 600; distance < mission.length - 20; distance += boost ? 240 : 2400) {
      course.pads.push({ id: course.pads.length, distance, lane: 0, width: boost ? 32 : 8 });
    }
  }
  return course;
}
