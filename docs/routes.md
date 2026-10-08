# Routes

The app uses a `HashRouter`, so every URL looks like `/#/path`. Route declarations live in `src/App.tsx`, and URL builders live in `APP_ROUTES` in `src/app/routes.ts`. Build links with `APP_ROUTES` rather than string literals.

## Public

| Path | Page |
|---|---|
| `/` | `LandingPage` |
| `/auth` | `AuthPage`: email code and passkey sign-in |
| `/invite/:token` | `InvitePage` |

## Signed in

Everything below renders inside `AppShell` behind `ProtectedRoute`.

### Chat (`ChatPage` in `ChatShell`)

The inbox stays visible on every chat route. The route selects the container and the **lens**: `chat` is the timeline lens, and `feed` is the feed lens.

| Path | Container |
|---|---|
| `/chat` | Inbox only |
| `/dms/:conversationId` | Direct message |
| `/groups/:conversationId/chat` | Standalone group |
| `/spaces/:spaceId/groups/:conversationId/chat` | Space group |
| `/spaces/:spaceId/channels/:channelId/chat` | Channel, timeline lens |
| `/spaces/:spaceId/channels/:channelId/feed` | Channel, feed lens |

Each timeline route also has a `/thread/:rootMessageId` child that opens the thread panel, for example `/dms/:conversationId/thread/:rootMessageId`.

### Social and discovery

| Path | Page | Tabs |
|---|---|---|
| `/feed`, `/feed/:tab` | `FeedPage` | `home`, `saved` |
| `/channels/:channelId/posts/:postId` | `PostDetailPage` | |
| `/spaces/:spaceId/channels/:channelId/:tab` | `ChannelPage` | `feed`, `chat`, `about`, `members` |
| `/spaces`, `/spaces/:spaceId/:tab` | `SpacesPage`, `SpaceHomePage` | `channels`, `groups`, `members` |
| `/discover/:tab` | `DiscoverPage` | `people`, `channels`, `spaces`, `groups` |
| `/people/:tab` | `ContactsPage` | `contacts`, `following`, `followers`, `blocked` |
| `/activity/:tab` | `NotificationsPage` | `all`, `stats`, `mentions`, `requests`, `sent`, `call-logs` |
| `/me` | `MyProfilePage` | |
| `/profile/:userId` | `ProfilePage` | |
| `/settings/:tab` | `SettingsPage` | `appearance`, `notifications`, `privacy`, `account` |

### Management

Management pages have their own chrome and deep-link to a section. They render the same settings registry as the in-chat settings sheet. See [Architecture](./architecture.md#settings-one-registry-two-shells).

| Path | Page |
|---|---|
| `/manage`, `/manage/:tab` | `ManageHubPage` (`people`, `spaces`, `channels`, `groups`) |
| `/spaces/:spaceId/manage/:section` | `ManageSpacePage` |
| `/spaces/:spaceId/channels/:channelId/manage/:section` | `ManageChannelPage` |
| `/channels/:channelId/manage/:section` | `ManageChannelPage` |
| `/spaces/:spaceId/groups/:conversationId/manage/:section` | `ManageConversationPage` |
| `/chat/:conversationId/manage/:section` | `ManageConversationPage` |

## Legacy redirects

Old URLs keep working, and each one redirects to its current home.

| Old path | Goes to |
|---|---|
| `/login` | `/auth` |
| `/calls` | `/activity/call-logs` |
| `/chat/:conversationId`, `…/thread/:rootMessageId` | the typed DM or group route |
| `/chat/channels/:channelId`, `…/feed`, `…/thread/:rootMessageId` | the channel's space-scoped route |
| `/channels/:channelId`, `/channels/:channelId/:tab` | the channel's space-scoped page |
| `/feeds` | `/feed` |
| `/feeds/users/:username`, `/feeds/channels/:channelId` | the profile, or the channel page |
| `/notifications`, `/notifications/:tab`, `/pings`, `/pings/:tab` | `/activity` |
| `/contacts` | `/people` |
| `/settings` | `/settings/appearance` |
| `/spaces/:spaceId/{roles,invites,requests,settings}`, `/channels/:channelId/settings` | the matching `/manage/:section` |
| anything else | `/` |
