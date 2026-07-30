import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const specPath = path.join(rootDir, 'openapi', 'openapi.json');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const getOperation = (method, route) => {
  const operation = spec.paths?.[route]?.[method];
  assert.ok(operation, `Missing ${method.toUpperCase()} ${route}`);
  return operation;
};

const getJsonResponseRef = (method, route, status) => {
  const operation = getOperation(method, route);
  const response = operation.responses?.[status];
  assert.ok(response, `Missing ${status} response for ${method.toUpperCase()} ${route}`);
  const ref = response.content?.['application/json']?.schema?.$ref;
  assert.ok(ref, `Missing JSON schema ref for ${method.toUpperCase()} ${route} ${status}`);
  return ref;
};

const getSchema = (name) => {
  const schema = spec.components?.schemas?.[name];
  assert.ok(schema, `Missing schema ${name}`);
  return schema;
};

const operationCount = Object.values(spec.paths).reduce(
  (count, operations) => count + Object.keys(operations).length,
  0
);

// 211 -> 209: -2 from collapsing the duplicate feed routes (GET
// /feeds/channels/{id}/posts into its /feeds/channels/{id} twin, and GET
// /users/{username}/posts into its /feeds/users/{username} twin).
assert.equal(operationCount, 209, 'Unexpected number of OpenAPI operations');
assert.equal(
  Object.keys(spec.paths).some((route) => route.startsWith('/pings')),
  false,
  'Legacy pings routes must not be present'
);

assert.equal(
  getJsonResponseRef('post', '/spaces', '201'),
  '#/components/schemas/SuccessResponse_SpaceView_'
);
assert.equal(
  getJsonResponseRef('post', '/webhooks', '201'),
  '#/components/schemas/SuccessResponse_WebhookView_'
);
assert.equal(
  getJsonResponseRef('post', '/slash-commands', '201'),
  '#/components/schemas/SuccessResponse_SlashCommandView_'
);
assert.equal(
  getJsonResponseRef('post', '/reports', '201'),
  '#/components/schemas/SuccessResponse_ReportView_'
);

assert.equal(
  getJsonResponseRef('get', '/auth/passkeys', '200'),
  '#/components/schemas/SuccessResponse_list_PasskeyResponse__'
);
assert.equal(
  getJsonResponseRef('post', '/discovery/code/regenerate', '200'),
  '#/components/schemas/SuccessResponse_RegenerateCodeResponse_'
);
assert.equal(
  getJsonResponseRef('get', '/users/{id}', '200'),
  '#/components/schemas/SuccessResponse_SelectedUserProfileResponse_'
);
assert.equal(
  getJsonResponseRef('get', '/messages/{message_id}/thread', '200'),
  '#/components/schemas/SuccessResponse_list_MessageDoc__'
);
assert.equal(
  getJsonResponseRef('post', '/conversations/{conversation_id}/messages/content', '201'),
  '#/components/schemas/SuccessResponse_MessageDoc_'
);
assert.equal(
  getJsonResponseRef('delete', '/messages/{message_id}', '200'),
  '#/components/schemas/SuccessResponse_DeleteMessageResponse_'
);
assert.equal(
  getJsonResponseRef('post', '/messages/{message_id}/reactions', '200'),
  '#/components/schemas/SuccessResponse_MessageDoc_'
);
// Viewer capabilities: the batch endpoint is the contract, the per-resource
// ones exist for cold deep links and must return the same shape.
assert.equal(
  getJsonResponseRef('post', '/viewer/capabilities', '200'),
  '#/components/schemas/SuccessResponse_CapabilitiesResponse_'
);
assert.equal(
  getJsonResponseRef('get', '/channels/{resource_id}/capabilities', '200'),
  '#/components/schemas/SuccessResponse_ResourceCapabilitiesView_'
);
assert.equal(
  getJsonResponseRef('get', '/spaces/{resource_id}/capabilities', '200'),
  '#/components/schemas/SuccessResponse_ResourceCapabilitiesView_'
);
assert.equal(
  getJsonResponseRef('get', '/conversations/{resource_id}/capabilities', '200'),
  '#/components/schemas/SuccessResponse_ResourceCapabilitiesView_'
);

