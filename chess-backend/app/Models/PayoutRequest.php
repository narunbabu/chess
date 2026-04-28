<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayoutRequest extends Model
{
    protected $fillable = [
        'user_id',
        'amount',
        'currency',
        'payment_method',
        'bank_account_name',
        'bank_account_number',
        'bank_ifsc',
        'bank_name',
        'upi_id',
        'status',
        'admin_notes',
        'processed_at',
        'processed_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'processed_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function processor()
    {
        return $this->belongsTo(User::class, 'processed_by');
    }
}
