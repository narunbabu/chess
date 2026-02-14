<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('email_notifications_enabled')->default(true)->after('last_activity_date');
            $table->json('email_preferences')->nullable()->after('email_notifications_enabled');
            $table->timestamp('email_unsubscribed_at')->nullable()->after('email_preferences');
            $table->timestamp('last_email_sent_at')->nullable()->after('email_unsubscribed_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'email_notifications_enabled',
                'email_preferences',
                'email_unsubscribed_at',
                'last_email_sent_at',
            ]);
        });
    }
};
