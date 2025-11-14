Request URL
http://localhost:8000/api/championships?status=&format=&search=&upcoming_only=false&user_registered=false&archived=false
Request Method
GET
Status Code
200 OK
Response
{
    "current_page": 1,
    "data": [
        {
            "id": 3,
            "title": "Organization Internal Tournament 8274",
            "description": "Private tournament for organization members",
            "entry_fee": "0.00",
            "max_participants": null,
            "registration_deadline": "2025-12-01T10:00:00.000000Z",
            "start_date": "2025-12-15T10:00:00.000000Z",
            "match_time_window_hours": 24,
            "format_id": 2,
            "swiss_rounds": 5,
            "top_qualifiers": null,
            "status_id": 2,
            "created_at": "2025-11-13T16:48:02.000000Z",
            "updated_at": "2025-11-13T16:48:02.000000Z",
            "created_by": 1,
            "organization_id": null,
            "visibility": "public",
            "allow_public_registration": true,
            "time_control_minutes": 10,
            "time_control_increment": 0,
            "total_rounds": 5,
            "deleted_at": null,
            "deleted_by": null,
            "color_assignment_method": "balanced",
            "max_concurrent_matches": 0,
            "auto_progression": 0,
            "pairing_optimization": 1,
            "auto_invitations": 1,
            "round_interval_minutes": 15,
            "invitation_timeout_minutes": 60,
            "match_start_buffer_minutes": 5,
            "tournament_settings": null,
            "cancelled_at": null,
            "cancelled_reason": null,
            "scheduling_instructions": null,
            "play_instructions": null,
            "default_grace_period_minutes": 10,
            "allow_early_play": true,
            "require_confirmation": true,
            "user_status": {
                "is_registered": false,
                "has_paid": false,
                "can_register": true
            },
            "user_participation": null,
            "status": "registration_open",
            "format": "swiss_only",
            "registered_count": 0,
            "participants_count": 0,
            "is_registration_open": true,
            "name": "Organization Internal Tournament 8274",
            "registration_start_at": "2025-11-13T16:48:02.000000Z",
            "registration_end_at": "2025-12-01 10:00:00",
            "starts_at": "2025-12-15 10:00:00",
            "time_control": {
                "minutes": 10,
                "increment": 0
            },
            "status_relation": {
                "id": 2,
                "code": "registration_open",
                "label": "Registration Open",
                "created_at": "2025-11-13T16:22:44.000000Z",
                "updated_at": "2025-11-13T16:22:44.000000Z"
            },
            "format_relation": {
                "id": 2,
                "code": "swiss_only",
                "label": "Swiss Only",
                "created_at": "2025-11-13T16:22:44.000000Z",
                "updated_at": "2025-11-13T16:22:44.000000Z"
            }
        },
        {
            "id": 6,
            "title": "Test 1",
            "description": "Hello how are you",
            "entry_fee": "100.00",
            "max_participants": 50,
            "registration_deadline": "2025-11-14T18:20:00.000000Z",
            "start_date": "2025-11-14T23:17:00.000000Z",
            "match_time_window_hours": 72,
            "format_id": 2,
            "swiss_rounds": 5,
            "top_qualifiers": null,
            "status_id": 2,
            "created_at": "2025-11-13T17:51:32.000000Z",
            "updated_at": "2025-11-14T01:23:35.000000Z",
            "created_by": 1,
            "organization_id": null,
            "visibility": "public",
            "allow_public_registration": true,
            "time_control_minutes": 10,
            "time_control_increment": 0,
            "total_rounds": 5,
            "deleted_at": null,
            "deleted_by": null,
            "color_assignment_method": "balanced",
            "max_concurrent_matches": 0,
            "auto_progression": 0,
            "pairing_optimization": 1,
            "auto_invitations": 1,
            "round_interval_minutes": 15,
            "invitation_timeout_minutes": 60,
            "match_start_buffer_minutes": 5,
            "tournament_settings": null,
            "cancelled_at": null,
            "cancelled_reason": null,
            "scheduling_instructions": null,
            "play_instructions": null,
            "default_grace_period_minutes": 10,
            "allow_early_play": true,
            "require_confirmation": true,
            "user_status": {
                "is_registered": false,
                "has_paid": false,
                "can_register": true
            },
            "user_participation": null,
            "status": "registration_open",
            "format": "swiss_only",
            "registered_count": 0,
            "participants_count": 0,
            "is_registration_open": true,
            "name": "Test 1",
            "registration_start_at": "2025-11-13T17:51:32.000000Z",
            "registration_end_at": "2025-11-14 18:20:00",
            "starts_at": "2025-11-14 23:17:00",
            "time_control": {
                "minutes": 10,
                "increment": 0
            },
            "status_relation": {
                "id": 2,
                "code": "registration_open",
                "label": "Registration Open",
                "created_at": "2025-11-13T16:22:44.000000Z",
                "updated_at": "2025-11-13T16:22:44.000000Z"
            },
            "format_relation": {
                "id": 2,
                "code": "swiss_only",
                "label": "Swiss Only",
                "created_at": "2025-11-13T16:22:44.000000Z",
                "updated_at": "2025-11-13T16:22:44.000000Z"
            }
        },
        {
            "id": 4,
            "title": "Organization Internal Tournament 7608",
            "description": "Private tournament for organization members",
            "entry_fee": "100.00",
            "max_participants": 50,
            "registration_deadline": "2025-11-13T18:55:00.000000Z",
            "start_date": "2025-11-13T19:00:00.000000Z",
            "match_time_window_hours": 24,
            "format_id": 2,
            "swiss_rounds": 5,
            "top_qualifiers": null,
            "status_id": 3,
            "created_at": "2025-11-13T16:48:51.000000Z",
            "updated_at": "2025-11-13T16:48:51.000000Z",
            "created_by": 1,
            "organization_id": null,
            "visibility": "public",
            "allow_public_registration": true,
            "time_control_minutes": 10,
            "time_control_increment": 0,
            "total_rounds": 5,
            "deleted_at": null,
            "deleted_by": null,
            "color_assignment_method": "balanced",
            "max_concurrent_matches": 0,
            "auto_progression": 0,
            "pairing_optimization": 1,
            "auto_invitations": 1,
            "round_interval_minutes": 15,
            "invitation_timeout_minutes": 60,
            "match_start_buffer_minutes": 5,
            "tournament_settings": null,
            "cancelled_at": null,
            "cancelled_reason": null,
            "scheduling_instructions": null,
            "play_instructions": null,
            "default_grace_period_minutes": 10,
            "allow_early_play": true,
            "require_confirmation": true,
            "user_status": {
                "is_registered": true,
                "has_paid": true,
                "can_register": false
            },
            "user_participation": {
                "id": 1,
                "registered_at": "2025-11-13T08:34:27.000000Z",
                "payment_status": "pending",
                "amount_paid": "0.00"
            },
            "status": "in_progress",
            "format": "swiss_only",
            "registered_count": 3,
            "participants_count": 3,
            "is_registration_open": false,
            "name": "Organization Internal Tournament 7608",
            "registration_start_at": "2025-11-13T16:48:51.000000Z",
            "registration_end_at": "2025-11-13 18:55:00",
            "starts_at": "2025-11-13 19:00:00",
            "time_control": {
                "minutes": 10,
                "increment": 0
            },
            "status_relation": {
                "id": 3,
                "code": "in_progress",
                "label": "In Progress",
                "created_at": "2025-11-13T16:22:44.000000Z",
                "updated_at": "2025-11-13T16:22:44.000000Z"
            },
            "format_relation": {
                "id": 2,
                "code": "swiss_only",
                "label": "Swiss Only",
                "created_at": "2025-11-13T16:22:44.000000Z",
                "updated_at": "2025-11-13T16:22:44.000000Z"
            }
        }
    ],
    "first_page_url": "http:\/\/localhost:8000\/api\/championships?page=1",
    "from": 1,
    "last_page": 1,
    "last_page_url": "http:\/\/localhost:8000\/api\/championships?page=1",
    "links": [
        {
            "url": null,
            "label": "&laquo; Previous",
            "page": null,
            "active": false
        },
        {
            "url": "http:\/\/localhost:8000\/api\/championships?page=1",
            "label": "1",
            "page": 1,
            "active": true
        },
        {
            "url": null,
            "label": "Next &raquo;",
            "page": null,
            "active": false
        }
    ],
    "next_page_url": null,
    "path": "http:\/\/localhost:8000\/api\/championships",
    "per_page": 15,
    "prev_page_url": null,
    "to": 3,
    "total": 3
}

