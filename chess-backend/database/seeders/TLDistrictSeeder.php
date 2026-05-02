<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class TLDistrictSeeder extends Seeder
{
    public function run()
    {
        $items = [
        ['id' => 532,'name' => 'Adilabad', 'state_id' => 36],
        ['id' => 533,'name' => 'Nizamabad', 'state_id' => 36],
        ['id' => 534,'name' => 'Karimnagar', 'state_id' => 36],
        ['id' => 535,'name' => 'Medak', 'state_id' => 36],
        ['id' => 536,'name' => 'Hyderabad', 'state_id' => 36],
        ['id' => 537,'name' => 'Rangareddy', 'state_id' => 36],
        ['id' => 538,'name' => 'Mahbubnagar', 'state_id' => 36],
        ['id' => 539,'name' => 'Nalgonda', 'state_id' => 36],
        ['id' => 540,'name' => 'Warangal', 'state_id' => 36],
        ['id' => 541,'name' => 'Khammam', 'state_id' => 36],
];foreach ($items as $item) {
    \App\Models\PlaceRelated\District::updateOrCreate(['id' => $item['id']], $item);
}     }
}
