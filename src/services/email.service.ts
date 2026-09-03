import { env } from '../config/env';
import { logger } from '../config/logger';

export interface ConsultationLeadEmailData {
  leadId?: number;
  publicId?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  serviceId?: number | null;
  serviceName?: string | null;
  serviceInterest?: string | null;
  businessType?: string | null;
  city?: string | null;
  message?: string | null;
  source?: string | null;
  createdAt?: Date | string;
}

export class EmailService {
  private static readonly RESEND_API_URL = 'https://api.resend.com/emails';

  /**
   * Dispatches an executive email notification to firm partners/advisors
   * when a new consultation inquiry or lead is received.
   */
  static async sendConsultationNotification(data: ConsultationLeadEmailData): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY || env.RESEND_API_KEY;
    const fromAddress = process.env.EMAIL_FROM || env.EMAIL_FROM || 'noreply@anstaxconsultancy.com';
    const toAddress =
      process.env.LEAD_NOTIFICATION_EMAIL ||
      env.LEAD_NOTIFICATION_EMAIL ||
      'info@anstaxconsultancy.com';

    if (!apiKey) {
      logger.warn('[EmailService] RESEND_API_KEY not configured. Simulated consultation notification email:', {
        to: toAddress,
        lead: data.name,
      });
      return false;
    }

    const serviceDisplay =
      data.serviceName ||
      data.serviceInterest ||
      'General Corporate & Tax Advisory';

    const cleanPhone = (data.phone || '').replace(/[^0-9+]/g, '');
    const whatsAppUrl = cleanPhone
      ? `https://wa.me/${cleanPhone.replace('+', '')}`
      : null;

    const subject = `🔔 New Consultation Request: ${data.name} — ${serviceDisplay}`;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08); overflow: hidden;" cellspacing="0" cellpadding="0">
          
          <!-- Top Header Brand -->
          <tr>
            <td style="background-color: #0b1429; padding: 28px 32px; border-bottom: 3px solid #d97706; text-align: left;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">
                      ANS <span style="color: #f59e0b;">Tax Consultancy</span>
                    </h1>
                    <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 12px; font-weight: 500; letter-spacing: 0.5px;">
                      CHARTERED ADVISORY &amp; CORPORATE TAX PRACTICE
                    </p>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #fbbf24; font-size: 11px; font-weight: 700; padding: 6px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">
                      ⚡ New Inquiry
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Notice Banner -->
          <tr>
            <td style="background-color: #fffbeb; padding: 14px 32px; border-bottom: 1px solid #fef3c7;">
              <p style="margin: 0; color: #92400e; font-size: 13px; font-weight: 600;">
                📅 A prospective client has booked a consultation session via the web portal.
              </p>
            </td>
          </tr>

          <!-- Main Details -->
          <tr>
            <td style="padding: 28px 32px 20px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 18px; font-weight: 800;">
                Consultation Request Details
              </h2>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 700; width: 35%; text-transform: uppercase;">
                    Client Name
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 800;">
                    ${data.name}
                  </td>
                </tr>

                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                    Phone Number
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 700;">
                    ${data.phone ? `<a href="tel:${cleanPhone}" style="color: #0284c7; text-decoration: none;">${data.phone}</a>` : '<span style="color: #94a3b8;">Not provided</span>'}
                  </td>
                </tr>

                <tr style="background-color: #f8fafc;">
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                    Email Address
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 700;">
                    ${data.email ? `<a href="mailto:${data.email}" style="color: #0284c7; text-decoration: none;">${data.email}</a>` : '<span style="color: #94a3b8;">Not provided</span>'}
                  </td>
                </tr>

                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                    Service Practice
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #b45309; font-size: 14px; font-weight: 800;">
                    ${serviceDisplay}
                  </td>
                </tr>

                ${data.businessType ? `
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                    Business / Turnover
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 13px; font-weight: 600;">
                    ${data.businessType}
                  </td>
                </tr>` : ''}

                ${data.city ? `
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                    Location / City
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 13px; font-weight: 600;">
                    ${data.city}
                  </td>
                </tr>` : ''}

                <tr style="background-color: #f8fafc;">
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                    Lead Source
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 12px; font-weight: 600;">
                    ${data.source || 'WEBSITE'}
                  </td>
                </tr>

                ${data.message ? `
                <tr>
                  <td style="padding: 12px 16px; color: #64748b; font-size: 12px; font-weight: 700; vertical-align: top; text-transform: uppercase;">
                    Scope / Requirement
                  </td>
                  <td style="padding: 12px 16px; color: #1e293b; font-size: 13px; line-height: 1.6; white-space: pre-wrap;">
                    ${data.message}
                  </td>
                </tr>` : ''}
              </table>

              <!-- Direct Action Buttons -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top: 8px; margin-bottom: 24px;">
                <tr>
                  ${data.phone ? `
                  <td style="padding-right: 8px;">
                    <a href="tel:${cleanPhone}" style="display: block; text-align: center; background-color: #0f172a; color: #ffffff; padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none;">
                      📞 Call Client
                    </a>
                  </td>` : ''}
                  ${whatsAppUrl ? `
                  <td style="padding-right: 8px;">
                    <a href="${whatsAppUrl}" target="_blank" style="display: block; text-align: center; background-color: #059669; color: #ffffff; padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none;">
                      💬 WhatsApp
                    </a>
                  </td>` : ''}
                  ${data.email ? `
                  <td>
                    <a href="mailto:${data.email}?subject=Regarding%20Your%20Consultation%20Request%20-%20ANS%20Tax%20Consultancy" style="display: block; text-align: center; background-color: #d97706; color: #ffffff; padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; text-decoration: none;">
                      ✉️ Reply Email
                    </a>
                  </td>` : ''}
                </tr>
              </table>

              <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                ⚡ ANS Advisory SLA: Connect with high-value leads within 2 business hours for optimum client conversion.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">
                ANS Tax Consultancy &bull; Automated Dispatch &bull; info@anstaxconsultancy.com
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

    const textContent = `
NEW CONSULTATION REQUEST
====================================
Client Name: ${data.name}
Phone: ${data.phone || 'N/A'}
Email: ${data.email || 'N/A'}
Service: ${serviceDisplay}
Entity/Turnover: ${data.businessType || 'N/A'}
Location: ${data.city || 'N/A'}
Source: ${data.source || 'WEBSITE'}
Requirement: ${data.message || 'N/A'}
`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(this.RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [toAddress],
          subject,
          html,
          text: textContent,
        }),
        signal: controller.signal,
      });

      const resData: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        logger.error('[EmailService] Lead notification email dispatch failed', {
          status: response.status,
          error: resData,
          to: toAddress,
        });
        return false;
      }

      logger.info('[EmailService] Lead notification email sent successfully', {
        id: resData.id,
        to: toAddress,
        leadName: data.name,
      });
      return true;
    } catch (error: any) {
      logger.error('[EmailService] Unexpected error sending lead notification email', {
        error: error.message,
      });
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
