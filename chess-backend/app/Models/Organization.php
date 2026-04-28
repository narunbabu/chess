<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Organization extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'type',
        'website',
        'city',
        'state',
        'contact_email',
        'contact_phone',
        'logo_url',
        'is_active',
        'status',
        'created_by',
        'requested_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * The user who created this organization
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * The user who requested this organization
     */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    /**
     * Users belonging to this organization
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Championships hosted by this organization
     */
    public function championships(): HasMany
    {
        return $this->hasMany(Championship::class);
    }

    /**
     * Pending invitations for this organization
     */
    public function invitations()
    {
        return $this->hasMany(OrganizationInvitation::class);
    }

    /**
     * Get organization admins
     */
    public function admins()
    {
        return $this->users()
                    ->whereHas('roles', function ($query) {
                        $query->where('name', 'organization_admin');
                    });
    }

    /**
     * Generate slug from name
     */
    public static function generateSlug(string $name): string
    {
        $slug = str($name)->slug();
        $count = 1;

        while (static::where('slug', $slug)->exists()) {
            $slug = str($name)->slug() . '-' . $count;
            $count++;
        }

        return $slug;
    }

    /**
     * Boot method for model events
     */
    protected static function boot()
    {
        parent::boot();

        // Auto-generate slug if not provided
        static::creating(function ($organization) {
            if (empty($organization->slug)) {
                $organization->slug = static::generateSlug($organization->name);
            }
        });
    }
}
