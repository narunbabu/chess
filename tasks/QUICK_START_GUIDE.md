# Chess Web - Quick Start Guide

**Current Status:** Phase 1 Complete ✅ | Ready for Phase 2A
**Time to Next Demo:** 2 weeks (Phase 2A completion)

---

## 🚀 Immediate Action Items

### This Week Priority List
1. **✅ Validate Phase 1 Setup** (30 minutes)
2. **🔄 Start Phase 2A Development** (This Week)
3. **📋 Set Up Development Workflow** (1 hour)

---

## ⚡ 30-Second Status Check

Run these commands to verify everything is working:

```bash
# 1. Check database migrations
php composer.phar exec -- php artisan migrate:status

# 2. Start WebSocket server (keep running)
php composer.phar exec -- php artisan reverb:start

# 3. Start Laravel server (new terminal)
php composer.phar exec -- php artisan serve

# 4. Test basic functionality
curl http://localhost:8000
```

**✅ Expected Results:**
- Migrations: All should show "Ran"
- Reverb: "Reverb server started"
- Laravel: "Laravel development server started"
- Curl: Homepage loads successfully

---

## 🎯 Next 2 Hours: Phase 2A Kickoff

### Hour 1: WebSocket Authentication Setup

**Goal:** Secure WebSocket connections with user authentication

```bash
# 1. Create authentication middleware
php composer.phar exec -- php artisan make:middleware WebSocketAuth

# 2. Create channel authorization
php composer.phar exec -- php artisan make:channel GameChannel

# 3. Update Reverb configuration
# Edit: config/reverb.php
```

**Files to Create/Edit:**
- `app/Http/Middleware/WebSocketAuth.php`
- `app/Broadcasting/GameChannel.php`
- `routes/channels.php`

### Hour 2: Game Room Management

**Goal:** Players can create and join game rooms

```bash
# 1. Create game room controller
php composer.phar exec -- php artisan make:controller GameRoomController

# 2. Create room management service
php composer.phar exec -- php artisan make:service GameRoomService

# 3. Add room routes
# Edit: routes/web.php
```

**Files to Create/Edit:**
- `app/Http/Controllers/GameRoomController.php`
- `app/Services/GameRoomService.php`
- `routes/web.php`

---

## 📋 Daily Development Workflow

### Morning Routine (10 minutes)
```bash
# 1. Pull latest changes
git pull origin master

# 2. Check migrations
php composer.phar exec -- php artisan migrate:status

# 3. Start development servers
php composer.phar exec -- php artisan reverb:start &
php composer.phar exec -- php artisan serve &

# 4. Run tests
php composer.phar exec -- php artisan test
```

### Evening Routine (10 minutes)
```bash
# 1. Run tests before commit
php composer.phar exec -- php artisan test

# 2. Commit daily progress
git add .
git commit -m "Day X: [feature] - [brief description]"

# 3. Update task status (optional)
# Edit: PHASE_2_TASKS.md with completed items
```

---

## 🛠️ Essential Development Commands

### Laravel Commands
```bash
# Database
php composer.phar exec -- php artisan migrate
php composer.phar exec -- php artisan migrate:rollback
php composer.phar exec -- php artisan db:seed

# Development
php composer.phar exec -- php artisan serve
php composer.phar exec -- php artisan reverb:start
php composer.phar exec -- php artisan queue:work

# Code Generation
php composer.phar exec -- php artisan make:controller [Name]
php composer.phar exec -- php artisan make:model [Name]
php composer.phar exec -- php artisan make:middleware [Name]
php composer.phar exec -- php artisan make:event [Name]

# Testing
php composer.phar exec -- php artisan test
php composer.phar exec -- php artisan test --filter=[TestName]
```

### Git Workflow
```bash
# Feature development
git checkout -b feature/phase-2a-auth
git add .
git commit -m "Add WebSocket authentication middleware"
git push origin feature/phase-2a-auth

# Merge to master
git checkout master
git merge feature/phase-2a-auth
git push origin master
```

---

## 🎯 Week 1 Detailed Plan

### Monday: WebSocket Authentication
**Time:** 4-6 hours
**Goal:** Secure WebSocket connections

**Tasks:**
- [ ] Create WebSocket authentication middleware
- [ ] Implement channel authorization for game rooms
- [ ] Test authentication with dummy users
- [ ] Document authentication flow

**Success Criteria:**
- Users must be authenticated to join game channels
- Invalid tokens are rejected
- Connection persists after authentication

### Tuesday: Game Room Creation
**Time:** 4-6 hours
**Goal:** Players can create game rooms

**Tasks:**
- [ ] Create GameRoom model and migration
- [ ] Implement room creation API
- [ ] Add room status management
- [ ] Test room creation and validation

**Success Criteria:**
- Rooms created with unique IDs
- Room capacity limited to 2 players
- Room status tracked (waiting, active, completed)

### Wednesday: Room Discovery & Joining
**Time:** 4-6 hours
**Goal:** Players can find and join rooms

