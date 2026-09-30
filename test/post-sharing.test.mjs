import test from 'node:test';
import assert from 'node:assert/strict';
import { externalShareLinks, mediaAttachmentUrl, postShareUrl, shareablePost, sharedPostMessage, videoAttachmentUrl } from '../lib/post-sharing.ts';

const post = {
  id: 'post/a&b', author: { username: 'creator' }, realm: null, body: 'A caption',
  moderation: 'VISIBLE', kind: 'video', media: [], mediaUrls: ['https://res.cloudinary.com/demo/video/upload/v12/video.mp4'], coverUrl: 'cover.jpg', allowDownload: true,
};

test('post links encode the post id and external sharing preserves the exact link', () => {
  const target = shareablePost(post);
  const url = postShareUrl('https://signalface.example', target);
  assert.equal(new URL(url).searchParams.get('post'), post.id);
  const links = externalShareLinks(url, target.title);
  assert.equal(new URL(links.facebook).searchParams.get('u'), url);
  assert.equal(new URL(links.whatsapp).searchParams.get('text'), `${target.title}\n${url}`);
});

test('mixed-media downloads include only video items', () => {
  const target = shareablePost({ ...post, kind: 'image', media: [{ kind: 'image', url: 'photo.jpg' }, { kind: 'video', url: 'clip.mp4' }] });
  assert.deepEqual(target.videos, ['clip.mp4']);
});

test('moderated posts do not expose downloads, thumbnails or captions', () => {
  for (const moderation of ['CENSORED', 'REMOVED']) {
    const target = shareablePost({ ...post, moderation });
    assert.deepEqual(target.videos, []);
    assert.equal(target.thumbnail, null);
    assert.notEqual(target.text, post.body);
  }
});

test('author download permission removes downloadable video options', () => {
  assert.deepEqual(shareablePost({ ...post, allowDownload: false }).videos, []);
});

test('DM messages include the note and clickable post URL within message limits', () => {
  const target = shareablePost({ ...post, body: 'x'.repeat(5000) });
  const url = postShareUrl('https://signalface.example', target);
  const text = sharedPostMessage(target, url, 'n'.repeat(2000));
  assert.ok(text.endsWith(url)); assert.ok(text.length < 4000);
  assert.ok(sharedPostMessage(target, url, '  Look at this  ').startsWith('Look at this\n\n'));
});

test('Cloudinary videos use attachment delivery while signed or other URLs use fetch', () => {
  const result = videoAttachmentUrl(post.mediaUrls[0], 'signalface-video');
  assert.equal(result, 'https://res.cloudinary.com/demo/video/upload/fl_attachment:signalface-video/v12/video.mp4');
  assert.equal(videoAttachmentUrl('https://res.cloudinary.com/demo/video/upload/s--signature--/clip.mp4', 'clip'), null);
  assert.equal(videoAttachmentUrl('https://example.com/video.mp4', 'clip'), null);
  assert.equal(videoAttachmentUrl('https://res.cloudinary.com/demo/image/upload/cover.jpg', 'clip'), null);
  assert.equal(
    mediaAttachmentUrl('https://res.cloudinary.com/demo/image/upload/v2/photo.jpg', 'signalface-photo', 'image'),
    'https://res.cloudinary.com/demo/image/upload/fl_attachment:signalface-photo/v2/photo.jpg',
  );
});
