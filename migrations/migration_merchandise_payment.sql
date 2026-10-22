-- ============================================================
-- MIGRATION : Clarification sémantique paiement marchandise
-- Date       : 2025-10-20
-- Auteur     : Antigravity / MonColis
-- ============================================================
--
-- SÉMANTIQUE DES CHAMPS packages :
--
--   is_prepaid (BOOLEAN) :
--     • FALSE (défaut) = "Agence collecte la marchandise"
--       → Le livreur DOIT récupérer le montant de la marchandise
--         en espèces chez le client (COD marchandise).
--     • TRUE = "Client a déjà réglé la marchandise"
--       → Le livreur NE collecte PAS d'argent pour la marchandise.
--
--   paid_by_client (BOOLEAN) :
--     • TRUE (défaut) = "Client paie les frais de livraison"
--       → Le livreur collecte les frais de livraison chez le client.
--     • FALSE = "Vendeur paie les frais de livraison"
--       → Les frais sont déduits du reversement du vendeur par l'agence.
--
-- CALCUL CAISSE LIVREUR :
--   cashCollected = Σ (
--     (!is_prepaid ? prix_colis : 0) +
--     (paid_by_client ? frais_livraison : 0)
--   )  pour tous les colis livrés non encore reversés
-- ============================================================

COMMENT ON COLUMN packages.is_prepaid IS
  'TRUE = client a déjà payé la marchandise (pas de collecte par livreur). FALSE = livreur collecte le montant de la marchandise chez le client (COD marchandise).';

COMMENT ON COLUMN packages.paid_by_client IS
  'TRUE = client paie les frais de livraison à la réception (COD frais). FALSE = frais déduits du reversement vendeur par l''agence.';

CREATE INDEX IF NOT EXISTS idx_packages_is_prepaid ON packages (is_prepaid)
  WHERE is_prepaid = FALSE;

CREATE INDEX IF NOT EXISTS idx_packages_vendor_paid ON packages (vendor_paid, status)
  WHERE vendor_paid = FALSE AND status = 'Livré';
