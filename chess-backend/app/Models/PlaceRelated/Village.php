<?php

namespace App\Models\PlaceRelated;

use Illuminate\Database\Eloquent\Model;

class Village extends Model
{
    protected $fillable = ['name', 'mandal_id'];

    public function mandal()
    {
        return $this->belongsTo(Mandal::class);
    }
}
