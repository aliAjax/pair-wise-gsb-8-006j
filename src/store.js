// 保存模块：本地持久化 + 数据迁移 + 全部写操作的校验
// 所有写操作均为纯函数，返回 { ok, data, message } 或 { ok: false, error }
import { DM, isAbsent, operatorOf, validateProxy, archiveBlockers, canResolve } from './eligibility.js';

const KEY = 'campaign-log';
const today = () => new Date().toISOString().slice(0, 10);

const FIELD_LABELS = { title: '标题', date: '日期', summary: '摘要', tag: '类型' };

export const seed = {
  name: '暮光边境',
  system: 'D&D 5E',
  sessions: [
    {
      id: 1, date: '2024-06-08', title: '第一章：灰港的钟声', tag: '主线', color: '#d8a153',
      summary: '队伍抵达灰港，在失落的钟楼发现了神秘符文。符文经鉴定为古代航标，指向雾林深处。',
      attendance: { 林默: 'present', 安然: 'present', 周岳: 'present' },
      proxies: {},
      proxyNotes: [],
      archived: true, archivedAt: '2024-06-09',
      revisions: [{
        ts: '2024-06-10', actor: '主持人', reason: '补录符文鉴定结果',
        changes: [{
          field: 'summary', label: '摘要',
          from: '队伍抵达灰港，在失落的钟楼发现了神秘符文。',
          to: '队伍抵达灰港，在失落的钟楼发现了神秘符文。符文经鉴定为古代航标，指向雾林深处。',
        }],
      }],
    },
    {
      id: 2, date: '2024-06-15', title: '第二章：雾中来客', tag: '主线', color: '#93b7a6',
      summary: '与流浪法师伊琳结盟，追踪海雾中的脚印。',
      attendance: { 林默: 'present', 安然: 'present', 周岳: 'absent' },
      proxies: { 莫尔: '主持人' },
      proxyNotes: [{
        id: 'n1', character: '莫尔', owner: '周岳', author: '主持人', ts: '2024-06-15', status: 'pending',
        text: '莫尔以术士身份与伊琳交涉，消耗一枚术法点识破海雾幻术，并约定在钟楼废墟会合。',
      }],
      archived: false, archivedAt: null, revisions: [],
    },
    {
      id: 3, date: '2024-06-22', title: '支线：深林采药', tag: '支线', color: '#b9a6d1',
      summary: '帮助村民寻找月光草，获得一枚古老铜币。',
      attendance: {}, proxies: {}, proxyNotes: [],
      archived: false, archivedAt: null, revisions: [],
    },
  ],
  characters: [
    { name: '艾德里安', role: '圣骑士', player: '林默', color: '#d8a153' },
    { name: '瑟琳', role: '游侠', player: '安然', color: '#93b7a6' },
    { name: '莫尔', role: '术士', player: '周岳', color: '#b9a6d1' },
  ],
};

const fresh = () => ({ attendance: {}, proxies: {}, proxyNotes: [], archived: false, archivedAt: null, revisions: [] });

// 兼容旧版存档：补齐出席/代管/记录/收档等字段
export function normalize(d) {
  const base = d && Array.isArray(d.sessions) ? d : JSON.parse(JSON.stringify(seed));
  return {
    ...base,
    characters: base.characters || [],
    sessions: base.sessions.map(s => ({
      ...fresh(), ...s,
      attendance: { ...(s.attendance || {}) },
      proxies: { ...(s.proxies || {}) },
      proxyNotes: (s.proxyNotes || []).map(n => ({ ...n })),
      revisions: (s.revisions || []).map(r => ({
        ...r, changes: (r.changes || []).map(c => ({ ...c })),
      })),
    })),
  };
}

export function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return normalize(null);
  }
}

export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 存储不可用时静默 */ }
}

const err = error => ({ ok: false, error });
const ok = (data, message) => ({ ok: true, data, message });
const patch = (data, sid, fn) => ({ ...data, sessions: data.sessions.map(s => (s.id === sid ? fn(s) : s)) });
const get = (data, sid) => data.sessions.find(s => s.id === sid);

export function addSession(data, session) {
  return ok({ ...data, sessions: [...data.sessions, { ...fresh(), ...session }] }, '新章节已加入时间线');
}

