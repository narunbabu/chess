<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('games', function (Blueprint $table) {
            // Resume request tracking
            $table->unsignedBigInteger('resume_requested_by')->nullable()->after('black_grace_time_ms');
            $table->timestamp('resume_requested_at')->nullable()->after('resume_requested_by');
            $table->timestamp('resume_request_expires_at')->nullable()->after('resume_requested_at');
            $table->enum('resume_status', ['none', 'pending', 'accepted', 'expired'])->default('none')->after('resume_request_expires_at');

            // Foreign key for resume_requested_by
            $table->foreign('resume_requested_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('games', function (Blueprint $table) {
            $table->dropForeign(['resume_requested_by']);
            $table->dropColumn([
                'resume_requested_by',
                'resume_requested_at',
                'resume_request_expires_at',
                'resume_status'
            ]);
        });
    }
};