/** Utils estilo shadcn: classnames condicionales. Base mínima compatible. */
export function cn(...partes: (string | false | null | undefined)[]): string {
  return partes.filter(Boolean).join(" ");
}