// The directory paginates like every other list surface, so its responses are
// PaginatedResponse rather than SuccessResponse. The omni preview is the one
// deliberate exception.
assert.equal(
  getJsonResponseRef('get', '/directory/channels', '200'),
  '#/components/schemas/PaginatedResponse_ChannelSummary_'
);
assert.equal(
  getJsonResponseRef('get', '/directory/spaces', '200'),
  '#/components/schemas/PaginatedResponse_SpaceSummary_'
);
assert.equal(
  getJsonResponseRef('get', '/directory/groups', '200'),
  '#/components/schemas/PaginatedResponse_GroupSummary_'
);
assert.equal(
  getJsonResponseRef('get', '/directory', '200'),
  '#/components/schemas/SuccessResponse_OmniResults_'
);

// `ChannelSummary` is the canonical list shape; the retired projection renamed
// four fields, so guard against its return.
const channelSummary = getSchema('ChannelSummary');
for (const field of ['name', 'follower_count', 'last_activity_at', 'visibility']) {
  assert.ok(field in channelSummary.properties, `ChannelSummary must carry ${field}`);
}
for (const field of ['title', 'member_count', 'last_message_at', 'read_policy']) {
  assert.equal(
    field in channelSummary.properties,
    false,
    `ChannelSummary must not resurrect ${field}`
  );
}
assert.equal(
  Object.keys(spec.components.schemas).some((name) => name === 'UserChannelView'),
  false,
  'UserChannelView must stay retired'
);

assert.equal(
  getJsonResponseRef('post', '/connections/{user_id}/ping', '201'),
  '#/components/schemas/SuccessResponse_RelationshipView_'
);
assert.equal(
  getJsonResponseRef('post', '/connections/{relationship_id}/accept', '200'),
  '#/components/schemas/SuccessResponse_RelationshipView_'
);
assert.equal(
  getJsonResponseRef('get', '/connections', '200'),
  '#/components/schemas/PaginatedResponse_list_ConnectionListItem__'
);
assert.equal(
  getJsonResponseRef('get', '/connections/pending', '200'),
  '#/components/schemas/PaginatedResponse_list_ConnectionListItem__'
);
assert.equal(
  getJsonResponseRef('post', '/blocks/{user_id}', '201'),
  '#/components/schemas/SuccessResponse_BlockView_'
);
assert.equal(
  getJsonResponseRef('get', '/blocks', '200'),
  '#/components/schemas/PaginatedResponse_list_BlockedUserListItem__'
);
assert.ok(getOperation('delete', '/blocks/{user_id}').responses?.['204']);
assert.equal(
  getJsonResponseRef('get', '/calls/active', '200'),
  '#/components/schemas/SuccessResponse_Union_CallSession__NoneType__'
);
assert.equal(
  getJsonResponseRef('get', '/realtime/presence', '200'),
  '#/components/schemas/SuccessResponse_dict_str__PresenceStatusResponse__'
);

assert.deepEqual(
  getSchema('MessageDoc').properties.type.enum,
  ['text', 'media', 'file', 'call', 'system', 'poll', 'sticker', 'voice', 'location', 'contact', 'link_preview']
);
assert.deepEqual(
  getSchema('Body_send_media_conversations__conversation_id__messages_media_post').properties.type.enum,
  ['media', 'file']
);
assert.deepEqual(
  getSchema('MediaMeta').properties.kind.enum,
  ['voice', 'audio', 'image', 'video', 'file']
);
assert.deepEqual(
  getSchema('Body_send_media_conversations__conversation_id__messages_media_post').properties.media_kind.anyOf[0].enum,
  ['voice', 'audio', 'image', 'video']
);
assert.deepEqual(
  getSchema('ReplyPreview').properties.type.enum,
  ['text', 'media', 'file', 'call', 'system', 'poll', 'sticker', 'voice', 'location', 'contact', 'link_preview']
);
assert.deepEqual(
  getSchema('ReplyPreview').properties.media_kind.anyOf[0].enum,
  ['voice', 'audio', 'image', 'video', 'file']
);
assert.deepEqual(
  getSchema('MessageDoc').properties.state.enum,
  ['sent', 'scheduled']
);
assert.deepEqual(
  getSchema('PresenceStatusResponse').properties.state.enum,
  ['online', 'away', 'dnd', 'offline']
);

console.log('OpenAPI contract checks passed');
