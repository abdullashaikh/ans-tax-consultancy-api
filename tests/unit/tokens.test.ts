import { TokenUtil } from '../../src/utils/tokens';
import { RoleName } from '../../src/constants/roles';
import { PermissionName } from '../../src/constants/permissions';

describe('TokenUtil', () => {
  const mockUser = {
    userId: 1,
    publicId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    email: 'client@example.com',
    roles: [RoleName.CLIENT],
    permissions: [PermissionName.APPLICATION_VIEW, PermissionName.DOCUMENT_UPLOAD],
  };

  it('should generate valid access and refresh tokens', () => {
    const { tokens, rawRefreshToken, refreshTokenHash, tokenId } = TokenUtil.generateAuthTokens(mockUser);

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(rawRefreshToken).toBe(tokens.refreshToken);
    expect(refreshTokenHash).toBeDefined();
    expect(tokenId).toBeDefined();
    expect(tokens.expiresIn).toBe(900); // 15 mins
  });

  it('should verify and decode valid access token', () => {
    const { tokens } = TokenUtil.generateAuthTokens(mockUser);
    const decoded = TokenUtil.verifyAccessToken(tokens.accessToken);

    expect(decoded.sub).toBe(mockUser.publicId);
    expect(decoded.userId).toBe(mockUser.userId);
    expect(decoded.email).toBe(mockUser.email);
    expect(decoded.roles).toEqual(mockUser.roles);
    expect(decoded.permissions).toEqual(mockUser.permissions);
    expect(decoded.type).toBe('access');
  });

  it('should verify and decode valid refresh token', () => {
    const { tokens, tokenId } = TokenUtil.generateAuthTokens(mockUser);
    const decoded = TokenUtil.verifyRefreshToken(tokens.refreshToken);

    expect(decoded.sub).toBe(mockUser.publicId);
    expect(decoded.userId).toBe(mockUser.userId);
    expect(decoded.tokenId).toBe(tokenId);
    expect(decoded.type).toBe('refresh');
  });

  it('should reject malformed or tampered tokens', () => {
    expect(() => TokenUtil.verifyAccessToken('invalid.token.string')).toThrow();
  });
});
