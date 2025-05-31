
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->integer('delta'); // positive for credit, negative for debit
            $table->enum('reason', [
                'purchase', 'game_win', 'game_loss', 'referral', 'quest_reward', 
                'tournament_entry', 'tournament_win', 'daily_bonus', 'admin_adjustment'
            ]);
            $table->string('description')->nullable();
            $table->unsignedBigInteger('source_game_id')->nullable();
            $table->json('meta')->nullable();
            $table->integer('balance_after');
            $table->timestamps();
            
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('wallet_transactions');
    }
};
