<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->string('tier', 20);
            $table->string('name', 100);
            $table->string('interval', 20);
            $table->decimal('price', 10, 2)->default(0);
            $table->string('currency', 3)->default('INR');
            $table->string('razorpay_plan_id', 255)->nullable();
            $table->integer('undo_limit')->nullable();
            $table->boolean('ad_free')->default(false);
            $table->boolean('priority_matchmaking')->default(false);
            $table->boolean('can_create_tournaments')->default(false);
            $table->boolean('advanced_analytics')->default(false);
            $table->boolean('synthetic_opponents')->default(false);
            $table->json('features')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tier', 'interval']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_plans');
    }
};
