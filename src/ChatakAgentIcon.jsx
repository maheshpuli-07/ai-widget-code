import { Sparkles } from 'lucide-react';
import { cn } from './cn.js';

/**
 * Lifted verbatim from Payment-Gateway-Portal `DashboardAgentAssistant.tsx`
 * (`AssistantGlyph`, `AgentOrb`, `AgenticFabGlyph`) — same SVG, class hooks,
 * keyframes, Sparkles, and motion-safe / motion-reduce behaviour.
 * Utilities use the widget `ew-` Tailwind prefix; theme includes `primary` like the portal.
 */

export function AssistantGlyph({ className }) {
  return (
    <svg
      className={cn('copilot-robo-glyph', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <defs>
        <style>
          {`
            @media (prefers-reduced-motion: no-preference) {
              @keyframes copilot-antenna-sway {
                0%, 100% { transform: rotate(-6deg); }
                50% { transform: rotate(7deg); }
              }
              @keyframes copilot-blink {
                0%, 48%, 52%, 100% { transform: scaleY(1); }
                49.5%, 50.5% { transform: scaleY(0.12); }
              }
              .copilot-robo-glyph .copilot-antenna {
                transform-origin: 12px 6.5px;
                animation: copilot-antenna-sway 2.6s ease-in-out infinite;
              }
              .copilot-robo-glyph .copilot-eye-l {
                transform-origin: 9.75px 14px;
                animation: copilot-blink 3.6s ease-in-out infinite;
              }
              .copilot-robo-glyph .copilot-eye-r {
                transform-origin: 14.25px 14px;
                animation: copilot-blink 3.6s ease-in-out infinite;
                animation-delay: 45ms;
              }
            }
          `}
        </style>
      </defs>
      <g className="copilot-antenna">
        <path d="M12 3.25v3.25" />
        <circle cx="12" cy="2.35" r="0.95" fill="currentColor" stroke="none" />
      </g>
      <rect x="5" y="8.5" width="14" height="11.5" rx="2.75" />
      <g className="copilot-eye-l">
        <circle cx="9.75" cy="14" r="1.25" fill="currentColor" stroke="none" />
      </g>
      <g className="copilot-eye-r">
        <circle cx="14.25" cy="14" r="1.25" fill="currentColor" stroke="none" />
      </g>
      <path d="M9.25 18h5.5" strokeWidth="1.5" />
    </svg>
  );
}

export function AgentOrb({ className }) {
  return (
    <div
      className={cn(
        'ew-flex ew-h-12 ew-w-12 ew-shrink-0 ew-items-center ew-justify-center ew-overflow-visible ew-rounded-xl ew-bg-gradient-to-br ew-from-slate-800 ew-to-slate-950 ew-text-white ew-shadow-md ew-ring-1 ew-ring-primary/20',
        className,
      )}
      aria-hidden
    >
      <span className="ew-agent-wander ew-flex ew-items-center ew-justify-center">
        <AssistantGlyph className="ew-h-9 ew-w-9" />
      </span>
    </div>
  );
}

/**
 * Reddit-style: round glass disc, no fill behind the glyph — the mark “moves” in 3D inside the circle.
 */
export function AgenticFabGlyph({ className }) {
  return (
    <span
      className={cn(
        'ew-relative ew-flex ew-h-full ew-w-full ew-min-h-0 ew-min-w-0 ew-items-center ew-justify-center ew-overflow-visible',
        'ew-[transform-style:preserve-3d] ew-will-change-transform',
        'motion-safe:ew-animate-agent-fab-3d motion-reduce:ew-animate-none',
        className,
      )}
      aria-hidden
    >
      <span className="ew-agent-wander ew-relative ew-flex ew-h-full ew-w-full ew-items-center ew-justify-center">
        <AssistantGlyph className="ew-relative ew-z-[1] ew-h-8 ew-w-8 sm:ew-h-10 sm:ew-w-10 ew-text-primary ew-drop-shadow-[0_2px_3px_rgba(0,0,0,0.18)] motion-reduce:ew-drop-shadow-none" />
        <Sparkles
          className="ew-absolute -ew-right-0.5 -ew-top-0.5 ew-z-[2] ew-h-3.5 ew-w-3.5 sm:ew-h-4 sm:ew-w-4 ew-text-amber-500 ew-drop-shadow-[0_1px_2px_rgba(180,83,9,0.35)]"
          strokeWidth={2.35}
        />
      </span>
    </span>
  );
}
