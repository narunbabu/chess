<?php

namespace App\Models\PlaceRelated;

use Illuminate\Database\Eloquent\Model;

class District extends Model
{
    protected $fillable = ['name', 'state_id'];

    public function state()
    {
        return $this->belongsTo(State::class);
    }

    public function mandals()
    {
        return $this->hasMany(Mandal::class);
    }
}
