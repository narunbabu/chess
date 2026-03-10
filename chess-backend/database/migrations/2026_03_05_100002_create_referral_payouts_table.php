<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('referral_payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('referrer_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('period', 7); // e.g. "2026-03" (YYYY-MM)
            $table->decimal('total_amount', 10, 2);
            $table->string('currency', 3)->default('INR');
            $table->unsignedInteger('earnings_count')->default(0); // how many earnings in this payout
            $table->enum('status', ['pending', 'paid', 'cancelled'])->default('pending');
            $table->timestamp('paid_at')->nullable();
            $table->string('paid_by')->nullable(); // admin email who marked as paid
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['referrer_user_id', 'period']);
            $table->index(['status', 'period']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('referral_payouts');
    }
};
