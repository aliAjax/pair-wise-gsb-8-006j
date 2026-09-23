import React, { useEffect, useState } from 'react';
import {
  addGuest,
  archiveSession,
  assignOperator,
  decideProxy,
  recordArchivedChange,
  setAttendance,
  setChapterNote,
  setProxyNote
} from './campaignStorage.js';
import { canEditProxyNote, getArchiveChecks, getOperatorPool, getProxyReview } from './attendanceEligibility.js';
import './attendanceDesk.css';

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

function AttendanceRoster({ campaign, session, onToggle, onAddGuest, guestName, setGuestName }) {
  const present = campaign.players.filter((player) => session.attendance[player.id] === 'present');
  const absent = campaign.players.filter((player) => session.attendance[player.id] !== 'present');

  return (
    <section className="desk-card roster-card">
      <div className="desk-card-head">
        <div>
          <span>ATTENDANCE</span>
          <h3>本场出席名单</h3>
        </div>
        <b>{present.length}/{campaign.players.length} 在场</b>
      </div>

      <div className="roster-columns">
        <div>
          <h4>在场玩家</h4>
          {present.map((player) => (
            <button
              className="player-chip present"
              disabled={session.archived}
              key={player.id}
              onClick={() => onToggle(player, 'absent')}
              title={session.archived ? '收档后不能改动出席资格' : '点击标记为缺席'}
            >
              <span>{player.name}</span>
              <em>出席</em>
            </button>
          ))}
          {present.length === 0 && <p className="muted">尚未标记在场玩家</p>}
        </div>
        <div>
          <h4>缺席玩家</h4>
          {absent.map((player) => (
            <button
              className="player-chip absent"
              disabled={session.archived}
              key={player.id}
              onClick={() => onToggle(player, 'present')}
              title={session.archived ? '收档后不能改动出席资格' : '玩家回来了，点击恢复出席'}
            >
              <span>{player.name}</span>
              <em>缺席</em>
            </button>
          ))}
          {absent.length === 0 && <p className="muted">全员在场</p>}
        </div>
      </div>

      <div className="guest-box">
        <div>
          <h4>主持 / 候补操作者</h4>
          <p>一名候补一场最多操作一名角色；不能让同一玩家接管第二名角色。</p>
        </div>
        <div className="guest-list">
          {(session.guests || []).map((guest) => <span key={guest.id}>{guest.name}</span>)}
        </div>
        <div className="guest-add">
          <input
            value={guestName}
            disabled={session.archived}
            onChange={(event) => setGuestName(event.target.value)}
            placeholder="输入候补名，例：主持人"
          />
          <button disabled={session.archived} onClick={onAddGuest}>加入</button>
        </div>
      </div>
    </section>
  );
}

