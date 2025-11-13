<?php

namespace App\Services;

use Razorpay\Api\Api;
use Razorpay\Api\Errors\SignatureVerificationError;
use App\Models\ChampionshipParticipant;
use App\Enums\PaymentStatus;
use Illuminate\Support\Facades\Log;

class RazorpayService
{
    private Api $api;

    public function __construct()
    {
        $this->api = new Api(
            config('services.razorpay.key_id'),
            config('services.razorpay.key_secret')
        );
    }

    /**
     * Create Razorpay order for championship entry fee
     *
     * @param float $amount Amount in INR
     * @param int $championshipId Championship ID
     * @param int $userId User ID
     * @return array Order details
     */
    public function createOrder(float $amount, int $championshipId, int $userId): array
    {
        try {
            // Convert amount to paise (smallest currency unit)
            $amountInPaise = (int)($amount * 100);

            $orderData = [
                'receipt' => 'champ_' . $championshipId . '_user_' . $userId . '_' . time(),
                'amount' => $amountInPaise,
                'currency' => 'INR',
                'notes' => [
                    'championship_id' => (string)$championshipId,
                    'user_id' => (string)$userId,
                    'type' => 'championship_entry_fee',
                ],
            ];

            $order = $this->api->order->create($orderData);

            Log::info('Razorpay order created', [
                'order_id' => $order['id'],
                'championship_id' => $championshipId,
                'user_id' => $userId,
                'amount' => $amount,
            ]);

            return [
                'order_id' => $order['id'],
                'amount' => $order['amount'],
                'currency' => $order['currency'],
                'key_id' => config('services.razorpay.key_id'),
            ];
        } catch (\Exception $e) {
            Log::error('Razorpay order creation failed', [
                'error' => $e->getMessage(),
                'championship_id' => $championshipId,
                'user_id' => $userId,
            ]);

            throw new \Exception('Failed to create payment order: ' . $e->getMessage());
        }
    }

    /**
     * Verify Razorpay payment signature
     *
     * @param array $attributes Payment attributes
     * @return bool
     */
    public function verifyPaymentSignature(array $attributes): bool
    {
        try {
            $this->api->utility->verifyPaymentSignature($attributes);
            return true;
        } catch (SignatureVerificationError $e) {
            Log::error('Razorpay signature verification failed', [
                'error' => $e->getMessage(),
                'order_id' => $attributes['razorpay_order_id'] ?? null,
            ]);
            return false;
        }
    }

    /**
     * Process successful payment
     *
     * @param ChampionshipParticipant $participant
     * @param string $razorpayPaymentId
     * @param string $razorpaySignature
     * @return void
     */
    public function processSuccessfulPayment(
        ChampionshipParticipant $participant,
        string $razorpayPaymentId,
        string $razorpaySignature
    ): void {
        try {
            // Fetch payment details from Razorpay
            $payment = $this->api->payment->fetch($razorpayPaymentId);

            // Verify payment status
            if ($payment['status'] !== 'captured' && $payment['status'] !== 'authorized') {
                throw new \Exception('Payment not successful. Status: ' . $payment['status']);
            }

            // Update participant record
            $participant->markAsPaid($razorpayPaymentId, $razorpaySignature);

            Log::info('Championship payment processed successfully', [
                'participant_id' => $participant->id,
                'championship_id' => $participant->championship_id,
                'user_id' => $participant->user_id,
                'payment_id' => $razorpayPaymentId,
                'amount' => $payment['amount'] / 100,
            ]);
        } catch (\Exception $e) {
            Log::error('Payment processing failed', [
                'error' => $e->getMessage(),
                'participant_id' => $participant->id,
                'payment_id' => $razorpayPaymentId,
            ]);

            throw $e;
        }
    }

    /**
     * Handle failed payment
     *
     * @param ChampionshipParticipant $participant
     * @param string|null $errorCode
     * @param string|null $errorDescription
     * @return void
     */
    public function handleFailedPayment(
        ChampionshipParticipant $participant,
        ?string $errorCode = null,
        ?string $errorDescription = null
    ): void {
        $participant->markAsFailed();

        Log::warning('Championship payment failed', [
            'participant_id' => $participant->id,
            'championship_id' => $participant->championship_id,
            'user_id' => $participant->user_id,
            'error_code' => $errorCode,
            'error_description' => $errorDescription,
        ]);
    }

