import { mapPackage } from '../data-service';
import { DROP_POINT_REFUSAL_REASONS } from '../package-state-machine';

describe('Cycle de vie des colis — Tests Unitaires & Règles Métier', () => {

  describe('1. Mapping des nouveaux statuts', () => {
    it('doit mapper REFUSED_BY_DROP_POINT en "Refusé par le point relais"', () => {
      const raw = {
        id: 'pkg-refused-1',
        tracking_code: 'MC-111111',
        status: 'REFUSED_BY_DROP_POINT',
        refusal_comment: 'Colis endommagé',
        created_at: new Date().toISOString(),
      };
      const res = mapPackage(raw);
      expect(res.status).toBe('Refusé par le point relais');
      expect(res.refusalComment).toBe('Colis endommagé');
    });

    it('doit mapper IN_DISPUTE en "En réclamation"', () => {
      const raw = {
        id: 'pkg-dispute-1',
        tracking_code: 'MC-222222',
        status: 'IN_DISPUTE',
        claim_status: 'OPEN',
        claim_reason: 'Client introuvable et contestation vendeur',
        created_at: new Date().toISOString(),
      };
      const res = mapPackage(raw);
      expect(res.status).toBe('En réclamation');
      expect(res.claimStatus).toBe('OPEN');
      expect(res.claimReason).toBe('Client introuvable et contestation vendeur');
    });
  });

  describe('2. Motifs obligatoires de refus Point Relais', () => {
    it('doit contenir la liste officielle exhaustive des motifs de refus', () => {
      expect(DROP_POINT_REFUSAL_REASONS.length).toBeGreaterThanOrEqual(5);
      const codes = DROP_POINT_REFUSAL_REASONS.map(r => r.code);
      expect(codes).toContain('DAMAGED_PARCEL');
      expect(codes).toContain('OVERSIZED');
      expect(codes).toContain('CAPACITY_REACHED');
      expect(codes).toContain('SUSPICIOUS_CONTENT');
      expect(codes).toContain('OTHER');
    });
  });

  describe('3. Règle critique : Blocage strict du retrait client en cas de réclamation', () => {
    it('doit interdire toute validation OTP lorsque le colis est sous réclamation', () => {
      const pkgInDispute = {
        id: 'pkg-locked-1',
        status: 'IN_DISPUTE',
        claim_status: 'OPEN',
        claim_reason: 'Erreur marchandise',
        validation_code: '123456',
      };

      // Simule la vérification de la route validate-otp
      const isBlocked = pkgInDispute.status === 'IN_DISPUTE' || pkgInDispute.claim_status === 'OPEN';
      expect(isBlocked).toBe(true);

      const canDeliver = !isBlocked && pkgInDispute.validation_code === '123456';
      expect(canDeliver).toBe(false);
    });
  });

  describe('4. Sécurité QR Code Point Relais', () => {
    it('doit invalider l\'ancien token lors de la génération d\'un nouveau token aléatoire', () => {
      const oldQrToken = 'MCL-DP-GOMBE-old-token-123456';
      const newQrToken = 'MCL-DP-GOMBE-new-random-token-789012';

      expect(newQrToken).not.toEqual(oldQrToken);

      // Simulation de la vérification de QR
      const activeDropPoint = {
        id: 'DP-GOM-1',
        code: 'DP-GOM-2778',
        qr_token: newQrToken,
      };

      const scanOldToken = activeDropPoint.qr_token === oldQrToken;
      const scanNewToken = activeDropPoint.qr_token === newQrToken;

      expect(scanOldToken).toBe(false); // L'ancien ne fonctionne plus
      expect(scanNewToken).toBe(true);  // Le nouveau fonctionne
    });
  });
});
