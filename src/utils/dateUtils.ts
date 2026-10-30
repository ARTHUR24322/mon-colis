/**
 * Utilitaires pour le formatage sécurisé des dates
 * Évite définitivement l'affichage de "Invalid Date".
 */

export function safeFormatDate(
  dateInput: any,
  options: {
    includeTime?: boolean;
    fallback?: string;
  } = {}
): string {
  const { includeTime = false, fallback = '—' } = options;
  if (!dateInput) return fallback;

  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return fallback;

    if (includeTime) {
      return d.toLocaleDateString('fr-FR', {
        timeZone: 'Africa/Kinshasa',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return d.toLocaleDateString('fr-FR', {
      timeZone: 'Africa/Kinshasa',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return fallback;
  }
}

export function safeFormatTime(dateInput: any, fallback: string = '—'): string {
  if (!dateInput) return fallback;
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleTimeString('fr-FR', {
      timeZone: 'Africa/Kinshasa',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return fallback;
  }
}

export function safeFormatDateTime(dateInput: any, fallback: string = '—'): string {
  return safeFormatDate(dateInput, { includeTime: true, fallback });
}
