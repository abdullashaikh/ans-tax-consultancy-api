import { OtpProvider, SendOtpParams, SendOtpResult } from './otpProvider.interface';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/apiError';
import { ErrorCodes } from '../../constants/errorCodes';

export class ResendOtpProvider implements OtpProvider {
  readonly name = 'RESEND';

  private readonly resendApiUrl = 'https://api.resend.com/emails';

  /**
   * Generates a clean, branded HTML email template for ANS Tax Consultancy OTP delivery.
   */
  private generateEmailHtml(code: string, purpose: string): string {
    const purposeText =
      purpose === 'LOGIN'
        ? 'Client Portal Login'
        : purpose === 'REGISTRATION'
        ? 'Account Registration'
        : purpose === 'PASSWORD_RESET'
        ? 'Password Reset'
        : 'Identity Verification';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ANS Tax Consultancy Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 28px 32px; text-align: center; border-bottom: 3px solid #d97706;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">
                ANS <span style="color: #f59e0b;">Tax Consultancy</span>
              </h1>
              <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; font-weight: 500;">
                Statutory Compliance &amp; Taxation Services
              </p>
            </td>
          </tr>
          
          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 17px; font-weight: 700;">
                Your Verification Code
              </h2>
              <p style="margin: 0 0 24px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                Use the following 6-digit verification code to complete your <strong>${purposeText}</strong> request on the ANS Client Portal:
              </p>
              
              <!-- OTP Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 2px dashed #f59e0b; border-radius: 12px; padding: 20px;">
                    <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #78350f; display: block; margin-left: 8px;">
                      ${code}
                    </span>
                  </td>
                </tr>
              </table>
              
              <!-- Security Notes -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; border-radius: 8px; padding: 14px 16px; margin: 0 0 24px 0;">
                <tr>
                  <td>
                    <p style="margin: 0; color: #64748b; font-size: 12px; line-height: 1.5;">
                      ⏱️ <strong>Valid for 5 minutes.</strong> Do not share this code with anyone. ANS Tax Consultancy staff will never ask for your verification code.
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                If you did not initiate this request, please ignore this email or contact support immediately.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                &copy; ${new Date().getFullYear()} ANS Tax Consultancy. 8/131, Khichri Pur, East Delhi, Delhi – 110091, India.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
  }

  /**
   * Dispatches Email OTP using Resend API.
   */
  async sendOtp(params: SendOtpParams): Promise<SendOtpResult> {
    if (params.channel !== 'EMAIL') {
      throw ApiError.badRequest('Resend provider only supports EMAIL channel.');
    }

    if (!env.RESEND_API_KEY) {
      logger.warn('[ResendOtpProvider] RESEND_API_KEY not configured. Running in simulated mode (logging OTP):', {
        destination: params.destination,
        code: params.code,
        purpose: params.purpose,
      });
      return {
        providerMessageId: `sim-resend-${Date.now()}`,
        deliveryStatus: 'SIMULATED',
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const fromAddress = env.EMAIL_FROM || 'ANS Tax Consultancy <onboarding@resend.dev>';
      const subject = `${params.code} is your ANS Tax Consultancy verification code`;
      const html = this.generateEmailHtml(params.code, params.purpose);

      const response = await fetch(this.resendApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [params.destination],
          subject,
          html,
          text: `Your ANS Tax Consultancy verification code is ${params.code}. It is valid for 5 minutes. Do not share this code with anyone.`,
        }),
        signal: controller.signal,
      });

      const data: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        logger.error('[ResendOtpProvider] Email dispatch failed', {
          status: response.status,
          error: data,
          recipient: params.destination,
        });

        throw ApiError.serviceUnavailable(
          data.message || 'Failed to send verification email. Please try again later.',
          ErrorCodes.INTERNAL_SERVER_ERROR
        );
      }

      logger.info('[ResendOtpProvider] Email OTP sent successfully', {
        id: data.id,
        recipient: params.destination,
      });

      return {
        providerMessageId: data.id || `resend-${Date.now()}`,
        deliveryStatus: 'SENT',
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.error('[ResendOtpProvider] Email dispatch timed out');
        throw ApiError.serviceUnavailable(
          'Email delivery timed out. Please try again.',
          ErrorCodes.INTERNAL_SERVER_ERROR
        );
      }
      if (error instanceof ApiError) throw error;

      logger.error('[ResendOtpProvider] Unexpected error during Resend email dispatch', {
        error: error.message,
      });
      throw ApiError.serviceUnavailable(
        'Email verification service is temporarily unavailable.',
        ErrorCodes.INTERNAL_SERVER_ERROR
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