// —— 出席 ——
export function setAttendance(data, sid, player, status) {
  const s = get(data, sid);
  if (!s) return err('章节不存在');
  if (s.archived) return err('章节已收档，出席记录已锁定');
  return ok(patch(data, sid, s => {
    const attendance = { ...s.attendance, [player]: status };
    const proxies = { ...s.proxies };
    if (status !== 'absent') // 重新到场：撤掉其角色的代管安排
      for (const c of data.characters)
        if (c.player === player) delete proxies[c.name];
    return { ...s, attendance, proxies };
  }), status === 'absent' ? `${player} 标记为缺席` : `${player} 已到场`);
}

// —— 代管（一名角色一场一位操作者，同一玩家不接第二个）——
export function setProxy(data, sid, characterName, proxy) {
  const s = get(data, sid);
  if (!s) return err('章节不存在');
  if (s.archived) return err('章节已收档，代管安排已锁定');
  const v = validateProxy(s, data.characters, characterName, proxy || null);
  if (!v.ok) return v;
  return ok(
    patch(data, sid, s => ({ ...s, proxies: { ...s.proxies, [characterName]: proxy || null } })),
    proxy ? `${characterName} 本场由 ${proxy} 代管` : `${characterName} 本场无人代管，暂时搁置`
  );
}

// —— 临时扮演记录：由本场代管人提交，状态为 pending ——
export function addProxyNote(data, sid, actor, characterName, text) {
  const s = get(data, sid);
  if (!s) return err('章节不存在');
  if (s.archived) return err('章节已收档，不能再补临时扮演记录');
  const character = data.characters.find(c => c.name === characterName);
  if (!character) return err('角色不存在');
  if (!isAbsent(s, character.player)) return err('该角色玩家在场，无需代管记录');
  const op = operatorOf(s, character);
  if (op !== actor) return err(`只有本场操作者${op ? `（${op}）` : ''}能为 ${characterName} 留下记录`);
  if (!text || !text.trim()) return err('记录内容不能为空');
  const note = {
    id: 'n' + Date.now(), character: characterName, owner: character.player,
    author: actor, text: text.trim(), ts: today(), status: 'pending',
  };
  return ok(
    patch(data, sid, s => ({ ...s, proxyNotes: [...s.proxyNotes, note] })),
    `记录已提交，待原玩家 ${character.player} 确认`
  );
}

// —— 原玩家回来后：只能确认或驳回，不能覆盖记录/角色资料 ——
export function resolveNote(data, sid, noteId, actor, decision) {
  const s = get(data, sid);
  if (!s) return err('章节不存在');
  const note = s.proxyNotes.find(n => n.id === noteId);
  if (!note) return err('记录不存在');
  if (decision !== 'confirmed' && decision !== 'rejected') return err('只能确认或驳回');
  if (!canResolve(actor, note))
    return err(`只有原玩家 ${note.owner} 能处理这条记录，且记录不可改写`);
  return ok(patch(data, sid, s => ({
    ...s,
    proxyNotes: s.proxyNotes.map(n =>
      n.id === noteId ? { ...n, status: decision, resolvedTs: today() } : n),
  })), decision === 'confirmed'
    ? `记录已确认，计入 ${note.owner} 的章节笔记`
    : '记录已驳回，不并入档案');
}

// —— 收档：有待确认记录时被挡住 ——
export function archive(data, sid, actor) {
  const s = get(data, sid);
  if (!s) return err('章节不存在');
  if (actor !== DM) return err('只有主持人能收档');
  if (s.archived) return err('章节已收档');
  const blockers = archiveBlockers(s);
  if (blockers.length) return err(`无法收档：${blockers[0]}`);
  return ok(
    patch(data, sid, s => ({ ...s, archived: true, archivedAt: today() })),
    '章节已收档，后续改动需注明用途并保留旧版'
  );
}

// —— 章节信息编辑：收档后必须写用途说明，旧版留在 revisions ——
export function editChapter(data, sid, actor, changes, reason) {
  const s = get(data, sid);
  if (!s) return err('章节不存在');
  const diff = Object.keys(FIELD_LABELS)
    .filter(f => changes[f] !== undefined && changes[f] !== s[f])
    .map(f => ({ field: f, label: FIELD_LABELS[f], from: s[f], to: changes[f] }));
  if (!diff.length) return err('没有任何改动');
  if (s.archived) {
    if (!reason || !reason.trim()) return err('已收档章节的改动必须填写用途说明');
    const revision = { ts: today(), actor, reason: reason.trim(), changes: diff };
    return ok(
      patch(data, sid, s => ({ ...s, ...changes, revisions: [...s.revisions, revision] })),
      '改动已记录，旧版保留在改动记录中'
    );
  }
  return ok(patch(data, sid, s => ({ ...s, ...changes })), '章节已更新');
}
