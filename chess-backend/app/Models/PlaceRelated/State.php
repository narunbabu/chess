<?php

namespace App\Models\PlaceRelated;

use Illuminate\Database\Eloquent\Model;

class State extends Model
{
    protected $fillable = ['name', 'initial', 'country_id'];

    public function districts()
    {
        return $this->hasMany(District::class);
    }
}
