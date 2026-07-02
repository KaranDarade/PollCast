# PollCast Frontend Architecture

## Overview

The frontend is built with Next.js 14+ (App Router), React 18, TypeScript, Tailwind CSS, and shadcn/ui. It's a fully responsive, accessible, and performant application.

## Tech Choices

### Next.js App Router
- **File-based routing**: Intuitive, nested layouts, loading states
- **React Server Components (RSC)** : Reduce client-side JavaScript, improve SEO
- **Server Actions**: Form handling without API boilerplate
- **ISR/SSG**: Static generation for public pages
- **Middleware**: Auth checks, redirects

### Tailwind CSS + shadcn/ui
- **Tailwind**: Utility-first, fast iteration, consistent design
- **shadcn/ui**: Copy-paste components, full control, accessible (Radix UI primitives)
- **Dark/light mode**: Tailwind `dark:` variant, `next-themes`

### Framer Motion
- **Page transitions**: `AnimatePresence` for route changes
- **Live results**: Animate poll bar changes during realtime updates
- **Modals/Drawers**: Mount/unmount animations
- **Micro-interactions**: Button hover, card hover, skeleton loading

### React Hook Form + Zod
- **RHF**: Performant form handling, minimal re-renders
- **Zod**: Schema validation, shared with backend
- **Integration**: `@hookform/resolvers/zod` for seamless validation

### Recharts
- **Poll results**: Bar charts, pie charts
- **Analytics**: Line charts for engagement over time
- **Composable**: React-native, easy to customize

## Component Architecture

```
components/
├── ui/                    # shadcn/ui primitives (button, card, dialog, etc.)
├── layout/                # App shell, sidebar, navbar, footer
├── auth/                  # Login form, signup form, password reset
├── events/               # Event card, event list, event form, invite modal
├── polls/                # Poll creator, poll card, poll results, vote form
├── questions/            # Question card, question list, Q&A panel
├── analytics/            # Charts, metrics cards, summary views
└── shared/               # Loading states, empty states, error boundaries
```

### Component Design Principles

1. **Single Responsibility**: Each component does one thing
2. **Composition over Configuration**: Combine small components, not giant prop objects
3. **Server Components by Default**: Only add `'use client'` when needed (interactivity, hooks)
4. **Controlled Components**: Form inputs use RHF, not local state
5. **Error Boundaries**: Every data-fetching section has error + loading states

## Data Flow

### Client → Server (HTTP)

```
React Component
    │
    ▼
Custom Hook (useEvents, useAuth, etc.)
    │
    ▼
Service Layer (api/events.ts, api/auth.ts)
    │
    ├── Constructs URL + headers
    ├── Attaches JWT from auth context
    ├── Calls fetch() with credentials
    └── Returns typed response
    │
    ▼
React Component renders with data
    │
    ▼
Error? → Error boundary / toast notification
Success → Update local state / cache
```

### Client → Server (WebSocket)

```
Component
    │
    ▼
Socket Hook (useSocket, useEventRoom)
    │
    ├── Connects to Socket.IO server
    ├── Authenticates via JWT
    ├── Joins event room
    └── Listens for events
    │
    ▼
Realtime Event Received
    │
    ▼
Component updates optimistically
    │
    ▼
Framer Motion animates the change
    │
    ▼
Toast notification (optional)
```

## State Management

We use a **layered state approach**:

1. **Server State** (React Query / SWR)
   - Event lists, user data, poll history
   - Cached, refetched, background sync
   - Not used here — keeping it simple with fetch + React context

2. **Client State** (React Context + hooks)
   - Auth state (user, tokens)
   - Socket connection state
   - UI state (theme, sidebar open)

3. **Realtime State** (Socket.IO events)
   - Live poll results
   - New questions
   - Participant updates
   - These update local state directly from socket events

## Routing Structure

```
/app
├── (auth)                  # Auth layout (centered, minimal)
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
│
├── (dashboard)             # Dashboard layout (sidebar, navbar)
│   ├── dashboard/page.tsx
│   ├── events/
│   │   ├── page.tsx        # List all events
│   │   ├── [id]/page.tsx   # Single event (host view)
│   │   ├── create/page.tsx # Create event form
│   │   └── join/page.tsx   # Join event form
│   │
│   ├── polls/
│   │   ├── [id]/page.tsx   # Poll view + vote
│   │   └── create/page.tsx # Create poll form
│   │
│   ├── analytics/
│   │   └── [eventId]/page.tsx
│   │
│   └── settings/page.tsx
│
├── event/[code]/page.tsx   # Public event page (participant view)
├── layout.tsx              # Root layout
├── page.tsx                # Landing page
└── globals.css             # Global styles
```

## UI/UX Patterns

### Loading States
- **Skeleton loaders**: For cards, lists, and detail views
- **Shimmer loading**: Animated gradient placeholders
- **Progressive loading**: Content appears as it loads

### Empty States
- Illustration + message for empty lists
- CTA button to create first item
- Example: "No events yet. Create your first event!"

### Error States
- Friendly error messages with retry button
- Error boundaries per section (one section crash doesn't break whole page)
- Toast notifications for non-blocking errors

### Optimistic UI
- When user votes, immediately update the UI
- If server rejects, rollback with a toast
- Socket.IO confirmation or timeout

### Responsive Breakpoints
- **Desktop** (≥1024px): Full sidebar, rich analytics, spacious cards
- **Tablet** (768-1023px): Collapsed sidebar, adaptive grids
- **Mobile** (<768px): Bottom navigation, full-width cards, touch targets ≥44px

## Accessibility

- All shadcn/ui components are built on Radix UI (WCAG compliant)
- Keyboard navigation: Tab, Enter, Escape, Arrow keys
- ARIA labels on all interactive elements
- Focus indicators visible (not removed)
- Color contrast meets WCAG AA
- Reduced motion support: `prefers-reduced-motion` disables animations

## Performance Targets

| Metric | Target |
|--------|--------|
| LCP | <2.5s |
| FID | <100ms |
| CLS | <0.1 |
| TTI | <3.5s |
| First paint | <1.5s |

## Development Guidelines

1. **No `any` types** — always type properly
2. **Server components first** — only add `'use client'` when necessary
3. **Small components** — max ~200 lines per file
4. **Custom hooks** — extract all logic into hooks
5. **Tailwind classes** — use `cn()` utility for conditional classes
6. **Accessibility** — every interactive element needs keyboard + screen reader support
7. **Testing** — components with logic need unit tests
