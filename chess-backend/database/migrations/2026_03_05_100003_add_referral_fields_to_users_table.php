<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use App\Models\User;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('referral_code', 20)->nullable()->unique()->after('role');
            $table->foreignId('referred_by_user_id')->nullable()->after('referral_code')
                  ->constrained('users')->nullOnDelete();
            $table->foreignId('referred_by_code_id')->nullable()->after('referred_by_user_id');
        });

        // Generate referral codes for all existing users
        User::whereNull('referral_code')->chunkById(100, function ($users) {
            foreach ($users as $user) {
                $user->update([
                    'referral_code' => strtoupper(Str::random(8)),
                ]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['referred_by_user_id']);
            $table->dropColumn(['referral_code', 'referred_by_user_id', 'referred_by_code_id']);
        });
    }
};
