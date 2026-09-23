export const splitOperatorToken = (token = '') => {
  const [type = '', id = ''] = String(token).split(':');
  return { type, id };
};

export const makeOperatorToken = (type, id) => `${type}:${id}`;

export const findGuest = (session = {}, token) =>
  (session.guests || []).find((guest) => makeOperatorToken('guest', guest.id) === token);

export function getOperatorName(campaign, session, token) {
  if (!token) return '';
  const { type, id } = splitOperatorToken(token);
  if (type === 'player') {
    return campaign.players?.find((player) => player.id === id)?.name || '未知玩家';
  }
  if (type === 'guest') {
    return findGuest(session, token)?.name || '候补操作者';
  }
  return '未知操作者';
}

export function getCharacterMap(campaign) {
  return new Map((campaign.characters || []).map((character) => [character.id, character]));
}

export function getPlayerAttendance(session, playerId) {
  return session?.attendance?.[playerId] || 'absent';
}

export function isPlayerPresent(session, playerId) {
  return getPlayerAttendance(session, playerId) === 'present';
}

export function getProxyRecord(session, characterId) {
  return session?.proxyRecords?.[characterId] || null;
}

export function getOperatorLoads(session = {}) {
  const loads = new Map();
  Object.entries(session.operators || {}).forEach(([characterId, token]) => {
    if (!token) return;
    loads.set(token, { token, characterIds: [...(loads.get(token)?.characterIds || []), characterId] });
  });
  return loads;
}

export function getCharacterAssignment(campaign, session, characterId) {
  const character = getCharacterMap(campaign).get(characterId);
  const token = session.operators?.[characterId] || '';
  const { type, id } = splitOperatorToken(token);

  if (!token) return { character, token: '', status: 'unassigned', operatorName: '' };
  if (type === 'player') {
    if (id !== character?.playerId) return { character, token, status: 'invalid', operatorName: getOperatorName(campaign, session, token) };
    return isPlayerPresent(session, id)
      ? { character, token, status: 'self', operatorName: getOperatorName(campaign, session, token) }
      : { character, token, status: 'absent', operatorName: getOperatorName(campaign, session, token) };
  }
  if (type === 'guest' && findGuest(session, token)) {
    return { character, token, status: 'proxy', operatorName: getOperatorName(campaign, session, token) };
  }
  return { character, token, status: 'invalid', operatorName: getOperatorName(campaign, session, token) };
}

export function getOperatorPool(campaign, session, targetCharacterId) {
  const loads = getOperatorLoads(session);
  const character = getCharacterMap(campaign).get(targetCharacterId);
  const currentToken = session.operators?.[targetCharacterId] || '';
  const taken = (token) => token !== currentToken && (loads.get(token)?.characterIds.length || 0) > 0;

  const players = (campaign.players || []).map((player) => {
    const token = makeOperatorToken('player', player.id);
    let enabled = true;
    let reason = '';

    if (!isPlayerPresent(session, player.id)) {
      enabled = false;
      reason = '缺席';
    } else if (taken(token)) {
      enabled = false;
      reason = '已操作一名角色';
    } else if (character && player.id !== character.playerId) {
      enabled = false;
      reason = '在场玩家不接管第二名角色';
    }

    return { type: 'player', id: player.id, token, name: player.name, enabled, reason };
  });

  const guests = (session.guests || []).map((guest) => {
    const token = makeOperatorToken('guest', guest.id);
    const usedByOthers = taken(token);
    return {
      type: 'guest',
      id: guest.id,
      token,
      name: guest.name,
      enabled: !usedByOthers,
      reason: usedByOthers ? '已操作一名角色' : ''
    };
  });

  return { players, guests };
}

export function canAssignOperator(campaign, session, targetCharacterId, token) {
  if (session.archived) return { allowed: false, reason: '章节收档后不能改动操作者' };
  if (!token) return { allowed: true };

  const pool = getOperatorPool(campaign, session, targetCharacterId);
  const option = pool.players.concat(pool.guests).find((item) => item.token === token);
  if (!option) return { allowed: false, reason: '操作者不在本场名单中' };
  if (!option.enabled) return { allowed: false, reason: option.reason || '操作者资格无效' };
  return { allowed: true };
}

