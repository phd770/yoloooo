# Manual QA checklist — run after each deploy

Scope: yoloooo-live (PIN login, chat, games, vault, push, PWA). Run on both
profiles (boaz/mishel) where relevant, and on at least one real iOS Safari
device for the PWA items.

## Login

- [ ] Cold open (first visit / cleared cache): login screen renders within
      ~2s, no flash of blank page, no console errors.
- [ ] Correct PIN logs in and lands on Home.
- [ ] Wrong PIN shows "קוד שגוי. נסו שוב." and does **not** consume more than
      one attempt per submit.
- [ ] 5 wrong attempts in a row lock the account for 15 minutes
      (`429` + "בוצעו יותר מדי ניסיונות"); a 6th attempt within the window is
      still rejected even with the *correct* PIN.
- [ ] After the 15-minute window (or after a correct login, which clears the
      counter), attempts reset.
- [ ] Throttle/kill the network (DevTools "Slow 3G" or airplane-mode toggle)
      mid-login: login either succeeds after the client's automatic retry or
      fails with a clear, retryable error — never hangs forever.
- [ ] Reload the login screen and immediately submit a PIN (before the
      warm-up GET to `/api/auth` could have returned) — login still
      completes normally.
- [ ] Changing PIN (Settings) still requires the current PIN and rejects a
      stale/expired auth token with "יש להתחבר מחדש".

## Chat — send/receive

- [ ] Send a text message online: appears instantly with a clock icon, then
      flips to delivered/read icon once the partner device opens the chat.
- [ ] Send with an attachment (image/video/audio) online: uploads, sends,
      appears for the partner.
- [ ] **Go offline (airplane mode) before sending**, type a message, hit
      send: message shows the "⚠ לא נשלחה · נסו שוב" retry affordance (not a
      silently dropped message).
- [ ] While that failed message is still showing the retry button, **switch
      to another tab (Home/Games/Vault/Settings) and back to Chat** — confirm
      whether the failed message and its retry button are still visible.
      (Known risk: this state is held only in component memory and is
      dropped on tab switch/reload — see QA report.)
- [ ] With the app still open, go back online and tap the retry button: the
      message sends and does not create a duplicate once the partner's
      listener picks it up.
- [ ] Repeat the offline-send test, but **reload the whole page** instead of
      switching tabs, before retrying — confirm the message is recoverable
      (re-typing the identical text should reuse the stored draft id and not
      duplicate) or document that it is lost.
- [ ] Two rapid sends in a row (tap send twice fast) never produce a
      duplicate message.
- [ ] Typing indicator appears for the partner and clears a few seconds after
      typing stops or on send.
- [ ] Editing a message and deleting a message both still work and sync to
      the partner.
- [ ] "View once" message disappears for the recipient after viewing.

## Push notifications

- [ ] Enable notifications from Settings on a non-iOS browser (or installed
      iOS PWA): subscribe call succeeds, no console errors.
- [ ] On iOS **Safari tab (not installed to Home Screen)**: enabling shows
      the "באייפון יש להוסיף את האתר למסך הבית..." message and does not
      throw.
- [ ] On an installed iOS PWA: enabling notifications works end-to-end.
- [ ] Partner sends a push ping; the other device shows a system
      notification even if the app is fully closed.
- [ ] Tapping the notification opens/focuses the app on the chat tab.
- [ ] Sending two push pings within 30 seconds: the second is rejected
      client-side with the "אפשר לשלוח התראה נוספת בעוד חצי דקה" message
      (rate limit holds).
- [ ] Log out and back in on the same device/browser: notifications still
      work without needing to re-enable manually (subscription re-registers
      on login if it was missing/expired).

## Games

- [ ] Start a new game (Connect Four, Backgammon, Dots and Boxes) and confirm
      moves sync live to the partner.
- [ ] Leaving the Games tab mid-game and returning restores the board state.
- [ ] Starting a *new* game while already in one correctly resets/replaces
      the previous session (tapping "games" while already on games is a
      known re-trigger path — confirm no duplicate game is created).

## Vault

- [ ] Entering the vault requires its PIN/step codes; wrong codes are
      rejected and rate-limited the same way as login (5 attempts / 15 min).
- [ ] Previously saved items (links/images saved via "add to vault") are
      still visible after reopening the vault.

## Auto-logout / session

- [ ] Leave the app idle (per the configured auto-logout window) and confirm
      it signs out automatically and returns to the login screen.
- [ ] After auto-logout, chat/vault data from the previous session is not
      visible without logging back in.
- [ ] Logging out manually (Settings) returns to the login screen promptly,
      with no stuck spinner (this flow was touched by the Firestore
      persistence revert — confirm no regression).

## Mobile / iOS PWA

- [ ] "Add to Home Screen" from iOS Safari produces a standalone app with the
      correct icon, name ("המקום שלנו") and status bar style.
- [ ] Opened from the Home Screen icon, the app runs standalone (no Safari
      chrome), and push notifications are receivable (see above).
- [ ] Viewport behaves correctly with the iOS keyboard open (composer stays
      visible, no layout jump) — `interactive-widget=resizes-content` is in
      the markup; verify it actually behaves that way on a real device.
- [ ] Rotate the device / resize to a small viewport: no horizontal scroll,
      bottom nav still usable.

## Zimmers (צימרים)

- [ ] Paste an Airbnb listing link: a card appears immediately (title =
      domain, loading skeleton), then fills in with title/image/price once
      the server-side preview resolves.
