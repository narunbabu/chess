<?php

namespace App\Models\PlaceRelated;

use Illuminate\Database\Eloquent\Model;

class Mandal extends Model
{
    protected $fillable = ['name', 'district_id'];

    public function district()
    {
        return $this->belongsTo(District::class);
    }

    public function villages()
    {
        return $this->hasMany(Village::class);
    }
}