function CharacterCustody({ campaign, session, setData, setNotice }) {
  const chooseOperator = (character, token) => {
    if (session.archived) return;
    const review = getProxyReview(campaign, session, character.id);
    if (review.status === 'pending' && token !== session.operators[character.id]) {
      setNotice('临时扮演记录尚未处理：请先由原玩家确认或驳回，不能换人或覆盖。');
      return;
    }

    setData(assignOperator(campaign, session.id, character.id, token));
  };

  return (
    <section className="desk-card custody-card">
      <div className="desk-card-head">
        <div>
          <span>CUSTODY</span>
          <h3>角色代管人</h3>
        </div>
        <b>一名角色 / 一场 / 一位操作者</b>
      </div>

      <div className="custody-list">
        {campaign.characters.map((character) => {
          const pool = getOperatorPool(campaign, session, character.id);
          const review = getProxyReview(campaign, session, character.id);
          const assignment = review.assignment;
          const originalPlayer = campaign.players.find((player) => player.id === character.playerId);
          const noteEditable = canEditProxyNote(session, character.id) && assignment.status === 'proxy';
          const statusText = {
            self: '原玩家亲自操作',
            proxy: '代管中',
            unassigned: '未指定操作者',
            absent: '原玩家缺席，待代管',
            invalid: '操作者资格无效'
          }[assignment.status];

          return (
            <article className="custody-row" key={character.id}>
              <div className="custody-main">
                <div className="mini-avatar" style={{ background: character.color }}>{character.name[0]}</div>
                <div className="character-title">
                  <small>{character.role}</small>
                  <h4>{character.name}</h4>
                  <p>原玩家：{originalPlayer?.name}</p>
                </div>
                <span className={`custody-status ${assignment.status}`}>{statusText}</span>
              </div>

              <label className="operator-select">
                本场操作者
                <select
                  disabled={session.archived}
                  value={assignment.token}
                  onChange={(event) => chooseOperator(character, event.target.value)}
                >
                  <option value="" disabled>请选择操作者</option>
                  <optgroup label="在场玩家">
                    {pool.players.map((option) => (
                      <option
                        disabled={!option.enabled || (review.status === 'pending' && option.token !== assignment.token)}
                        key={option.token}
                        value={option.token}
                      >
                        {option.name}{option.token === `player:${character.playerId}` ? '（原玩家）' : ''}{option.reason ? ` · ${option.reason}` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="主持 / 候补">
                    {pool.guests.map((option) => (
                      <option
                        disabled={!option.enabled || (review.status === 'pending' && option.token !== assignment.token)}
                        key={option.token}
                        value={option.token}
                      >
                        {option.name}{option.reason ? ` · ${option.reason}` : ''}
                      </option>
                    ))}
                    {pool.guests.length === 0 && <option disabled>暂无候补操作者</option>}
                  </optgroup>
                </select>
              </label>

              {review.record ? (
                <div className={`proxy-record ${review.status}`}>
                  <div className="proxy-record-head">
                    <div>
                      <strong>临时扮演记录</strong>
                      <span>记录作者：{review.assignment.operatorName || '当前操作者'}</span>
                    </div>
                    <b>
                      {review.status === 'pending' && `等待 ${review.originalName} 确认`}
                      {review.status === 'awaiting-player' && `等待 ${review.originalName} 回场`}
                      {review.status === 'confirmed' && `${review.originalName} 已确认`}
                      {review.status === 'rejected' && `${review.originalName} 已驳回`}
                      {review.status === 'stale' && '旧记录：操作者已更换'}
                    </b>
                  </div>
                  <textarea
                    rows="3"
                    value={review.record.note}
                    readOnly={!noteEditable}
                    disabled={!noteEditable}
                    placeholder="记录代管期间的行动、承诺和后果。原玩家确认前不能收档。"
                    onChange={(event) => setData(setProxyNote(campaign, session.id, character.id, event.target.value))}
                  />
                  <div className="proxy-record-foot">
                    <span>确认或驳回只处理本条记录，不会覆盖角色资料。</span>
                    {review.needsDecision && (
                      <div>
                        <button
                          className="confirm"
                          onClick={() => setData(decideProxy(campaign, session.id, character.id, 'rejected'))}
                        >驳回</button>
                        <button
                          className="approve"
                          onClick={() => setData(decideProxy(campaign, session.id, character.id, 'confirmed'))}
                        >确认</button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="profile-lock">♙ 角色资料只读；这里只登记本场操作者和临时扮演，不改角色卡。</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RevisionHistory({ session, revisionOpen, setRevisionOpen }) {
  if (!session.revisions?.length) {
    return <p className="muted">收档后尚无修订。</p>;
  }

  return (
    <div className="revision-list">
      {session.revisions.map((revision) => (
        <article key={revision.id} className="revision-row">
          <div>
            <b>{revision.target === 'note' ? '章节笔记' : '章节摘要'}</b>
            <span>{formatDate(revision.changedAt)}</span>
          </div>
          <p>用途说明：{revision.purpose}</p>
          <div className="revision-values">
            <div><small>旧版</small><p>{revision.oldValue || '（空白）'}</p></div>
            <div><small>新版</small><p>{revision.newValue}</p></div>
          </div>
          <button onClick={() => setRevisionOpen(revisionOpen === revision.id ? null : revision.id)}>
            {revisionOpen === revision.id ? '收起旧版快照' : '查看旧版快照'}
          </button>
          {revisionOpen === revision.id && (
            <pre className="old-snapshot">{JSON.stringify(revision.oldSnapshot, null, 2)}</pre>
          )}
        </article>
      ))}
    </div>
  );
}

export default function ChapterDesk({ campaign, session, setData, setNotice }) {
  const [guestName, setGuestName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [target, setTarget] = useState('note');
  const [content, setContent] = useState('');
  const [revisionOpen, setRevisionOpen] = useState(null);
  const archive = getArchiveChecks(campaign, session);

  useEffect(() => {
    setGuestName('');
    setPurpose('');
    setRevisionOpen(null);
  }, [session.id]);

  useEffect(() => {
    setContent(target === 'note' ? session.note : session.summary);
  }, [session.id, target, session.archived]);

  const toggleAttendance = (player, status) => {
    setData(setAttendance(campaign, session.id, player.id, status));
    setNotice(status === 'present' ? `${player.name} 已恢复出席` : `${player.name} 已标记缺席，请安排代管`);
  };

  const addOperator = () => {
    if (!guestName.trim()) return;
    setData(addGuest(campaign, session.id, guestName));
    setGuestName('');
    setNotice('候补操作者已加入本场名单');
  };

  const submitAmendment = () => {
    if (!purpose.trim() || !content.trim()) {
      setNotice('收档后改动必须填写用途说明和新内容。');
      return;
    }
    setData(recordArchivedChange(campaign, session.id, { purpose, target, content }));
    setPurpose('');
    setNotice('已保存改动，并在旧版记录中留下快照。');
  };

  return (
    <div className="attendance-desk">
      <AttendanceRoster
        campaign={campaign}
        session={session}
        guestName={guestName}
        setGuestName={setGuestName}
        onToggle={toggleAttendance}
        onAddGuest={addOperator}
      />
      <CharacterCustody campaign={campaign} session={session} setData={setData} setNotice={setNotice} />

      <section className="desk-card notes-card">
        <div className="desk-card-head">
          <div>
            <span>SESSION NOTES</span>
            <h3>散场笔记归属</h3>
          </div>
          <b>主持人记录</b>
        </div>
        <label>
          本章主持笔记
          <textarea
            rows="4"
            value={session.note}
            readOnly={session.archived}
            disabled={session.archived}
            placeholder="记录剧情、决定和未解线索。代管行动请写在对应角色的临时扮演记录中。"
            onChange={(event) => setData(setChapterNote(campaign, session.id, event.target.value))}
          />
        </label>
        {session.archived && <p className="muted">本章已收档。普通笔记编辑已锁定，需要补记请走下方“收档后改动”。</p>}
      </section>

      <section className={`desk-card archive-card ${session.archived ? 'archived' : ''}`}>
        {!session.archived ? (
          <>
            <div className="archive-head">
              <div>
                <span>ARCHIVE GATE</span>
                <h3>收档检查</h3>
              </div>
              <button
                className="primary"
                disabled={!archive.canArchive}
                onClick={() => {
                  setData(archiveSession(campaign, session.id));
                  setNotice('出席、代管和记录均已确认，章节已收档。');
                }}
              >确认收档</button>
            </div>
            {archive.canArchive ? (
              <p className="gate-ok">所有角色都有唯一操作者，临时扮演记录也已由原玩家确认或驳回。</p>
            ) : (
              <ul className="gate-issues">
                {archive.checks.map((check, index) => <li key={`${check.code}-${check.characterId || index}`}>{check.message}</li>)}
              </ul>
            )}
          </>
        ) : (
          <>
            <div className="archive-head">
              <div>
                <span>ARCHIVED</span>
                <h3>本章已收档</h3>
              </div>
              <b>{formatDate(session.archivedAt)}</b>
            </div>
            <p className="gate-ok">出席、托管和临时扮演记录已锁定。后续改动必须说明用途，并保留旧版。</p>

            <div className="amendment-box">
              <h4>收档后改动</h4>
              <label>
                改动位置
                <select value={target} onChange={(event) => setTarget(event.target.value)}>
                  <option value="note">章节笔记</option>
                  <option value="summary">章节摘要</option>
                </select>
              </label>
              <label>
                用途说明
                <input value={purpose} onChange={(event) => setPurpose(event.target.value)} placeholder="例：补记主持人复盘后确认的线索来源" />
              </label>
              <label>
                新内容
                <textarea rows="4" value={content} onChange={(event) => setContent(event.target.value)} />
              </label>
              <button className="primary full" onClick={submitAmendment}>保存改动并保留旧版</button>
            </div>

            <div className="revision-history">
              <h4>旧版与用途记录</h4>
              <RevisionHistory session={session} revisionOpen={revisionOpen} setRevisionOpen={setRevisionOpen} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
