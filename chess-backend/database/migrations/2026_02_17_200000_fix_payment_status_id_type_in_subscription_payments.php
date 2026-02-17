<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fix payment_status_id type: foreignId() created bigint unsigned,
     * but payment_statuses.id is tinyint unsigned (tinyIncrements).
     */
    public function up(): void
    {
        Schema::table('subscription_payments', function (Blueprint $table) {
            // Drop the existing foreign key first
            $table->dropForeign(['payment_status_id']);
        });

        // Change column type from bigint unsigned to tinyint unsigned
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->unsignedTinyInteger('payment_status_id')->change();
        });

        // Re-add the foreign key
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->foreign('payment_status_id')->references('id')->on('payment_statuses');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->dropForeign(['payment_status_id']);
        });

        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->unsignedBigInteger('payment_status_id')->change();
        });

        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->foreign('payment_status_id')->references('id')->on('payment_statuses');
        });
    }
};
