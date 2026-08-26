export type OtpChannel = 'EMAIL' | 'MOBILE';

export type OtpPurpose =
  | 'LOGIN'
  | 'REGISTRATION'
  | 'VERIFY_EMAIL'
  | 'VERIFY_MOBILE'
  | 'PASSWORD_RESET'
  | 'CHANGE_EMAIL'
  | 'CHANGE_MOBILE'
  | 'STEP_UP_AUTH';

export const ALLOWED_OTP_PURPOSES: readonly OtpPurpose[] = [
  'LOGIN',
  'REGISTRATION',
  'VERIFY_EMAIL',
  'VERIFY_MOBILE',
  'PASSWORD_RESET',
  'CHANGE_EMAIL',
  'CHANGE_MOBILE',
  'STEP_UP_AUTH',
] as const;

export interface SendOtpParams {
  destination: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  code: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SendOtpResult {
  providerMessageId?: string;
  deliveryStatus?: string;
}

export interface OtpProvider {
  readonly name: string;
  sendOtp(params: SendOtpParams): Promise<SendOtpResult>;
}
