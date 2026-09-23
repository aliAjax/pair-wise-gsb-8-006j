import { seed } from './seed.js';
import { canAssignOperator, getArchiveChecks, makeOperatorToken, splitOperatorToken } from './attendanceEligibility.js';

const STORAGE_KEY = 'campaign-attendance-desk';
const LEGACY_KEY = 'campaign-log';

const clone = (value) => JSON.parse(JSON.stringify(value));

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

function normalizeSession(session, characters) {
  const attendance = {};
  const operators = {};
  const proxyRecords = {};

  characters.forEach((character) => {
    attendance[character.playerId] = session.attendance?.[character.playerId] || 'absent';
    operators[character.id] = session.operators?.[character.id] || (attendance[character.playerId] === 'present' ? makeOperatorToken('player', character.playerId) : '');
    if (session.proxyRecords?.[character.id]) {
      proxyRecords[character.id] = clone(session.proxyRecords[character.id]);
    }
  });

  return {
    id: session.id,
    date: session.date,
    title: session.title,
    summary: session.summary || '',
    tag: session.tag || '主线',
    color: session.color || '#d8a153',
    attendance,
    guests: session.guests || [],
    operators,
    proxyRecords,
    note: session.note || '',
    archived: Boolean(session.archived),
    archivedAt: session.archivedAt || null,
    amendments: session.amendments || [],
    revisions: session.revisions || []
  };
}

function hydrate(raw) {
  const players = raw.players || [...new Set((raw.characters || []).map((character) => character.player).filter(Boolean))].map((name, index) => ({
    id: `legacy-player-${index}`,
    name
  }));
  const playerByName = new Map(players.map((player, index) => [raw.characters?.[index]?.player || player.name, player.id]));
  const characters = (raw.characters || []).map((character, index) => ({
    id: character.id || `legacy-character-${index}`,
    name: character.name,
    role: character.role || '冒险者',
    playerId: character.playerId || playerByName.get(character.player) || players[0]?.id,
    color: character.color || '#d8a153'
  }));

  const sessions = (raw.sessions || []).map((session, index) => {
    const normalized = normalizeSession({ ...session, attendance: {}, operators: {}, proxyRecords: {} }, characters);
    return {
      ...normalized,
      id: session.id || index + 1
    };
  });

  return {
    name: raw.name || seed.name,
    system: raw.system || seed.system,
    players,
    characters,
    sessions
  };
}

export function loadCampaign() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const campaign = hydrate(parsed);
      campaign.sessions = campaign.sessions.map((session) => normalizeSession(session, campaign.characters));
      return campaign;
    }

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = hydrate(JSON.parse(legacy));
      return migrated;
    }
  } catch {
    // 损坏的本地缓存不应阻断出席台打开。
  }
  return clone(seed);
}

export function saveCampaign(campaign) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(campaign));
  return campaign;
}

function mapSession(campaign, sessionId, mapper) {
  const sessions = campaign.sessions.map((session) =>
    session.id === sessionId ? normalizeSession(mapper(clone(session)), campaign.characters) : session
  );
  return saveCampaign({ ...campaign, sessions });
}

export function createSession(campaign, form) {
  const session = normalizeSession({
    ...form,
    id: Date.now(),
    color: form.tag === '支线' ? '#b9a6d1' : form.tag === '番外' ? '#93b7a6' : '#d8a153',
    attendance: Object.fromEntries(campaign.players.map((player) => [player.id, 'absent'])),
    guests: [{ id: 'g-gm', name: '主持人' }],
    operators: {},
    proxyRecords: {},
    note: '',
    archived: false,
    archivedAt: null,
    amendments: [],
    revisions: []
  }, campaign.characters);

  return saveCampaign({ ...campaign, sessions: [...campaign.sessions, session] });
}

export function addGuest(campaign, sessionId, name) {
  const guestName = name.trim();
  if (!guestName) return campaign;
  return mapSession(campaign, sessionId, (session) => {
    if (session.archived) return session;
    session.guests.push({ id: id('guest'), name: guestName });
    return session;
  });
}

