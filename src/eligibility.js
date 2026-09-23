// 托管资格模块：判定一场一章中"谁能操作哪个角色"
// 规则一：一名角色一场只对应一位操作者
// 规则二：同一玩家（含主持人）不得接管第二个角色

export const DM = '主持人';

export function playersOf(characters) {
  return [...new Set(characters.map(c => c.player))];
}

export function attendanceOf(session, player) {
  return session.attendance?.[player] || 'present';
}

export function isAbsent(session, player) {
  return attendanceOf(session, player) === 'absent';
}

// 角色本场的操作者：玩家在场 = 本人；缺席 = 代管人；未安排 = null（搁置）
export function operatorOf(session, character) {
  if (!isAbsent(session, character.player)) return character.player;
  return session.proxies?.[character.name] ?? null;
}

// 全部角色 → 操作者映射，kind: self（本人）/ proxy（代管）/ none（搁置）
export function operatorsSummary(session, characters) {
  return characters.map(c => {
    const operator = operatorOf(session, c);
    return {
      character: c.name,
      operator,
      kind: !operator ? 'none' : operator === c.player ? 'self' : 'proxy',
    };
  });
}

// 某角色可选的代管人：须在场（主持人除外），且本场未操作其他角色
export function eligibleProxies(session, characters, character) {
  const busy = new Set();
  for (const c of characters) {
    if (c.name === character.name) continue; // 本角色现有代管人可被替换
    const op = operatorOf(session, c);
    if (op) busy.add(op);
  }
  return [DM, ...playersOf(characters)].filter(p =>
    p !== character.player &&              // 不能自己代管自己
    (p === DM || !isAbsent(session, p)) && // 缺席玩家不能代管
    !busy.has(p)                           // 已操作角色者不能再接管第二个
  );
}

export function validateProxy(session, characters, characterName, proxy) {
  const character = characters.find(c => c.name === characterName);
  if (!character) return { ok: false, error: '角色不存在' };
  if (!isAbsent(session, character.player))
    return { ok: false, error: `${character.player} 在场，${characterName} 无需代管` };
  if (proxy === null || proxy === '') return { ok: true }; // 明确搁置
  if (!eligibleProxies(session, characters, character).includes(proxy))
    return { ok: false, error: `${proxy} 不在场或本场已操作其他角色，不能接管第二个角色` };
  return { ok: true };
}

// 收档阻挡：所有未确认的临时扮演记录
export function archiveBlockers(session) {
  return (session.proxyNotes || [])
    .filter(n => n.status === 'pending')
    .map(n => `「${n.character}」的临时扮演记录待原玩家 ${n.owner} 确认`);
}

// 原玩家回来后只能确认或驳回，且只能处理待确认的记录
export function canResolve(actor, note) {
  return note.status === 'pending' && actor === note.owner;
}
