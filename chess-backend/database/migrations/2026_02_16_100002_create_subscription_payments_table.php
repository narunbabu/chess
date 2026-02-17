<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('subscription_plan_id')->constrained('subscription_plans');
            $table->string('razorpay_subscription_id', 255)->nullable();
            $table->string('razorpay_payment_id', 255)->nullable()->unique();
            $table->string('razorpay_order_id', 255)->nullable();
            $table->string('razorpay_signature', 255)->nullable();
            $table->unsignedTinyInteger('payment_status_id');
            $table->foreign('payment_status_id')->references('id')->on('payment_statuses');
            $table->decimal('amount', 10, 2);
            $table->string('currency', 3)->default('INR');
            $table->string('interval', 20)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('period_start')->nullable();
            $table->timestamp('period_end')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index('razorpay_subscription_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_payments');
    }
};
