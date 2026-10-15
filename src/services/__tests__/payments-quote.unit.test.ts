import { PaymentsService } from '../payments.service';
import { AssetExchangeService } from '../assetExchange.service';
import pool from '../../config/database';
import { BookingModel } from '../../models/booking.model';
import { createError } from '../../middleware/errorHandler';
import { ErrorCode } from '../../errors/error-codes';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.mock('../../models/booking.model');

describe('PaymentsService - quote expiry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('proceeds with valid quote (< 30s old)', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-15T12:00:00Z'));

    // Mock quote created 10 seconds ago (valid)
    const validQuote = {
      id: 'quote-1',
      rate: '1.05',
      pathPaymentRequired: true,
      createdAt: new Date('2026-01-15T11:59:50Z'),
    };

    (AssetExchangeService.validateQuote as jest.Mock).mockResolvedValueOnce(validQuote);
    (BookingModel.findById as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      mentee_id: 'user-1',
      payment_status: 'pending',
    });
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    const result = await PaymentsService.initiatePayment({
      userId: 'user-1',
      bookingId: 'booking-1',
      amount: '100',
      currency: 'XLM',
      quoteId: 'quote-1',
    });

    expect(result.quote_id).toBe('quote-1');
    expect(result.quoted_rate).toBe('1.05');
    expect(result.path_payment).toBe(true);
  });

  it('throws error for expired quote (> 30s old)', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-15T12:00:00Z'));

    // Mock quote created 60 seconds ago (expired)
    const expiredQuote = {
      id: 'quote-2',
      rate: '1.05',
      pathPaymentRequired: true,
      createdAt: new Date('2026-01-15T11:59:00Z'),
    };

    (AssetExchangeService.validateQuote as jest.Mock).mockResolvedValueOnce(expiredQuote);
    (BookingModel.findById as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      mentee_id: 'user-1',
      payment_status: 'pending',
    });

    await expect(PaymentsService.initiatePayment({
      userId: 'user-1',
      bookingId: 'booking-1',
      amount: '100',
      currency: 'XLM',
      quoteId: 'quote-2',
    })).rejects.toThrow('Quote has expired or is invalid');
  });

  it('proceeds without path payment when quoteId is missing', async () => {
    (AssetExchangeService.validateQuote as jest.Mock).mockResolvedValueOnce(null);
    (BookingModel.findById as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      mentee_id: 'user-1',
      payment_status: 'pending',
    });
    (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

    const result = await PaymentsService.initiatePayment({
      userId: 'user-1',
      bookingId: 'booking-1',
      amount: '100',
      currency: 'XLM',
      // no quoteId
    });

    expect(result.quote_id).toBeNull();
    expect(result.quoted_rate).toBeNull();
    expect(result.path_payment).toBeFalsy();
  });
});