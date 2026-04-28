<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('mobile_country_code', 8)->nullable()->after('email');
            $table->string('mobile_number', 30)->nullable()->after('mobile_country_code');
            $table->timestamp('mobile_verified_at')->nullable()->after('mobile_number');
            $table->timestamp('tournament_contact_consent_at')->nullable()->after('mobile_verified_at');
            $table->boolean('whatsapp_updates_opt_in')->default(false)->after('tournament_contact_consent_at');

            $table->index(['mobile_country_code', 'mobile_number'], 'users_mobile_compound_index');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_mobile_compound_index');
            $table->dropColumn([
                'mobile_country_code',
                'mobile_number',
                'mobile_verified_at',
                'tournament_contact_consent_at',
                'whatsapp_updates_opt_in',
            ]);
        });
    }
};
