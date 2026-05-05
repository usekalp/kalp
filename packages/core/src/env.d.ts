/**
 * Ambient type declarations for the core package.
 *
 * Core is infrastructure-agnostic. These declarations provide the minimal
 * global types required by the engine without pulling in DOM or CF-specific libs.
 *
 * These types exist in every JS runtime that Kalp targets
 * (Cloudflare Workers, Node 18+, Bun, Deno).
 */

/* eslint-disable no-var */

// ── Crypto ──────────────────────────────────────────────────────────────────

declare var crypto: {
  randomUUID(): `${string}-${string}-${string}-${string}-${string}`;
};

// ── Fetch API (WinterCG-compatible subset) ──────────────────────────────────

declare class URL {
  constructor(input: string, base?: string | URL);
  readonly href: string;
  readonly origin: string;
  readonly protocol: string;
  readonly host: string;
  readonly hostname: string;
  readonly port: string;
  readonly pathname: string;
  readonly search: string;
  readonly searchParams: URLSearchParams;
  readonly hash: string;
  toString(): string;
  toJSON(): string;
  static createObjectURL(blob: Blob): string;
  static revokeObjectURL(url: string): void;
}

declare class URLSearchParams implements Iterable<[string, string]> {
  constructor(init?: string | Record<string, string> | [string, string][]);
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  getAll(name: string): string[];
  has(name: string): boolean;
  set(name: string, value: string): void;
  toString(): string;
  entries(): IterableIterator<[string, string]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
  [Symbol.iterator](): IterableIterator<[string, string]>;
}

declare class Headers implements Iterable<[string, string]> {
  constructor(init?: HeadersInit);
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  has(name: string): boolean;
  set(name: string, value: string): void;
  entries(): IterableIterator<[string, string]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
  forEach(
    callback: (value: string, key: string, parent: Headers) => void,
  ): void;
  [Symbol.iterator](): IterableIterator<[string, string]>;
}

type HeadersInit = Headers | Record<string, string> | [string, string][];

interface RequestInit {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  signal?: AbortSignal;
  redirect?: "follow" | "error" | "manual";
}

type BodyInit =
  | string
  | ArrayBuffer
  | Uint8Array
  | ReadableStream
  | FormData
  | URLSearchParams
  | Blob;

declare class Request {
  constructor(input: string | URL | Request, init?: RequestInit);
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: ReadableStream | null;
  readonly bodyUsed: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  clone(): Request;
}

interface ResponseInit {
  status?: number;
  statusText?: string;
  headers?: HeadersInit;
}

declare class Response {
  constructor(body?: BodyInit | null, init?: ResponseInit);
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: Headers;
  readonly body: ReadableStream | null;
  readonly bodyUsed: boolean;
  json(): Promise<unknown>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  clone(): Response;
  static json(data: unknown, init?: ResponseInit): Response;
  static redirect(url: string, status?: number): Response;
}

declare class Blob {
  constructor(parts?: BlobPart[], options?: BlobPropertyBag);
  readonly size: number;
  readonly type: string;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  slice(start?: number, end?: number, contentType?: string): Blob;
}

type BlobPart = string | ArrayBuffer | Uint8Array | Blob;

interface BlobPropertyBag {
  type?: string;
}

declare function fetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response>;