-------------------
Request URL
http://localhost:8000/api/championships/4/participants
Request Method
GET
Status Code
200 OK

{
    "championship_id": 4,
    "total_participants": 3,
    "max_participants": 50,
    "participants": [
        {
            "id": 1,
            "championship_id": 4,
            "user_id": 1,
            "razorpay_order_id": null,
            "razorpay_payment_id": null,
            "razorpay_signature": null,
            "payment_status_id": 2,
            "amount_paid": "0.00",
            "registered_at": "2025-11-13T08:34:27.000000Z",
            "seed_number": null,
            "created_at": "2025-11-13T16:48:51.000000Z",
            "updated_at": "2025-11-13T16:48:51.000000Z",
            "payment_status": "completed",
            "user": {
                "id": 1,
                "name": "Arun Nalamara",
                "email": "nalamara.arun@gmail.com",
                "avatar_url": "http:\/\/localhost:8000\/storage\/avatars\/1_1763079330.jpg",
                "rating": 1200
            },
            "payment_status_relation": {
                "id": 2,
                "code": "completed",
                "label": "Completed",
                "created_at": "2025-11-13T16:22:44.000000Z",
                "updated_at": "2025-11-13T16:22:44.000000Z"
            }
        },
        {
            "id": 2,
            "championship_id": 4,
            "user_id": 3,
            "razorpay_order_id": null,
            "razorpay_payment_id": null,
            "razorpay_signature": null,
            "payment_status_id": 2,
            "amount_paid": "100.00",
            "registered_at": "2025-11-13T12:57:40.000000Z",
            "seed_number": null,
            "created_at": "2025-11-13T16:48:51.000000Z",
            "updated_at": "2025-11-13T16:48:51.000000Z",
            "payment_status": "completed",
            "user": {
                "id": 3,
                "name": "arun babu",
                "email": "narun.iitb@gmail.com",
                "avatar_url": "http:\/\/localhost:8000\/storage\/avatars\/3_1763052017.jpg",
                "rating": 1200
            },
            "payment_status_relation": {
                "id": 2,
                "code": "completed",
                "label": "Completed",
                "created_at": "2025-11-13T16:22:44.000000Z",
                "updated_at": "2025-11-13T16:22:44.000000Z"
            }
        },
        {
            "id": 3,
            "championship_id": 4,
            "user_id": 4,
            "razorpay_order_id": null,
            "razorpay_payment_id": null,
            "razorpay_signature": null,
            "payment_status_id": 2,
            "amount_paid": "100.00",
            "registered_at": "2025-11-13T13:07:53.000000Z",
            "seed_number": null,
            "created_at": "2025-11-13T16:48:51.000000Z",
            "updated_at": "2025-11-13T16:48:51.000000Z",
            "payment_status": "completed",
            "user": {
                "id": 4,
                "name": "Arun Nalamara",
                "email": "sanatan.dharmam@gmail.com",
                "avatar_url": "http:\/\/localhost:8000\/storage\/avatars\/4_1763052295.jpg",
                "rating": 1200
            },
            "payment_status_relation": {
                "id": 2,
                "code": "completed",
                "label": "Completed",
                "created_at": "2025-11-13T16:22:44.000000Z",
                "updated_at": "2025-11-13T16:22:44.000000Z"
            }
        }
    ]
}
-------
standings
{
    "championship_id": 4,
    "standings": [],
    "summary": {
        "total_participants": 0,
        "completed_matches": 0,
        "total_possible_matches": 15,
        "leader": null,
        "top_three": [],
        "standings": []
    }
}

