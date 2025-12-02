CREATE TABLE IF NOT EXISTS "migrations"(
  "id" integer primary key autoincrement not null,
  "migration" varchar not null,
  "batch" integer not null
);
CREATE TABLE IF NOT EXISTS "password_reset_tokens"(
  "email" varchar not null,
  "token" varchar not null,
  "created_at" datetime,
  primary key("email")
);
CREATE TABLE IF NOT EXISTS "sessions"(
  "id" varchar not null,
  "user_id" integer,
  "ip_address" varchar,
  "user_agent" text,
  "payload" text not null,
  "last_activity" integer not null,
  primary key("id")
);
CREATE INDEX "sessions_user_id_index" on "sessions"("user_id");
CREATE INDEX "sessions_last_activity_index" on "sessions"("last_activity");
CREATE TABLE IF NOT EXISTS "cache"(
  "key" varchar not null,
  "value" text not null,
  "expiration" integer not null,
  primary key("key")
);
CREATE TABLE IF NOT EXISTS "cache_locks"(
  "key" varchar not null,
  "owner" varchar not null,
  "expiration" integer not null,
  primary key("key")
);
CREATE TABLE IF NOT EXISTS "jobs"(
  "id" integer primary key autoincrement not null,
  "queue" varchar not null,
  "payload" text not null,
  "attempts" integer not null,
  "reserved_at" integer,
  "available_at" integer not null,
  "created_at" integer not null
);
CREATE INDEX "jobs_queue_index" on "jobs"("queue");
CREATE TABLE IF NOT EXISTS "job_batches"(
  "id" varchar not null,
  "name" varchar not null,
  "total_jobs" integer not null,
  "pending_jobs" integer not null,
  "failed_jobs" integer not null,
  "failed_job_ids" text not null,
  "options" text,
  "cancelled_at" integer,
  "created_at" integer not null,
  "finished_at" integer,
  primary key("id")
);
CREATE TABLE IF NOT EXISTS "failed_jobs"(
  "id" integer primary key autoincrement not null,
  "uuid" varchar not null,
  "connection" text not null,
  "queue" text not null,
  "payload" text not null,
  "exception" text not null,
  "failed_at" datetime not null default CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "failed_jobs_uuid_unique" on "failed_jobs"("uuid");
CREATE TABLE IF NOT EXISTS "personal_access_tokens"(
  "id" integer primary key autoincrement not null,
  "tokenable_type" varchar not null,
  "tokenable_id" integer not null,
  "name" varchar not null,
  "token" varchar not null,
  "abilities" text,
  "last_used_at" datetime,
  "expires_at" datetime,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE INDEX "personal_access_tokens_tokenable_type_tokenable_id_index" on "personal_access_tokens"(
  "tokenable_type",
  "tokenable_id"
);
CREATE UNIQUE INDEX "personal_access_tokens_token_unique" on "personal_access_tokens"(
  "token"
);
CREATE TABLE IF NOT EXISTS "game_statuses"(
  "id" integer primary key autoincrement not null,
  "code" varchar not null,
  "label" varchar not null,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE UNIQUE INDEX "game_statuses_code_unique" on "game_statuses"("code");
CREATE TABLE IF NOT EXISTS "game_end_reasons"(
  "id" integer primary key autoincrement not null,
  "code" varchar not null,
  "label" varchar not null,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE UNIQUE INDEX "game_end_reasons_code_unique" on "game_end_reasons"(
  "code"
);
CREATE TABLE IF NOT EXISTS "user_presence"(
  "id" integer primary key autoincrement not null,
  "user_id" integer not null,
  "status" varchar check("status" in('online', 'away', 'offline')) not null default 'offline',
  "socket_id" varchar,
  "device_info" text,
  "last_activity" datetime,
  "current_game_id" integer,
  "game_status" varchar check("game_status" in('waiting', 'playing', 'spectating')),
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("current_game_id") references "games"("id") on delete set null
);
CREATE INDEX "user_presence_user_id_status_index" on "user_presence"(
  "user_id",
  "status"
);
CREATE INDEX "user_presence_socket_id_index" on "user_presence"("socket_id");
CREATE INDEX "user_presence_last_activity_index" on "user_presence"(
  "last_activity"
);
CREATE TABLE IF NOT EXISTS "game_moves"(
  "id" integer primary key autoincrement not null,
  "game_id" integer not null,
  "user_id" integer not null,
  "move_number" integer not null,
  "from_square" varchar not null,
  "to_square" varchar not null,
  "piece_moved" varchar not null,
  "piece_captured" varchar,
  "move_notation" varchar not null,
  "board_state" text not null,
  "is_check" tinyint(1) not null default '0',
  "is_checkmate" tinyint(1) not null default '0',
  "is_castling" tinyint(1) not null default '0',
  "is_en_passant" tinyint(1) not null default '0',
  "promotion_piece" varchar,
  "time_taken_ms" integer,
  "move_timestamp" datetime not null,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("game_id") references "games"("id") on delete cascade,
  foreign key("user_id") references "users"("id") on delete cascade
);
CREATE INDEX "game_moves_game_id_move_number_index" on "game_moves"(
  "game_id",
  "move_number"
);
CREATE INDEX "game_moves_move_timestamp_index" on "game_moves"(
  "move_timestamp"
);
CREATE TABLE IF NOT EXISTS "game_histories"(
  "id" integer primary key autoincrement not null,
  "user_id" integer,
  "game_id" integer,
  "played_at" datetime not null,
  "player_color" varchar not null,
  "computer_level" integer not null,
  "opponent_name" varchar,
  "game_mode" varchar check("game_mode" in('computer', 'multiplayer')) not null default 'computer',
  "moves" text not null,
  "final_score" float not null,
  "result" varchar not null,
  "white_time_remaining_ms" integer,
  "black_time_remaining_ms" integer,
  "last_move_time" integer,
  "created_at" datetime,
  "updated_at" datetime,
  "opponent_score" float not null default '0',
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("game_id") references "games"("id") on delete set null
);
CREATE TABLE IF NOT EXISTS "game_connections"(
  "id" integer primary key autoincrement not null,
  "user_id" integer not null,
  "game_id" integer not null,
  "connection_id" varchar not null,
  "socket_id" varchar,
  "status" varchar check("status" in('connected', 'disconnected', 'stale')) not null default 'connected',
  "connected_at" datetime not null default CURRENT_TIMESTAMP,
  "disconnected_at" datetime,
  "last_activity" datetime not null default CURRENT_TIMESTAMP,
  "metadata" text,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("game_id") references "games"("id") on delete cascade
);
CREATE INDEX "game_connections_game_id_status_index" on "game_connections"(
  "game_id",
  "status"
);
CREATE INDEX "game_connections_user_id_game_id_index" on "game_connections"(
  "user_id",
  "game_id"
);
CREATE INDEX "game_connections_last_activity_index" on "game_connections"(
  "last_activity"
);
CREATE UNIQUE INDEX "game_connections_connection_id_unique" on "game_connections"(
  "connection_id"
);
CREATE TABLE IF NOT EXISTS "ratings_history"(
  "id" integer primary key autoincrement not null,
  "user_id" integer not null,
  "old_rating" integer not null,
  "new_rating" integer not null,
  "rating_change" integer not null,
  "opponent_id" integer,
  "opponent_rating" integer,
  "computer_level" integer,
  "result" varchar check("result" in('win', 'loss', 'draw')) not null,
  "game_type" varchar check("game_type" in('computer', 'multiplayer')) not null default 'multiplayer',
  "k_factor" integer not null,
  "expected_score" numeric not null,
  "actual_score" numeric not null,
  "game_id" integer,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("opponent_id") references "users"("id") on delete set null,
  foreign key("game_id") references "games"("id") on delete set null
);
CREATE INDEX "ratings_history_user_id_index" on "ratings_history"("user_id");
CREATE INDEX "ratings_history_created_at_index" on "ratings_history"(
  "created_at"
);
CREATE INDEX "ratings_history_user_id_created_at_index" on "ratings_history"(
  "user_id",
  "created_at"
);
CREATE TABLE IF NOT EXISTS "user_friends"(
  "id" integer primary key autoincrement not null,
  "user_id" integer not null,
  "friend_id" integer not null,
  "status" varchar check("status" in('pending', 'accepted', 'blocked')) not null default 'pending',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("friend_id") references "users"("id") on delete cascade
);
CREATE UNIQUE INDEX "user_friends_user_id_friend_id_unique" on "user_friends"(
  "user_id",
  "friend_id"
);
CREATE TABLE IF NOT EXISTS "shared_results"(
  "id" integer primary key autoincrement not null,
  "unique_id" varchar not null,
  "game_id" integer,
  "user_id" integer,
  "image_path" varchar not null,
  "result_data" text,
  "view_count" integer not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete set null
);
CREATE INDEX "shared_results_unique_id_index" on "shared_results"("unique_id");
CREATE INDEX "shared_results_game_id_index" on "shared_results"("game_id");
CREATE INDEX "shared_results_created_at_index" on "shared_results"(
  "created_at"
);
CREATE UNIQUE INDEX "shared_results_unique_id_unique" on "shared_results"(
  "unique_id"
);
CREATE TABLE IF NOT EXISTS "championship_statuses"(
  "id" integer primary key autoincrement not null,
  "code" varchar not null,
  "label" varchar not null,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE UNIQUE INDEX "championship_statuses_code_unique" on "championship_statuses"(
  "code"
);
CREATE TABLE IF NOT EXISTS "championship_formats"(
  "id" integer primary key autoincrement not null,
  "code" varchar not null,
  "label" varchar not null,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE UNIQUE INDEX "championship_formats_code_unique" on "championship_formats"(
  "code"
);
CREATE TABLE IF NOT EXISTS "payment_statuses"(
  "id" integer primary key autoincrement not null,
  "code" varchar not null,
  "label" varchar not null,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE UNIQUE INDEX "payment_statuses_code_unique" on "payment_statuses"(
  "code"
);
CREATE TABLE IF NOT EXISTS "championship_participants"(
  "id" integer primary key autoincrement not null,
  "championship_id" integer not null,
  "user_id" integer not null,
  "razorpay_order_id" varchar,
  "razorpay_payment_id" varchar,
  "razorpay_signature" varchar,
  "payment_status_id" integer not null default '1',
  "amount_paid" numeric not null default '0',
  "registered_at" datetime not null default CURRENT_TIMESTAMP,
  "seed_number" integer,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("championship_id") references "championships"("id") on delete cascade,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("payment_status_id") references "payment_statuses"("id") on delete restrict
);
CREATE UNIQUE INDEX "championship_participants_championship_id_user_id_unique" on "championship_participants"(
  "championship_id",
  "user_id"
);
CREATE INDEX "championship_participants_championship_id_index" on "championship_participants"(
  "championship_id"
);
CREATE INDEX "championship_participants_user_id_index" on "championship_participants"(
  "user_id"
);
CREATE INDEX "championship_participants_payment_status_id_index" on "championship_participants"(
  "payment_status_id"
);
CREATE INDEX "championship_participants_razorpay_order_id_index" on "championship_participants"(
  "razorpay_order_id"
);
CREATE INDEX "championship_participants_razorpay_payment_id_index" on "championship_participants"(
  "razorpay_payment_id"
);
CREATE TABLE IF NOT EXISTS "championship_round_types"(
  "id" integer primary key autoincrement not null,
  "code" varchar not null,
  "label" varchar not null,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE UNIQUE INDEX "championship_round_types_code_unique" on "championship_round_types"(
  "code"
);
CREATE TABLE IF NOT EXISTS "championship_match_statuses"(
  "id" integer primary key autoincrement not null,
  "code" varchar not null,
  "label" varchar not null,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE UNIQUE INDEX "championship_match_statuses_code_unique" on "championship_match_statuses"(
  "code"
);
CREATE TABLE IF NOT EXISTS "championship_result_types"(
  "id" integer primary key autoincrement not null,
  "code" varchar not null,
  "label" varchar not null,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE UNIQUE INDEX "championship_result_types_code_unique" on "championship_result_types"(
  "code"
);
CREATE TABLE IF NOT EXISTS "championship_standings"(
  "id" integer primary key autoincrement not null,
  "championship_id" integer not null,
  "user_id" integer not null,
  "matches_played" integer not null default '0',
  "wins" integer not null default '0',
  "draws" integer not null default '0',
  "losses" integer not null default '0',
  "points" numeric not null default '0',
  "buchholz_score" numeric not null default '0',
  "sonneborn_berger" numeric not null default '0',
  "rank" integer,
  "final_position" integer,
  "prize_amount" numeric not null default '0',
  "credits_earned" integer not null default '0',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("championship_id") references "championships"("id") on delete cascade,
  foreign key("user_id") references "users"("id") on delete cascade
);
CREATE UNIQUE INDEX "championship_standings_championship_id_user_id_unique" on "championship_standings"(
  "championship_id",
  "user_id"
);
CREATE INDEX "championship_standings_championship_id_index" on "championship_standings"(
  "championship_id"
);
CREATE INDEX "championship_standings_user_id_index" on "championship_standings"(
  "user_id"
);
CREATE INDEX "champ_standings_leaderboard_idx" on "championship_standings"(
  "championship_id",
  "points",
  "buchholz_score"
);
CREATE INDEX "champ_standings_rank_idx" on "championship_standings"(
  "championship_id",
  "rank"
);
CREATE TABLE IF NOT EXISTS "roles"(
  "id" integer primary key autoincrement not null,
  "name" varchar not null,
  "display_name" varchar not null,
  "description" text,
  "hierarchy_level" integer not null default '0',
  "is_system_role" tinyint(1) not null default '0',
  "created_at" datetime,
  "updated_at" datetime
);
CREATE INDEX "roles_hierarchy_level_index" on "roles"("hierarchy_level");
CREATE UNIQUE INDEX "roles_name_unique" on "roles"("name");
CREATE TABLE IF NOT EXISTS "permissions"(
  "id" integer primary key autoincrement not null,
  "name" varchar not null,
  "display_name" varchar not null,
  "description" text,
  "category" varchar not null,
  "created_at" datetime,
  "updated_at" datetime
);
CREATE INDEX "permissions_category_index" on "permissions"("category");
CREATE UNIQUE INDEX "permissions_name_unique" on "permissions"("name");
CREATE TABLE IF NOT EXISTS "role_permissions"(
  "id" integer primary key autoincrement not null,
  "role_id" integer not null,
  "permission_id" integer not null,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("role_id") references "roles"("id") on delete cascade,
  foreign key("permission_id") references "permissions"("id") on delete cascade
);
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_unique" on "role_permissions"(
  "role_id",
  "permission_id"
);
CREATE INDEX "role_permissions_role_id_index" on "role_permissions"("role_id");
CREATE INDEX "role_permissions_permission_id_index" on "role_permissions"(
  "permission_id"
);
CREATE TABLE IF NOT EXISTS "user_roles"(
  "id" integer primary key autoincrement not null,
  "user_id" integer not null,
  "role_id" integer not null,
  "assigned_by" integer,
  "assigned_at" datetime not null default CURRENT_TIMESTAMP,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("role_id") references "roles"("id") on delete cascade,
  foreign key("assigned_by") references "users"("id") on delete set null
);
CREATE UNIQUE INDEX "user_roles_user_id_role_id_unique" on "user_roles"(
  "user_id",
  "role_id"
);
CREATE INDEX "user_roles_user_id_index" on "user_roles"("user_id");
CREATE INDEX "user_roles_role_id_index" on "user_roles"("role_id");
CREATE INDEX "user_roles_assigned_at_index" on "user_roles"("assigned_at");
CREATE TABLE IF NOT EXISTS "organizations"(
  "id" integer primary key autoincrement not null,
  "name" varchar not null,
  "slug" varchar not null,
  "description" text,
  "type" varchar,
  "website" varchar,
  "contact_email" varchar,
  "contact_phone" varchar,
  "logo_url" varchar,
  "is_active" tinyint(1) not null default '1',
  "created_by" integer,
  "created_at" datetime,
  "updated_at" datetime,
  "deleted_at" datetime,
  foreign key("created_by") references "users"("id") on delete set null
);
CREATE INDEX "organizations_is_active_index" on "organizations"("is_active");
CREATE INDEX "organizations_type_index" on "organizations"("type");
CREATE INDEX "organizations_created_by_index" on "organizations"("created_by");
CREATE UNIQUE INDEX "organizations_slug_unique" on "organizations"("slug");
CREATE TABLE IF NOT EXISTS "users"(
  "id" integer primary key autoincrement not null,
  "name" varchar not null,
  "email" varchar not null,
  "email_verified_at" datetime,
  "password" varchar,
  "provider" varchar,
  "provider_id" varchar,
  "provider_token" varchar,
  "remember_token" varchar,
  "created_at" datetime,
  "updated_at" datetime,
  "avatar_url" varchar,
  "rating" integer not null default('1200'),
  "is_provisional" tinyint(1) not null default('1'),
  "games_played" integer not null default('0'),
  "peak_rating" integer not null default('1200'),
  "rating_last_updated" datetime,
  "organization_id" integer,
  "is_active" tinyint(1) not null default '1',
  "last_login_at" datetime,
  "last_activity_at" datetime,
  "tutorial_xp" integer not null default '0',
  "tutorial_level" integer not null default '1',
  "current_skill_tier" varchar check("current_skill_tier" in('beginner', 'intermediate', 'advanced')) not null default 'beginner',
  "current_streak_days" integer not null default '0',
  "longest_streak_days" integer not null default '0',
  "last_activity_date" date,
  foreign key("organization_id") references "organizations"("id") on delete set null
);
CREATE UNIQUE INDEX "users_email_unique" on "users"("email");
CREATE INDEX "users_peak_rating_index" on "users"("peak_rating");
CREATE INDEX "users_rating_index" on "users"("rating");
CREATE INDEX "users_organization_id_index" on "users"("organization_id");
CREATE INDEX "users_is_active_index" on "users"("is_active");
CREATE TABLE IF NOT EXISTS "championships"(
  "id" integer primary key autoincrement not null,
  "title" varchar not null,
  "description" text,
  "entry_fee" numeric not null default('0'),
  "max_participants" integer,
  "registration_deadline" datetime not null,
  "start_date" datetime not null,
  "match_time_window_hours" integer not null default('24'),
  "format_id" integer not null,
  "swiss_rounds" integer,
  "top_qualifiers" integer,
  "status_id" integer not null default('1'),
  "created_at" datetime,
  "updated_at" datetime,
  "created_by" integer,
  "organization_id" integer,
  "visibility" varchar not null default('public'),
  "allow_public_registration" tinyint(1) not null default('1'),
  "time_control_minutes" integer not null default('10'),
  "time_control_increment" integer not null default('0'),
  "total_rounds" integer,
  "deleted_at" datetime,
  "deleted_by" integer,
  "color_assignment_method" varchar not null default 'balanced',
  "max_concurrent_matches" integer not null default '0',
  "auto_progression" tinyint(1) not null default '0',
  "pairing_optimization" tinyint(1) not null default '1',
  "auto_invitations" tinyint(1) not null default '1',
  "round_interval_minutes" integer not null default '15',
  "invitation_timeout_minutes" integer not null default '60',
  "match_start_buffer_minutes" integer not null default '5',
  "tournament_settings" text,
  "cancelled_at" datetime,
  "cancelled_reason" varchar,
  "scheduling_instructions" text,
  "play_instructions" text,
  "default_grace_period_minutes" integer not null default '10',
  "allow_early_play" tinyint(1) not null default '1',
  "require_confirmation" tinyint(1) not null default '1',
  "tournament_config" text,
  "tournament_generated" tinyint(1) not null default '0',
  "tournament_generated_at" datetime,
  foreign key("organization_id") references organizations("id") on delete set null on update no action,
  foreign key("created_by") references users("id") on delete set null on update no action,
  foreign key("format_id") references championship_formats("id") on delete restrict on update no action,
  foreign key("status_id") references championship_statuses("id") on delete restrict on update no action,
  foreign key("deleted_by") references "users"("id") on delete set null
);
CREATE INDEX "championships_created_by_index" on "championships"("created_by");
CREATE INDEX "championships_organization_id_index" on "championships"(
  "organization_id"
);
CREATE INDEX "championships_registration_deadline_index" on "championships"(
  "registration_deadline"
);
CREATE INDEX "championships_start_date_index" on "championships"("start_date");
CREATE INDEX "championships_status_id_index" on "championships"("status_id");
CREATE INDEX "championships_visibility_index" on "championships"("visibility");
CREATE INDEX "championships_deleted_at_index" on "championships"("deleted_at");
CREATE INDEX "championships_deleted_at_status_id_index" on "championships"(
  "deleted_at",
  "status_id"
);
CREATE INDEX "championships_status_id_auto_progression_index" on "championships"(
  "status_id",
  "auto_progression"
);
CREATE INDEX "championships_auto_progression_start_date_index" on "championships"(
  "auto_progression",
  "start_date"
);
CREATE TABLE IF NOT EXISTS "invitations"(
  "id" integer primary key autoincrement not null,
  "inviter_id" integer not null,
  "invited_id" integer not null,
  "status" varchar not null default('pending'),
  "inviter_preferred_color" varchar not null default('white'),
  "responded_by" integer,
  "responded_at" datetime,
  "game_id" integer,
  "type" varchar not null default('game_invitation'),
  "expires_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  "championship_match_id" integer,
  "priority" varchar not null default 'normal',
  "desired_color" varchar,
  "auto_generated" tinyint(1) not null default '0',
  "metadata" text,
  foreign key("responded_by") references users("id") on delete set null on update no action,
  foreign key("game_id") references games("id") on delete set null on update no action,
  foreign key("invited_id") references users("id") on delete cascade on update no action,
  foreign key("inviter_id") references users("id") on delete cascade on update no action,
  foreign key("championship_match_id") references "championship_matches"("id") on delete cascade
);
CREATE INDEX "invitations_invited_id_status_index" on "invitations"(
  "invited_id",
  "status"
);
CREATE INDEX "invitations_inviter_id_status_index" on "invitations"(
  "inviter_id",
  "status"
);
CREATE INDEX "invitations_championship_match_id_index" on "invitations"(
  "championship_match_id"
);
CREATE INDEX "invitations_type_status_priority_index" on "invitations"(
  "type",
  "status",
  "priority"
);
CREATE INDEX "invitations_expires_at_status_index" on "invitations"(
  "expires_at",
  "status"
);
CREATE TABLE IF NOT EXISTS "championship_matches"(
  "id" integer primary key autoincrement not null,
  "championship_id" integer not null,
  "round_number" integer not null,
  "round_type_id" integer not null,
  "player1_id" integer,
  "player2_id" integer,
  "game_id" integer,
  "scheduled_at" datetime not null default(CURRENT_TIMESTAMP),
  "deadline" datetime not null,
  "winner_id" integer,
  "result_type_id" integer,
  "status_id" integer not null default('1'),
  "created_at" datetime,
  "updated_at" datetime,
  "white_player_id" integer,
  "black_player_id" integer,
  "color_assignment_method" varchar not null default('balanced'),
  "auto_generated" tinyint(1) not null default('0'),
  "invitation_sent_at" datetime,
  "invitation_accepted_at" datetime,
  "invitation_status" varchar not null default('pending'),
  "is_placeholder" tinyint(1) not null default('0'),
  "placeholder_positions" text,
  "players_assigned_at" datetime,
  "determined_by_round" integer,
  "scheduled_time" datetime,
  "game_timeout" datetime,
  "scheduling_status" varchar check("scheduling_status" in('pending', 'proposed', 'accepted', 'confirmed', 'forfeit')) not null default 'pending',
  "can_schedule_early" tinyint(1) not null default '1',
  "scheduling_notes" text,
  foreign key("championship_id") references championships("id") on delete cascade on update no action,
  foreign key("round_type_id") references championship_round_types("id") on delete restrict on update no action,
  foreign key("game_id") references games("id") on delete set null on update no action,
  foreign key("winner_id") references users("id") on delete set null on update no action,
  foreign key("result_type_id") references championship_result_types("id") on delete restrict on update no action,
  foreign key("status_id") references championship_match_statuses("id") on delete restrict on update no action,
  foreign key("player1_id") references "users"("id") on delete cascade,
  foreign key("player2_id") references "users"("id") on delete cascade,
  foreign key("white_player_id") references "users"("id") on delete cascade,
  foreign key("black_player_id") references "users"("id") on delete cascade
);
CREATE INDEX "champ_match_invitation_idx" on "championship_matches"(
  "championship_id",
  "round_number",
  "invitation_status"
);
CREATE INDEX "championship_matches_black_player_id_index" on "championship_matches"(
  "black_player_id"
);
CREATE INDEX "championship_matches_championship_id_index" on "championship_matches"(
  "championship_id"
);
CREATE INDEX "championship_matches_championship_id_round_number_index" on "championship_matches"(
  "championship_id",
  "round_number"
);
CREATE INDEX "championship_matches_deadline_index" on "championship_matches"(
  "deadline"
);
CREATE INDEX "championship_matches_game_id_index" on "championship_matches"(
  "game_id"
);
CREATE INDEX "championship_matches_is_placeholder_round_number_index" on "championship_matches"(
  "is_placeholder",
  "round_number"
);
CREATE INDEX "championship_matches_player1_id_index" on "championship_matches"(
  "player1_id"
);
CREATE INDEX "championship_matches_player2_id_index" on "championship_matches"(
  "player2_id"
);
CREATE INDEX "championship_matches_status_id_index" on "championship_matches"(
  "status_id"
);
CREATE INDEX "championship_matches_white_player_id_index" on "championship_matches"(
  "white_player_id"
);
CREATE TABLE IF NOT EXISTS "championship_match_schedules"(
  "id" integer primary key autoincrement not null,
  "championship_match_id" integer not null,
  "proposer_id" integer not null,
  "proposed_time" datetime not null,
  "status" varchar check("status" in('proposed', 'accepted', 'rejected', 'alternative_proposed')) not null default 'proposed',
  "responder_id" integer,
  "response_time" datetime,
  "proposer_message" text,
  "responder_message" text,
  "alternative_time" datetime,
  "alternative_message" text,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("championship_match_id") references "championship_matches"("id") on delete cascade,
  foreign key("proposer_id") references "users"("id") on delete cascade,
  foreign key("responder_id") references "users"("id") on delete cascade
);
CREATE INDEX "championship_match_schedules_championship_match_id_index" on "championship_match_schedules"(
  "championship_match_id"
);
CREATE INDEX "championship_match_schedules_proposer_id_index" on "championship_match_schedules"(
  "proposer_id"
);
CREATE INDEX "championship_match_schedules_responder_id_index" on "championship_match_schedules"(
  "responder_id"
);
CREATE INDEX "championship_match_schedules_status_index" on "championship_match_schedules"(
  "status"
);
CREATE INDEX "championship_match_schedules_proposed_time_index" on "championship_match_schedules"(
  "proposed_time"
);
CREATE TABLE IF NOT EXISTS "games"(
  "id" integer primary key autoincrement not null,
  "white_player_id" integer not null,
  "black_player_id" integer not null,
  "status_id" integer not null,
  "result" varchar default('*'),
  "winner_player" varchar,
  "fen" varchar not null default('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
  "moves" text,
  "turn" varchar not null default('white'),
  "last_move_at" datetime,
  "ended_at" datetime,
  "end_reason_id" integer,
  "paused_at" datetime,
  "paused_reason" varchar,
  "paused_by_user_id" integer,
  "parent_game_id" integer,
  "winner_user_id" integer,
  "move_count" integer not null default('0'),
  "pgn" text,
  "time_control_minutes" integer not null default('10'),
  "increment_seconds" integer not null default('0'),
  "white_time_remaining_ms" integer,
  "black_time_remaining_ms" integer,
  "last_move_time" datetime,
  "white_time_paused_ms" integer,
  "black_time_paused_ms" integer,
  "turn_at_pause" varchar,
  "white_grace_time_ms" integer not null default('0'),
  "black_grace_time_ms" integer not null default('0'),
  "resume_requested_by" integer,
  "resume_requested_at" datetime,
  "resume_request_expires_at" datetime,
  "resume_status" varchar not null default('none'),
  "white_connected" tinyint(1) not null default('0'),
  "black_connected" tinyint(1) not null default('0'),
  "white_last_seen" datetime,
  "black_last_seen" datetime,
  "game_phase" varchar not null default('waiting'),
  "game_state" text,
  "total_moves" integer not null default('0'),
  "disconnection_count_white" integer not null default('0'),
  "disconnection_count_black" integer not null default('0'),
  "abandonment_warning_sent" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  "last_heartbeat_at" datetime,
  "white_player_score" numeric not null default('0'),
  "black_player_score" numeric not null default('0'),
  "draw_reason" text,
  "insufficient_material_draw" tinyint(1) not null default '0',
  "timeout_winner_id" integer,
  foreign key("resume_requested_by") references users("id") on delete set null on update no action,
  foreign key("winner_user_id") references users("id") on delete set null on update no action,
  foreign key("paused_by_user_id") references users("id") on delete set null on update no action,
  foreign key("end_reason_id") references game_end_reasons("id") on delete restrict on update no action,
  foreign key("status_id") references game_statuses("id") on delete restrict on update no action,
  foreign key("black_player_id") references users("id") on delete cascade on update no action,
  foreign key("white_player_id") references users("id") on delete cascade on update no action,
  foreign key("timeout_winner_id") references "users"("id") on delete set null
);
CREATE INDEX "games_black_player_id_status_id_index" on "games"(
  "black_player_id",
  "status_id"
);
CREATE INDEX "games_game_phase_updated_at_index" on "games"(
  "game_phase",
  "updated_at"
);
CREATE INDEX "games_parent_game_id_index" on "games"("parent_game_id");
CREATE INDEX "games_status_id_index" on "games"("status_id");
CREATE INDEX "games_white_connected_black_connected_index" on "games"(
  "white_connected",
  "black_connected"
);
CREATE INDEX "games_white_player_id_status_id_index" on "games"(
  "white_player_id",
  "status_id"
);
CREATE INDEX "games_winner_user_id_ended_at_index" on "games"(
  "winner_user_id",
  "ended_at"
);
CREATE INDEX "users_last_activity_at_index" on "users"("last_activity_at");
CREATE TABLE IF NOT EXISTS "tutorial_modules"(
  "id" integer primary key autoincrement not null,
  "name" varchar not null,
  "slug" varchar not null,
  "skill_tier" varchar check("skill_tier" in('beginner', 'intermediate', 'advanced')) not null,
  "description" text,
  "icon" varchar,
  "sort_order" integer not null default '0',
  "unlock_requirement_id" integer,
  "estimated_duration_minutes" integer not null default '30',
  "is_active" tinyint(1) not null default '1',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("unlock_requirement_id") references "tutorial_modules"("id") on delete set null
);
CREATE INDEX "tutorial_modules_skill_tier_index" on "tutorial_modules"(
  "skill_tier"
);
CREATE INDEX "tutorial_modules_is_active_sort_order_index" on "tutorial_modules"(
  "is_active",
  "sort_order"
);
CREATE UNIQUE INDEX "tutorial_modules_slug_unique" on "tutorial_modules"(
  "slug"
);
CREATE TABLE IF NOT EXISTS "tutorial_lessons"(
  "id" integer primary key autoincrement not null,
  "module_id" integer not null,
  "title" varchar not null,
  "slug" varchar not null,
  "lesson_type" varchar check("lesson_type" in('theory', 'interactive', 'puzzle', 'practice_game')) not null,
  "content_data" text,
  "difficulty_rating" integer not null default '1',
  "sort_order" integer not null default '0',
  "estimated_duration_minutes" integer not null default '10',
  "xp_reward" integer not null default '10',
  "unlock_requirement_lesson_id" integer,
  "is_active" tinyint(1) not null default '1',
  "created_at" datetime,
  "updated_at" datetime,
  "interactive_config" text,
  "stage_progress" text,
  "interactive_type" varchar,
  "allow_invalid_fen" tinyint(1) not null default '0',
  "validation_rules" text,
  foreign key("module_id") references "tutorial_modules"("id") on delete cascade,
  foreign key("unlock_requirement_lesson_id") references "tutorial_lessons"("id") on delete set null
);
CREATE INDEX "tutorial_lessons_module_id_is_active_sort_order_index" on "tutorial_lessons"(
  "module_id",
  "is_active",
  "sort_order"
);
CREATE TABLE IF NOT EXISTS "user_tutorial_progress"(
  "id" integer primary key autoincrement not null,
  "user_id" integer not null,
  "lesson_id" integer not null,
  "status" varchar check("status" in('not_started', 'in_progress', 'completed', 'mastered')) not null default 'not_started',
  "attempts" integer not null default '0',
  "best_score" numeric not null default '0',
  "time_spent_seconds" integer not null default '0',
  "completed_at" datetime,
  "mastered_at" datetime,
  "last_accessed_at" datetime not null default CURRENT_TIMESTAMP,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("lesson_id") references "tutorial_lessons"("id") on delete cascade
);
CREATE UNIQUE INDEX "user_tutorial_progress_user_id_lesson_id_unique" on "user_tutorial_progress"(
  "user_id",
  "lesson_id"
);
CREATE INDEX "user_tutorial_progress_user_id_status_index" on "user_tutorial_progress"(
  "user_id",
  "status"
);
CREATE TABLE IF NOT EXISTS "user_skill_assessments"(
  "id" integer primary key autoincrement not null,
  "user_id" integer not null,
  "skill_tier" varchar check("skill_tier" in('beginner', 'intermediate', 'advanced')) not null,
  "assessment_type" varchar check("assessment_type" in('initial', 'module_completion', 'challenge')) not null,
  "score" numeric not null,
  "rating_before" integer,
  "rating_after" integer,
  "completed_at" datetime not null default CURRENT_TIMESTAMP,
  "assessment_data" text,
  foreign key("user_id") references "users"("id") on delete cascade
);
CREATE INDEX "user_skill_assessments_user_id_skill_tier_index" on "user_skill_assessments"(
  "user_id",
  "skill_tier"
);
CREATE TABLE IF NOT EXISTS "user_stage_progress"(
  "id" integer primary key autoincrement not null,
  "user_id" integer not null,
  "lesson_id" integer not null,
  "stage_id" integer not null,
  "status" varchar check("status" in('not_started', 'in_progress', 'completed')) not null default 'not_started',
  "attempts" integer not null default '0',
  "best_score" integer not null default '0',
  "total_time_seconds" integer not null default '0',
  "mistake_log" text,
  "hint_usage" text,
  "completed_at" datetime,
  "last_attempt_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("lesson_id") references "tutorial_lessons"("id") on delete cascade,
  foreign key("stage_id") references "interactive_lesson_stages"("id") on delete cascade
);
CREATE UNIQUE INDEX "user_stage_progress_user_id_lesson_id_stage_id_unique" on "user_stage_progress"(
  "user_id",
  "lesson_id",
  "stage_id"
);
CREATE INDEX "user_stage_progress_user_id_status_index" on "user_stage_progress"(
  "user_id",
  "status"
);
CREATE TABLE IF NOT EXISTS "tutorial_achievements"(
  "id" integer primary key autoincrement not null,
  "name" varchar not null,
  "slug" varchar not null,
  "description" text,
  "icon" varchar,
  "tier" varchar check("tier" in('bronze', 'silver', 'gold', 'platinum')) not null,
  "requirement_type" varchar check("requirement_type" in('lessons_completed', 'streak', 'score', 'speed', 'special')) not null,
  "requirement_value" integer,
  "xp_reward" integer not null default '50',
  "is_active" tinyint(1) not null default '1',
  "created_at" datetime,
  "updated_at" datetime
);
CREATE UNIQUE INDEX "tutorial_achievements_slug_unique" on "tutorial_achievements"(
  "slug"
);
CREATE TABLE IF NOT EXISTS "user_achievements"(
  "id" integer primary key autoincrement not null,
  "user_id" integer not null,
  "achievement_id" integer not null,
  "earned_at" datetime not null default CURRENT_TIMESTAMP,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("achievement_id") references "tutorial_achievements"("id") on delete cascade
);
CREATE UNIQUE INDEX "user_achievements_user_id_achievement_id_unique" on "user_achievements"(
  "user_id",
  "achievement_id"
);
CREATE TABLE IF NOT EXISTS "tutorial_practice_games"(
  "id" integer primary key autoincrement not null,
  "user_id" integer not null,
  "lesson_id" integer,
  "ai_difficulty" varchar check("ai_difficulty" in('easy', 'medium', 'hard', 'expert')) not null,
  "result" varchar check("result" in('win', 'loss', 'draw')) not null,
  "moves_played" integer,
  "game_data" text,
  "duration_seconds" integer,
  "xp_earned" integer not null default '0',
  "played_at" datetime not null default CURRENT_TIMESTAMP,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("lesson_id") references "tutorial_lessons"("id") on delete set null
);
CREATE INDEX "tutorial_practice_games_user_id_played_at_index" on "tutorial_practice_games"(
  "user_id",
  "played_at"
);
CREATE TABLE IF NOT EXISTS "daily_challenges"(
  "id" integer primary key autoincrement not null,
  "date" date not null,
  "challenge_type" varchar check("challenge_type" in('puzzle', 'endgame', 'opening', 'tactic')) not null,
  "skill_tier" varchar check("skill_tier" in('beginner', 'intermediate', 'advanced')) not null,
  "challenge_data" text not null,
  "xp_reward" integer not null default '25',
  "created_at" datetime,
  "updated_at" datetime
);
CREATE INDEX "daily_challenges_date_skill_tier_index" on "daily_challenges"(
  "date",
  "skill_tier"
);
CREATE UNIQUE INDEX "daily_challenges_date_unique" on "daily_challenges"(
  "date"
);
CREATE TABLE IF NOT EXISTS "user_daily_challenge_completions"(
  "id" integer primary key autoincrement not null,
  "user_id" integer not null,
  "challenge_id" integer not null,
  "completed" tinyint(1) not null default '0',
  "attempts" integer not null default '0',
  "time_spent_seconds" integer,
  "completed_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("user_id") references "users"("id") on delete cascade,
  foreign key("challenge_id") references "daily_challenges"("id") on delete cascade
);
CREATE UNIQUE INDEX "user_daily_challenge_completions_user_id_challenge_id_unique" on "user_daily_challenge_completions"(
  "user_id",
  "challenge_id"
);
CREATE TABLE IF NOT EXISTS "championship_game_resume_requests"(
  "id" integer primary key autoincrement not null,
  "championship_match_id" integer not null,
  "game_id" integer not null,
  "requester_id" integer not null,
  "recipient_id" integer not null,
  "status" varchar check("status" in('pending', 'accepted', 'declined', 'expired')) not null default 'pending',
  "expires_at" datetime not null,
  "responded_at" datetime,
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("championship_match_id") references "championship_matches"("id") on delete cascade,
  foreign key("game_id") references "games"("id") on delete cascade,
  foreign key("requester_id") references "users"("id") on delete cascade,
  foreign key("recipient_id") references "users"("id") on delete cascade
);
CREATE INDEX "championship_game_resume_requests_championship_match_id_status_index" on "championship_game_resume_requests"(
  "championship_match_id",
  "status"
);
CREATE INDEX "championship_game_resume_requests_recipient_id_status_index" on "championship_game_resume_requests"(
  "recipient_id",
  "status"
);
CREATE INDEX "championship_game_resume_requests_expires_at_index" on "championship_game_resume_requests"(
  "expires_at"
);
CREATE INDEX "tutorial_lessons_lesson_type_interactive_type_index" on "tutorial_lessons"(
  "lesson_type",
  "interactive_type"
);
CREATE INDEX "tutorial_lessons_is_active_interactive_type_index" on "tutorial_lessons"(
  "is_active",
  "interactive_type"
);
CREATE TABLE IF NOT EXISTS "interactive_lesson_stages"(
  "id" integer primary key autoincrement not null,
  "lesson_id" integer not null,
  "stage_order" integer not null,
  "title" varchar not null,
  "instruction_text" text,
  "initial_fen" varchar not null,
  "orientation" varchar not null default 'white',
  "goals" text,
  "success_criteria" text,
  "hints" text,
  "visual_aids" text,
  "alternative_solutions" text,
  "auto_reset_on_success" tinyint(1) not null default '0',
  "auto_reset_delay_ms" integer not null default '1500',
  "feedback_messages" text,
  "is_active" tinyint(1) not null default '1',
  "created_at" datetime,
  "updated_at" datetime,
  foreign key("lesson_id") references "tutorial_lessons"("id") on delete cascade
);
CREATE UNIQUE INDEX "interactive_lesson_stages_lesson_id_stage_order_unique" on "interactive_lesson_stages"(
  "lesson_id",
  "stage_order"
);
CREATE INDEX "interactive_lesson_stages_lesson_id_is_active_stage_order_index" on "interactive_lesson_stages"(
  "lesson_id",
  "is_active",
  "stage_order"
);

INSERT INTO migrations VALUES(60,'0001_01_01_000000_create_users_table',1);
INSERT INTO migrations VALUES(61,'0001_01_01_000001_create_cache_table',1);
INSERT INTO migrations VALUES(62,'0001_01_01_000002_create_jobs_table',1);
INSERT INTO migrations VALUES(63,'2025_01_17_000000_add_avatar_url_to_users_table',1);
INSERT INTO migrations VALUES(64,'2025_01_17_100000_add_rating_system_to_users_table',1);
INSERT INTO migrations VALUES(65,'2025_03_15_180745_create_personal_access_tokens_table',1);
INSERT INTO migrations VALUES(66,'2025_09_27_124000_create_games_table',1);
INSERT INTO migrations VALUES(67,'2025_09_27_124100_create_invitations_table',1);
INSERT INTO migrations VALUES(68,'2025_09_27_124200_create_user_presence_table',1);
INSERT INTO migrations VALUES(69,'2025_09_27_124310_create_game_moves_table',1);
INSERT INTO migrations VALUES(70,'2025_09_27_125000_create_game_histories_table',1);
INSERT INTO migrations VALUES(71,'2025_09_27_192657_create_game_connections_table',1);
INSERT INTO migrations VALUES(72,'2025_09_28_120000_create_ratings_history_table',1);
INSERT INTO migrations VALUES(73,'2025_10_21_061800_add_player_scores_to_games_table',1);
INSERT INTO migrations VALUES(74,'2025_10_23_000000_add_opponent_score_to_game_histories_table',1);
INSERT INTO migrations VALUES(75,'2025_10_24_000000_create_user_friends_table',1);
INSERT INTO migrations VALUES(76,'2025_11_11_065657_create_shared_results_table',1);
INSERT INTO migrations VALUES(77,'2025_11_12_100000_create_championships_table',1);
INSERT INTO migrations VALUES(78,'2025_11_12_100001_create_championship_participants_table',1);
INSERT INTO migrations VALUES(79,'2025_11_12_100002_create_championship_matches_table',1);
INSERT INTO migrations VALUES(80,'2025_11_12_100003_create_championship_standings_table',1);
INSERT INTO migrations VALUES(81,'2025_11_12_110000_create_roles_table',1);
INSERT INTO migrations VALUES(82,'2025_11_12_110001_create_permissions_table',1);
INSERT INTO migrations VALUES(83,'2025_11_12_110002_create_role_permissions_table',1);
INSERT INTO migrations VALUES(84,'2025_11_12_110003_create_user_roles_table',1);
INSERT INTO migrations VALUES(85,'2025_11_12_110004_create_organizations_table',1);
INSERT INTO migrations VALUES(86,'2025_11_12_110005_add_authorization_to_championships',1);
INSERT INTO migrations VALUES(87,'2025_11_12_110006_add_authorization_to_users',1);
INSERT INTO migrations VALUES(88,'2025_11_12_120000_add_time_control_and_total_rounds_to_championships',1);
INSERT INTO migrations VALUES(89,'2025_11_13_100000_add_soft_deletes_to_championships_table',1);
INSERT INTO migrations VALUES(90,'2025_11_13_140000_add_color_assignment_to_championship_matches',1);
INSERT INTO migrations VALUES(91,'2025_11_13_140001_add_tournament_configuration_to_championships',1);
INSERT INTO migrations VALUES(92,'2025_11_13_140002_enhance_invitations_for_championship_matches',1);
INSERT INTO migrations VALUES(93,'2025_11_13_172756_add_cancelled_fields_to_championships_table',1);
INSERT INTO migrations VALUES(94,'2025_11_14_175202_add_placeholder_support_to_championship_matches_table',1);
INSERT INTO migrations VALUES(95,'2025_11_14_180021_allow_null_player_ids_for_placeholder_matches',1);
INSERT INTO migrations VALUES(96,'2025_11_14_190000_add_scheduling_fields_to_championship_matches_table',1);
INSERT INTO migrations VALUES(97,'2025_11_14_190001_create_championship_match_schedules_table',1);
INSERT INTO migrations VALUES(98,'2025_11_14_190002_add_instructions_to_championships_table',1);
INSERT INTO migrations VALUES(99,'2025_11_14_190003_add_draw_detection_to_games_table',1);
INSERT INTO migrations VALUES(100,'2025_11_14_200000_add_tournament_config_to_championships',1);
INSERT INTO migrations VALUES(101,'2025_11_15_093118_add_last_activity_at_to_users_table',1);
INSERT INTO migrations VALUES(102,'2025_11_19_100000_create_tutorial_modules_table',1);
INSERT INTO migrations VALUES(103,'2025_11_19_100001_create_tutorial_lessons_table',1);
INSERT INTO migrations VALUES(104,'2025_11_19_100002_create_user_tutorial_progress_table',1);
INSERT INTO migrations VALUES(105,'2025_11_19_100003_create_user_skill_assessments_table',1);
INSERT INTO migrations VALUES(106,'2025_11_19_100003_create_user_stage_progress_table',1);
INSERT INTO migrations VALUES(107,'2025_11_19_100004_create_tutorial_achievements_table',1);
INSERT INTO migrations VALUES(108,'2025_11_19_100005_create_user_achievements_table',1);
INSERT INTO migrations VALUES(109,'2025_11_19_100006_create_tutorial_practice_games_table',1);
INSERT INTO migrations VALUES(110,'2025_11_19_100007_create_daily_challenges_table',1);
INSERT INTO migrations VALUES(111,'2025_11_19_100008_create_user_daily_challenge_completions_table',1);
INSERT INTO migrations VALUES(112,'2025_11_19_100009_add_tutorial_fields_to_users_table',1);
INSERT INTO migrations VALUES(113,'2025_11_19_151800_add_championship_match_to_invitation_type',1);
INSERT INTO migrations VALUES(114,'2025_11_21_044904_fix_championship_match_status_for_unstarted_games',1);
INSERT INTO migrations VALUES(115,'2025_11_21_050309_create_championship_game_resume_requests_table',1);
