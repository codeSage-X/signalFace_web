import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarSource, googleAvatarUrl } from '../lib/avatar-source.ts';

test('Google profile photos are served through the same-origin cache', () => {
  for (const url of ['https://lh3.googleusercontent.com/a/photo=s96-c', 'https://lh6.googleusercontent.com/a-/photo_123=s192-c']) {
    assert.equal(googleAvatarUrl(url), url);
    assert.equal(avatarSource(url), `/api/avatar/google?url=${encodeURIComponent(url)}`);
  }
});

test('uploaded and local avatars retain their original source', () => {
  for (const url of ['https://res.cloudinary.com/example/image/upload/v1/avatar.jpg', '/avatars/me.png']) {
    assert.equal(avatarSource(url), url);
    assert.equal(googleAvatarUrl(url), null);
  }
  assert.equal(avatarSource(null), null);
  assert.equal(avatarSource(undefined), null);
  assert.equal(avatarSource(''), null);
});

test('image cache rejects other hosts, schemes, credentials, ports and non-avatar paths', () => {
  for (const url of [
    'http://lh3.googleusercontent.com/a/photo',
    'https://lh3.googleusercontent.com.evil.example/a/photo',
    'https://evil.example/a/photo',
    'https://127.0.0.1/a/photo',
    'https://lh3.googleusercontent.com:444/a/photo',
    'https://name:secret@lh3.googleusercontent.com/a/photo',
    'https://lh3.googleusercontent.com/other/photo',
    'https://lh3.googleusercontent.com/a/photo?redirect=https://example.com',
    'https://lh3.googleusercontent.com/a/photo#fragment',
    'https://lh3.googleusercontent.com/a/../secret',
    'https://lh3.googleusercontent.com/a/%2fsecret',
    'not a URL',
  ]) assert.equal(googleAvatarUrl(url), null, url);
});
