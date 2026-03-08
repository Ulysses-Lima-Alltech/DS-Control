/**
 * Enum representing common HTTP status codes.
 * 
 * @enum {number}
 * @readonly
 * @property {number} OK - The request has succeeded (200).
 * @property {number} CREATED - The request has been fulfilled and has resulted in one or more new resources being created (201).
 * @property {number} NO_CONTENT - The server has successfully fulfilled the request and there is no additional content to send (204).
 * @property {number} BAD_REQUEST - The server cannot or will not process the request due to a client error (400).
 * @property {number} UNAUTHORIZED - The request requires user authentication (401).
 * @property {number} FORBIDDEN - The server understood the request, but refuses to authorize it (403).
 * @property {number} NOT_FOUND - The server has not found anything matching the request URI (404).
 * @property {number} CONFLICT - The request could not be completed due to a conflict with the current state of the target resource (409).
 * @property {number} TOO_MANY_REQUESTS - The user has sent too many requests in a given amount of time, resulting in rate limiting (429).
 * @property {number} INTERNAL_SERVER_ERROR - The server encountered an unexpected condition that prevented it from fulfilling the request (500).
 * @property {number} SERVICE_UNAVAILABLE - The server is currently unable to handle the request due to temporary overload or scheduled maintenance (503).
 * @property {number} GATEWAY_TIMEOUT - The server, while acting as a gateway or proxy, did not receive a timely response from an upstream server (504).
 */
export enum HTTP_STATUS_CODES {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}