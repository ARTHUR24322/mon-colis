import { mapPackage, DEFAULT_DROP_POINTS } from '../data-service';

// Mock du cache local
jest.mock('../data-service', () => {
  const originalModule = jest.requireActual('../data-service');
  return {
    ...originalModule,
    DEFAULT_DROP_POINTS: [
      { id: 'DP-TEST-1', name: 'Test Drop Point' }
    ]
  };
});

describe('mapPackage', () => {
  it('doit mapper correctement le status CREATED', () => {
    const rawData = {
      id: 'pkg-1',
      tracking_code: 'TRK-123',
      status: 'CREATED',
      created_at: new Date().toISOString()
    };

    const result = mapPackage(rawData);
    expect(result.status).toBe('Créé');
    expect(result.trackingCode).toBe('TRK-123');
  });

  it('doit mapper correctement le status PENDING_DROP_POINT_CONFIRMATION', () => {
    const rawData = {
      id: 'pkg-2',
      tracking_code: 'TRK-456',
      status: 'PENDING_DROP_POINT_CONFIRMATION',
      created_at: new Date().toISOString()
    };

    const result = mapPackage(rawData);
    expect(result.status).toBe('En attente de confirmation relais');
  });
});
