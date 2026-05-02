<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DistrictSeeder extends Seeder
{
    public function run()
    {
        $items = [
            ['id' => 5420, 'name' => 'Srikakulam', 'state_id' => 28],
            ['id' => 5430, 'name' => 'Manyam', 'state_id' => 28],
            ['id' => 5431, 'name' => 'Vizianagaram', 'state_id' => 28],
            ['id' => 5440, 'name' => 'Alluri Sitharama Raju', 'state_id' => 28],
            ['id' => 5441, 'name' => 'Anakapalli', 'state_id' => 28],
            ['id' => 5442, 'name' => 'Visakhapatnam', 'state_id' => 28],
            ['id' => 5450, 'name' => 'East Godavari', 'state_id' => 28],
            ['id' => 5451, 'name' => 'Kakinada', 'state_id' => 28],
            ['id' => 5452, 'name' => 'Konaseema', 'state_id' => 28],
            ['id' => 5460, 'name' => 'Eluru', 'state_id' => 28],
            ['id' => 5461, 'name' => 'West Godavari', 'state_id' => 28],
            ['id' => 5470, 'name' => 'Krishna', 'state_id' => 28],
            ['id' => 5471, 'name' => 'NTR', 'state_id' => 28],
            ['id' => 5480, 'name' => 'Guntur', 'state_id' => 28],
            ['id' => 5481, 'name' => 'Palnadu', 'state_id' => 28],
            ['id' => 5490, 'name' => 'Bapatla', 'state_id' => 28],
            ['id' => 5491, 'name' => 'Prakasam', 'state_id' => 28],
            ['id' => 5500, 'name' => 'Nellore', 'state_id' => 28],
            ['id' => 5510, 'name' => 'Kadapa', 'state_id' => 28],
            ['id' => 5520, 'name' => 'Kurnool', 'state_id' => 28],
            ['id' => 5521, 'name' => 'Nandyal', 'state_id' => 28],
            ['id' => 5530, 'name' => 'Anantapur', 'state_id' => 28],
            ['id' => 5531, 'name' => 'Sri Sathya Sai', 'state_id' => 28],
            ['id' => 5540, 'name' => 'Annamayya', 'state_id' => 28],
            ['id' => 5541, 'name' => 'Chittoor', 'state_id' => 28],
            ['id' => 5542, 'name' => 'Tirupati', 'state_id' => 28],
        ];
foreach ($items as $item) {
    \App\Models\PlaceRelated\District::updateOrCreate(
        ['id' => $item['id']],
        $item
    );
}  
    }
}
