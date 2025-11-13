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
        if (Schema::hasTable('championships')) {
            return;
        }

        // Create championship_statuses lookup table
        Schema::create('championship_statuses', function (Blueprint $table) {
            $table->tinyIncrements('id');
            $table->string('code', 32)->unique()->comment('Machine-readable status code');
            $table->string('label', 50)->comment('Human-readable label');
            $table->timestamps();
        });

        // Seed championship status values
        DB::table('championship_statuses')->insert([
            ['code' => 'upcoming', 'label' => 'Upcoming', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'registration_open', 'label' => 'Registration Open', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'in_progress', 'label' => 'In Progress', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'completed', 'label' => 'Completed', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'cancelled', 'label' => 'Cancelled', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Create championship_formats lookup table
        Schema::create('championship_formats', function (Blueprint $table) {
            $table->tinyIncrements('id');
            $table->string('code', 32)->unique()->comment('Machine-readable format code');
            $table->string('label', 50)->comment('Human-readable label');
            $table->timestamps();
        });

        // Seed championship format values
        DB::table('championship_formats')->insert([
            ['code' => 'swiss_elimination', 'label' => 'Swiss + Elimination', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'swiss_only', 'label' => 'Swiss Only', 'created_at' => now(), 'updated_at' => now()],
            ['code' => 'elimination_only', 'label' => 'Single Elimination', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Create championships table
        Schema::create('championships', function (Blueprint $table) {
            $table->id();
            $table->string('title', 255);
            $table->text('description')->nullable();
            $table->decimal('entry_fee', 10, 2)->default(0);
            $table->unsignedInteger('max_participants')->nullable()->comment('NULL = unlimited');
            $table->dateTime('registration_deadline');
            $table->dateTime('start_date');
            $table->unsignedInteger('match_time_window_hours')->default(24)->comment('Hours to complete match');

            // Format using lookup table
            $table->unsignedTinyInteger('format_id');
            $table->foreign('format_id')->references('id')->on('championship_formats')->onDelete('restrict');

            $table->unsignedInteger('swiss_rounds')->nullable()->comment('Number of Swiss rounds');
            $table->unsignedInteger('top_qualifiers')->nullable()->comment('Number advancing to elimination');

            // Status using lookup table
            $table->unsignedTinyInteger('status_id')->default(1);
            $table->foreign('status_id')->references('id')->on('championship_statuses')->onDelete('restrict');

            $table->timestamps();

            // Indexes
            $table->index('status_id');
            $table->index('start_date');
            $table->index('registration_deadline');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('championships');
        Schema::dropIfExists('championship_formats');
        Schema::dropIfExists('championship_statuses');
    }
};
