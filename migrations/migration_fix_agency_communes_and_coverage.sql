-- =====================================================================
-- Moncolis — Synchronisation automatique des communes et zones de couverture
-- À exécuter dans le SQL Editor de Supabase
-- =====================================================================

-- 1. Mettre à jour le statut des agences actives vers APPROVED si nécessaire
UPDATE public.agencies
SET status = 'APPROVED'
WHERE status = 'active' OR status = 'ACTIVE' OR status IS NULL;

-- 2. Synchroniser les zones de couverture (coverage_zones) avec les communes
-- définies dans la grille tarifaire (commune_prices)
DO $$
DECLARE
  ag RECORD;
  communes_list TEXT[];
BEGIN
  FOR ag IN SELECT id, commune_prices FROM public.agencies WHERE commune_prices IS NOT NULL AND jsonb_array_length(commune_prices) > 0 LOOP
    SELECT ARRAY_AGG(DISTINCT elem->>'commune')
    INTO communes_list
    FROM jsonb_array_elements(ag.commune_prices) elem
    WHERE (elem->>'price')::numeric > 0 OR elem->>'commune' IS NOT NULL;

    IF communes_list IS NOT NULL AND array_length(communes_list, 1) > 0 THEN
      UPDATE public.agencies
      SET coverage_zones = communes_list
      WHERE id = ag.id;
    END IF;
  END LOOP;
END $$;
