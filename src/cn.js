/** Tiny `clsx`-style helper — keeps Chatak-style `cn()` without adding a dependency. */
export function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}