-----
Request URL
http://localhost:8000/api/championships/4
Request Method
GET
Status Code
200 OK

Response
{
    "championship": {
        "id": 4,
        "title": "Organization Internal Tournament 7608",
        "description": "Private tournament for organization members",
        "entry_fee": "100.00",
        "max_participants": 50,
        "registration_deadline": "2025-11-13T18:55:00.000000Z",
        "start_date": "2025-11-13T19:00:00.000000Z",
        "match_time_window_hours": 24,
        "format_id": 2,
        "swiss_rounds": 5,
        "top_qualifiers": null,
        "status_id": 3,
        "created_at": "2025-11-13T16:48:51.000000Z",
        "updated_at": "2025-11-13T16:48:51.000000Z",
        "created_by": 1,
        "organization_id": null,
        "visibility": "public",
        "allow_public_registration": true,
        "time_control_minutes": 10,
        "time_control_increment": 0,
        "total_rounds": 5,
        "deleted_at": null,
        "deleted_by": null,
        "color_assignment_method": "balanced",
        "max_concurrent_matches": 0,
        "auto_progression": 0,
        "pairing_optimization": 1,
        "auto_invitations": 1,
        "round_interval_minutes": 15,
        "invitation_timeout_minutes": 60,
        "match_start_buffer_minutes": 5,
        "tournament_settings": null,
        "cancelled_at": null,
        "cancelled_reason": null,
        "user_participation": true,
        "user_status": "paid",
        "status": "in_progress",
        "format": "swiss_only",
        "registered_count": 3,
        "participants_count": 3,
        "is_registration_open": false,
        "name": "Organization Internal Tournament 7608",
        "registration_start_at": "2025-11-13T16:48:51.000000Z",
        "registration_end_at": "2025-11-13 18:55:00",
        "starts_at": "2025-11-13 19:00:00",
        "time_control": {
            "minutes": 10,
            "increment": 0
        },
        "participants": [
            {
                "id": 1,
                "championship_id": 4,
                "user_id": 1,
                "razorpay_order_id": null,
                "razorpay_payment_id": null,
                "razorpay_signature": null,
                "payment_status_id": 2,
                "amount_paid": "0.00",
                "registered_at": "2025-11-13T08:34:27.000000Z",
                "seed_number": null,
                "created_at": "2025-11-13T16:48:51.000000Z",
                "updated_at": "2025-11-13T16:48:51.000000Z",
                "payment_status": "completed",
                "user": {
                    "id": 1,
                    "name": "Arun Nalamara",
                    "email": "nalamara.arun@gmail.com",
                    "avatar_url": "http:\/\/localhost:8000\/storage\/avatars\/1_1763079330.jpg",
                    "rating": 1200
                },
                "payment_status_relation": {
                    "id": 2,
                    "code": "completed",
                    "label": "Completed",
                    "created_at": "2025-11-13T16:22:44.000000Z",
                    "updated_at": "2025-11-13T16:22:44.000000Z"
                }
            },
            {
                "id": 2,
                "championship_id": 4,
                "user_id": 3,
                "razorpay_order_id": null,
                "razorpay_payment_id": null,
                "razorpay_signature": null,
                "payment_status_id": 2,
                "amount_paid": "100.00",
                "registered_at": "2025-11-13T12:57:40.000000Z",
                "seed_number": null,
                "created_at": "2025-11-13T16:48:51.000000Z",
                "updated_at": "2025-11-13T16:48:51.000000Z",
                "payment_status": "completed",
                "user": {
                    "id": 3,
                    "name": "arun babu",
                    "email": "narun.iitb@gmail.com",
                    "avatar_url": "http:\/\/localhost:8000\/storage\/avatars\/3_1763052017.jpg",
                    "rating": 1200
                },
                "payment_status_relation": {
                    "id": 2,
                    "code": "completed",
                    "label": "Completed",
                    "created_at": "2025-11-13T16:22:44.000000Z",
                    "updated_at": "2025-11-13T16:22:44.000000Z"
                }
            },
            {
                "id": 3,
                "championship_id": 4,
                "user_id": 4,
                "razorpay_order_id": null,
                "razorpay_payment_id": null,
                "razorpay_signature": null,
                "payment_status_id": 2,
                "amount_paid": "100.00",
                "registered_at": "2025-11-13T13:07:53.000000Z",
                "seed_number": null,
                "created_at": "2025-11-13T16:48:51.000000Z",
                "updated_at": "2025-11-13T16:48:51.000000Z",
                "payment_status": "completed",
                "user": {
                    "id": 4,
                    "name": "Arun Nalamara",
                    "email": "sanatan.dharmam@gmail.com",
                    "avatar_url": "http:\/\/localhost:8000\/storage\/avatars\/4_1763052295.jpg",
                    "rating": 1200
                },
                "payment_status_relation": {
                    "id": 2,
                    "code": "completed",
                    "label": "Completed",
                    "created_at": "2025-11-13T16:22:44.000000Z",
                    "updated_at": "2025-11-13T16:22:44.000000Z"
                }
            }
        ],
        "standings": [],
        "status_relation": {
            "id": 3,
            "code": "in_progress",
            "label": "In Progress",
            "created_at": "2025-11-13T16:22:44.000000Z",
            "updated_at": "2025-11-13T16:22:44.000000Z"
        },
        "format_relation": {
            "id": 2,
            "code": "swiss_only",
            "label": "Swiss Only",
            "created_at": "2025-11-13T16:22:44.000000Z",
            "updated_at": "2025-11-13T16:22:44.000000Z"
        }
    },
    "summary": {
        "current_round": 0,
        "total_rounds": 5,
        "is_complete": false,
        "matches": {
            "pending": 0,
            "active": 0,
            "completed": 0,
            "total": 0
        },
        "can_schedule_next": true,
        "next_round_number": 1
    },
    "user_status": {
        "is_registered": true,
        "has_paid": true,
        "can_register": false
    }
}
--------------------------------
users
{
    "id": 1,
    "name": "Tatva Nalamara",
    "email": "nalamara.arun@gmail.com",
    "organization_id": null,
    "is_active": true,
    "last_login_at": null,
    "rating": 1200,
    "is_provisional": true,
    "games_played": 0,
    "peak_rating": 1200,
    "rating_last_updated": null,
    "email_verified_at": null,
    "provider": "google",
    "provider_id": "113424578044464968863",
    "avatar_url": "http:\/\/localhost:8000\/storage\/avatars\/1_1763101954.jpg",
    "created_at": "2025-11-14T06:32:34.000000Z",
    "updated_at": "2025-11-14T06:32:36.000000Z",
    "roles": []
}

