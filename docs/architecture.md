# Architecture

## Stack

- React 19 and TypeScript 5.8, built with Vite 6
- Tailwind CSS v4 and Radix UI primitives
- TanStack Query for server state, Zustand for auth state (`src/store/authStore.ts`)
- `socket.io-client` for realtime (`src/socket/`)
- Vitest for unit tests, Playwright for end-to-end tests and documentation screenshots
- Capacitor for the Android companion app (`mobile/`)

The `@/` import alias points at `src/`.

## Source layout

```text
src/
  App.tsx          route table
  app/             route constants (APP_ROUTES), app shell (rail, mobile tab bar), legacy redirects
  api/             httpClient, endpoints, query keys, generated OpenAPI contract
  auth/            session and token storage
  container/       the container descriptor; read its AGENTS.md first
  features/        one folder per product area (see below)
  navigation/      URL-derived navigation state
  socket/          Socket.IO client, event names, channel room subscriptions
  store/           Zustand stores
  shared/, components/, hooks/, lib/, utils/   shared UI and helpers
```

`features/` holds `auth`, `calls`, `channels`, `chat`, `discovery`, `feed`, `invite`, `landing`, `manage`, `notifications`, `profile`, `settings`, `settings-container` and `spaces`.

## The container descriptor

The backend models every message parent as a container: a `conversation` (DM or group) or a `channel`. The client mirrors this in `src/container/`.

`container_type` used to answer three unrelated questions at once, so `ContainerDescriptor` splits them:

| Part | Varies with | Answers |
|---|---|---|
| `endpoints` | container type | which URL to call and which cache key to use |
| `capabilities` | the viewer | what this person may do; this comes from the server |
| `presentation` | the **lens** the route selects (`timeline` or `feed`) | how it renders |

Capabilities do not change with the lens. The same channel resolves the same permissions whether it is read as a timeline or as a feed, and `resolveContainer.test.ts` asserts this. That is what lets one component tree serve a DM, a group and a channel in both lenses.

**Rule:** feature components must not branch on container type to decide behaviour or affordances. Read a capability instead. The full reasoning is in [`src/container/AGENTS.md`](../src/container/AGENTS.md).

## Capabilities: absent, not disabled

What a viewer may do is decided by the backend's authorization service and fetched as a batch (`POST /viewer/capabilities`). An action the viewer cannot take is **left out**, not shown greyed out.

The gating decisions live in small, pure, unit-tested modules rather than inline in JSX:

- `src/features/chat/components/headerActions.ts`: the chat header actions
- `src/features/chat/components/inbox/inboxMenuItems.ts`: the inbox row menus
- `src/features/settings-container/sections/registry.ts`: which settings sections exist

To add an affordance, put its gating decision in a module like these.

### Batching and caching

`src/container/useCapabilities.ts` batches requests: the fetch unit is a batch, and the cache unit is one resource. A feed card and a chat header that ask about the same channel share one cache entry. When the server emits `capabilities.invalidated`, the matching entries are refetched (`CapabilityInvalidationRoot.tsx`).

`resource.delete` is deliberately **left out** of `DEFAULT_ACTIONS` (`src/container/capabilities.ts`), so `descriptor.capabilities.canDeleteContainer` silently reads `false`. Use `useManageCapabilities().canDeleteResource` (`src/features/manage/useManageCapabilities.ts`), which requests it explicitly.

## Settings: one registry, two shells

Container settings are one component tree rendered in two places:

- `ContainerSettingsSheet`: a slide-over opened from a chat or channel header
- the `/manage/:section` routes: full-page management with deep links

Both resolve their sections from `sections/registry.ts` against capabilities. A section is omitted for a subject kind when the backend has no endpoint for it. That is why groups have no access section and channels have no invites section.

## Realtime

`src/socket/` holds one Socket.IO connection, authenticated with the access token. Conversation events arrive on the user's own room. Channel events need an explicit `join_channel`, which `useChannelRooms` manages for the channels currently on screen. Event names and payloads are documented in the backend's [Realtime](../../VoiceChat/docs/realtime.md) page.

## API contract

`openapi/openapi.json` is a copy of the backend schema, and `src/api/openapi-contract.ts` is generated from it:

```bash
npm run sync:openapi            # regenerate the schema from ../VoiceChat
npm run generate:api-contract   # regenerate src/api/openapi-contract.ts
npm run test:api-contract       # fail if operations or response schemas the client relies on are missing
```

## Deliberately absent features

Some affordances are missing because the backend has no endpoint for them, not because they are broken:

- group visibility and posting-policy editing
- channel invite links and join requests
- channel and space member removal
- space `join_policy` editing
- reporting

Check this list before treating a missing button as a bug.
