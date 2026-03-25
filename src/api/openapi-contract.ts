// Generated from openapi/openapi.json. Do not edit manually.
export const OPENAPI_MESSAGE_TYPES = ["text", "media", "file"] as const;
export type OpenApiMessageType = (typeof OPENAPI_MESSAGE_TYPES)[number];

export const OPENAPI_MEDIA_UPLOAD_TYPES = ["media", "file"] as const;
export type OpenApiMediaUploadType = (typeof OPENAPI_MEDIA_UPLOAD_TYPES)[number];

export const OPENAPI_MEDIA_KINDS = ["voice", "audio", "image", "video", "file"] as const;
export type OpenApiMediaKind = (typeof OPENAPI_MEDIA_KINDS)[number];

export const OPENAPI_PREVIEW_MEDIA_KINDS = ["voice", "audio", "image", "video"] as const;
export type OpenApiPreviewMediaKind = (typeof OPENAPI_PREVIEW_MEDIA_KINDS)[number];

export const OPENAPI_REPLY_MODES = ["quote", "thread"] as const;
export type OpenApiReplyMode = (typeof OPENAPI_REPLY_MODES)[number];

export const OPENAPI_MESSAGE_STATUSES = ["sent", "delivered", "read"] as const;
export type OpenApiMessageStatus = (typeof OPENAPI_MESSAGE_STATUSES)[number];

export const OPENAPI_PING_STATUSES = ["pending", "accepted", "declined", "cancelled", "expired", "blocked"] as const;
export type OpenApiPingStatus = (typeof OPENAPI_PING_STATUSES)[number];

export const OPENAPI_CALL_TYPES = ["audio", "video"] as const;
export type OpenApiCallType = (typeof OPENAPI_CALL_TYPES)[number];

export const OPENAPI_CALL_STATUSES = ["ringing", "accepted", "connecting", "active", "reconnecting", "rejected", "cancelled", "expired", "ended"] as const;
export type OpenApiCallStatus = (typeof OPENAPI_CALL_STATUSES)[number];

export const OPENAPI_DISCOVERY_VIA = ["username", "code", "link"] as const;
export type OpenApiDiscoveryVia = (typeof OPENAPI_DISCOVERY_VIA)[number];
