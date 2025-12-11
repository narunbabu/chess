# Game End Card Visual Specification

## Card Layout Structure

```
╔══════════════════════════════════════════════════════════╗
║                    [Chess99 Logo]                        ║
║                 ─────────────────────                     ║
║                                                          ║
║                        🏆                                ║
║                     Victory!                             ║
║                                                          ║
║        You defeated Tatva by checkmate!                 ║
║                                                          ║
║  ┌──────────────────────┐ VS ┌──────────────────────┐  ║
║  │ 👤 ♔                │    │ 👤 ♚                │  ║
║  │ Vedansh (You)        │    │ Tatva                │  ║
║  │ Rating: 1263?        │    │ Rating: 1191         │  ║
║  │ Score: 9.50          │    │ Score: 6.90          │  ║
║  └──────────────────────┘    └──────────────────────┘  ║
║                                                          ║
║  ┌───────────────────────────────────────────────────┐  ║
║  │ Moves: 12  │  Duration: 1m  │  Result: checkmate │  ║
║  └───────────────────────────────────────────────────┘  ║
║                                                          ║
║  Rating: 1200 (+13) → 1213                              ║
║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │ 🏆 Congratulations on your victory!                 │ ║
║  │     Think you can win again?                        │ ║
║  │                                                     │ ║
║  │ 💪 Want to challenge Tatva?                        │ ║
║  │     Or try to beat this performance! 🚀            │ ║
║  │                                                     │ ║
║  │ ─────────────────────────────────                  │ ║
║  │ 📱 Share this result and let others                │ ║
║  │     try to beat you!                               │ ║
║  └─────────────────────────────────────────────────────┘ ║
║                                                          ║
║           ═══════════════════════════                   ║
║                                                          ║
║  ┌─────────────────────────────────────────────────────┐ ║
║  │        WANT TO TEST YOUR CHESS SKILLS?              │ ║
║  │                                                     │ ║
║  │         Register and Try me at                     │ ║
║  │       ┌─────────────────────────┐                  │ ║
║  │       │   www.chess99.com   │                  │ ║
║  │       └─────────────────────────┘                  │ ║
║  └─────────────────────────────────────────────────────┘ ║
╚══════════════════════════════════════════════════════════╝
```

## Visual Elements Breakdown

### 1. Header Section
```
┌────────────────────────────────┐
│     [Chess99 Logo - 50px]      │
│    ────────────────────         │
└────────────────────────────────┘
```
- **Logo**: Professional branding, centered
- **Border**: Subtle gray separator line
- **Background**: Transparent with slight shadow

