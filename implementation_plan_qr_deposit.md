# Implémentation du Dépôt Vendeur via QR Code (Point Relais)

## Objectif
Simplifier le dépôt des colis au point relais. Si le vendeur a déjà créé le colis dans son tableau de bord, il ne devrait pas avoir à redonner toutes ses informations au point relais. À la place, le vendeur scanne le QR code du point relais pour lui attribuer le colis. Ensuite, le point relais confirme la réception et choisit l'agence.

## User Review Required
> [!IMPORTANT]
> - Étant donné qu'il s'agit d'une application web de démonstration, la "numérisation du QR code" sera simulée par une modale affichant un sélecteur de point relais (ou la possibilité d'entrer l'ID du point relais manuellement), car nous n'avons pas accès direct à la caméra d'un téléphone mobile dans ce contexte de test.
> - Le flux va fusionner la création `ColisItem` classique avec le système `VendorDeposit` récemment créé. Ou plutôt, nous allons utiliser le `ColisItem` directement pour le dépôt vendeur.

## Proposed Changes

### 1. Affichage du QR Code pour le Point Relais
#### [MODIFY] `src/app/point-relais/page.tsx`
- Ajouter un bouton/onglet "Mon QR Code" pour l'agent du point relais.
- Afficher un code QR généré (ex: avec l'ID du point relais).

### 2. Attribution par le Vendeur
#### [MODIFY] `src/app/dashboard/vendeur/page.tsx`
- Ajouter un bouton "Déposer en point relais" sur les colis au statut `Créé`.
- Ce bouton ouvre une modale demandant au vendeur de scanner le QR code du point relais (simulé par un champ de sélection d'ID de point relais).
- Lors de la validation, le colis est mis à jour : `status` passe à `En attente de confirmation relais` et `originDropPointId` est renseigné.

### 3. Réception par le Point Relais et Choix de l'Agence
#### [MODIFY] `src/app/point-relais/page.tsx`
- Mettre à jour l'onglet "Colis entrants" ou créer un onglet "Dépôts à confirmer" qui liste les colis (`ColisItem`) attribués par les vendeurs mais pas encore confirmés.
- L'agent clique sur "Confirmer la réception".
- Le colis passe au statut `Déposé en point relais` (ou `En attente de collecte`).
- L'agent peut alors "Assigner une agence" à ce colis (comme on l'a fait pour le formulaire manuel).

### 4. Code de Récupération pour le Livreur
#### [MODIFY] `src/lib/data-service.ts`
- Ajouter un champ `pickupCode` (3 lettres + 3 chiffres) généré automatiquement dès qu'un colis est déposé et assigné à une agence depuis le point relais.
#### [MODIFY] `src/app/livreur/page.tsx`
- Le livreur de l'agence choisie voit le colis assigné. Il devra présenter ce `pickupCode` (ou le scanner) pour récupérer le colis au point relais.

## Verification Plan
### Manual Verification
- Je vais ouvrir le tableau de bord vendeur, créer un colis, et utiliser la fonctionnalité "Déposer en point relais".
- Je vais ensuite me connecter en tant qu'agent point relais, voir le colis en attente, le confirmer, et assigner une agence.
- Je vais vérifier que le code de récupération (3 lettres, 3 chiffres) est bien généré.
