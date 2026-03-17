# UI & Design Conventions

Design principles and component conventions for The Magic Lab.

## Design Language

### Color

- **Accent**: Violet -- used for primary actions, active states, and brand identity
- **Neutral palette**: Gray scale via OKLCH color space (defined in `globals.css`)
- **Dark mode**: Full dark mode support via `next-themes` and Tailwind's `dark:` variant
- **Semantic colors**: destructive (red), muted (gray), accent (violet) -- all defined as CSS custom properties

### Typography

- **Font family**: Geist Sans (variable font) via `next/font/google`
- **Scale**: Tailwind default type scale
- **Monospace**: Geist Mono (for code blocks, technical data)

### Spacing & Layout

- **Mobile-first**: All styles start with mobile layout, progressively enhanced for larger screens
- **Touch targets**: Minimum 44x44px for all interactive elements (WCAG 2.1 AA)
- **Content width**: Max-width containers (`max-w-5xl` for marketing, sidebar-constrained for app)
- **Padding**: Consistent `p-4` / `px-6` spacing rhythm

### Motion

- **Duration**: Sub-200ms for micro-interactions (hover, focus, toggle)
- **Easing**: Default Tailwind easing curves
- **Animation library**: tw-animate-css for enter/exit animations
- **Reduced motion**: Respect `prefers-reduced-motion` media query

## Layout Patterns

### Mobile Navigation

- **Bottom tab bar** for primary module navigation (Improve, Train, Plan, Perform, Collect)
- Fixed to bottom of viewport
- 44px minimum touch targets
- Active state indicated by violet accent

### Desktop Navigation

- **Collapsible sidebar** (shadcn SidebarProvider)
- Shows module icons + labels
- Trigger button in the header
- Persists collapse state across sessions

### App Chrome

```
+------------------------------------------+
| [=] Module Name                          |  <- Header (48px, border-bottom)
+------------------------------------------+
|                                          |
|          Page Content                    |  <- Scrollable content area
|          (p-4)                           |
|                                          |
+------------------------------------------+
| [Improve] [Train] [Plan] [Perform] [...] |  <- Bottom tabs (mobile only)
+------------------------------------------+
```

## Component States

Every data-driven component must handle three states:

### Loading State

- Use skeleton placeholders (shadcn `Skeleton` component)
- Match the layout of the loaded state
- No layout shift when data arrives

### Empty State

- Centered illustration or icon
- Clear heading explaining what belongs here
- Call-to-action button to create the first item
- Example: "No tricks yet. Add your first trick to get started."

### Error State

- Clear error message (user-friendly, not technical)
- Retry button when applicable
- Fallback to cached data when offline

## shadcn/ui Components

The project uses shadcn/ui (new-york style) components built on Radix UI:

| Component | Usage |
|---|---|
| Button | Primary actions, navigation, forms |
| Card | Content containers, module cards |
| Input | Text input fields |
| Separator | Visual dividers |
| Sheet | Mobile slide-over panels |
| Sidebar | App navigation (desktop) |
| Skeleton | Loading placeholders |
| Tooltip | Contextual help text |
| Badge | Status indicators, tags |

### Component Styling

- Components use CVA (class-variance-authority) for variant management
- Styles composed with `cn()` utility (`clsx` + `tailwind-merge`)
- Custom variants extend the base shadcn styles, never override

## Accessibility

- **Skip link**: "Skip to main content" link on every page
- **Semantic HTML**: Proper heading hierarchy, landmarks, ARIA labels
- **Keyboard navigation**: All interactive elements focusable and operable via keyboard
- **Screen reader**: Meaningful alt text, `sr-only` labels for icon-only buttons
- **Focus indicators**: Visible focus rings on all interactive elements
- **Color contrast**: WCAG 2.1 AA minimum (4.5:1 for text, 3:1 for large text)

## Icons

- **Library**: Lucide React
- **Size**: `size-4` (16px) inline, `size-6` (24px) in buttons/nav, `size-12` (48px) feature cards
- **Style**: Consistent stroke width, no filled variants

## Responsive Breakpoints

Following Tailwind's default breakpoints:

| Prefix | Min Width | Use |
|---|---|---|
| (none) | 0px | Mobile (default) |
| `sm` | 640px | Large phones, small tablets |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small desktops |
| `xl` | 1280px | Large desktops |

## See Also

- [architecture.md](./architecture.md) -- Tech stack details
- [testing.md](./testing.md) -- Component testing approach