**Tasks:**
- [ ] Implement room listing API
- [ ] Add room joining functionality
- [ ] Create quick match system
- [ ] Test room discovery flow

**Success Criteria:**
- Public rooms are discoverable
- Players can join available rooms
- Room capacity is enforced

### Thursday: Player Handshake Protocol
**Time:** 4-6 hours
**Goal:** Players establish game connection

**Tasks:**
- [ ] Design handshake message protocol
- [ ] Implement readiness confirmation
- [ ] Add color assignment logic
- [ ] Test handshake completion

**Success Criteria:**
- Both players confirm readiness
- Colors assigned (white/black)
- Game state initialized

### Friday: Integration & Testing
**Time:** 4-6 hours
**Goal:** End-to-end connection flow

**Tasks:**
- [ ] Integration testing of full flow
- [ ] Bug fixes and refinements
- [ ] Connection recovery testing
- [ ] Documentation updates

**Success Criteria:**
- Two players can reliably connect
- Connection survives interruptions
- Handshake completes within 3 seconds

---

## 🔍 Testing Strategy

### Manual Testing Checklist
```bash
# Phase 2A Testing
□ User can authenticate WebSocket connection
□ Game room can be created successfully
□ Room appears in public listing
□ Second player can join the room
□ Room capacity is enforced (max 2 players)
□ Handshake protocol completes for both players
□ Colors are assigned correctly
□ Connection recovers after network interruption
```

### Automated Testing
```bash
# Run all tests
php composer.phar exec -- php artisan test

# Specific test categories
php composer.phar exec -- php artisan test --testsuite=Feature
php composer.phar exec -- php artisan test --testsuite=Unit

# Test specific functionality
php composer.phar exec -- php artisan test --filter=GameRoomTest
php composer.phar exec -- php artisan test --filter=WebSocketAuthTest
```

---

## 🚨 Common Issues & Solutions

### WebSocket Connection Issues
**Problem:** "Connection refused" or "WebSocket failed"
**Solution:**
```bash
# Check if Reverb is running
ps aux | grep reverb

# Restart Reverb server
php composer.phar exec -- php artisan reverb:restart

# Check port availability
netstat -an | grep 8080
```

### Database Migration Issues
**Problem:** Migration fails or tables not found
**Solution:**
```bash
# Check migration status
php composer.phar exec -- php artisan migrate:status

# Rollback and re-run
php composer.phar exec -- php artisan migrate:rollback
php composer.phar exec -- php artisan migrate

# Fresh migration (WARNING: loses data)
php composer.phar exec -- php artisan migrate:fresh
```

### Authentication Issues
**Problem:** Users can't authenticate or join channels
**Solution:**
```bash
# Clear authentication cache
php composer.phar exec -- php artisan cache:clear

# Check user sessions
php composer.phar exec -- php artisan tinker
>>> App\Models\User::all()

# Verify channel definitions
# Check: routes/channels.php
```

---

## 📊 Progress Tracking

### Week 1 Goals
- [ ] **Monday:** WebSocket authentication ✅/❌
- [ ] **Tuesday:** Game room creation ✅/❌
- [ ] **Wednesday:** Room discovery ✅/❌
- [ ] **Thursday:** Player handshake ✅/❌
- [ ] **Friday:** Integration testing ✅/❌

### Week 2 Goals
- [ ] **Monday:** Game state sync ✅/❌
- [ ] **Tuesday:** Connection recovery ✅/❌
- [ ] **Wednesday:** Error handling ✅/❌
- [ ] **Thursday:** Performance testing ✅/❌
- [ ] **Friday:** Phase 2A completion ✅/❌

### Success Metrics
- **Connection Success Rate:** Target >95%
- **Handshake Time:** Target <3 seconds
- **Error Rate:** Target <5%
- **Test Coverage:** Target >80%

---

## 📞 Support & Resources

### Documentation References
- **Laravel WebSocket:** https://laravel.com/docs/11.x/reverb
- **Chess Rules Reference:** /docs/chess-rules.md (to be created)
- **API Documentation:** /docs/api-reference.md (to be created)

### Quick Reference Files
- **Phase 2 Tasks:** `PHASE_2_TASKS.md`
- **Technical Architecture:** `TECHNICAL_ARCHITECTURE.md`
- **Implementation Roadmap:** `IMPLEMENTATION_ROADMAP.md`

### Emergency Contacts
- **Primary Developer:** [Your name/contact]
- **Project Repository:** [Git repository URL]
- **Issue Tracking:** [Issue tracker URL]

---

**Last Updated:** September 27, 2025
**Next Update:** End of Week 1 (Phase 2A progress review)
**Version:** 1.0

---

## 🎉 Ready to Start!

You now have:
- ✅ **Complete foundation** from Phase 1
- 📋 **Detailed task breakdown** for next phases
- 🏗️ **Technical architecture** documentation
- 🛣️ **Implementation roadmap** with timelines
- ⚡ **Quick start guide** for immediate action

**Next Step:** Begin Phase 2A development with WebSocket authentication!

Happy coding! 🚀