<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class StateSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {

        $items = [


            ['id' => 1, 'name' => 'India','initial'=>'IN'],


        ];

        foreach ($items as $item) {
            \App\Models\PlaceRelated\Country::updateOrCreate(
                ['id' => $item['id']],
                $item
            );
        }

        $items = [


            ['id' => 28, 'name' => 'Andhrapradesh','initial'=>'AP','country_id'=>'1'],
            ['id' => 36, 'name' => 'Telangana','initial'=>'TL','country_id'=>'1'],

        ];

        foreach ($items as $item) {
            \App\Models\PlaceRelated\State::updateOrCreate(
                ['id' => $item['id']],
                $item
            );
        }
    }
}