    /**
     * Issue refund for a payment
     *
     * @param ChampionshipParticipant $participant
     * @param string $reason
     * @return array Refund details
     */
    public function issueRefund(ChampionshipParticipant $participant, string $reason = 'Championship cancelled'): array
    {
        if (!$participant->isPaid()) {
            throw new \Exception('Cannot refund unpaid participant');
        }

        try {
            $refund = $this->api->payment->fetch($participant->razorpay_payment_id)->refund([
                'amount' => (int)($participant->amount_paid * 100), // Full refund
                'notes' => [
                    'reason' => $reason,
                    'championship_id' => (string)$participant->championship_id,
                    'user_id' => (string)$participant->user_id,
                ],
            ]);

            // Update participant status
            $participant->markAsRefunded();

            Log::info('Championship payment refunded', [
                'participant_id' => $participant->id,
                'championship_id' => $participant->championship_id,
                'user_id' => $participant->user_id,
                'refund_id' => $refund['id'],
                'amount' => $participant->amount_paid,
                'reason' => $reason,
            ]);

            return [
                'refund_id' => $refund['id'],
                'amount' => $refund['amount'] / 100,
                'status' => $refund['status'],
            ];
        } catch (\Exception $e) {
            Log::error('Refund failed', [
                'error' => $e->getMessage(),
                'participant_id' => $participant->id,
                'payment_id' => $participant->razorpay_payment_id,
            ]);

            throw new \Exception('Failed to process refund: ' . $e->getMessage());
        }
    }

    /**
     * Verify webhook signature
     *
     * @param string $body Webhook body
     * @param string $signature Webhook signature
     * @return bool
     */
    public function verifyWebhookSignature(string $body, string $signature): bool
    {
        try {
            $webhookSecret = config('services.razorpay.webhook_secret');

            $expectedSignature = hash_hmac('sha256', $body, $webhookSecret);

            return hash_equals($expectedSignature, $signature);
        } catch (\Exception $e) {
            Log::error('Webhook signature verification failed', [
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Handle webhook payment captured event
     *
     * @param array $payload Webhook payload
     * @return void
     */
    public function handleWebhookPaymentCaptured(array $payload): void
    {
        try {
            $payment = $payload['payload']['payment']['entity'];
            $orderId = $payment['order_id'];

            // Find participant by order ID
            $participant = ChampionshipParticipant::where('razorpay_order_id', $orderId)->first();

            if (!$participant) {
                Log::warning('Participant not found for webhook payment', [
                    'order_id' => $orderId,
                    'payment_id' => $payment['id'],
                ]);
                return;
            }

            // If already completed, skip
            if ($participant->isPaid()) {
                Log::info('Payment already processed', [
                    'order_id' => $orderId,
                    'participant_id' => $participant->id,
                ]);
                return;
            }

            // Process payment
            $this->processSuccessfulPayment(
                $participant,
                $payment['id'],
                '' // Signature not available in webhook
            );

            Log::info('Webhook payment processed', [
                'order_id' => $orderId,
                'payment_id' => $payment['id'],
                'participant_id' => $participant->id,
            ]);
        } catch (\Exception $e) {
            Log::error('Webhook payment processing failed', [
                'error' => $e->getMessage(),
                'payload' => $payload,
            ]);

            throw $e;
        }
    }

    /**
     * Handle webhook payment failed event
     *
     * @param array $payload Webhook payload
     * @return void
     */
    public function handleWebhookPaymentFailed(array $payload): void
    {
        try {
            $payment = $payload['payload']['payment']['entity'];
            $orderId = $payment['order_id'];

            $participant = ChampionshipParticipant::where('razorpay_order_id', $orderId)->first();

            if (!$participant) {
                Log::warning('Participant not found for failed payment webhook', [
                    'order_id' => $orderId,
                ]);
                return;
            }

            $this->handleFailedPayment(
                $participant,
                $payment['error_code'] ?? null,
                $payment['error_description'] ?? null
            );

            Log::info('Webhook payment failure processed', [
                'order_id' => $orderId,
                'participant_id' => $participant->id,
            ]);
        } catch (\Exception $e) {
            Log::error('Webhook payment failure processing failed', [
                'error' => $e->getMessage(),
                'payload' => $payload,
            ]);
        }
    }
}
