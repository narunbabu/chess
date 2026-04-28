<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->string('status', 20)->default('approved')->after('is_active');
            $table->unsignedBigInteger('requested_by')->nullable()->after('created_by');
            $table->string('city', 100)->nullable()->after('website');
            $table->string('state', 100)->nullable()->after('city');

            $table->foreign('requested_by')->references('id')->on('users')->nullOnDelete();
        });

        // Existing orgs are already approved
        DB::table('organizations')->update(['status' => 'approved']);
    }

    public function down(): void
    {
        Schema::table('organizations', function (Blueprint $table) {
            $table->dropForeign(['requested_by']);
            $table->dropColumn(['status', 'requested_by', 'city', 'state']);
        });
    }
};
