import { describe, expect, it } from 'vitest';
import { direction8, distanceParlee, indiceVers, versDirection } from './indices';

describe('indices de direction', () => {
  it('donne les huit directions (+x est, +z sud)', () => {
    expect(direction8(0, -100)).toBe('nord');
    expect(direction8(100, -100)).toBe('nord-est');
    expect(direction8(100, 0)).toBe('est');
    expect(direction8(100, 100)).toBe('sud-est');
    expect(direction8(0, 100)).toBe('sud');
    expect(direction8(-100, 100)).toBe('sud-ouest');
    expect(direction8(-100, 0)).toBe('ouest');
    expect(direction8(-100, -100)).toBe('nord-ouest');
  });

  it('range un angle proche dans la direction la plus proche', () => {
    // Aldric (x 3, z 232) : au sud du village
    expect(direction8(3, 232)).toBe('sud');
    // 20° à l'est du sud : encore « sud » ; 30° : « sud-est »
    expect(direction8(Math.sin((20 * Math.PI) / 180) * 100, Math.cos((20 * Math.PI) / 180) * 100)).toBe('sud');
    expect(direction8(Math.sin((30 * Math.PI) / 180) * 100, Math.cos((30 * Math.PI) / 180) * 100)).toBe('sud-est');
    expect(direction8(0, 0)).toBe('nord');
  });

  it('écrit « à l’est » et « au nord-ouest »', () => {
    expect(versDirection('est')).toBe('à l’est');
    expect(versDirection('ouest')).toBe('à l’ouest');
    expect(versDirection('nord-ouest')).toBe('au nord-ouest');
  });

  it('arrondit la distance comme un habitant qui parle', () => {
    expect(distanceParlee(3)).toBe(10);
    expect(distanceParlee(64)).toBe(60);
    expect(distanceParlee(232)).toBe(250);
    expect(distanceParlee(370)).toBe(350);
    expect(distanceParlee(376)).toBe(400);
  });

  it('part d’un autre point que le village', () => {
    expect(indiceVers(0, 0, { x: 0, z: 200 }).direction).toBe('nord');
  });
});
