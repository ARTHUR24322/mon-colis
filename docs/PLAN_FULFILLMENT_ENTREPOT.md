# 📦 Plan Stratégique : Système d'Entrepôt & Fulfillment (Fulfillment by MonColis)

> **Date :** 22 Octobre 2026  
> **Statut :** Planification & Conception  
> **Objectif :** Permettre aux agences de rentabiliser leur espace de stockage en vendant des emplacements aux vendeurs, et permettre aux vendeurs de stocker leurs marchandises directement chez l'agence pour des livraisons ultra-rapides sans étape de ramassage.

---

## 1. 💡 Vision Globale & Proposition de Valeur

### Le Problème Actuel
- Pour chaque vente, le livreur/l'agence doit d'abord se déplacer chez le vendeur pour récupérer le colis, puis aller livrer le client.
- Cela engendre :
  - Une perte de temps (délais de livraison allongés).
  - Des coûts et de la fatigue logistique (trajets redondants).
  - Un risque d'indisponibilité du vendeur lors du passage du livreur.

### La Solution : Le Fulfillment / Entrepôt MonColis
1. **L'Agence** met en location des espaces/emplacements dans son entrepôt (ex: par étagère, volume $m^3$, ou nombre d'articles).
2. **Le Vendeur** loue un emplacement et dépose un lot de marchandises à l'agence (réapprovisionnement groupé).
3. **À chaque vente**, le vendeur choisit les articles dans son catalogue/boutique MonColis et génère un ordre d'expédition.
4. **L'Agence** prépare le colis directement depuis son stock et part livrer le client final immédiatement.
5. **Le Stock** diminue automatiquement en temps réel et le vendeur garde une visibilité totale sur ses niveaux de marchandise.

---

## 2. 👥 Rôles & Parcours Utilisateurs

### 🏢 Côté Agence (Gestionnaire d'Entrepôt)
1. **Configuration des Emplacements :**
   - Définir le nombre d'emplacements disponibles (ex: Rayon A, Emplacement 1-10).
   - Définir la tarification (ex: 20 $/mois par emplacement ou par volume).
   - Spécifier les conditions (types de produits acceptés, poids max, dimensions max).
2. **Réception de Stock (Entrée en stock) :**
   - Réceptionner le lot déposé par le vendeur.
   - Scanner / Valider le nombre d'unités reçues et attribuer l'emplacement physique (ex: Étagère B-03).
3. **Préparation & Expédition (Picking & Packing) :**
   - Notification d'une nouvelle commande à expédier.
   - Fiche de préparation : Produit, quantité, emplacement dans l'entrepôt, coordonnées client.
   - Scan du produit à la sortie d'entrepôt pour décrémenter le stock.
   - Attribution au livreur pour livraison directe.

---

### 🛍️ Côté Vendeur (Gestionnaire de Marchandises)
1. **Location d'un Emplacement :**
   - Explorer les agences partenaires proposant du stockage (filtre par commune, prix, réputation).
   - Souscrire à un abonnement de stockage auprès de l'agence choisie.
2. **Dépôt de Stock (Inbound) :**
   - Enregistrer une liste de produits à déposer (Nom, quantité, photos, code-barres/référence).
   - Générer un bon de dépôt avec QR Code.
   - Déposer la marchandise à l'agence qui valide la réception.
3. **Gestion des Ventes & Expédition Directe :**
   - Lors d'une vente : sélection du produit et de la quantité depuis son stock en entrepôt.
   - Saisie de l'adresse du client destinataire.
   - Envoi instantané de l'ordre à l'agence sans attendre de ramassage.
4. **Suivi du Stock en Temps Réel :**
   - Tableau de bord : Quantités restantes, alertes de stock faible (ex: moins de 5 unités restantes).
   - Historique des mouvements (entrées, sorties, retours).

---

## 3. 🗄️ Architecture Données (Modèle Prévisionnel Supabase)

### Table : `agency_storage_spaces` (Offres de stockage des agences)
- `id` (UUID, PK)
- `agency_id` (FK -> profiles / agencies)
- `name` (ex: "Étagère Standard", "Box 1m³")
- `total_slots` / `available_slots` (INT)
- `price_per_month` (DECIMAL)
- `currency` (USD / CDF)
- `max_weight_per_slot` (DECIMAL)
- `is_active` (BOOLEAN)

