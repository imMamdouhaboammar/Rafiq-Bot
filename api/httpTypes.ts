import type { IncomingMessage, ServerResponse } from 'node:http';

export type ApiRequest = IncomingMessage & {
  body?: any;
};

export type ApiResponse = ServerResponse & {
  status(code: number): ApiResponse;
  json(payload: unknown): ApiResponse;
  flush?: () => void;
};
