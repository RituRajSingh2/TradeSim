import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// ============================================================
// ssrf-protection.middleware.ts
//
// Blocks Server-Side Request Forgery by refusing any request
// where a URL query param or body field resolves to:
//   - Loopback (127.x.x.x, ::1)
//   - Private LAN ranges (10.x, 172.16-31.x, 192.168.x)
//   - Link-local (169.254.x)
//   - Metadata endpoints (169.254.169.254 — AWS/GCP/Azure IMDS)
//
// This middleware is applied only to routes that accept
// user-supplied URLs (e.g. webhook callbacks, image proxies).
// It does NOT intercept internal NestJS provider fetches,
// which use hardcoded allowlisted hostnames.
// ============================================================

const PRIVATE_IP_PATTERNS = [
  /^127\./,                    // IPv4 loopback
  /^10\./,                     // Class A private
  /^192\.168\./,               // Class C private
  /^172\.(1[6-9]|2\d|3[01])\./, // Class B private (172.16-31.x)
  /^169\.254\./,               // Link-local / APIPA / cloud metadata
  /^::1$/,                     // IPv6 loopback
  /^fc00:/i,                   // IPv6 unique-local
  /^fe80:/i,                   // IPv6 link-local
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal',
  '169.254.169.254',           // AWS / GCP / Azure IMDS endpoint
  '100.100.100.200',           // Alibaba Cloud IMDS
];

function isPrivateOrBlocked(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Explicit hostname blocklist
    if (BLOCKED_HOSTNAMES.includes(hostname)) return true;

    // Pattern-based private IP check
    if (PRIVATE_IP_PATTERNS.some(p => p.test(hostname))) return true;
  } catch {
    // Unparseable URL — treat as suspicious
    return true;
  }
  return false;
}

@Injectable()
export class SsrfProtectionMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    // Check query params for URL-like values
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
        if (isPrivateOrBlocked(value)) {
          throw new BadRequestException(
            `SSRF Protection: query param '${key}' points to a private/internal address`,
          );
        }
      }
    }

    // Check body for URL-like values (shallow scan, depth-1 only)
    if (req.body && typeof req.body === 'object') {
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
          if (isPrivateOrBlocked(value)) {
            throw new BadRequestException(
              `SSRF Protection: body field '${key}' points to a private/internal address`,
            );
          }
        }
      }
    }

    next();
  }
}
