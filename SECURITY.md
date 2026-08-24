# ANS Tax Consultancy — Backend Security Architecture (`SECURITY.md`)

> Comprehensive Security Reference for the `ans-tax-backend` REST API.

---

## 1. Security Philosophy & Threat Model

The backend API (`ans-tax-backend`) serves as the **central security boundary** of the ANS Tax Consultancy platform. Neither the public website (`ans-tax-website`) nor the private admin portal (`ans-tax-admin`) has direct database access.

### Core Security Tenets
1. **Zero Trust Network:** Every HTTP request is treated as untrusted, regardless of source IP.
2. **Defense in Depth:** Security is enforced at multiple layers: Network (TLS) → Gateway (Rate Limiter/Helmet/CORS) → Authentication (JWT) → Authorization (RBAC) → Object-Level (BOLA/IDOR) → Data Layer (Parameterized SQL & Transactions).
3. **Principle of Least Privilege:** Users receive minimum permissions necessary to complete tasks. Database users (`ans_api`) have limited DML/execution grants.
4. **Confidentiality of Tax Records:** Strict metadata isolation. Binary files are never stored in MySQL; access is granted via short-lived signed URLs (15-min expiry).

---

## 2. Authentication & Token Architecture

```
Client / Admin                   Backend API (ans-tax-backend)
      │                                       │
      │─── POST /api/v1/auth/login ──────────►│
      │    { email, password }                │ 1. Validate Zod Schema
      │                                       │ 2. Constant-time password check
      │                                       │ 3. Check status != SUSPENDED
      │                                       │ 4. Load Roles & Permissions
      │                                       │ 5. Generate Access & Refresh Tokens
      │◄── 200 OK ────────────────────────────│
      │    Body: { accessToken, expiresIn }   │
      │    Cookie: refresh_token (HttpOnly)   │
      │                                       │
      │─── GET /api/v1/applications ─────────►│
      │    Header: Authorization: Bearer ...  │ 1. Verify Access Token signature
      │                                       │ 2. Check Role / Permission
      │                                       │ 3. Enforce Object Ownership (IDOR)
      │◄── 200 OK { data: [...] } ────────────│
```

### 2.1 Token Specifications
- **Access Token:** Short-lived (15 minutes). Contains `{ sub: public_id, userId, roles, permissions, type: 'access' }`. Signed with HMAC-SHA256 (`JWT_ACCESS_SECRET`).
- **Refresh Token:** Long-lived (7 days). Contains `{ sub: public_id, userId, tokenId: uuidv4(), type: 'refresh' }`.
- **Storage:** Refresh tokens are delivered via `HttpOnly`, `Secure`, `SameSite=Lax` cookies scoped strictly to `/api/v1/auth`.
- **Replay/Reuse Detection:** Hashed (SHA-256) upon generation. Reusing a rotated refresh token immediately invalidates active sessions.

### 2.2 Account Enumeration Defense
- Failed logins return generic: `"Invalid email or password"`.
- Password reset requests always return: `"If the account exists, a password reset link has been sent."`
- Timing attacks are prevented by running a dummy bcrypt comparison when the user is not found.

---

## 3. Multi-Layer Authorization (RBAC + BOLA/IDOR)

### 3.1 Role Hierarchy
1. `SUPER_ADMIN`: Unrestricted platform access.
2. `ADMIN`: Full administrative operations and user management.
3. `CONSULTANT`: Professional management of assigned applications and client documents.
4. `STAFF`: Back-office coordination and appointment scheduling.
5. `CLIENT`: Self-service portal (own profile, applications, documents, payments).

### 3.2 Object-Level Authorization (IDOR Prevention)
In addition to role checks, `ObjectAuth` verifies resource ownership:
- **Clients:** Can only view/modify records where `client.user_id === req.user.id`.
- **Consultants:** Can only view/modify applications where `assigned_consultant_id === req.user.id` unless administrative permissions (`APPLICATION_VIEW`) are held.
- **Admins:** Governed by explicit permission tokens.

---

## 4. Input Validation & Mass Assignment Defense

- **Strict Zod Schemas:** Every request body, query parameter, and route path parameter is validated before reaching the controller.
- **Strip/Reject Extra Properties:** Unpermitted fields (such as `role`, `status`, `is_admin`, `assigned_consultant_id`) are stripped or rejected during parsing.
- **SQL Parameterization:** 100% of queries use prepared statements (`?` placeholders) with `mysql2/promise`. Dynamic sorting/filtering columns are strictly whitelisted against an allowed array.

---

## 5. File Upload & Storage Security

- **Metadata Only in MySQL:** The database stores file metadata (`storage_provider`, `storage_object_key`, `mime_type`, `file_size`, `checksum`).
- **Private Storage:** Binary objects are stored in private cloud buckets (AWS S3 / Google Cloud Storage).
- **Time-Limited Signed URLs:** Authorized users receive pre-signed URLs with a 15-minute expiration time (`SIGNED_URL_EXPIRY_SECONDS=900`).
- **MIME & Size Limits:** Strict upload restrictions (max 25MB, whitelist: PDF, JPEG, PNG, XLSX, DOCX, ZIP).

---

## 6. HTTP & Network Security

| Feature | Implementation |
|---------|----------------|
| **Security Headers** | Helmet with `noSniff`, `frameguard: { action: 'deny' }`, `xssFilter`, and strict CSP in production |
| **CORS Whitelist** | Explicit origin validation (`CORS_ORIGINS`). Wildcard `*` is strictly disallowed in production |
| **Tiered Rate Limiting** | Auth endpoints (10 req/15 min), Leads (15 req/15 min), General API (300 req/15 min), Uploads (30 req/15 min) |
| **Sensitive Route Cache Control** | `Cache-Control: no-store, no-cache, must-revalidate` on all user and financial endpoints |
| **Correlation Tracking** | Every request receives a unique `X-Request-ID` header attached to logs and error responses |

---

## 7. Audit Logging & Compliance

The `audit_logs` table provides an immutable journal for security and business events:
- User logins / logouts / failures
- Client profile creation & updates
- Application status transitions & consultant assignments
- Document uploads, verifications, and signed URL downloads
- Payment creation and gateway webhook updates

> **Sensitive Data Redaction:** Passwords, tokens, cookies, OTPs, CVVs, card numbers, and secret keys are automatically redacted (`[REDACTED]`) from logs and audit records.

---

## 8. Incident Response & Security Vulnerability Reporting

If you discover a security issue or vulnerability, please contact:
- **Email:** `security@anstaxconsultancy.com`
- **PGP Key:** Available upon request
