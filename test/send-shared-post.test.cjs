const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../lib/send-shared-post.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function fixture({ userId = 'sender', firebaseId = userId, exists = false, failCommit = false } = {}) {
  const calls = []; const commits = []; let currentUser = userId;
  const firestore = {
    collection: (parent, name) => ({ path: `${parent.path}/${name}` }),
    doc: (parent, name, id) => ({ path: name ? `${parent.path || ''}/${name}/${id}` : `${parent.path}/new-message` }),
    serverTimestamp: () => 'server-time',
    runTransaction: async (_db, work) => work({
      get: async () => ({ exists: () => exists }),
      set: (ref, data) => calls.push({ operation: 'create-conversation', path: ref.path, data }),
    }),
    writeBatch: () => {
      const writes = [];
      return {
        set: (ref, data) => writes.push({ operation: 'message', path: ref.path, data }),
        update: (ref, data) => writes.push({ operation: 'preview', path: ref.path, data }),
        commit: async () => { if (failCommit) throw new Error('permission denied'); commits.push(writes); },
      };
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: (id) => {
    if (id === 'firebase/firestore') return firestore;
    if (id === './chatClient') return { chatDb: () => ({}), directConversationId: (a, b) => [a, b].sort().join('_'), ensureChatAuth: async () => firebaseId };
    if (id === './stores') return { useAuth: { getState: () => ({ user: currentUser ? { id: currentUser } : null }) } };
    throw new Error(`Unexpected dependency: ${id}`);
  } });
  return { send: exports.sendSharedPost, calls, commits, logout: () => { currentUser = null; } };
}

test('opening/importing sharing code does not send anything', () => {
  const f = fixture(); assert.equal(f.calls.length, 0); assert.equal(f.commits.length, 0);
});

test('DM sharing creates the parent then commits the message and inbox preview together', async () => {
  const f = fixture();
  await f.send('friend', 'https://example.com/app/for-you?post=123');
  assert.equal(f.calls.length, 1);
  assert.deepEqual(Array.from(f.calls[0].data.participants), ['friend', 'sender']);
  assert.equal(f.commits.length, 1); assert.equal(f.commits[0].length, 2);
  const [message, preview] = f.commits[0];
  assert.equal(message.data.senderId, 'sender');
  assert.deepEqual(Array.from(message.data.readBy), ['sender']);
  assert.equal(message.data.text, preview.data.lastMessage.text);
  assert.equal(message.data.timestamp, 'server-time');
});

test('sharing to an existing thread does not reset its participants or history', async () => {
  const f = fixture({ exists: true }); await f.send('friend', 'Post link');
  assert.equal(f.calls.length, 0); assert.equal(f.commits.length, 1);
});

test('anonymous users and mismatched Firebase sessions cannot send', async () => {
  for (const options of [{ userId: null }, { firebaseId: 'another-user' }]) {
    const f = fixture(options); await assert.rejects(f.send('friend', 'Post link'));
    assert.equal(f.calls.length, 0); assert.equal(f.commits.length, 0);
  }
});

test('self recipients and invalid text are rejected before writes', async () => {
  const f = fixture();
  await assert.rejects(f.send('sender', 'Post link'));
  await assert.rejects(f.send('friend', ' '));
  await assert.rejects(f.send('friend', 'a'.repeat(4001)));
  assert.equal(f.calls.length, 0); assert.equal(f.commits.length, 0);
});

test('a failed commit rejects so the share modal can keep that recipient selected', async () => {
  const f = fixture({ failCommit: true });
  await assert.rejects(f.send('friend', 'Post link'), /permission denied/);
  assert.equal(f.commits.length, 0);
});
