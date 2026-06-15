/** Format a dollar amount as $X,XXX with no decimals. */
export function money(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('en-US')
}
