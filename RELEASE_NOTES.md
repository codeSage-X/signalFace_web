# Signal Face — Release Notes

**Release date:** 15 August 2026
**Covers:** work completed 10–15 August 2026
**Audience:** QA and product

---

## Before you start testing

**The new backend has not been deployed yet.** Everything in this document works
against the local/staging server. If you test against the live site you will see
the *old* behaviour and most of this list will look broken.

Please confirm with the dev team that the server has been updated before you
begin, otherwise every result will be a false failure.

Two things you'll want ready:

- **A second test account.** Several items (referrals, blocking, censorship)
  need two people.
- **An admin account.** The admin dashboard is a separate login.

---

## 1. Signing in and accounts

### You no longer get logged out every few minutes

Previously the app quietly signed you out after about 15 minutes. Worse, the
screen still *looked* like you were signed in — your name and picture stayed on
screen — but liking, commenting or posting silently failed until you logged out
and back in.

**How to test**

1. Sign in and leave the app open for 20–30 minutes (browse in between).
2. Come back and like a post, add a comment, and publish a post.
3. All three should work with no interruption and no re-login.
4. Reload the page — you should still be signed in.

**Also worth checking:** sign out, then confirm you are genuinely signed out
(you should be asked to sign in before liking anything).

---

### Signing up is easier

- **Passwords** now only need to be **6 characters**. No more forced capital
  letters, numbers or symbols.
- **Usernames are automatically lowercased as you type.** Type `SageX` and the
  field shows `sagex` — which is exactly what the account will be called, so
  there are no surprises after signing up.
- **Usernames are properly checked for duplicates.** As you type, the form tells
  you live whether a name is free or already taken.

**How to test**

1. Start a sign-up. In the username field, type an existing user's name in
   **capitals** (e.g. `CodeSageX`). It should lowercase as you type and warn you
   that it's taken.
2. Type a name nobody has — it should confirm it's available.
3. Set a 6-character password like `abc123` and confirm sign-up is allowed.
4. Try to complete sign-up with a username someone already has. You should get a
   clear "That username is already taken" message — **not** a crash or an
   unexplained error.

---

### Signed-out visitors can't open your profile page

Going to the profile page while logged out now shows a "Sign in to see your
profile" prompt instead of an empty broken-looking page.

**How to test:** sign out, navigate to the profile page, confirm you get the
sign-in prompt and that the Sign in button opens the login window.

---

## 2. Your profile

### Empty fields now tell you what to add

If you haven't written a bio, added a link or set a tagline, your profile used to
just show blank space. Now it prompts you — "Tell us about you", "Add a link",
"Add a tagline" — and tapping the prompt opens the editor.

**Note:** only *you* see these prompts on your own profile. Visitors see nothing.

**How to test**

1. Clear your bio and website link, then view your own profile — you should see
   both prompts.
2. Tap each one and confirm it opens the right editor.
3. View someone else's profile who has no bio — you should **not** see prompts
   there.
4. Check the same on your creator page (tagline, link, and the About section).

---

### Reposts (new)

You can now repost someone's post to your own profile.

**How to test**

1. In the feed, tap the repost icon on a post. It should confirm and turn green.
2. Go to your profile → **Reposts** tab. The post should be there.
3. Tap repost again on the same post to undo it — it should disappear from the
   tab.
4. Check that the repost count on the post goes up and down accordingly.

---

### The Liked tab now works

Liked posts never appeared under the **Liked** tab. They do now.

**How to test:** like a few posts, go to your profile → **Liked**, and confirm
they're all listed. Unlike one and confirm it disappears.

---

### Tapping a post opens a scrollable viewer

Tapping any post on your profile now opens it full-screen — and **scrolling moves
through that tab's posts only**, not the public feed. So if you open a video from
your Liked tab, scrolling takes you to your next liked video.

**How to test**

1. Open a post from the **Posts** tab and scroll — you should move through your
   own posts.
