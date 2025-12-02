# Championship vs Tournament Terminology Standardization

## Executive Summary

**Decision**: Standardize on "Championship" terminology across entire codebase.

**Rationale**:
- Database uses "championships" table (established schema)
- Laravel models use `Championship`, `ChampionshipMatch`, `ChampionshipParticipant`
- Frontend already predominantly uses "Championship" components
- API endpoints use `/api/championships`
- Less migration overhead vs renaming database tables

## Implementation Plan

### Phase 1: Backend Standardization (P0)
**Timeline**: 1-2 days
**Impact**: Low risk, high consistency gain

#### Files to Update:
1. **Controllers**: Replace `tournament` references with `championship`
2. **Comments**: Update docblocks and inline comments
3. **Variable Names**: Local variables in controllers/services
4. **Validation Messages**: User-facing error messages
5. **Log Messages**: Debug and informational logs

#### Specific Changes:
- `TournamentAdminDashboard` → `ChampionshipAdminDashboard`
- `TournamentManagementDashboard` → `ChampionshipManagementDashboard`
- `TournamentPreview` → `ChampionshipPreview`
- `TournamentConfigurationModal` → `ChampionshipConfigurationModal`

### Phase 2: Frontend Component Rename (P1)
**Timeline**: 2-3 days
**Impact**: Medium risk (requires import updates)

#### Component Renames:
```javascript
// BEFORE
TournamentAdminDashboard
TournamentManagementDashboard
TournamentPreview
TournamentConfigurationModal

// AFTER
ChampionshipAdminDashboard
ChampionshipManagementDashboard
ChampionshipPreview
ChampionshipConfigurationModal
```

#### File Renames:
- `TournamentAdminDashboard.jsx` → `ChampionshipAdminDashboard.jsx`
- `TournamentManagementDashboard.jsx` → `ChampionshipManagementDashboard.jsx`
- `TournamentPreview.jsx` → `ChampionshipPreview.jsx`
- `TournamentConfigurationModal.jsx` → `ChampionshipConfigurationModal.jsx`

#### Import Updates:
```javascript
// All files importing these components need updates
import TournamentAdminDashboard from './TournamentAdminDashboard';
// ↓
import ChampionshipAdminDashboard from './ChampionshipAdminDashboard';
```

### Phase 3: API Response Consistency (P1)
**Timeline**: 1 day
**Impact**: Low risk (JSON field names)

#### Response Format Standardization:
```json
// BEFORE (mixed)
{
  "championship": { ... },
  "tournament_config": { ... },
  "tournament_settings": { ... }
}

// AFTER (consistent)
{
  "championship": { ... },
  "championship_config": { ... },
  "championship_settings": { ... }
}
```

### Phase 4: Database Field Consistency (P2)
**Timeline**: 3-4 days
**Impact**: Higher risk (requires migration)

#### Field Rename Planning:
```sql
-- Current mixed fields:
tournament_config → championship_config
tournament_settings → championship_settings
tiebreak_config → championship_tiebreak_config

-- Migration plan:
-- 1. Add new fields
-- 2. Migrate data
-- 3. Update application to use new fields
-- 4. Drop old fields in future version
```

## Search & Replace Patterns

### Backend Patterns:
```php
// Search for:
"tournament"
" Tournament"
'_tournament'
'tournament'

// Replace with:
"championship"
" Championship"
'_championship'
'championship'
```

### Frontend Patterns:
```javascript
// Search for:
tournament
Tournament
TOURNAMENT

// Replace with:
championship
Championship
CHAMPIONSHIP
```

### CSS Class Names:
```css
/* Before */
.tournament-dashboard
.tournament-config

/* After */
.championship-dashboard
.championship-config
```

## Validation Strategy

### Pre-Deployment:
1. **Code Review**: Ensure all "Tournament" references are intentional
2. **Search Verification**: Global search for remaining "Tournament" terms
3. **Test Coverage**: Verify renamed components have tests
4. **API Testing**: Check response format consistency

### Post-Deployment:
1. **User Testing**: Verify UI displays correct terminology
2. **Error Monitoring**: Watch for broken imports or missing components
3. **Performance**: Ensure no regressions from component renames

## Risk Mitigation

### Low Risk:
- Comment updates
- Variable name changes
- String literal updates

### Medium Risk:
- Component renames (requires import updates)
- API field name changes

### High Risk:
- Database schema changes
- Large-scale file renames

## Rollback Plan

### If Issues Detected:
1. **Revert component renames** via git revert
2. **Restore API field names** with temporary backward compatibility
3. **Keep database changes** if migration already run
4. **Communicate** clear timeline for fixes

### Migration Windows:
- **Database**: During scheduled maintenance window
- **Code**: Deploy during low-traffic periods
- **Frontend**: Feature flag rollout if needed

## Success Metrics

### Quantitative:
- 0 "Tournament" references in code (except intentional legacy support)
- 100% component import consistency
- 0 API response format mismatches

### Qualitative:
- Consistent user experience across all interfaces
- Developer clarity (no terminology confusion)
- Reduced cognitive load for new team members

## Implementation Checklist

### Phase 1: Backend (P0)
- [ ] Update all controller comments and variable names
- [ ] Fix validation message terminology
- [ ] Update log messages
- [ ] Search and replace in service classes
- [ ] Update API documentation

### Phase 2: Frontend (P1)
- [ ] Rename component files
- [ ] Update all import statements
- [ ] Update CSS class names
- [ ] Update prop names and interfaces
- [ ] Test component functionality

### Phase 3: API (P1)
- [ ] Standardize JSON response field names
- [ ] Update API documentation
- [ ] Update frontend API consumers
- [ ] Test all API endpoints

### Phase 4: Database (P2)
- [ ] Create migration for field renames
- [ ] Test data migration in staging
- [ ] Update model $fillable arrays
- [ ] Update all references to old field names
- [ ] Deploy migration during maintenance window

## Dependencies

### Required Before:
- Code review of current "Tournament" usage
- Inventory of all affected files
- Test suite updated for renamed components

### Required After:
- Updated documentation
- Team training on new terminology
- Updated onboarding materials