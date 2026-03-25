import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const specPath = path.join(rootDir, 'openapi', 'openapi.json');
const outputPath = path.join(rootDir, 'src', 'api', 'openapi-contract.ts');

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

const schema = (name) => spec.components?.schemas?.[name];
const enumValues = (value, fallbackName) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Missing enum for ${fallbackName}`);
  }

  return value.map((entry) => JSON.stringify(entry)).join(', ');
};

const messageTypeEnum = enumValues(schema('MessageDoc')?.properties?.type?.enum, 'MessageDoc.type');
const uploadTypeEnum = enumValues(
  schema('Body_upload_media_messages_media_post')?.properties?.type?.enum,
  'Body_upload_media_messages_media_post.type'
);
const mediaKindEnum = enumValues(
  schema('MediaMeta')?.properties?.kind?.enum,
  'MediaMeta.kind'
);
const previewMediaKindEnum = enumValues(
  schema('Body_upload_media_messages_media_post')?.properties?.media_kind?.anyOf?.[0]?.enum,
  'Body_upload_media_messages_media_post.media_kind'
);
const replyModeEnum = enumValues(
  schema('SendTextMessageRequest')?.properties?.reply_mode?.anyOf?.[0]?.enum,
  'SendTextMessageRequest.reply_mode'
);
const messageStatusEnum = enumValues(schema('MessageDoc')?.properties?.status?.enum, 'MessageDoc.status');
const pingStatusEnum = enumValues(schema('PingResponse')?.properties?.status?.enum, 'PingResponse.status');
const callTypeEnum = enumValues(schema('CallDoc')?.properties?.type?.enum, 'CallDoc.type');
const callStatusEnum = enumValues(schema('CallDoc')?.properties?.status?.enum, 'CallDoc.status');
const discoveryViaEnum = enumValues(
  schema('DiscoveryUserSummary')?.properties?.discovered_via?.anyOf?.[0]?.enum,
  'DiscoveryUserSummary.discovered_via'
);

const output = `// Generated from openapi/openapi.json. Do not edit manually.
export const OPENAPI_MESSAGE_TYPES = [${messageTypeEnum}] as const;
export type OpenApiMessageType = (typeof OPENAPI_MESSAGE_TYPES)[number];

export const OPENAPI_MEDIA_UPLOAD_TYPES = [${uploadTypeEnum}] as const;
export type OpenApiMediaUploadType = (typeof OPENAPI_MEDIA_UPLOAD_TYPES)[number];

export const OPENAPI_MEDIA_KINDS = [${mediaKindEnum}] as const;
export type OpenApiMediaKind = (typeof OPENAPI_MEDIA_KINDS)[number];

export const OPENAPI_PREVIEW_MEDIA_KINDS = [${previewMediaKindEnum}] as const;
export type OpenApiPreviewMediaKind = (typeof OPENAPI_PREVIEW_MEDIA_KINDS)[number];

export const OPENAPI_REPLY_MODES = [${replyModeEnum}] as const;
export type OpenApiReplyMode = (typeof OPENAPI_REPLY_MODES)[number];

export const OPENAPI_MESSAGE_STATUSES = [${messageStatusEnum}] as const;
export type OpenApiMessageStatus = (typeof OPENAPI_MESSAGE_STATUSES)[number];

export const OPENAPI_PING_STATUSES = [${pingStatusEnum}] as const;
export type OpenApiPingStatus = (typeof OPENAPI_PING_STATUSES)[number];

export const OPENAPI_CALL_TYPES = [${callTypeEnum}] as const;
export type OpenApiCallType = (typeof OPENAPI_CALL_TYPES)[number];

export const OPENAPI_CALL_STATUSES = [${callStatusEnum}] as const;
export type OpenApiCallStatus = (typeof OPENAPI_CALL_STATUSES)[number];

export const OPENAPI_DISCOVERY_VIA = [${discoveryViaEnum}] as const;
export type OpenApiDiscoveryVia = (typeof OPENAPI_DISCOVERY_VIA)[number];
`;

fs.writeFileSync(outputPath, output);
console.log(`Wrote ${path.relative(rootDir, outputPath)}`);