2. Go back, open one from **Liked**, and scroll — you should move through liked
   posts only.
3. Repeat for **Favorites** and **Reposts**.
4. Press **Escape** (or the X) to close.
5. Like or save something inside the viewer, close it, and confirm the counts on
   the grid behind have updated.

---

### Removed

The **Latest / Popular / Oldest** buttons on the profile have been removed. They
never actually sorted anything.

---

## 3. Creating a post

### New post composer

After choosing a photo or video, you now get a two-step editor.

**Step 1 — Crop.** Choose the shape of your post:
- Photos: Original, 1:1, 4:5, 16:9
- Videos: Original, 1:1, 16:9, 9:16

**Step 2 — Edit.** A panel slides out from the side:
- **Photos:** filters (Clarendon, Gingham, Moon and others) plus manual sliders
  for brightness, contrast, fade, saturation, temperature and vignette.
- **Videos:** pick the **cover photo** — the still frame people see before the
  video plays — from frames taken across the video. Plus a sound on/off switch.

**How to test**

1. Start a post with a **photo**. Try each crop option and check the preview
   changes shape.
2. Press Next, try a few filters, then push the sliders around.
3. Publish, then find the post in the feed — the crop and filter you chose should
   be visible on the published post.
4. Repeat with a **video**: pick a shape, press Next, choose a different cover
   frame, publish. The thumbnail on your profile grid should be the frame you
   picked.
5. Select **2–4 photos at once** and confirm you can swipe between them in the
   editor (swipe on mobile, arrows or trackpad on desktop).

---

### Posts with several photos now work properly

Posts containing more than one item were broken. If a post had a video *and* a
photo, only the first item appeared and the rest were silently dropped — or a
video would show as a broken image.

Now every item appears and you can swipe through them.

**How to test**

1. Post 3 photos together. Open it in the feed and swipe through all three.
   A counter (`1/3`) and dots should show your position.
2. Post a video and a photo together and confirm both appear, and that the video
   plays while the photo displays normally.
3. On mobile, swipe with your finger. On desktop, use the arrows.

---

### Choosing a topic for your post

The composer now has a **Topic** selector (Music, Comedy, Tech, Food and so on).
This is what lets people find your post when they browse that category.

If you have a creator page, it pre-fills with your page's category. You can
change it, or choose "No topic".

**How to test**

1. Publish a post with the topic set to **Food**.
2. Go to Explore, tap the **Food** category chip, and confirm your post appears.
3. Publish one with "No topic" and confirm it does **not** appear under any
   category (it still shows in the normal feed).

---

### Upload progress and failures

- Pressing **Post** now closes the composer straight away — you can keep
  browsing while it uploads.
- A progress bar runs across the very top of the screen with a live percentage.
- If it fails, the bar turns red, explains why, and offers **Retry**.

**How to test**

1. Post a large video. Confirm the composer closes immediately and the bar
   appears at the top.
2. Confirm the percentage climbs, then holds near the end while the server
   finishes processing, then completes and shows "Posted".
3. Navigate to another page mid-upload — the bar should keep running.
4. **Test a failure:** turn off wifi mid-upload. The bar should go red with a
   Retry button. Turn wifi back on, press Retry, and confirm it publishes.

---

## 4. The feed (For You)

### Your feed is now personalised

The feed used to show everyone exactly the same thing. It now leans towards
topics you care about — roughly **two out of every three posts** match your
interests, with the rest kept varied so you still see other things.

You choose your interests **after verifying your email** when signing up, and can
change them any time in **Settings → Your interests**.

**How to test**

1. Create a new account. After entering the email code, you should be asked to
   pick topics. Pick **Comedy** only.
2. Browse the feed and note roughly how much of it is comedy content.
3. Go to Settings, change your interests to **Tech** only, save, and reload the
   feed. The mix should visibly shift towards tech.
