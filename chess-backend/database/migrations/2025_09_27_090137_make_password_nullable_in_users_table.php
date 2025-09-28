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
        // For SQLite, we need to handle this differently
        if (config('database.default') === 'sqlite') {
            // Create a new table with the correct structure
            Schema::create('users_new', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('email')->unique();
                $table->timestamp('email_verified_at')->nullable();
                $table->string('password')->nullable();
                $table->string('provider')->nullable();
                $table->string('provider_id')->nullable();
                $table->string('provider_token')->nullable();
                $table->rememberToken();
                $table->timestamps();
            });

            // Copy data from old table to new table
            DB::statement('INSERT INTO users_new (id, name, email, email_verified_at, password, provider, provider_id, provider_token, remember_token, created_at, updated_at)
                          SELECT id, name, email, email_verified_at, password, provider, provider_id, provider_token, remember_token, created_at, updated_at FROM users');

            // Drop old table and rename new table
            Schema::drop('users');
            Schema::rename('users_new', 'users');
        } else {
            // For other databases, use the normal change method
            Schema::table('users', function (Blueprint $table) {
                $table->string('password')->nullable()->change();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable(false)->change();
        });
    }
};