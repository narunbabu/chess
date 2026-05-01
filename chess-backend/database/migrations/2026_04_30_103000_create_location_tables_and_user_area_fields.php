<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('countries', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80);
            $table->string('initial', 10);
            $table->timestamps();
        });

        Schema::create('states', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80);
            $table->string('initial', 10)->nullable();
            $table->foreignId('country_id')->constrained('countries')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('districts', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->foreignId('state_id')->constrained('states')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('mandals', function (Blueprint $table) {
            $table->id();
            $table->string('name', 160);
            $table->foreignId('district_id')->constrained('districts')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('villages', function (Blueprint $table) {
            $table->id();
            $table->string('name', 160);
            $table->foreignId('mandal_id')->constrained('mandals')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['name', 'mandal_id']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('location_state_id')->nullable()->after('mobile_number')->index();
            $table->unsignedBigInteger('location_district_id')->nullable()->after('location_state_id')->index();
            $table->unsignedBigInteger('location_mandal_id')->nullable()->after('location_district_id')->index();
            $table->unsignedBigInteger('location_village_id')->nullable()->after('location_mandal_id')->index();
        });

        $now = now();
        DB::table('countries')->insert([
            ['id' => 1, 'name' => 'India', 'initial' => 'IN', 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('states')->insert([
            ['id' => 28, 'name' => 'Andhra Pradesh', 'initial' => 'AP', 'country_id' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 36, 'name' => 'Telangana', 'initial' => 'TG', 'country_id' => 1, 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('districts')->insert([
            ['id' => 5420, 'name' => 'Srikakulam', 'state_id' => 28, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 5431, 'name' => 'Vizianagaram', 'state_id' => 28, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 5442, 'name' => 'Visakhapatnam', 'state_id' => 28, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 536, 'name' => 'Hyderabad', 'state_id' => 36, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 537, 'name' => 'Rangareddy', 'state_id' => 36, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 540, 'name' => 'Warangal', 'state_id' => 36, 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('mandals')->insert([
            ['id' => 100001, 'name' => 'Srikakulam', 'district_id' => 5420, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 100002, 'name' => 'Amadalavalasa', 'district_id' => 5420, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 100003, 'name' => 'Vizianagaram', 'district_id' => 5431, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 100004, 'name' => 'Visakhapatnam Urban', 'district_id' => 5442, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 100005, 'name' => 'Secunderabad', 'district_id' => 536, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 100006, 'name' => 'Serilingampally', 'district_id' => 537, 'created_at' => $now, 'updated_at' => $now],
            ['id' => 100007, 'name' => 'Hanamkonda', 'district_id' => 540, 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('villages')->insert([
            ['name' => 'Srikakulam', 'mandal_id' => 100001, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Balaga', 'mandal_id' => 100001, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Amadalavalasa', 'mandal_id' => 100002, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Vizianagaram', 'mandal_id' => 100003, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Dwaraka Nagar', 'mandal_id' => 100004, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Secunderabad', 'mandal_id' => 100005, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Madhapur', 'mandal_id' => 100006, 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'Hanamkonda', 'mandal_id' => 100007, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'location_state_id',
                'location_district_id',
                'location_mandal_id',
                'location_village_id',
            ]);
        });

        Schema::dropIfExists('villages');
        Schema::dropIfExists('mandals');
        Schema::dropIfExists('districts');
        Schema::dropIfExists('states');
        Schema::dropIfExists('countries');
    }
};
