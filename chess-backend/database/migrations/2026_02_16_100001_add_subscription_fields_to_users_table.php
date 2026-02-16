<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('subscription_tier', 20)->default('free')->after('email_unsubscribed_at');
            $table->timestamp('subscription_expires_at')->nullable()->after('subscription_tier');
            $table->string('razorpay_subscription_id', 255)->nullable()->after('subscription_expires_at');
            $table->string('razorpay_customer_id', 255)->nullable()->after('razorpay_subscription_id');
            $table->boolean('subscription_auto_renew')->default(true)->after('razorpay_customer_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'subscription_tier',
                'subscription_expires_at',
                'razorpay_subscription_id',
                'razorpay_customer_id',
                'subscription_auto_renew',
            ]);
        });
    }
};
