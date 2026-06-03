/** Simple className merger — avoids adding clsx/tailwind-merge as a dep */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
