<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TesterSubmission extends Model
{
    use HasFactory;

    protected $fillable = [
        'tester_application_id',
        'user_id',
        'period',
        'app_name',
        'test_link',
        'feedback_summary',
        'issue_count',
        'status',
        'payout_amount',
        'reviewer_note',
        'reviewed_by',
        'reviewed_at',
        'payout_processed_at',
    ];

    protected $casts = [
        'issue_count' => 'integer',
        'payout_amount' => 'decimal:2',
        'reviewed_at' => 'datetime',
        'payout_processed_at' => 'datetime',
    ];

    public function application(): BelongsTo
    {
        return $this->belongsTo(TesterApplication::class, 'tester_application_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
