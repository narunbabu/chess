<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TesterApplication extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'mobile',
        'upi_id',
        'reason',
        'consented_at',
        'status',
        'reviewed_by',
        'reviewed_at',
        'decline_reason',
    ];

    protected $casts = [
        'consented_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function submissions(): HasMany
    {
        return $this->hasMany(TesterSubmission::class);
    }
}
