<?php

namespace App\Models;

use App\Models\PlaceRelated\Country;
use App\Models\PlaceRelated\District;
use App\Models\PlaceRelated\Mandal;
use App\Models\PlaceRelated\State;
use App\Models\PlaceRelated\Village;
use Illuminate\Database\Eloquent\Model;

class PendingLocation extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'user_id',
        'level',
        'name',
        'country_id',
        'state_id',
        'district_id',
        'mandal_id',
        'status',
        'reviewed_by',
        'reviewed_at',
        'reject_reason',
        'created_place_id',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function country()
    {
        return $this->belongsTo(Country::class);
    }

    public function state()
    {
        return $this->belongsTo(State::class);
    }

    public function district()
    {
        return $this->belongsTo(District::class);
    }

    public function mandal()
    {
        return $this->belongsTo(Mandal::class);
    }

    public function createdCountry()
    {
        return $this->belongsTo(Country::class, 'created_place_id');
    }

    public function createdState()
    {
        return $this->belongsTo(State::class, 'created_place_id');
    }

    public function createdDistrict()
    {
        return $this->belongsTo(District::class, 'created_place_id');
    }

    public function createdMandal()
    {
        return $this->belongsTo(Mandal::class, 'created_place_id');
    }

    public function createdVillage()
    {
        return $this->belongsTo(Village::class, 'created_place_id');
    }
}
