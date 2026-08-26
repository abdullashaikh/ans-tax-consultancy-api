import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { OtpService } from '../services/otp/otp.service';
import { ResponseFormatter } from '../utils/apiResponse';
import { getRefreshTokenCookieOptions, getClearCookieOptions } from '../config/security';
import { AuditService } from '../middleware/audit.middleware';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.register({
        ...req.body,
        ipAddress,
        userAgent,
      });

      // Set HttpOnly refresh token cookie
      res.cookie('refresh_token', result.rawRefreshToken, getRefreshTokenCookieOptions());

      ResponseFormatter.created(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      }, 'Account registered successfully');
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.login({
        email: req.body.email,
        password: req.body.password,
        ipAddress,
        userAgent,
      });

      res.cookie('refresh_token', result.rawRefreshToken, getRefreshTokenCookieOptions());

      ResponseFormatter.success(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      }, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Look in cookie or request body
      const refreshToken = req.cookies?.['refresh_token'] || req.body.refreshToken;
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.refresh({
        refreshToken,
        ipAddress,
        userAgent,
      });

      res.cookie('refresh_token', result.rawRefreshToken, getRefreshTokenCookieOptions());

      ResponseFormatter.success(res, {
        user: result.user,
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
      }, 'Token refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie('refresh_token', getClearCookieOptions());
      res.clearCookie('access_token', getClearCookieOptions());
      ResponseFormatter.success(res, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      const result = await AuthService.forgotPassword(req.body.email, ipAddress, userAgent);
      ResponseFormatter.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];
      await AuthService.resetPassword({
        challengeId: req.body.challengeId,
        otp: req.body.otp,
        token: req.body.token,
        newPassword: req.body.newPassword,
        ipAddress,
        userAgent,
      });
      ResponseFormatter.success(res, null, 'Password reset successful. Please log in with your new password.');
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await AuthService.getMe(req.user!.id);
      ResponseFormatter.success(res, user);
    } catch (error) {
      next(error);
    }
  }

  static async requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const result = await OtpService.requestOtp({
        identifier: req.body.identifier,
        channel: req.body.channel,
        purpose: req.body.purpose || 'LOGIN',
        ipAddress,
        userAgent,
      });

      ResponseFormatter.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const result = await OtpService.verifyOtp({
        challengeId: req.body.challengeId,
        otp: req.body.otp,
        ipAddress,
        userAgent,
      });

      if (result.tokens && result.rawRefreshToken) {
        res.cookie('refresh_token', result.rawRefreshToken, getRefreshTokenCookieOptions());

        ResponseFormatter.success(
          res,
          {
            user: result.user,
            accessToken: result.tokens.accessToken,
            expiresIn: result.tokens.expiresIn,
            verified: true,
          },
          result.message
        );
      } else {
        ResponseFormatter.success(
          res,
          {
            verified: result.verified,
          },
          result.message
        );
      }
    } catch (error) {
      next(error);
    }
  }

  static async resendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ipAddress = AuditService.getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const result = await OtpService.resendOtp({
        challengeId: req.body.challengeId,
        ipAddress,
        userAgent,
      });

      ResponseFormatter.success(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }
}
