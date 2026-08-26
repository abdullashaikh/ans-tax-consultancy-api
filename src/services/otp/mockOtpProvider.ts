import { OtpProvider, SendOtpParams, SendOtpResult } from './otpProvider.interface';

export class MockOtpProvider implements OtpProvider {
  readonly name = 'MOCK';

  public sentOtps: Array<{ destination: string; channel: string; purpose: string; code: string; timestamp: Date }> = [];
  public shouldFailSend: boolean = false;
  public shouldTimeout: boolean = false;

  async sendOtp(params: SendOtpParams): Promise<SendOtpResult> {
    if (this.shouldTimeout) {
      const err = new Error('Mock timeout error');
      err.name = 'AbortError';
      throw err;
    }
    if (this.shouldFailSend) {
      throw new Error('Mock send failure');
    }

    this.sentOtps.push({
      destination: params.destination,
      channel: params.channel,
      purpose: params.purpose,
      code: params.code,
      timestamp: new Date(),
    });

    return {
      providerMessageId: `mock-msg-${Date.now()}`,
      deliveryStatus: 'DELIVERED',
    };
  }

  clear(): void {
    this.sentOtps = [];
    this.shouldFailSend = false;
    this.shouldTimeout = false;
  }
}
