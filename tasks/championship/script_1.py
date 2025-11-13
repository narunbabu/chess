
import pandas as pd

# Create database schema recommendations for championships module
tables_data = []

# Championships table
tables_data.append({
    "Table": "championships",
    "Field": "id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Primary key"
})
tables_data.append({
    "Table": "championships",
    "Field": "title",
    "Type": "VARCHAR(255)",
    "Description": "Championship name"
})
tables_data.append({
    "Table": "championships",
    "Field": "description",
    "Type": "TEXT",
    "Description": "Championship details"
})
tables_data.append({
    "Table": "championships",
    "Field": "entry_fee",
    "Type": "DECIMAL(10,2)",
    "Description": "Entry fee amount in INR"
})
tables_data.append({
    "Table": "championships",
    "Field": "max_participants",
    "Type": "INT UNSIGNED",
    "Description": "NULL = unlimited, otherwise capped"
})
tables_data.append({
    "Table": "championships",
    "Field": "registration_deadline",
    "Type": "DATETIME",
    "Description": "Last date to register"
})
tables_data.append({
    "Table": "championships",
    "Field": "start_date",
    "Type": "DATETIME",
    "Description": "Championship start date"
})
tables_data.append({
    "Table": "championships",
    "Field": "match_time_window_hours",
    "Type": "INT",
    "Description": "Hours to complete match (24, 48, 72)"
})
tables_data.append({
    "Table": "championships",
    "Field": "format",
    "Type": "ENUM",
    "Description": "'swiss_elimination', 'swiss_only', 'elimination_only'"
})
tables_data.append({
    "Table": "championships",
    "Field": "swiss_rounds",
    "Type": "INT",
    "Description": "Number of Swiss rounds"
})
tables_data.append({
    "Table": "championships",
    "Field": "top_qualifiers",
    "Type": "INT",
    "Description": "Number advancing to elimination (e.g., 8)"
})
tables_data.append({
    "Table": "championships",
    "Field": "status",
    "Type": "ENUM",
    "Description": "'upcoming', 'registration_open', 'in_progress', 'completed'"
})

# Championship participants table
tables_data.append({
    "Table": "championship_participants",
    "Field": "id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Primary key"
})
tables_data.append({
    "Table": "championship_participants",
    "Field": "championship_id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Foreign key to championships"
})
tables_data.append({
    "Table": "championship_participants",
    "Field": "user_id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Foreign key to users"
})
tables_data.append({
    "Table": "championship_participants",
    "Field": "razorpay_order_id",
    "Type": "VARCHAR(255)",
    "Description": "Razorpay order ID"
})
tables_data.append({
    "Table": "championship_participants",
    "Field": "razorpay_payment_id",
    "Type": "VARCHAR(255)",
    "Description": "Razorpay payment ID"
})
tables_data.append({
    "Table": "championship_participants",
    "Field": "payment_status",
    "Type": "ENUM",
    "Description": "'pending', 'completed', 'failed', 'refunded'"
})
tables_data.append({
    "Table": "championship_participants",
    "Field": "amount_paid",
    "Type": "DECIMAL(10,2)",
    "Description": "Amount paid"
})
tables_data.append({
    "Table": "championship_participants",
    "Field": "registered_at",
    "Type": "DATETIME",
    "Description": "Registration timestamp"
})
tables_data.append({
    "Table": "championship_participants",
    "Field": "seed_number",
    "Type": "INT",
    "Description": "Seeding for elimination bracket"
})

# Championship matches table
tables_data.append({
    "Table": "championship_matches",
    "Field": "id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Primary key"
})
tables_data.append({
    "Table": "championship_matches",
    "Field": "championship_id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Foreign key to championships"
})
tables_data.append({
    "Table": "championship_matches",
    "Field": "round_number",
    "Type": "INT",
    "Description": "Round number (1, 2, 3...)"
})
tables_data.append({
    "Table": "championship_matches",
    "Field": "round_type",
    "Type": "ENUM",
    "Description": "'swiss', 'quarter', 'semi', 'final', 'third_place'"
})
tables_data.append({
    "Table": "championship_matches",
    "Field": "player1_id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Foreign key to users"
})
tables_data.append({
    "Table": "championship_matches",
    "Field": "player2_id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Foreign key to users"
})
tables_data.append({
    "Table": "championship_matches",
    "Field": "game_id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Foreign key to games (NULL if not started)"
})
tables_data.append({
    "Table": "championship_matches",
    "Field": "scheduled_at",
    "Type": "DATETIME",
    "Description": "When match was created"
})
tables_data.append({
    "Table": "championship_matches",
    "Field": "deadline",
    "Type": "DATETIME",
    "Description": "Match completion deadline"
})
tables_data.append({
    "Table": "championship_matches",
    "Field": "winner_id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Foreign key to users (NULL if not finished)"
})
tables_data.append({
    "Table": "championship_matches",
    "Field": "result_type",
    "Type": "ENUM",
    "Description": "'completed', 'forfeit', 'double_forfeit', 'draw'"
})
tables_data.append({
    "Table": "championship_matches",
    "Field": "status",
    "Type": "ENUM",
    "Description": "'pending', 'in_progress', 'completed', 'cancelled'"
})

# Championship standings table
tables_data.append({
    "Table": "championship_standings",
    "Field": "id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Primary key"
})
tables_data.append({
    "Table": "championship_standings",
    "Field": "championship_id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Foreign key to championships"
})
tables_data.append({
    "Table": "championship_standings",
    "Field": "user_id",
    "Type": "BIGINT UNSIGNED",
    "Description": "Foreign key to users"
})
tables_data.append({
    "Table": "championship_standings",
    "Field": "matches_played",
    "Type": "INT",
    "Description": "Total matches played"
})
tables_data.append({
    "Table": "championship_standings",
    "Field": "wins",
    "Type": "INT",
    "Description": "Number of wins"
})
tables_data.append({
    "Table": "championship_standings",
    "Field": "draws",
    "Type": "INT",
    "Description": "Number of draws"
})
tables_data.append({
    "Table": "championship_standings",
    "Field": "losses",
    "Type": "INT",
    "Description": "Number of losses"
})
tables_data.append({
    "Table": "championship_standings",
    "Field": "points",
    "Type": "DECIMAL(4,1)",
    "Description": "Total points (W=1, D=0.5, L=0)"
})
tables_data.append({
    "Table": "championship_standings",
    "Field": "buchholz_score",
    "Type": "DECIMAL(6,1)",
    "Description": "Tiebreaker: sum of opponents' scores"
})
tables_data.append({
    "Table": "championship_standings",
    "Field": "rank",
    "Type": "INT",
    "Description": "Current rank in standings"
})
tables_data.append({
    "Table": "championship_standings",
    "Field": "final_position",
    "Type": "INT",
    "Description": "Final position (1st, 2nd, 3rd, etc.)"
})
tables_data.append({
    "Table": "championship_standings",
    "Field": "prize_amount",
    "Type": "DECIMAL(10,2)",
    "Description": "Prize money won"
})
tables_data.append({
    "Table": "championship_standings",
    "Field": "credits_earned",
    "Type": "INT",
    "Description": "Credits awarded"
})

df = pd.DataFrame(tables_data)

# Save to CSV
df.to_csv('championship_database_schema.csv', index=False)
print("Database schema saved to championship_database_schema.csv")
print(f"\nTotal fields across {df['Table'].nunique()} tables: {len(df)}")
print(f"\nTables: {', '.join(df['Table'].unique())}")
