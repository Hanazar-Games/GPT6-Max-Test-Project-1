const STATUS = {
  brake: { kind: 'brake', text: '制动中 · 松开后恢复驾驶' },
  pad: { kind: 'pad', text: '加速带驱动 · 免费超频中' },
  boost: { kind: 'boost', text: '能量冲刺中' },
  locked: { kind: 'locked', text: '松开冲刺键，再按启动' },
  cruise: { kind: 'cruise', text: '巡航油门 · 仍需手动转向' },
  gravity: { kind: 'gravity', text: '低重力区 · 跃升滞空更久' },
  idle: { kind: 'idle', text: '按住加速或开启巡航' },
  moving: { kind: 'moving', text: '悬浮引擎运行正常' },
};

export function getDriveStatus(game, { brake = false, cruise = false, lowGravity = false } = {}) {
  const kind = brake ? 'brake' : game.padBoost > 0 ? 'pad' : game.boosting ? 'boost' : game.boostLocked ? 'locked' : cruise ? 'cruise' : lowGravity ? 'gravity' : game.speed < 3 ? 'idle' : 'moving';
  return STATUS[kind];
}
