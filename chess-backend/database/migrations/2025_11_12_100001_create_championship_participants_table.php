<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('championship_participants')) {
            return;
        }

        // Create payment_statuses lookup table
        Schema::create('payment_statuses', function (Blueprint $table) {
            $table->tinyIncrements('id');
            $table->string('code', 32)->unique()->comment('Machine-readable status code');
            $table->string('label', 50)->comment('Human-readable label');
            $table->timestamps();
        });

        // Seed payment status values
        DB::table('payment_statuses')->insert([
            ['code' => 'pending', 'label' => 'Pending', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'completed', 'label' => 'Completed', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'failed', 'label' => 'Failed', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'refunded', 'label' => 'Refunded', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Create championship_participants table
        Schema::create('championship_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('championship_id')->constrained('championships')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');

            // Razorpay payment details
            $table->string('razorpay_order_id', 255)->nullable();
            $table->string('razorpay_payment_id', 255)->nullable();
            $table->string('razorpay_signature', 512)->nullable();

            // Payment status using lookup table
            $table->unsignedTinyInteger('payment_status_id')->default(1);
            $table->foreign('payment_status_id')->references('id')->on('payment_statuses')->onDelete('restrict');

            $table->decimal('amount_paid', 10, 2)->default(0);
            $table->dateTime('registered_at')->useCurrent();
            $table->unsignedInteger('seed_number')->nullable()->comment('Seeding for elimination bracket');

            $table->timestamps();

            // Unique constraint - one registration per user per championship
            $table->unique(['championship_id', 'user_id']);

            // Indexes
            $table->index('championship_id');
            $table->index('user_id');
            $table->index('payment_status_id');
            $table->index('razorpay_order_id');
            $table->index('razorpay_payment_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('championship_participants');
        Schema::dropIfExists('payment_statuses');
    }
};
