<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SyntheticPlayer extends Model
{
    protected $fillable = [
        'name',
        'avatar_seed',
        'rating',
        'computer_level',
        'personality',
        'bio',
        'is_active',
        'games_played_count',
        'wins_count',
    ];

    protected $casts = [
        'rating' => 'integer',
        'computer_level' => 'integer',
        'is_active' => 'boolean',
        'games_played_count' => 'integer',
        'wins_count' => 'integer',
    ];

    /**
     * Indian first names pool for randomized display
     */
    private static array $firstNames = [
        'Aarav', 'Aditi', 'Aditya', 'Akash', 'Amara', 'Amit', 'Ananya', 'Anil',
        'Anjali', 'Arjun', 'Aruna', 'Ashwin', 'Bhavna', 'Chandra', 'Deepa', 'Deepak',
        'Devika', 'Dhruv', 'Divya', 'Gaurav', 'Geeta', 'Hari', 'Indira', 'Ishaan',
        'Jaya', 'Kabir', 'Kavya', 'Kiran', 'Krishna', 'Lakshmi', 'Madhav', 'Meera',
        'Mohan', 'Nandini', 'Naveen', 'Neha', 'Nikhil', 'Pallavi', 'Pooja', 'Pradeep',
        'Pranav', 'Priya', 'Rahul', 'Rajesh', 'Ramesh', 'Ravi', 'Rekha', 'Rohan',
        'Rohit', 'Sakshi', 'Samir', 'Sandeep', 'Sanjay', 'Sarita', 'Shreya', 'Siddharth',
        'Sneha', 'Sunil', 'Sunita', 'Suresh', 'Tanvi', 'Varun', 'Vijay', 'Vikram',
    ];

    /**
     * Indian last names pool for randomized display
     */
    private static array $lastNames = [
        'Agarwal', 'Bhat', 'Chakraborty', 'Choudhury', 'Das', 'Desai', 'Deshpande',
        'Ghosh', 'Gupta', 'Iyer', 'Jain', 'Joshi', 'Kapoor', 'Khan', 'Kohli',
        'Kumar', 'Malhotra', 'Mehta', 'Menon', 'Mishra', 'Mukherjee', 'Nair',
        'Naidu', 'Pandey', 'Patel', 'Pillai', 'Prasad', 'Rai', 'Rajan', 'Rao',
        'Reddy', 'Saxena', 'Sen', 'Shah', 'Sharma', 'Shukla', 'Singh', 'Sinha',
        'Srinivasan', 'Subramanian', 'Tiwari', 'Trivedi', 'Varma', 'Verma',
    ];

    /**
     * Scope to get only active synthetic players
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Find the closest-rated synthetic player for matchmaking fallback
     */
    public static function findClosestToRating(int $rating): ?self
    {
        return self::active()
            ->orderByRaw('ABS(rating - ?) ASC', [$rating])
            ->first();
    }

    /**
     * Get synthetic players for lobby display (legacy — sorted by rating)
     */
    public static function getForLobby(int $limit = 40): \Illuminate\Database\Eloquent\Collection
    {
        return self::active()
            ->orderBy('rating')
            ->limit($limit)
            ->get();
    }

    /**
     * Get a subset of synthetic players for lobby display.
     * Returns 8-20 players using their permanent DB names and avatar seeds.
     */
    public static function getRandomizedForLobby(): \Illuminate\Database\Eloquent\Collection
    {
        $count = rand(8, 20);

        return self::active()
            ->inRandomOrder()
            ->limit($count)
            ->get();
    }

    /**
     * Get the corresponding ComputerPlayer for game creation
     */
    public function getComputerPlayer(): ComputerPlayer
    {
        return ComputerPlayer::getByLevel($this->computer_level);
    }

    /**
     * Get the DiceBear avatar URL
     */
    public function getAvatarUrlAttribute(): string
    {
        return "https://api.dicebear.com/7.x/avataaars/svg?seed={$this->avatar_seed}";
    }

    /**
     * Win rate as a percentage (cosmetic)
     */
    public function getWinRateAttribute(): float
    {
        if ($this->games_played_count === 0) return 0;
        return round(($this->wins_count / $this->games_played_count) * 100, 1);
    }
}
