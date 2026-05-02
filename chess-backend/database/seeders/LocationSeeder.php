<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class LocationSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            DistrictSeeder::class,
            MandalSeeder::class,
            VillageSeeder::class,
            TLDistrictSeeder::class,
            TLMandalSeeder::class,
            TLVillageSeeder::class,
        ]);
    }
}