### 2. Result Icon & Title
```
        🏆
     Victory!
```
- **Icon**: 4.5rem, bouncing animation
- **Color**: Green (#27ae60) for win, Red (#c0392b) for loss
- **Title**: 2.2rem, bold (600), dark text

### 3. Result Message
```
You defeated Tatva by checkmate!
```
- **Personalized**: Uses opponent name and end reason
- **Font**: 1.1rem, medium weight
- **Color**: Dark blue-grey

### 4. Player Cards (Multiplayer)
```
┌────────────────────┐ VS ┌────────────────────┐
│ 👤 ♔              │    │ 👤 ♚              │
│ Vedansh (You)      │    │ Tatva              │
│ Rating: 1263?      │    │ Rating: 1191       │
│ Score: 9.50        │    │ Score: 6.90        │
└────────────────────┘    └────────────────────┘
```
- **Avatar**: 60px circle with chess piece indicator
- **You Badge**: Golden background highlight
- **Gradient**: User card has golden accent
- **Hover**: Lift effect with shadow

### 5. Game Stats
```
┌───────────────────────────────────────────┐
│ Moves: 12 │ Duration: 1m │ Result: checkmate │
└───────────────────────────────────────────┘
```
- **Layout**: Horizontal flex, three columns
- **Styling**: Dark background with light text
- **Mobile**: Stacks vertically

### 6. Rating Update
```
Rating: 1200 (+13) → 1213
```
- **Change**: Green for positive, red for negative
- **Arrow**: Shows direction of change
- **New Rating**: Emphasized, larger font

### 7. Call-to-Action Box
```
┌─────────────────────────────────────┐
│ 🏆 Congratulations on your victory! │
│     Think you can win again?        │
│                                     │
│ 💪 Want to challenge Tatva?        │
│     Or try to beat this! 🚀        │
│                                     │
│ ──────────────────────────          │
│ 📱 Share and let others try!       │
└─────────────────────────────────────┘
```
- **Background**: Yellow gradient (#fff3cd → #ffeaa7)
- **Border**: Golden (#ffc107)
- **Emoji**: Bouncing animation
- **Text**: Bold main, italic subtext

### 8. Branding Footer
```
═══════════════════════════

┌─────────────────────────────────┐
│  WANT TO TEST YOUR CHESS SKILLS? │
│                                 │
│    Register and Try me at       │
│   ┌───────────────────────┐     │
│   │  www.chess99.com  │     │
│   └───────────────────────┘     │
└─────────────────────────────────┘
```
- **Divider**: Golden gradient line
- **Tagline**: Uppercase, bold, dark text
- **Link**: Blue with gradient background
- **Border**: 2px blue (#2196f3)
- **Hover**: Lifts up with shadow

## Color Palette

### Primary Colors
- **Win Green**: `#27ae60` (solid), `rgba(46, 204, 113, 0.85)` (background)
- **Loss Red**: `#c0392b` (solid), `rgba(231, 76, 60, 0.85)` (background)
- **Golden Accent**: `#ffc107` (borders, highlights)
- **Dark Text**: `#34495e` (main text)
- **Medium Grey**: `#7f8c8d` (secondary text)

### Branding Colors
- **Link Blue**: `#0066cc` (normal), `#004499` (hover)
- **Link Background**: `#e3f2fd → #bbdefb` (gradient)
- **Link Border**: `#2196f3` (normal), `#1976d2` (hover)
- **CTA Background**: `#f8f9fa → #e9ecef` (gradient)
- **CTA Border**: `#ffc107` (golden)

### Call-to-Action Colors
- **Background**: `#fff3cd → #ffeaa7` (yellow gradient)
- **Border**: `#ffc107` (golden)
- **Text**: `#856404` (brown-gold)

## Typography Scale

### Desktop
- **Result Icon**: 4.5rem (emoji)
- **Result Title**: 2.2rem (Victory!/Defeat!)
- **Player Names**: 1.1rem (bold)
- **Ratings**: 0.95rem (medium)
- **Scores**: 1.2rem (bold)
- **CTA Main**: 1.1rem (bold)
- **CTA Sub**: 0.9rem (italic)
- **Branding Link**: 1.3rem (bold)

### Mobile (< 600px)
- **Logo**: 40px height
- **Player Names**: 0.95rem
- **Ratings**: 0.85rem
- **Scores**: 0.9rem
- **CTA Main**: 1rem
- **CTA Sub**: 0.8rem
- **Branding Link**: 1.1rem

## Spacing System

### Margins
- **Header Bottom**: 15px
- **Footer Top**: 25px
- **CTA Top**: 20px
- **Sections**: 20px vertical spacing

### Padding
- **Card**: 30px 40px (desktop), 20px 30px (mobile)
- **Player Cards**: 15px
- **CTA Box**: 15px (desktop), 12px (mobile)
- **Branding Footer**: 15px

### Gaps
- **Player Cards**: 30px horizontal
- **Game Stats**: 15px between items
- **CTA Elements**: 8px vertical

## Animation Effects

### Bouncing Icon
```css
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
```
- **Duration**: 1.2s
- **Timing**: ease-in-out
- **Infinite**: Yes

### Hover Effects
```css
.branding-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(33, 150, 243, 0.3);
}
```
- **Lift**: 2px up
- **Shadow**: Colored glow
- **Transition**: 0.3s ease

### Card Appearance
```css
.completion-card {
  transform: scale(0.9) translateY(20px);
  opacity: 0;
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.completion-card.visible {
  transform: scale(1) translateY(0);
  opacity: 1;
}
```
- **Initial**: Scaled down, offset, transparent
- **Final**: Full size, centered, opaque
- **Duration**: 0.4s
- **Easing**: Smooth cubic-bezier

## Background Treatment

### Subtle Chess Background
```css
background-image:
  linear-gradient(rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.98)),
  url(chess-playing-kids-crop.jpeg);
background-size: cover;
background-position: center;
```
- **Overlay**: 95-98% white
- **Purpose**: Subtle context without distraction
- **Fallback**: White background

## Responsive Breakpoints

### Desktop (> 600px)
- Full horizontal player card layout
- Larger typography
- More generous spacing
- Multi-column game stats

### Mobile (≤ 600px)
- Vertical player card stacking
- Reduced typography sizes
- Compact spacing
- Single column game stats

## Export Specifications

### Image Export (Social Sharing)
- **Format**: PNG
- **Scale**: 2x for retina displays
- **Background**: White with subtle chess image
- **Includes**: Logo, all game info, branding footer
- **Clickable**: URL visible in image

### Dimensions
- **Desktop Card**: ~480px width (responsive)
- **Mobile Card**: ~90% viewport width
- **Export Image**: 960px width (2x scale)

## Usage Contexts

### 1. Game End Animation
- Appears immediately after game completes
- Full animation sequence
- Interactive hover effects
- Clickable website link

### 2. Social Share Preview
- Exported as static image
- All branding visible
- URL prominently displayed
- Professional, shareable format

### 3. Game Review Modal
- Shown when clicking share button
- Clean, professional presentation
- Encourages social sharing
- Drives traffic to platform

## Accessibility

- **Alt Text**: Logo has "Chess99" alt text
- **Color Contrast**: WCAG AA compliant
- **Focus States**: Clear keyboard navigation
- **Screen Readers**: Semantic HTML structure
- **Link Target**: Opens in new tab (_blank)

## Performance

- **Images**: Optimized PNG files
- **CSS**: Lightweight gradients
- **Animations**: GPU-accelerated transforms
- **Load Time**: < 100ms for card render
- **Export Time**: 1-2s for image generation

---

This card design balances celebration of player achievement with strategic brand promotion, creating a share-worthy asset that drives organic user acquisition through social channels. 🏆♟️
