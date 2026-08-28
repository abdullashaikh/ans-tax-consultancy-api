import crypto from 'crypto';
import { PaymentService } from '../../src/services/payment.service';

describe('Razorpay Standard Checkout & Payment Service', () => {
  const testSecret = 'AcPY7bRYMpYlZgAhEQU47zuK';
  const testOrderId = 'order_test_1234567890';
  const testPaymentId = 'pay_test_9876543210';

  describe('Signature Verification Algorithm', () => {
    it('should accurately generate and match valid HMAC-SHA256 signature', async () => {
      // Generate expected HMAC-SHA256 signature
      const validSignature = crypto
        .createHmac('sha256', testSecret)
        .update(`${testOrderId}|${testPaymentId}`)
        .digest('hex');

      const result = await PaymentService.verifyPayment({
        razorpay_order_id: testOrderId,
        razorpay_payment_id: testPaymentId,
        razorpay_signature: validSignature,
      });

      expect(result.verified).toBe(true);
      expect(result.order_id).toBe(testOrderId);
      expect(result.payment_id).toBe(testPaymentId);
    });

    it('should reject tampered or mismatched signature with 400 Bad Request', async () => {
      const tamperedSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

      await expect(
        PaymentService.verifyPayment({
          razorpay_order_id: testOrderId,
          razorpay_payment_id: testPaymentId,
          razorpay_signature: tamperedSignature,
        })
      ).rejects.toThrow('Payment verification failed. Invalid signature.');
    });

    it('should reject missing verification parameters', async () => {
      await expect(
        PaymentService.verifyPayment({
          razorpay_order_id: '',
          razorpay_payment_id: testPaymentId,
          razorpay_signature: 'dummy',
        })
      ).rejects.toThrow('Missing required payment verification parameters');
    });
  });

  describe('Minimum Amount Validation', () => {
    it('should reject orders with amount less than 100 paise (or < ₹1)', async () => {
      await expect(
        PaymentService.createOrder({
          amount: 0.5, // 50 paise
        })
      ).rejects.toThrow('Minimum payment amount is 100 paise');
    });
  });
});
