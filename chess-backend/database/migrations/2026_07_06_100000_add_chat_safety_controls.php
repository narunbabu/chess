<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'social_access_disabled')) {
                $table->boolean('social_access_disabled')->default(false)->after('whatsapp_updates_opt_in');
            }

            if (!Schema::hasColumn('users', 'social_access_disabled_at')) {
                $table->timestamp('social_access_disabled_at')->nullable()->after('social_access_disabled');
            }
        });

        Schema::table('organizations', function (Blueprint $table) {
            if (!Schema::hasColumn('organizations', 'social_access_disabled')) {
                $table->boolean('social_access_disabled')->default(false)->after('is_active');
            }

            if (!Schema::hasColumn('organizations', 'social_access_disabled_at')) {
                $table->timestamp('social_access_disabled_at')->nullable()->after('social_access_disabled');
            }
        });

        Schema::table('game_chat_messages', function (Blueprint $table) {
            if (!Schema::hasColumn('game_chat_messages', 'original_message')) {
                $table->string('original_message', 500)->nullable()->after('message');
            }

            if (!Schema::hasColumn('game_chat_messages', 'message_type')) {
                $table->string('message_type', 32)->default('free_text')->after('original_message');
            }

            if (!Schema::hasColumn('game_chat_messages', 'safety_action')) {
                $table->string('safety_action', 32)->nullable()->after('message_type');
            }

            if (!Schema::hasColumn('game_chat_messages', 'filtered')) {
                $table->boolean('filtered')->default(false)->after('safety_action');
            }
        });

        if (!Schema::hasTable('chat_message_reports')) {
            Schema::create('chat_message_reports', function (Blueprint $table) {
                $table->id();
                $table->foreignId('game_chat_message_id')->constrained()->cascadeOnDelete();
                $table->foreignId('game_id')->constrained()->cascadeOnDelete();
                $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('reported_user_id')->constrained('users')->cascadeOnDelete();
                $table->string('reason', 64);
                $table->text('note')->nullable();
                $table->string('status', 32)->default('pending');
                $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('reviewed_at')->nullable();
                $table->text('resolution_note')->nullable();
                $table->timestamps();

                $table->unique(['game_chat_message_id', 'reporter_id'], 'chat_report_unique_reporter');
                $table->index(['status', 'created_at']);
                $table->index(['reported_user_id', 'status']);
            });
        }

        if (!Schema::hasTable('user_blocks')) {
            Schema::create('user_blocks', function (Blueprint $table) {
                $table->id();
                $table->foreignId('blocker_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('blocked_user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamps();

                $table->unique(['blocker_id', 'blocked_user_id']);
                $table->index('blocked_user_id');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_blocks');
        Schema::dropIfExists('chat_message_reports');

        Schema::table('game_chat_messages', function (Blueprint $table) {
            $columns = [
                'filtered',
                'safety_action',
                'message_type',
                'original_message',
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('game_chat_messages', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('organizations', function (Blueprint $table) {
            foreach (['social_access_disabled_at', 'social_access_disabled'] as $column) {
                if (Schema::hasColumn('organizations', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('users', function (Blueprint $table) {
            foreach (['social_access_disabled_at', 'social_access_disabled'] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
