import React, { useState } from 'react';
import {
  DM, isAbsent, operatorOf, eligibleProxies,
  archiveBlockers, operatorsSummary,
} from './eligibility.js';
import * as store from './store.js';

// 界面模块：章节页 = 出席托管台
// 出席与代管（主持人）→ 临时扮演记录（代管人提交、原玩家确认）→ 收档
export default function AttendanceBoard({ session, characters, actor, act }) {
  const [drafts, setDrafts] = useState({});
  const locked = session.archived;
  const isDM = actor === DM;
  const blockers = archiveBlockers(session);
  const summary = operatorsSummary(session, characters);
  const myProxyChars = characters.filter(c =>
    isAbsent(session, c.player) && operatorOf(session, c) === actor);

  const submitNote = name => {
    if (act(store.addProxyNote, session.id, actor, name, drafts[name] || ''))
      setDrafts(d => ({ ...d, [name]: '' }));
  };

  return (
    <div className="board">
      <h4><i>◍</i>出席与代管 · ATTENDANCE</h4>
      {characters.map(c => {
        const absent = isAbsent(session, c.player);
        const proxy = session.proxies?.[c.name] ?? null;
        const eligible = absent ? eligibleProxies(session, characters, c) : [];
        const options = proxy && !eligible.includes(proxy) ? [proxy, ...eligible] : eligible;
        return (
          <div className="att-row" key={c.name}>
            <div className="att-line">
              <span className="att-dot" style={{ background: c.color }}>{c.name[0]}</span>
              <div className="att-who">
                <strong>{c.name}</strong>
                <small>{c.role} · 玩家 {c.player}</small>
              </div>
              {absent && <span className="chip warn">缺席</span>}
              <div className="seg">
                <button className={absent ? '' : 'on'} disabled={locked || !isDM}
                  onClick={() => act(store.setAttendance, session.id, c.player, 'present')}>在场</button>
                <button className={absent ? 'on abs' : ''} disabled={locked || !isDM}
                  onClick={() => act(store.setAttendance, session.id, c.player, 'absent')}>缺席</button>
              </div>
            </div>
            {absent && (
              <div className="proxy-line">
                <span>代管人</span>
                <select value={proxy || ''} disabled={locked || !isDM}
                  onChange={e => act(store.setProxy, session.id, c.name, e.target.value || null)}>
                  <option value="">无人代管（本场搁置）</option>
                  {options.map(p => <option key={p} value={p}>{p}{p === DM ? '（主持人）' : ''}</option>)}
                </select>
                {proxy && <span className="chip ok">操作者 {proxy}</span>}
              </div>
            )}
          </div>
        );
      })}
      <div className="chips">
        {summary.map(o => (
          <span key={o.character}
            className={'chip ' + (o.kind === 'proxy' ? 'warn' : o.kind === 'none' ? '' : 'ok')}>
            {o.character} → {o.operator || '无人操作'}
          </span>
        ))}
      </div>

      <h4><i>✎</i>临时扮演记录 · PROXY NOTES</h4>
      {session.proxyNotes.length === 0 &&
        <div className="locked">本场暂无临时扮演记录。</div>}
      {session.proxyNotes.map(n => (
        <div className={'note-item ' + n.status} key={n.id}>
          <div className="note-meta">
            <span>{n.character}</span>
            <span>代管 {n.author}</span>
            <span>{n.ts}</span>
            {n.status === 'pending' && <span className="chip warn">待 {n.owner} 确认</span>}
            {n.status === 'confirmed' && <span className="chip ok">已确认 · 计入 {n.owner} 的笔记</span>}
            {n.status === 'rejected' && <span className="chip">已驳回 · 不并入档案</span>}
          </div>
          <p>{n.text}</p>
          {n.status === 'pending' && actor === n.owner && (
            <div className="note-actions">
              <button className="mini confirm"
                onClick={() => act(store.resolveNote, session.id, n.id, actor, 'confirmed')}>确认</button>
              <button className="mini reject"
                onClick={() => act(store.resolveNote, session.id, n.id, actor, 'rejected')}>驳回</button>
              <span className="locked">仅可确认或驳回，不能改写角色资料</span>
            </div>
          )}
        </div>
      ))}
      {!locked && myProxyChars.map(c => (
        <div className="add-note" key={c.name}>
          <textarea rows="2" placeholder={`以 ${c.name} 身份留下的本场临时扮演记录…`}
            value={drafts[c.name] || ''}
            onChange={e => setDrafts(d => ({ ...d, [c.name]: e.target.value }))} />
          <button className="primary" onClick={() => submitNote(c.name)}>
            提交记录（待 {c.player} 确认）
          </button>
        </div>
      ))}

      <h4><i>▣</i>收档 · ARCHIVE</h4>
      {locked ? (
        <>
          <div className="chips"><span className="chip ok">已收档 · {session.archivedAt}</span></div>
          {session.revisions.length === 0
            ? <div className="locked">收档后暂无改动。</div>
            : session.revisions.map((r, i) => (
              <div className="rev" key={i}>
                <b>{r.actor}</b> · {r.ts} · 用途：{r.reason}
                {r.changes.map((ch, j) => (
                  <div key={j}>{ch.label}：<span className="old">{ch.from}</span> → {ch.to}</div>
                ))}
              </div>
            ))}
        </>
      ) : (
        <>
          {blockers.map((b, i) => <div className="blocked" key={i}>⚠ {b}，收档被挡住</div>)}
          <div className="archive-bar">
            <button className="primary" disabled={!isDM || blockers.length > 0}
              onClick={() => act(store.archive, session.id, actor)}>收档本章</button>
            <span className="locked">
              {isDM ? '收档后出席与代管锁定，改动需注明用途并保留旧版' : '由主持人收档'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