4. Confirm the feed is **not** 100% one topic — variety is intentional.
5. Select no interests at all and confirm the feed still works (it just shows
   newest first).

**Also:** if you run a creator page, its category counts as an interest
automatically.

---

### Sound stays on

Turning sound on for one video now keeps it on for every video as you scroll,
until you turn it off — like TikTok and Instagram.

**How to test:** unmute a video, scroll through several more, and confirm they
all play with sound. Mute one and confirm the rest go quiet too.

**Expected:** after a full page refresh, sound starts off again. This is
deliberate — browsers block audio from starting on its own.

---

### Loading screens

The feed, Explore, and several admin pages now show grey placeholder shapes while
loading, instead of a blank screen or a spinner.

**How to test:** hard-refresh the home page on a slow connection (browser dev
tools can simulate this) and confirm you see the placeholder layout rather than
an empty page.

---

## 5. Search (new)

The search box in the sidebar now works. It opens a full search page with tabs:

- **Top** — a mix of everything
- **Users** — accounts
- **Videos** — video posts only
- **Pages** — creator pages

Results appear as you type. Your recent searches are saved and can be cleared
individually or all at once.

**How to test**

1. Type a creator's name in the sidebar search and press Enter.
2. Check each of the four tabs returns sensible results.
3. Tap a video result — it should open full-screen, and scrolling should move
   through the other search results.
4. Search a few different things, then return to the empty search page and
   confirm your recent searches are listed. Remove one, then clear all.
5. Search for nonsense (`zzzzzz`) and confirm you get a friendly "no results"
   message rather than an error.

---

### People you may know

The search page now suggests accounts to follow, based on who the people you
follow also follow. You can follow directly from the suggestion card, or dismiss
one.

**How to test:** open search without typing anything. Confirm suggestions appear,
that following works from the card, and that you are never suggested to yourself.

---

## 6. Explore

### Category chips now filter posts too

Previously, picking a category like "Technology" only filtered creator *pages* —
the posts section disappeared entirely. Now it filters posts as well.

**How to test**

1. Go to Explore and tap the **Technology** chip.
2. Confirm you see technology **posts** as well as technology **pages**.
3. Tap a different category and confirm both sections update.
4. Clear the filter and confirm the normal Explore view returns.

**Expected:** the "Top Creators" section hides while a category is selected —
creators aren't categorised, so there's nothing to filter them by.

---

## 7. Rewards and referrals (new)

### Rewards

The Rewards page is now real (it previously showed fake sample data). It lists
rewards set up by the admin, and you can claim them for SF points.

**How to test**

1. Ask an admin to create a reward (see the admin section below).
2. Open the Rewards page and confirm it appears with the right name and amount.
3. Claim it. Your SF balance in the sidebar should increase by that amount.
4. For a **recurring** reward, try claiming twice — the second attempt should be
   refused and the button should show when it will next be available.
5. For a **one-time** reward, confirm it can't be claimed twice.

---

### Referrals

Everyone has an invite link. When someone signs up with your link **and verifies
their email**, you get the referral bonus.

**How to test** (needs two accounts and two browsers, or a private window)

1. On the Rewards page, copy your invite link.
2. Open it in a private window and sign up as a brand-new user.
3. Before verifying the email, check the referrer's Rewards page: the new person
   should be listed as **Pending**, with no bonus paid yet.
4. Complete email verification on the new account.
5. Back on the referrer's Rewards page: the person should now show **Earned**,
   the "Earned from referrals" total should have gone up, and their SF balance
   should have increased by the bonus amount.

**Important:** the bonus is paid on *verification*, not on sign-up. This is
deliberate — it stops people farming bonuses with fake email addresses.

---

## 8. Admin dashboard

### Managing rewards

New **Rewards & Referrals** page. Admins can create, edit, switch off and delete
rewards, setting:

