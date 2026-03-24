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

assert.equal(operationCount, 54, 'Unexpected number of OpenAPI operations');

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
  getJsonResponseRef('delete', '/messages/{message_id}', '200'),
  '#/components/schemas/SuccessResponse_DeleteMessageResponse_'
);
assert.equal(
  getJsonResponseRef('post', '/messages/{message_id}/reactions', '200'),
  '#/components/schemas/SuccessResponse_MessageDoc_'
);
assert.equal(
  getJsonResponseRef('post', '/pings/{ping_id}/cancel', '200'),
  '#/components/schemas/SuccessResponse_PingResponse_'
);
assert.equal(
  getJsonResponseRef('post', '/pings/block', '200'),
  '#/components/schemas/SuccessResponse_PingResponse_'
);
assert.equal(
  getJsonResponseRef('get', '/pings/blocked', '200'),
  '#/components/schemas/SuccessResponse_list_PingResponse__'
);
assert.equal(
  getJsonResponseRef('get', '/calls/active', '200'),
  '#/components/schemas/SuccessResponse_Union_CallSession__NoneType__'
);

assert.deepEqual(
  getSchema('MessageDoc').properties.type.enum,
  ['text', 'media', 'file']
);
assert.deepEqual(
  getSchema('Body_upload_media_messages_media_post').properties.type.enum,
  ['media', 'file']
);
assert.deepEqual(
  getSchema('MediaMeta').properties.kind.enum,
  ['voice', 'audio', 'image', 'video', 'file']
);
assert.deepEqual(
  getSchema('Body_upload_media_messages_media_post').properties.media_kind.anyOf[0].enum,
  ['voice', 'audio', 'image', 'video']
);
assert.deepEqual(
  getSchema('ReplyPreview').properties.type.enum,
  ['text', 'media', 'file']
);
assert.deepEqual(
  getSchema('ReplyPreview').properties.media_kind.anyOf[0].enum,
  ['voice', 'audio', 'image', 'video', 'file']
);

console.log('OpenAPI contract checks passed');
