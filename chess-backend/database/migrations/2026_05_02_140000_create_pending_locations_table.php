<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pending_locations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('level', 20);
            $table->string('name', 160);
            $table->foreignId('country_id')->nullable()->constrained('countries')->nullOnDelete();
            $table->foreignId('state_id')->nullable()->constrained('states')->nullOnDelete();
            $table->foreignId('district_id')->nullable()->constrained('districts')->nullOnDelete();
            $table->foreignId('mandal_id')->nullable()->constrained('mandals')->nullOnDelete();
            $table->string('status', 20)->default('pending')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('reject_reason', 500)->nullable();
            $table->unsignedBigInteger('created_place_id')->nullable();
            $table->timestamps();

            $table->index(['level', 'status']);
            $table->index(['level', 'name']);
            $table->index(['country_id', 'state_id', 'district_id', 'mandal_id'], 'pending_locations_parent_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pending_locations');
    }
};