export function setAttendance(campaign, sessionId, playerId, status) {
  return mapSession(campaign, sessionId, (session) => {
    if (session.archived) return session;
    session.attendance[playerId] = status;

    if (status === 'absent') {
      campaign.characters.forEach((character) => {
        if (character.playerId !== playerId) return;
        if (session.operators[character.id] === makeOperatorToken('player', playerId)) {
          session.operators[character.id] = '';
        }
      });
    } else {
      campaign.characters.forEach((character) => {
        if (character.playerId !== playerId || session.operators[character.id]) return;
        session.operators[character.id] = makeOperatorToken('player', playerId);
      });
    }
    return session;
  });
}

export function assignOperator(campaign, sessionId, characterId, token) {
  return mapSession(campaign, sessionId, (session) => {
    if (session.archived) return session;
    const character = campaign.characters.find((item) => item.id === characterId);
    const record = session.proxyRecords[characterId];
    const assignmentCheck = canAssignOperator(campaign, session, characterId, token);
    if (!assignmentCheck.allowed) return session;

    if (record?.status === 'pending' && token !== session.operators[characterId]) {
      return session;
    }

    session.operators[characterId] = token;
    const { type } = splitOperatorToken(token);

    if (type === 'player') {
      return session;
    }

    if (type === 'guest' && (!record || record.operatorToken !== token)) {
      session.proxyRecords[characterId] = {
        operatorToken: token,
        status: 'pending',
        note: '',
        createdAt: now()
      };
    }
    return session;
  });
}

export function setProxyNote(campaign, sessionId, characterId, note) {
  return mapSession(campaign, sessionId, (session) => {
    if (session.archived) return session;
    const token = session.operators[characterId];
    const { type } = splitOperatorToken(token);
    const record = session.proxyRecords[characterId];
    if (type !== 'guest' || (record && record.status !== 'pending')) return session;

    session.proxyRecords[characterId] = {
      operatorToken: token,
      status: 'pending',
      note,
      createdAt: record?.createdAt || now()
    };
    return session;
  });
}

export function decideProxy(campaign, sessionId, characterId, decision) {
  return mapSession(campaign, sessionId, (session) => {
    if (session.archived || !['confirmed', 'rejected'].includes(decision)) return session;
    const character = campaign.characters.find((item) => item.id === characterId);
    const record = session.proxyRecords[characterId];
    if (!record || record.status !== 'pending') return session;
    if (session.attendance[character?.playerId] !== 'present') return session;

    record.status = decision;
    record.decidedAt = now();
    return session;
  });
}

export function setChapterNote(campaign, sessionId, note) {
  return mapSession(campaign, sessionId, (session) => {
    if (session.archived) return session;
    session.note = note;
    return session;
  });
}

export function archiveSession(campaign, sessionId) {
  const session = campaign.sessions.find((item) => item.id === sessionId);
  if (!session || session.archived) return campaign;
  const checks = getArchiveChecks(campaign, session);
  if (!checks.canArchive) return campaign;

  return mapSession(campaign, sessionId, (draft) => {
    draft.archived = true;
    draft.archivedAt = now();
    return draft;
  });
}

export function recordArchivedChange(campaign, sessionId, { purpose, target, content }) {
  const usePurpose = purpose.trim();
  const nextContent = content.trim();
  if (!usePurpose || !nextContent) return campaign;

  const session = campaign.sessions.find((item) => item.id === sessionId);
  if (!session?.archived) return campaign;

  const oldValue = target === 'note' ? session.note : session.summary;
  const revisionId = id('revision');

  return mapSession(campaign, sessionId, (draft) => {
    const previousVersion = clone(draft);
    if (target === 'note') draft.note = nextContent;
    if (target === 'summary') draft.summary = nextContent;

    draft.revisions.unshift({
      id: revisionId,
      purpose: usePurpose,
      target,
      oldValue,
      newValue: nextContent,
      changedAt: now(),
      oldSnapshot: previousVersion
    });
    draft.amendments.unshift({
      id: revisionId,
      purpose: usePurpose,
      target,
      changedAt: now()
    });
    return draft;
  });
}