- [ ] Paste a Booking.com listing link: same flow, card fills in correctly.
- [ ] Paste a Facebook Marketplace/group listing link (no usable Open Graph
      data, or blocked by Facebook's server-side rendering): the card still
      saves with the domain as a placeholder title and a toast telling you
      the preview failed; the editor opens so you can fill in the details
      manually, and saving works.
- [ ] Open a card's editor and change price per night, nights, and the
      check-in/check-out dates: the computed total updates live in the
      editor, and persists after saving and reopening the card.
- [ ] Leaving nights blank but filling both dates: total is computed from
      the date range; entering an explicit nights value overrides that.
- [ ] Toggle amenities on/off and add a custom tag: both save and render as
      pills on the card after saving.
- [ ] Both partners vote (👍/🤔/👎) on the same card from two separate
      devices/sessions: each vote appears on the other partner's screen
      without a refresh.
- [ ] Clicking your own already-selected vote again clears it (no vote).
- [ ] When both partners vote 👍 on the same card: the "💞 התאמה!" match
      badge appears on both screens.
- [ ] Filters: "שנינו אהבנו" shows only matches, "עוד לא הוחלט" excludes
      anything with a dislike, "נפסלו" shows anything either partner
      disliked, "ארכיון" shows only archived cards and hides them from every
      other filter.
- [ ] Sort by price and by match change the order as expected; sort by
      "תאריך הוספה" puts the newest first.
- [ ] Archiving a card removes it from the default/match/undecided/rejected
      views and moves it to "ארכיון"; restoring brings it back.
- [ ] Archiving the currently-chosen card also clears its "נבחר!" status.
- [ ] **"נבחר!" exclusivity — both partners tap on *different* cards at the
      same moment** (coordinate a simultaneous tap, e.g. on a 3-2-1 count):
      afterwards exactly one card should show "נבחר!"/be pinned first. If
      both end up marked chosen, that's the race condition from the QA
      report — note which two cards and roughly how close the taps were.
- [ ] Choosing a different card while one is already chosen un-chooses the
      previous one (single source of truth, no stale "נבחר!" badge left
      behind).
- [ ] **Confetti on both phones**: when either partner taps "נבחר!", confetti
      fires on the tapping partner's screen AND on the other partner's
      screen (if they have the Zimmers tab open) once the change syncs —
      without needing to tap anything themselves. Confetti should *not*
      refire just from reopening the Zimmers tab when a card was already
      chosen earlier.
- [ ] **Duplicate links with different query strings**: paste the same
      listing twice, once as a bare URL and once with extra tracking query
      params (e.g. append `?utm_source=whatsapp` or a trailing slash) —
      confirm whether a second card gets created. (Known gap from the QA
      report: the duplicate check is an exact string match, so this is
      expected to currently create a duplicate — record whether that's
      still the case.)
- [ ] Deleting a card asks for confirmation ("למחוק סופית?") before removing
      it, and it disappears from both partners' lists.

## Mobile nav at 360px

- [ ] On a 360px-wide viewport (or an emulated small Android), the bottom
      nav shows all tabs without any label being clipped, overlapping, or
      forced to wrap awkwardly — including with Zimmers added as the 7th
      tab.
- [ ] If the nav now collapses less-used tabs into an "עוד" (more) menu:
      confirm which tabs land inside it, that it opens/closes reliably by
      tap, and that navigating to a tab inside it (e.g. Zimmers, Vault)
      correctly highlights it as active and closes the menu.
- [ ] From inside the "עוד" menu, switching to any tab and back doesn't lose
      your place (e.g. re-opening Chat still shows the same scroll
      position/draft).
- [ ] Repeat at 375px (iPhone SE) and at a normal 414px+ width to confirm the
      layout only changes where it needs to.

## Release smoke test (run immediately after the production switch)

A fast 10-step pass to catch a broken deploy before telling anyone it's live.
Do this on one phone first; if anything fails, stop and roll back rather than
continuing down the list.

1. [ ] Open the production URL cold (not from cache): login screen renders,
       no blank page, no console errors.
2. [ ] Log in with the correct PIN: succeeds and lands on Home within a few
       seconds.
3. [ ] Bottom nav shows all 7 tabs (or 6 + "עוד") with no visibly broken
       layout.
4. [ ] Open Chat, send a short text message: it appears with a delivered
       indicator (not stuck on the clock/pending icon).
5. [ ] Open Zimmers, paste one real listing link: a card appears and fills
       in with a preview within ~10 seconds.
6. [ ] Vote on that card and confirm the vote shows immediately on your own
       screen (don't need the partner for this smoke step).
7. [ ] Open Vault: existing saved items still load.
8. [ ] Open Games, start or resume one game: board renders and a move can be
       made.
9. [ ] Open Settings: profile loads, and (if applicable) push notification
       toggle doesn't throw an error when tapped.
10. [ ] Log out: returns cleanly to the login screen with no stuck spinner.

If all 10 pass, repeat steps 4-6 from the *second* phone/profile to confirm
cross-partner sync (chat delivery, zimmer vote visibility) before declaring
the release healthy.

## General

- [ ] `npx tsc --noEmit`, `npm run build`, `npm test` all pass before any
      deploy (see latest QA report for current status).
- [ ] No new console errors/warnings on first load of each tab
      (Home/Inbox/Chat/Vault/Settings/Games/Zimmers).
