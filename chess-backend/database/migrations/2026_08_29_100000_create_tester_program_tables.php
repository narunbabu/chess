<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tester_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->string('mobile', 32);
            $table->string('upi_id', 120);
            $table->text('reason')->nullable();
            $table->timestamp('consented_at')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('decline_reason')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index('user_id');
        });

        Schema::create('tester_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tester_application_id')->constrained('tester_applications')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('period', 7); // YYYY-MM, one report per app per month
            $table->string('app_name', 120);
            $table->string('test_link', 500);
            $table->text('feedback_summary');
            $table->unsignedSmallInteger('issue_count')->default(0);
            $table->enum('status', ['pending', 'approved', 'rejected', 'paid'])->default('pending');
            $table->decimal('payout_amount', 10, 2)->default(0);
            $table->text('reviewer_note')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('payout_processed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'period', 'app_name']);
            $table->index(['status', 'period']);
            $table->index('tester_application_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tester_submissions');
        Schema::dropIfExists('tester_applications');
    }
};