### Table : `vendor_storage_subscriptions` (Locations vendeurs)
- `id` (UUID, PK)
- `vendor_id` (FK -> profiles)
- `storage_space_id` (FK -> agency_storage_spaces)
- `agency_id` (FK -> profiles)
- `status` ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED')
- `start_date`, `end_date`

### Table : `warehouse_inventory` (Articles stockés par vendeur)
- `id` (UUID, PK)
- `vendor_id` (FK -> profiles)
- `agency_id` (FK -> profiles)
- `product_name` (TEXT)
- `sku` / `barcode` (TEXT)
- `photo_url` (TEXT)
- `quantity_in_stock` (INT)
- `quantity_reserved` (INT, réservé pour commandes en cours)
- `shelf_location` (TEXT, ex: "Rayon A - Étage 2")
- `low_stock_threshold` (INT, seuil d'alerte)

### Table : `warehouse_stock_movements` (Traçabilité)
- `id` (UUID, PK)
- `inventory_id` (FK -> warehouse_inventory)
- `type` ('DEPOSIT', 'DISPATCH', 'RETURN', 'ADJUSTMENT')
- `quantity` (INT)
- `colis_id` (FK -> colis, optionnel, lié à l'expédition)
- `created_at`, `performed_by`

---

## 4. 🚀 Plan de Mise en Œuvre (Par Étapes)

### Phase 1 : Catalogue Stock & Dépôt
- [x] Création du modèle de données (migration SQL [migration_fulfillment_warehouse.sql](../migrations/migration_fulfillment_warehouse.sql)).
- [x] Interface Vendeur : Enregistrement de ses produits, gestion du stock et bons de dépôt avec QR Code ([VendorWarehouseTab.tsx](../src/components/vendor/VendorWarehouseTab.tsx)).
- [x] Interface Agence : Validation de l'entrée en stock, scan QR et attribution de l'emplacement ([/agence/entrepot](../src/app/agence/entrepot/page.tsx)).

### Phase 2 : Commande & Décrémentation Automatique
- [x] Dans le formulaire de création de colis côté Vendeur : option "Expédier depuis mon stock en agence" (`WAREHOUSE_FULFILLMENT`).
- [x] Sélection des articles stockés, calcul automatique du prix/poids et assignation directe de l'agence hébergeant le stock.
- [x] Réservation et décrémentation automatique du stock via l'API `/api/vendor/warehouse/dispatch`.

### Phase 3 : Picking & Expédition Agence
- [x] Vue "Préparation de commandes" dédiée pour l'agence (bons de préparation avec emplacement physique) ([/agence/entrepot](../src/app/agence/entrepot/page.tsx)).
- [x] Validation par scan QR Code pour confirmer la sortie d'entrepôt et décrémentation directe.
- [x] Remise directe au livreur sans étape de ramassage (statut `COLIS_RECUPERE_PAR_LIVREUR`).

### Phase 4 : Monétisation & Facturation
- [x] Gestion des abonnements mensuels de stockage et souscription vendeur ([/api/vendor/warehouse/subscriptions](../src/app/api/vendor/warehouse/subscriptions/route.ts), modal de location dans [VendorWarehouseTab.tsx](../src/components/vendor/VendorWarehouseTab.tsx)).
- [x] Suivi des revenus récurrents et locataires côté agence ([/api/agency/warehouse/subscriptions](../src/app/api/agency/warehouse/subscriptions/route.ts), tableau de bord dans [/agence/entrepot](../src/app/agence/entrepot/page.tsx)).
- [x] Gestion des retours colis directement réintégrés en stock rayon en agence ([/api/agency/warehouse/returns](../src/app/api/agency/warehouse/returns/route.ts)).

---

## 5. ❓ Points de Décision pour Demain

1. **Modèle de facturation :**
   - Forfait mensuel fixe par emplacement ?
   - Ou commission par article vendu / stocké ?
2. **Réapprovisionnement :**
   - Le vendeur dépose-t-il lui-même à l'agence, ou MonColis propose-t-il aussi un service de collecte groupée vers l'entrepôt ?
3. **Gestion des retours ou invendus :**
   - Si un colis est refusé par le client, retourne-t-il au stock agence ou chez le vendeur ?