{
    "id": 2,
    "name": "Vedansh Nalamara",
    "email": "narun.iitb@gmail.com",
    "organization_id": null,
    "is_active": true,
    "last_login_at": null,
    "rating": 1200,
    "is_provisional": true,
    "games_played": 0,
    "peak_rating": 1200,
    "rating_last_updated": null,
    "email_verified_at": null,
    "provider": "google",
    "provider_id": "106461582716916530527",
    "avatar_url": "http:\/\/localhost:8000\/storage\/avatars\/2_1763101975.jpg",
    "created_at": "2025-11-14T06:32:55.000000Z",
    "updated_at": "2025-11-14T06:32:55.000000Z",
    "roles": []
}

{
    "id": 3,
    "name": "Sanatan Nalamara",
    "email": "sanatan.dharmam@gmail.com",
    "organization_id": null,
    "is_active": true,
    "last_login_at": null,
    "rating": 1200,
    "is_provisional": true,
    "games_played": 0,
    "peak_rating": 1200,
    "rating_last_updated": null,
    "email_verified_at": null,
    "provider": "google",
    "provider_id": "113477216881286710932",
    "avatar_url": "http:\/\/localhost:8000\/storage\/avatars\/3_1763102020.jpg",
    "created_at": "2025-11-14T06:33:40.000000Z",
    "updated_at": "2025-11-14T06:33:40.000000Z",
    "roles": []
}

[
    {
        "id": 1,
        "name": "Arun Nalamara",
        "avatar_url": "http://localhost:8000/storage/avatars/1_1763079330.jpg",
        "rating": 1200
    },
    {
        "id": 3,
        "name": "arun babu",
        "avatar_url": "http://localhost:8000/storage/avatars/3_1763052017.jpg",
        "rating": 1200
    },
    {
        "id": 4,
        "name": "Arun Nalamara",
        "avatar_url": "http://localhost:8000/storage/avatars/4_1763052295.jpg",
        "rating": 1200
    }
]
