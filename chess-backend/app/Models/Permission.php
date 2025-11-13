<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Permission extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'display_name',
        'description',
        'category',
    ];

    /**
     * The roles that have this permission
     */
    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class, 'role_permissions')
                    ->withTimestamps();
    }

    /**
     * Get permissions by category
     */
    public static function getByCategory(string $category)
    {
        return static::where('category', $category)->get();
    }

    /**
     * Get all permission categories
     */
    public static function getCategories(): array
    {
        return static::distinct('category')
                     ->pluck('category')
                     ->toArray();
    }
}