- Name and description
- Type — signup bonus, referral bonus, one-time claim, or recurring claim
- Amount in SF
- Cooldown in hours (recurring only) — how long before someone can claim again
- Start and end dates
- Total claim limit, and per-user limit

**The referral bonus amount is edited here too**, and changes take effect
immediately.

**How to test**

1. Create a **recurring** reward worth 250 SF with a 24-hour cooldown. Confirm a
   normal user can see and claim it.
2. Edit the amount to 500 and confirm the user's page shows the new amount.
3. Switch it off and confirm it disappears for users.
4. Change the **referral bonus** amount and confirm the Rewards page on the user
   side reflects the new figure.
5. Try to delete a reward somebody has already claimed — you should be warned
   that it will be switched off rather than deleted, so payout history is kept.
6. Try creating a recurring reward **without** a cooldown — it should be
   rejected with a clear message.

---

### Managing users

The **Users** page has been rebuilt:

- **Search now covers every user**, not just the ones on screen. It searches
  name, username and email, and runs shortly after you stop typing.
- **20 users per page**, with working Previous and Next buttons and a total count.
- Each row now shows the user's **profile picture** and username.

Admins can now, from the row menu:

- **Edit** a user's display name, username or email
- **Restrict** an account — "under review". They can still sign in and browse,
  but cannot post, like, comment or repost.
- **Block** an account — banned. They cannot sign in at all, and any active
  session is ended immediately.
- **Reinstate** a restricted or blocked account
- **Delete** an account permanently

**How to test**

1. Search for a user by **email** and confirm they're found even if they're not
   on the first page.
2. Page through with Next and Previous and confirm the count reads correctly
   ("Showing 21–40 of 63").
3. **Restrict** a test account. Sign in as that user: browsing should work, but
   liking or posting should be blocked with a message explaining the account is
   under review.
4. **Block** that account. The user should be signed out and unable to sign back
   in, with a message saying the account is blocked.
5. **Reinstate** them and confirm everything works again.
6. Confirm an admin **cannot** block or delete their own account.
7. Confirm a normal (non-admin) user cannot reach the admin dashboard at all.

---

### Other admin fixes

- **Recent activity now shows real profile pictures.** It previously showed
  generated placeholder images for everybody.
- **Loading placeholders** added to the Overview and Signals pages, instead of
  blank cards and "Loading…" text.

**How to test:** open Overview and confirm the activity list shows real avatars
(and initials for people with no picture). Hard-refresh and confirm the
placeholder layout appears while loading.

---

## Known limitations

These are expected and are **not** bugs:

1. **Older posts have no topic.** Posts made before this release by users
   without a creator page won't appear under any Explore category. They still
   appear in the normal feed and search.

2. **Older photos may show differently.** Photos posted before the new composer
   were never cropped to a chosen shape, so they now display fully (with a
   blurred background filling the space) rather than being cut to fill the
   screen. Nothing is hidden — this is the corrected behaviour.

3. **Video shape is applied on display.** Choosing 1:1 or 16:9 for a video does
   not alter the video file itself; the app displays it in that shape. Photos
   *are* genuinely cropped.

4. **Sound resets on a full page refresh.** Browsers do not allow sound to start
   on its own before you've interacted with the page.

5. **The upload bar pauses near the end.** After your file finishes uploading,
   the server still has to process it. The bar creeps forward during this rather
   than sitting frozen at 100%.

---

## Summary of what to prioritise

If time is short, these are the highest-risk areas:

| Priority | Area | Why |
|---|---|---|
| 1 | Staying signed in | Affects every user, every session |
| 2 | Posting (composer, upload, retry) | Most complex new flow |
| 3 | Multi-photo and mixed photo/video posts | Fixes a bug that lost content |
| 4 | Admin restrict / block | Real consequences if it misbehaves |
| 5 | Referral payout | Involves money-like balances |
| 6 | Personalised feed | Subjective, needs a considered look |
