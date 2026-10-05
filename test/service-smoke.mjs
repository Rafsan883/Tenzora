import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const sockets = [];
async function account() {
  const name = `smoke_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const response = await fetch('http://localhost:5001/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: name, email: `${name}@gmail.com`, password: 'SmokeTest123!' }) });
  const data = await response.json();
  assert.equal(response.status, 201, JSON.stringify(data));
  return data;
}
function connect(port, token) {
  return new Promise((resolve, reject) => {
    const socket = io(`http://localhost:${port}`, { auth: { token, username: 'forged_admin', displayName: 'Forged Admin', role: 'admin' }, transports: ['websocket'], timeout: 10000 });
    sockets.push(socket);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}
function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const listener = payload => { if (predicate(payload)) { clearTimeout(timer); socket.off(name, listener); resolve(payload); } };
    const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`Timed out waiting for ${name}`)); }, 10000);
    socket.on(name, listener);
  });
}
try {
  const health = await (await fetch('http://localhost:5001/health')).json();
  assert.equal(health.preview, true, 'Service smoke requires the isolated dev:all preview.');
  const [owner, member] = await Promise.all([account(), account()]);
  const comments = await connect(4000, owner.token);
  const comment = await comments.timeout(10000).emitWithAck('post_comment', { animeId: '1', episodeNumber: 1, content: 'Local integration test', username: 'forged_admin', role: 'admin' });
  assert.equal(comment.success, true, JSON.stringify(comment));
  assert.equal(comment.comment.user.username, owner.user.username);
  assert.equal(comment.comment.user.role, 'user');
  const otherComments = await connect(4000, member.token);
  const target = { commentId: comment.comment._id, animeId: '1', episodeNumber: 1 };
  for (const action of ['edit_comment', 'delete_comment']) {
    assert.match((await otherComments.timeout(10000).emitWithAck(action, { ...target, content: 'Impersonated edit', username: owner.user.username })).error, /Unauthorized/);
  }
  assert.equal((await otherComments.timeout(10000).emitWithAck('vote_comment', { ...target, action: 'like', username: owner.user.username })).success, true);
  const list = await (await fetch('http://localhost:4000/api/comments?animeId=1&episodeNumber=1')).json();
  assert.deepEqual(list.find(item => item._id === target.commentId).likedBy, [member.user.username]);
  assert.equal((await otherComments.timeout(10000).emitWithAck('report_comment', { targetId: target.commentId, targetType: 'Comment', reason: 'Contains Spoilers', username: owner.user.username })).success, true);
  assert.match((await otherComments.timeout(10000).emitWithAck('report_comment', { targetId: target.commentId, targetType: 'Comment', reason: 'Contains Spoilers', username: 'different_forgery' })).error, /already reported/);
  assert.ok((await comments.timeout(10000).emitWithAck('post_comment', null)).error);
  comments.emit('post_comment', null);
  comments.emit('post_comment', { animeId: '1', episodeNumber: 1, content: 'Optional acknowledgment' });
  assert.equal((await comments.timeout(10000).emitWithAck('edit_comment', { ...target, content: 'Authenticated edit' })).success, true);
  const chat = await connect(8080, owner.token);
  const received = event(chat, 'new_message', message => message.text === 'Local chat integration test');
  chat.emit('send_message', { text: 'Local chat integration test', username: 'forged_admin', role: 'admin' });
  const message = await received;
  assert.equal(message.username, owner.user.username);
  assert.equal(message.role, 'user');
  const host = await connect(8081, owner.token);
  const guest = await connect(8081, member.token);
  const created = await host.timeout(10000).emitWithAck('create_wt_room', { animeId: '1', animeTitle: 'Cowboy Bebop', episode: 1 });
  assert.equal(created.success, true, JSON.stringify(created));
  assert.equal((await guest.timeout(10000).emitWithAck('join_wt_room', created.roomId)).success, true);
  guest.emit('wt_sync_state', { playing: true, time: 100 });
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal((await host.timeout(10000).emitWithAck('get_room_state')).state.time, 0);
  host.emit('wt_sync_state', { playing: false, time: 25 });
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal((await guest.timeout(10000).emitWithAck('get_room_state')).state.time, 25);
  const second = await host.timeout(10000).emitWithAck('create_wt_room', { animeId: '1', animeTitle: 'Cowboy Bebop', episode: 2 });
  assert.equal(second.success, true);
  const rooms = await (await fetch('http://localhost:8081/api/rooms')).json();
  assert.equal(rooms.find(room => room.roomId === created.roomId).membersCount, 1);
  assert.equal((await fetch('http://localhost:7861/update-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: owner.user.username, displayName: 'Forged' }) })).status, 401);
  const response = await fetch('http://localhost:5001/auth/me', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.token}` }, body: JSON.stringify({ currentPassword: 'SmokeTest123!', password: 'Rotated123!' }) });
  assert.equal(response.status, 200);
  assert.ok((await comments.timeout(10000).emitWithAck('post_comment', { animeId: '1', episodeNumber: 1, content: 'Revoked session' })).error);
  const chatError = event(chat, 'chat_error');
  chat.emit('send_message', { text: 'Revoked session' });
  assert.ok((await chatError).message);
  assert.ok((await host.timeout(10000).emitWithAck('create_wt_room', { animeId: '1', animeTitle: 'Revoked room', episode: 1 })).error);
  console.log('Live service smoke passed: canonical identities, comment ownership/votes/reports/payload handling, host-only synchronization, room switching, protected presence updates, and JWT revocation.');
} finally { for (const socket of sockets) socket.disconnect(); }
