<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('referral_earnings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referral_code_id')->constrained()->cascadeOnDelete();
            $table->foreignId('referrer_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('referred_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('subscription_payment_id')->constrained('subscription_payments')->cascadeOnDelete();
            $table->decimal('payment_amount', 10, 2); // original payment amount
            $table->decimal('commission_rate', 5, 4)->default(0.1000); // 10%
            $table->decimal('earning_amount', 10, 2); // calculated: payment_amount * commission_rate
            $table->string('currency', 3)->default('INR');
            $table->enum('status', ['pending', 'approved', 'paid', 'cancelled'])->default('pending');
            $table->foreignId('payout_id')->nullable(); // linked when included in a payout
            $table->timestamps();

            $table->index(['referrer_user_id', 'status']);
            $table->index(['payout_id']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_earnings');
    }
};
