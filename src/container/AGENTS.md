# container/

**Read this before adding a branch on container type anywhere in the client.**

`container_type` used to answer three unrelated questions at once — which URL to
call, what the viewer may do, and how to render. Reading it for all three is why
the old chat hook needed non-null assertions and `any` casts, and why a DM, a
group and a channel each grew their own component path.

`ContainerDescriptor` splits those axes:

| Part | Varies with | Answers |
|---|---|---|
| `endpoints` | container type | which URL, which cache key |
| `capabilities` | the viewer | what may this person do |
| `presentation` | the **lens the route selects** | how does this render |

The load-bearing property is that **capabilities are lens-invariant**. The same
channel resolves the same permissions whether it is read as a timeline or as a
feed. That is what lets one component tree serve every container in both lenses
instead of two adapters or a discriminated union, and it is asserted in
`resolveContainer.test.ts` — if you find yourself wanting a capability to depend
on the lens, the design is being violated.

Consequences worth knowing before you fight them:

- **Feature components must not branch on container type** to decide behaviour
  or affordances. Read a capability. The one legitimate exception is identity
  rendering — a channel shows a hash tile where a DM shows presence — and that
  is presentation, not behaviour.
- **The lens comes from the route, never from storage.** It was a `localStorage`
  preference once, which meant the same URL rendered differently for two people
  and a channel could not be linked in a specific lens.
- **Conversation-only affordances are an absent object, not false flags.**
  `conversationOnly` is `null` for a channel so a channel cannot accidentally
  render a draft box. Marking read is deliberately *not* in that group: both
  container kinds support it.
- **`policy` is for rendering a management form, never for gating.** The two
  policy vocabularies (`everyone | admins` for conversations, four values for
  channels) collapse through one mapping in `policy.ts`, because "everyone"
  means different audiences in each. No other module may interpret those strings.

`resource.delete` is deliberately **outside** `DEFAULT_ACTIONS` — requesting it
on every container open would make opening one expensive. So
`capabilities.canDeleteContainer` is absent-not-false for a server-sourced
descriptor. Gate delete affordances on `useManageCapabilities().canDeleteResource`,
which asks for it explicitly.