export function getProxyReview(campaign, session, characterId) {
  const character = getCharacterMap(campaign).get(characterId);
  const assignment = getCharacterAssignment(campaign, session, characterId);
  const record = getProxyRecord(session, characterId);
  const original = campaign.players?.find((player) => player.id === character?.playerId);
  const originalPresent = original ? isPlayerPresent(session, original.id) : false;

  if (!record) {
    return {
      status: 'none',
      needsDecision: false,
      issues: [],
      record: null,
      assignment,
      originalName: original?.name || '原玩家'
    };
  }

  if (record.operatorToken !== assignment.token) {
    return {
      status: 'stale',
      needsDecision: false,
      issues: [{ code: 'STALE_RECORD', characterId, message: '代管操作者已更换，旧临时记录不参与本次确认。' }],
      record,
      assignment,
      originalName: original?.name || '原玩家'
    };
  }

  const issues = [];
  if (assignment.status !== 'proxy') {
    issues.push({ code: 'RECORD_OPERATOR_INVALID', characterId, message: '记录中的操作者当前没有该角色资格。' });
  }
  if (!originalPresent) {
    issues.push({ code: 'ORIGINAL_ABSENT', characterId, message: '原玩家尚未回到本场，暂时不能确认或驳回。' });
  }
  if (record.status === 'pending' && originalPresent) {
    return { status: 'pending', needsDecision: true, issues, record, assignment, originalName: original?.name || '原玩家' };
  }
  if (record.status === 'pending' && !originalPresent) {
    return { status: 'awaiting-player', needsDecision: false, issues, record, assignment, originalName: original?.name || '原玩家' };
  }
  return {
    status: record.status === 'confirmed' ? 'confirmed' : 'rejected',
    needsDecision: false,
    issues,
    record,
    assignment,
    originalName: original?.name || '原玩家'
  };
}

export function canEditProxyNote(session, characterId) {
  if (session.archived) return false;
  const record = getProxyRecord(session, characterId);
  return !record || record.status === 'pending';
}

export function getArchiveChecks(campaign, session = {}) {
  const checks = [];
  const seenOperators = new Set();

  (campaign.characters || []).forEach((character) => {
    const assignment = getCharacterAssignment(campaign, session, character.id);
    const review = getProxyReview(campaign, session, character.id);
    const token = assignment.token;

    if (!token) {
      checks.push({ code: 'UNASSIGNED', characterId: character.id, message: `${character.name} 尚未指定操作者。` });
    } else if (token && seenOperators.has(token)) {
      checks.push({ code: 'DUPLICATE_OPERATOR', characterId: character.id, message: `${assignment.operatorName} 不能在同一场接管第二名角色。` });
    }
    if (token) seenOperators.add(token);

    if (assignment.status === 'absent') {
      checks.push({ code: 'ABSENT_OPERATOR', characterId: character.id, message: `${character.name} 的原玩家缺席，需要指定代管人。` });
    }
    if (assignment.status === 'invalid') {
      checks.push({ code: 'INVALID_OPERATOR', characterId: character.id, message: `${character.name} 的操作者资格无效，请重新选择。` });
    }
    if (review.status === 'pending' || review.status === 'awaiting-player') {
      checks.push({ code: 'PENDING_REVIEW', characterId: character.id, message: `${character.name} 的临时扮演记录等待 ${review.originalName} 确认或驳回。` });
    }
    review.issues.forEach((issue) => {
      if (issue.code === 'RECORD_OPERATOR_INVALID') checks.push(issue);
    });
  });

  return {
    canArchive: session.archived ? false : checks.length === 0,
    checks,
    pendingCount: checks.filter((check) => check.code === 'PENDING_REVIEW').length
  };
}
