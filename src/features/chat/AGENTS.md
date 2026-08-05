# features/chat/

The largest feature in the client — ~20,500 lines, 38% of the frontend. Know
the seams before opening it, because most of it is not what you are looking for.

| Sub-area | Lines | What lives there |
|---|---|---|
| `components/` | 7,180 | header, inbox rows and menus, message shell, dialogs |
| `media/` | 3,675 | recorders, players, viewer, upload |
| `composer/` | 2,953 | the one message input, all presets |
| root files | 2,672 | `ChatPage`, `ContainerPane`, `ChatShell`, dialogs provider |
| `hooks/` | 1,494 | timeline, receipts, route params, conversation actions |
| `renderers/` + `content/` | 1,269 | per-content-type rendering |

## The seams that matter

**One composer, two chromes.** `ChatComposer` is the only implementation. It has
a `preset`: `inline-bar` is the docked row in a timeline, `post-box` is the large
body inside the feed's add-post modal. Attachment panels, upload progress and
cancellation are shared — there is exactly one place in the app that uploads a
file, and it should stay that way. A second composer is how the feed ended up
with a text-only box that could not attach anything.

**One content core, two shells.** The per-kind renderers hold the *body*;
`MessageShell` wraps it as a chat bubble and `features/feed/PostCard` wraps the
same body as a post. Content components take a `tone`, not `isOwn` — ownership
decides which side of a timeline a bubble sits on, which is a shell concern, but
a post has no "own" side and still needs to know if it is on an accent surface.

**Nothing in the renderer tree reads `message.raw`.** It used to, for two mention
fields, and that single dependency was what kept a projected feed post from using
the same components. `parseMessage` lifts them onto `TextMessage` instead. Keep
it that way: `BaseMessage.raw` is optional precisely because a feed post has no
source document.

**Which actions exist is decided in pure modules, not in JSX.** See
`components/headerActions.ts` and `components/inbox/inboxMenuItems.ts`. Both are
unit-tested, and both exist because the header and the row menu each used to
carry a hand-maintained channel branch — which is how channels ended up with no
mute, pin or archive despite the API supporting all three. An action a viewer
cannot take is **absent, not disabled**.

## Watch for

`ContainerPane` renders from `descriptor.presentation`, not from a lens prop.
`ChatDialogsProvider` holds shared dialog state, but the settings sheet and info
modal keep their open state local to `ChatPage` — follow the local pattern for
new surfaces unless something outside the page needs to open them.
